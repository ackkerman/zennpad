import * as vscode from "vscode";

export interface RepoConfig {
  owner: string;
  repo: string;
  mainBranch: string;
  workBranch: string;
}

export function getRepoConfig(): RepoConfig {
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
