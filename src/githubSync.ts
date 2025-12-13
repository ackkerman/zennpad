import * as vscode from "vscode";
import { Octokit } from "@octokit/rest";
import { getOctokit } from "./githubAuth";
import { toRelativeZennPath } from "./zennPath";
import { FsMutation, ZennFsProvider } from "./zennFsProvider";

interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

interface ShaMap {
  [path: string]: string;
}

export class GitHubSync {
  private shaMap: ShaMap = {};
  private pulling = false;

  constructor(private readonly fsProvider: ZennFsProvider) {}

  async pullAll(): Promise<void> {
    const repoConfig = this.getRepoConfig();
    const octokit = await getOctokit();
    this.pulling = true;
    try {
      await this.ensureDirectories();
      await this.pullDirectory(octokit, repoConfig, "articles");
      await this.pullDirectory(octokit, repoConfig, "books");
      await this.pullDirectory(octokit, repoConfig, "images");
    } finally {
      this.pulling = false;
    }
  }

  async pushMutation(mutation: FsMutation): Promise<void> {
    if (this.pulling) {
      return;
    }
    const pathInfo = this.mutationPath(mutation);
    if (!pathInfo) {
      return;
    }
    const repoConfig = this.getRepoConfig();
    const octokit = await getOctokit();

    switch (mutation.type) {
      case "write":
        if (typeof pathInfo === "string") {
          await this.createOrUpdate(octokit, repoConfig, pathInfo, mutation.content);
        }
        break;
      case "delete":
        if (typeof pathInfo === "string") {
          await this.delete(octokit, repoConfig, pathInfo);
        }
        break;
      case "rename":
        if (typeof pathInfo !== "string") {
          await this.delete(octokit, repoConfig, pathInfo.oldPath);
          await this.createOrUpdateFromPath(octokit, repoConfig, pathInfo.newPath);
        }
        break;
    }
  }

  private mutationPath(mutation: FsMutation):
    | string
    | { oldPath: string; newPath: string }
    | null {
    switch (mutation.type) {
      case "write": {
        const relative = toRelativeZennPath(mutation.uri);
        return relative;
      }
      case "delete": {
        const relative = toRelativeZennPath(mutation.uri);
        return relative;
      }
      case "rename": {
        const oldPath = toRelativeZennPath(mutation.oldUri);
        const newPath = toRelativeZennPath(mutation.newUri);
        if (oldPath && newPath) {
          return { oldPath, newPath };
        }
        return null;
      }
    }
  }

  private async pullDirectory(
    octokit: Octokit,
    repoConfig: RepoConfig,
    remotePath: string
  ): Promise<void> {
    try {
      const contents = await octokit.repos.getContent({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        path: remotePath,
        ref: repoConfig.branch
      });
      if (!Array.isArray(contents.data)) {
        return;
      }
      for (const item of contents.data) {
        if (item.type === "file") {
          await this.pullFile(octokit, repoConfig, item.path);
        } else if (item.type === "dir") {
          await this.pullDirectory(octokit, repoConfig, item.path);
        }
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        return;
      }
      throw error;
    }
  }

  private async pullFile(octokit: Octokit, repoConfig: RepoConfig, path: string): Promise<void> {
    const file = await octokit.repos.getContent({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      path,
      ref: repoConfig.branch
    });
    if (!("content" in file.data) || !file.data.content) {
      return;
    }
    const buffer = Buffer.from(file.data.content, "base64");
    this.shaMap[path] = file.data.sha;
    const uri = vscode.Uri.from({ scheme: "zenn", path: `/${path}` });
    this.fsProvider.writeFile(uri, buffer, { create: true, overwrite: true });
  }

  private async createOrUpdate(
    octokit: Octokit,
    repoConfig: RepoConfig,
    path: string,
    content: Uint8Array
  ): Promise<void> {
    const sha = this.shaMap[path];
    const res = await octokit.repos.createOrUpdateFileContents({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      path,
      message: `Update ${path}`,
      content: Buffer.from(content).toString("base64"),
      branch: repoConfig.branch,
      sha
    });
    this.shaMap[path] = res.data.content?.sha ?? this.shaMap[path];
  }

  private async createOrUpdateFromPath(
    octokit: Octokit,
    repoConfig: RepoConfig,
    path: string
  ): Promise<void> {
    const uri = vscode.Uri.from({ scheme: "zenn", path: `/${path}` });
    const data = this.fsProvider.readFile(uri);
    await this.createOrUpdate(octokit, repoConfig, path, data);
  }

  private async delete(octokit: Octokit, repoConfig: RepoConfig, path: string): Promise<void> {
    const sha = await this.ensureSha(octokit, repoConfig, path);
    if (!sha) {
      return;
    }
    await octokit.repos.deleteFile({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      path,
      message: `Delete ${path}`,
      branch: repoConfig.branch,
      sha
    });
    delete this.shaMap[path];
  }

  private async ensureSha(octokit: Octokit, repoConfig: RepoConfig, path: string): Promise<string | undefined> {
    if (this.shaMap[path]) {
      return this.shaMap[path];
    }
    try {
      const res = await octokit.repos.getContent({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        path,
        ref: repoConfig.branch
      });
      if ("sha" in res.data) {
        this.shaMap[path] = res.data.sha;
        return res.data.sha;
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        return undefined;
      }
      throw error;
    }
    return undefined;
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
    const branch = config.get<string>("githubBranch")?.trim() || "main";
    if (!owner || !repo) {
      throw new Error("zennpad.githubOwner と zennpad.githubRepo を設定してください。");
    }
    return { owner, repo, branch };
  }
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status?: number }).status === 404
  );
}
