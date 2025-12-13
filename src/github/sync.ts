import * as vscode from "vscode";
import { Octokit } from "@octokit/rest";
import { createHash } from "crypto";
import { getOctokit } from "./auth";
import { toRelativeZennPath } from "../utils/zennPath";
import { FsMutation, ZennFsProvider } from "../fs/zennFsProvider";
import { SyncScheduler, type Clock } from "./syncScheduler";

interface RepoConfig {
  owner: string;
  repo: string;
  mainBranch: string;
  workBranch: string;
}

type ShaMap = Record<string, string>;

interface PendingWrite {
  path: string;
  content: Uint8Array;
  hash: string;
}

const DEFAULT_DEBOUNCE_MS = 0;
const DEFAULT_MIN_INTERVAL_MS = 0;
const COMMIT_MESSAGE = "ZennPad sync";
const DEPLOY_MESSAGE = "ZennPad deploy work -> main";

export class GitHubSync {
  private shaMapByBranch: Map<string, ShaMap> = new Map();
  private lastHashesByBranch: Map<string, ShaMap> = new Map();
  private pulling = false;
  private pendingWrites = new Map<string, PendingWrite>();
  private pendingDeletes = new Set<string>();
  private autoSyncPaused = false;
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
    const repoConfig = this.getRepoConfig();
    const octokit = await getOctokit();
    this.pulling = true;
    try {
      await this.ensureWorkBranch(octokit, repoConfig);
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
    if (!this.hasPending()) {
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
    if (!this.autoSyncPaused && this.hasPending()) {
      this.scheduler.markDirty();
    }
    return this.autoSyncPaused;
  }

  isAutoSyncPaused(): boolean {
    return this.autoSyncPaused;
  }

  setAutoSyncPaused(paused: boolean): void {
    this.autoSyncPaused = paused;
    if (!paused && this.hasPending()) {
      this.scheduler.markDirty();
    }
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
    const { workBranch } = this.getRepoConfig();
    const hashes = this.getBranchHashMap(workBranch);
    const hash = hashContent(content);
    if (hashes[path] === hash && !this.pendingDeletes.has(path)) {
      return false;
    }
    this.pendingDeletes.delete(path);
    this.pendingWrites.set(path, { path, content, hash });
    this.notifyPendingChange();
    return true;
  }

  private recordDelete(uri: vscode.Uri): boolean {
    const path = toRelativeZennPath(uri);
    if (!path) {
      return false;
    }
    this.pendingWrites.delete(path);
    this.pendingDeletes.add(path);
    this.notifyPendingChange();
    return true;
  }

  private recordRename(oldUri: vscode.Uri, newUri: vscode.Uri): boolean {
    const oldPath = toRelativeZennPath(oldUri);
    const newPath = toRelativeZennPath(newUri);
    if (!oldPath || !newPath) {
      return false;
    }
    this.pendingWrites.delete(oldPath);
    this.pendingDeletes.add(oldPath);
    let newContent: Uint8Array;
    try {
      newContent = this.fsProvider.readFile(newUri);
    } catch (error) {
      console.error("[ZennPad] Failed to read renamed file", error);
      return false;
    }
    const hash = hashContent(newContent);
    this.pendingDeletes.delete(newPath);
    this.pendingWrites.set(newPath, { path: newPath, content: newContent, hash });
    this.notifyPendingChange();
    return true;
  }

  private hasPending(): boolean {
    return this.pendingWrites.size > 0 || this.pendingDeletes.size > 0;
  }

  hasPendingChanges(): boolean {
    return this.hasPending();
  }

  private async commitPending(): Promise<void> {
    if (!this.hasPending()) {
      return;
    }
    try {
      const repoConfig = this.getRepoConfig();
      const octokit = await getOctokit();
      await this.ensureWorkBranch(octokit, repoConfig);
      const { headSha, treeSha } = await this.getHeadRefs(repoConfig.workBranch, octokit, repoConfig);

      const writesSnapshot = Array.from(this.pendingWrites.entries());
      const deletesSnapshot = Array.from(this.pendingDeletes.values());
      const treeEntries = await this.buildTreeEntries(octokit, repoConfig, writesSnapshot, deletesSnapshot);
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
      this.applyCommitResult(treeEntries, writesSnapshot, deletesSnapshot);
      this.notifyPendingChange();
    } catch (error) {
      this.scheduler.markDirty();
      console.error("[ZennPad] Failed to sync pending changes", error);
      throw error;
    }
  }

  async deployWorkToMain(): Promise<void> {
    const repoConfig = this.getRepoConfig();
    const octokit = await getOctokit();
    await this.ensureWorkBranch(octokit, repoConfig);
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
        throw new Error("work → main のマージでコンフリクトが発生しました。GitHub上で解消してください。");
      }
      throw error;
    }
  }

  private async getHeadRefs(
    branch: string,
    octokit: Octokit,
    repoConfig: RepoConfig
  ): Promise<{ headSha: string; treeSha: string }> {
    const head = await octokit.git.getRef({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      ref: `heads/${branch}`
    });
    const headSha = head.data.object.sha;
    const commit = await octokit.git.getCommit({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      commit_sha: headSha
    });
    return { headSha, treeSha: commit.data.tree.sha };
  }

  private async buildTreeEntries(
    octokit: Octokit,
    repoConfig: RepoConfig,
    writesSnapshot: Array<[string, PendingWrite]>,
    deletesSnapshot: string[]
  ): Promise<Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }>> {
    const treeEntries: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }> = [];
    for (const [, write] of writesSnapshot) {
      const blob = await octokit.git.createBlob({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        content: Buffer.from(write.content).toString("base64"),
        encoding: "base64"
      });
      treeEntries.push({ path: write.path, mode: "100644", type: "blob", sha: blob.data.sha });
    }
    for (const path of deletesSnapshot) {
      treeEntries.push({ path, mode: "100644", type: "blob", sha: null });
    }
    return treeEntries;
  }

  private applyCommitResult(
    treeEntries: Array<{ path: string; sha: string | null }>,
    writesSnapshot: Array<[string, PendingWrite]>,
    deletesSnapshot: string[]
  ): void {
    const repoConfig = this.getRepoConfig();
    const shaMap = this.getBranchShaMap(repoConfig.workBranch);
    const hashes = this.getBranchHashMap(repoConfig.workBranch);
    for (const [path, write] of writesSnapshot) {
      const treeEntry = treeEntries.find((entry) => entry.path === path && entry.sha);
      if (treeEntry?.sha) {
        shaMap[path] = treeEntry.sha;
        hashes[path] = write.hash;
      }
      this.pendingWrites.delete(path);
    }
    for (const path of deletesSnapshot) {
      delete shaMap[path];
      delete hashes[path];
      this.pendingDeletes.delete(path);
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
    if (!("content" in file.data) || !file.data.content) {
      return;
    }
    const buffer = Buffer.from(file.data.content, "base64");
    const shaMap = this.getBranchShaMap(branch);
    const hashes = this.getBranchHashMap(branch);
    shaMap[path] = file.data.sha;
    hashes[path] = hashContent(buffer);
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

  private getRepoConfig(): RepoConfig {
    const config = vscode.workspace.getConfiguration("zennpad");
    const owner = config.get<string>("githubOwner")?.trim();
    const repo = config.get<string>("githubRepo")?.trim();
    const mainBranch =
      config.get<string>("githubBranch")?.trim() ||
      config.get<string>("mainBranch")?.trim() ||
      "main";
    const workBranch = config.get<string>("workBranch")?.trim() || "zenn-work";
    if (!owner || !repo) {
      throw new Error("zennpad.githubOwner と zennpad.githubRepo を設定してください。");
    }
    return { owner, repo, mainBranch, workBranch };
  }

  private notifyPendingChange(): void {
    const paths = new Set<string>();
    for (const path of this.pendingWrites.keys()) {
      paths.add(`/${path}`);
    }
    for (const path of this.pendingDeletes.values()) {
      paths.add(`/${path}`);
    }
    this.pendingEmitter.fire(paths);
  }

  private getBranchShaMap(branch: string): ShaMap {
    if (!this.shaMapByBranch.has(branch)) {
      this.shaMapByBranch.set(branch, {});
    }
    return this.shaMapByBranch.get(branch)!;
  }

  private getBranchHashMap(branch: string): ShaMap {
    if (!this.lastHashesByBranch.has(branch)) {
      this.lastHashesByBranch.set(branch, {});
    }
    return this.lastHashesByBranch.get(branch)!;
  }

  private async ensureWorkBranch(octokit: Octokit, repoConfig: RepoConfig): Promise<void> {
    try {
      await octokit.git.getRef({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        ref: `heads/${repoConfig.workBranch}`
      });
      return;
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
    // Create work branch from main if missing
    const mainHead = await octokit.git.getRef({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      ref: `heads/${repoConfig.mainBranch}`
    });
    await octokit.git.createRef({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      ref: `refs/heads/${repoConfig.workBranch}`,
      sha: mainHead.data.object.sha
    });
  }
}

function hashContent(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status?: number }).status === 404
  );
}
