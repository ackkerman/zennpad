import * as vscode from "vscode";
import { Octokit } from "@octokit/rest";
import { getOctokit } from "./auth";
import { toRelativeZennPath } from "../utils/path/zennPath";
import { FsMutation, ZennFsProvider } from "../fs/zennFsProvider";
import { SyncScheduler, type Clock } from "./syncScheduler";
import { getRepoConfig, type RepoConfig } from "./repoConfig";
import { PendingState, hashContent } from "./pendingState";
import { buildTreeEntries, ensureWorkBranch, getHeadRefs, isNotFoundError } from "./gitApi";
import { resolveGitHubFileBuffer } from "./fileContent";

const DEFAULT_DEBOUNCE_MS = 0;
const DEFAULT_MIN_INTERVAL_MS = 0;
const COMMIT_MESSAGE = "ZennPad sync";
const DEPLOY_MESSAGE = "ZennPad deploy work -> main";

export class GitHubSync {
  private pulling = false;
  private autoSyncPaused = false;
  private readonly state = new PendingState();
  private readonly scheduler: SyncScheduler;
  private readonly pendingEmitter = new vscode.EventEmitter<Set<string>>();
  readonly onPendingChange = this.pendingEmitter.event;

  constructor(
    private readonly fsProvider: ZennFsProvider,
    options?: { debounceMs?: number; minIntervalMs?: number }
  ) {
    const clock: Clock = {
      now: () => Date.now(),
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: unknown) => clearTimeout(id as NodeJS.Timeout)
    };
    this.scheduler = new SyncScheduler(
      clock,
      () => this.commitPending(),
      options?.debounceMs ?? DEFAULT_DEBOUNCE_MS,
      options?.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS
    );
  }

  async pullAll(): Promise<void> {
    const repoConfig = getRepoConfig();
    const octokit = await getOctokit();
    this.pulling = true;
    try {
      await ensureWorkBranch(octokit, repoConfig);
      await this.ensureDirectories();
      await this.pullDirectory(octokit, repoConfig, "articles", repoConfig.workBranch);
      await this.pullDirectory(octokit, repoConfig, "books", repoConfig.workBranch);
      await this.pullDirectory(octokit, repoConfig, "images", repoConfig.workBranch);
      this.notifyPendingChange();
    } finally {
      this.pulling = false;
    }
  }

  handleMutation(mutation: FsMutation): void {
    if (this.pulling) {
      return;
    }
    const updated = this.recordMutation(mutation);
    if (updated && !this.autoSyncPaused) {
      this.scheduler.markDirty();
    }
  }

  async flushPending(): Promise<boolean> {
    if (!this.state.hasPending()) {
      return false;
    }
    await this.scheduler.flushUnsafe();
    return true;
  }

  async flushPendingUnsafe(): Promise<boolean> {
    return this.flushPending();
  }

  toggleAutoSync(): boolean {
    this.autoSyncPaused = !this.autoSyncPaused;
    if (!this.autoSyncPaused && this.state.hasPending()) {
      this.scheduler.markDirty();
    }
    return this.autoSyncPaused;
  }

  isAutoSyncPaused(): boolean {
    return this.autoSyncPaused;
  }

  setAutoSyncPaused(paused: boolean): void {
    this.autoSyncPaused = paused;
    if (!paused && this.state.hasPending()) {
      this.scheduler.markDirty();
    }
  }

  hasPendingChanges(): boolean {
    return this.state.hasPending();
  }

  private recordMutation(mutation: FsMutation): boolean {
    switch (mutation.type) {
      case "write":
        return this.recordWrite(mutation.uri, mutation.content);
      case "delete":
        return this.recordDelete(mutation.uri);
      case "rename":
        return this.recordRename(mutation.oldUri, mutation.newUri);
      default:
        return false;
    }
  }

  private recordWrite(uri: vscode.Uri, content: Uint8Array): boolean {
    const path = toRelativeZennPath(uri);
    if (!path) {
      return false;
    }
    const { workBranch } = getRepoConfig();
    const hash = hashContent(content);
    const updated = this.state.recordWrite(workBranch, path, content, hash);
    if (updated) {
      this.notifyPendingChange();
    }
    return updated;
  }

  private recordDelete(uri: vscode.Uri): boolean {
    const path = toRelativeZennPath(uri);
    if (!path) {
      return false;
    }
    const updated = this.state.recordDelete(path);
    if (updated) {
      this.notifyPendingChange();
    }
    return updated;
  }

  private recordRename(oldUri: vscode.Uri, newUri: vscode.Uri): boolean {
    const oldPath = toRelativeZennPath(oldUri);
    const newPath = toRelativeZennPath(newUri);
    if (!oldPath || !newPath) {
      return false;
    }
    let newContent: Uint8Array;
    try {
      newContent = this.fsProvider.readFile(newUri);
    } catch (error) {
      console.error("[ZennPad] Failed to read renamed file", error);
      return false;
    }
    const { workBranch } = getRepoConfig();
    const hash = hashContent(newContent);
    const updated = this.state.recordRename(workBranch, oldPath, newPath, newContent, hash);
    if (updated) {
      this.notifyPendingChange();
    }
    return updated;
  }

  private async commitPending(): Promise<void> {
    if (!this.state.hasPending()) {
      return;
    }
    try {
      const repoConfig = getRepoConfig();
      const octokit = await getOctokit();
      await ensureWorkBranch(octokit, repoConfig);
      const { headSha, treeSha } = await getHeadRefs(repoConfig.workBranch, octokit, repoConfig);

      const snapshot = this.state.snapshot();
      const treeEntries = await buildTreeEntries(
        octokit,
        repoConfig,
        snapshot.writes,
        snapshot.deletes
      );
      if (treeEntries.length === 0) {
        return;
      }
      const tree = await octokit.git.createTree({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        base_tree: treeSha,
        tree: treeEntries
      });
      const commit = await octokit.git.createCommit({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        message: COMMIT_MESSAGE,
        tree: tree.data.sha,
        parents: [headSha]
      });
      await octokit.git.updateRef({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        ref: `heads/${repoConfig.workBranch}`,
        sha: commit.data.sha
      });
      this.state.applyCommitResult(repoConfig.workBranch, treeEntries, snapshot);
      this.notifyPendingChange();
    } catch (error) {
      this.scheduler.markDirty();
      console.error("[ZennPad] Failed to sync pending changes", error);
      throw error;
    }
  }

  async deployWorkToMain(): Promise<void> {
    const repoConfig = getRepoConfig();
    const octokit = await getOctokit();
    await ensureWorkBranch(octokit, repoConfig);
    try {
      await octokit.repos.merge({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        base: repoConfig.mainBranch,
        head: repoConfig.workBranch,
        commit_message: DEPLOY_MESSAGE
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new Error("指定されたブランチが存在しません。設定を確認してください。");
      }
      const status = (error as { status?: number }).status;
      if (status === 409) {
        throw new Error(
          "work → main のマージでコンフリクトが発生しました。GitHub上で解消してください。"
        );
      }
      throw error;
    }
  }

  private async pullDirectory(
    octokit: Octokit,
    repoConfig: RepoConfig,
    remotePath: string,
    branch: string
  ): Promise<void> {
    try {
      const contents = await octokit.repos.getContent({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        path: remotePath,
        ref: branch
      });
      if (!Array.isArray(contents.data)) {
        return;
      }
      for (const item of contents.data) {
        if (item.type === "file") {
          await this.pullFile(octokit, repoConfig, item.path, branch);
        } else if (item.type === "dir") {
          await this.pullDirectory(octokit, repoConfig, item.path, branch);
        }
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        return;
      }
      throw error;
    }
  }

  private async pullFile(
    octokit: Octokit,
    repoConfig: RepoConfig,
    path: string,
    branch: string
  ): Promise<void> {
    const file = await octokit.repos.getContent({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      path,
      ref: branch
    });
    const data = file.data as {
      type?: string;
      sha: string;
      content?: string | null;
      encoding?: string | null;
    };
    if (data.type !== "file") {
      return;
    }
    const buffer = await resolveGitHubFileBuffer(octokit, repoConfig, data);
    if (!buffer) {
      return;
    }
    this.state.setRemoteState(branch, path, data.sha, hashContent(buffer));
    const uri = vscode.Uri.from({ scheme: "zenn", path: `/${path}` });
    this.fsProvider.writeFile(uri, buffer, { create: true, overwrite: true });
  }

  private async ensureDirectories(): Promise<void> {
    const directories = ["/", "/articles", "/books", "/images"];
    for (const dir of directories) {
      const uri = vscode.Uri.from({ scheme: "zenn", path: dir });
      try {
        this.fsProvider.createDirectory(uri);
      } catch {
        // ignore
      }
    }
  }

  private notifyPendingChange(): void {
    this.pendingEmitter.fire(this.state.getPendingPaths());
  }
}
