import * as vscode from "vscode";
import { getMainBranch } from "../../config";

export interface SettingsSnapshot {
  owner: string;
  repo: string;
  mainBranch: string;
  workBranch: string;
  zennAccount: string;
  accountLabel: string;
  repoSummary: string;
}

export async function loadSettings(): Promise<SettingsSnapshot> {
  const config = vscode.workspace.getConfiguration("zennpad");
  const owner = config.get<string>("githubOwner")?.trim() ?? "";
  const repo = config.get<string>("githubRepo")?.trim() ?? "";
  const mainBranch = getMainBranch(config);
  const workBranch = config.get<string>("workBranch")?.trim() || "zenn-work";
  const zennAccount = config.get<string>("zennAccount")?.trim() ?? "";
  const session = await vscode.authentication.getSession("github", ["repo"], {
    createIfNone: false,
    silent: true
  });
  const accountLabel = session?.account?.label ?? "未サインイン";
  const repoSummary =
    owner && repo ? `${owner}/${repo}@${mainBranch} (work:${workBranch})` : "リポジトリ未設定";
  return { owner, repo, mainBranch, workBranch, zennAccount, accountLabel, repoSummary };
}

export async function updateOwner(value: string): Promise<void> {
  const config = vscode.workspace.getConfiguration("zennpad");
  await config.update("githubOwner", value.trim(), vscode.ConfigurationTarget.Global);
}

export async function updateRepo(value: string): Promise<void> {
  const config = vscode.workspace.getConfiguration("zennpad");
  await config.update("githubRepo", value.trim(), vscode.ConfigurationTarget.Global);
}

export async function updateMainBranch(value: string): Promise<void> {
  const config = vscode.workspace.getConfiguration("zennpad");
  await config.update("githubBranch", value.trim(), vscode.ConfigurationTarget.Global);
}

export async function updateWorkBranch(value: string): Promise<void> {
  const config = vscode.workspace.getConfiguration("zennpad");
  await config.update("workBranch", value.trim(), vscode.ConfigurationTarget.Global);
}

export async function updateZennAccount(value: string): Promise<void> {
  const config = vscode.workspace.getConfiguration("zennpad");
  await config.update("zennAccount", value.trim(), vscode.ConfigurationTarget.Global);
}
