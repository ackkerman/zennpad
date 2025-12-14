import * as vscode from "vscode";

export function getMainBranch(config: vscode.WorkspaceConfiguration): string {
  return (
    config.get<string>("githubBranch")?.trim() || config.get<string>("mainBranch")?.trim() || "main"
  );
}

export function getRepoConfigSummary(): string | undefined {
  const config = vscode.workspace.getConfiguration("zennpad");
  const owner = config.get<string>("githubOwner")?.trim();
  const repo = config.get<string>("githubRepo")?.trim();
  const branch = getMainBranch(config);
  const workBranch = config.get<string>("workBranch")?.trim() || "zenn-work";
  if (!owner || !repo) {
    return undefined;
  }
  return `${owner}/${repo}@${branch} (work:${workBranch})`;
}

export function validateRepoConfig(): void {
  const config = vscode.workspace.getConfiguration("zennpad");
  const owner = config.get<string>("githubOwner")?.trim();
  const repo = config.get<string>("githubRepo")?.trim();
  const mainBranch = getMainBranch(config);
  const workBranch = config.get<string>("workBranch")?.trim() || "zenn-work";
  if (!owner || !repo) {
    vscode.window.showErrorMessage(
      "zennpad.githubOwner と zennpad.githubRepo を設定してください。"
    );
  }
  if (workBranch === mainBranch) {
    vscode.window.showWarningMessage(
      "workBranch が main と同じです。分離してデプロイ回数を抑制してください。"
    );
  }
}

export function getZennOwner(config: vscode.WorkspaceConfiguration): string | undefined {
  const owner = config.get<string>("zennAccount")?.trim();
  if (owner && owner.length > 0) {
    return owner;
  }
  return config.get<string>("githubOwner")?.trim();
}
