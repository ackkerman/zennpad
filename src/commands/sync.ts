import * as vscode from "vscode";
import { withStatusBarSpinner } from "../ui/statusBar";
import { getMainBranch } from "../config";
import { GitHubSync } from "../github/sync";
import { CommandDeps } from "./types";
import { ZennTreeDataProvider } from "../ui/tree/zennTreeDataProvider";

export function registerSyncCommands(
  context: vscode.ExtensionContext,
  deps: CommandDeps,
  treeDataProvider: ZennTreeDataProvider
): vscode.Disposable[] {
  const { githubSync, statusBarItem } = deps;
  return [
    vscode.commands.registerCommand("zennpad.refresh", () => {
      githubSync
        .pullAll()
        .then(() => treeDataProvider.refresh())
        .then(() => vscode.window.showInformationMessage("Zenn content refreshed from GitHub"))
        .catch((error) => deps.handleAuthError(error, "refresh from GitHub"));
    }),
    vscode.commands.registerCommand("zennpad.flushPendingSync", async () => {
      try {
        const ran = await githubSync.flushPending();
        if (ran) {
          vscode.window.showInformationMessage("Pending ZennPad changes flushed.");
        } else {
          vscode.window.showInformationMessage("No pending changes to flush.");
        }
      } catch (error) {
        deps.handleAuthError(error, "flush pending sync");
      }
    }),
    vscode.commands.registerCommand("zennpad.deployToZenn", async () => {
      await withStatusBarSpinner(statusBarItem, "Deploying to Zenn...", () => deployToZenn(githubSync));
    }),
    vscode.commands.registerCommand("zennpad.toggleAutoSync", async () => {
      const paused = githubSync.toggleAutoSync();
      deps.setAutoSyncContext(paused);
      vscode.window.showInformationMessage(paused ? "Auto sync paused." : "Auto sync resumed.");
    }),
    vscode.commands.registerCommand("zennpad.pauseAutoSync", async () => {
      await withStatusBarSpinner(statusBarItem, "Pausing auto sync...", async () => {
        githubSync.setAutoSyncPaused(true);
        deps.setAutoSyncContext(true);
      });
      vscode.window.showInformationMessage("Auto sync paused.");
    }),
    vscode.commands.registerCommand("zennpad.resumeAutoSync", async () => {
      await withStatusBarSpinner(statusBarItem, "Resuming auto sync...", async () => {
        githubSync.setAutoSyncPaused(false);
        deps.setAutoSyncContext(false);
      });
      vscode.window.showInformationMessage("Auto sync resumed.");
    })
  ];
}

async function deployToZenn(githubSync: GitHubSync): Promise<void> {
  const config = vscode.workspace.getConfiguration("zennpad");
  const mainBranch = getMainBranch(config);
  const workBranch = config.get<string>("workBranch")?.trim() || "zenn-work";
  const choice = await vscode.window.showWarningMessage(
    `work ブランチ (${workBranch}) の内容を main (${mainBranch}) に反映して Zenn にデプロイしますか？`,
    { modal: true },
    "Deploy"
  );
  if (choice !== "Deploy") {
    return;
  }
  try {
    await githubSync.flushPendingUnsafe();
    await githubSync.deployWorkToMain();
    vscode.window.showInformationMessage(`Deployed ${workBranch} to ${mainBranch} and pushed for Zenn.`);
  } catch (error) {
    vscode.window.showErrorMessage(`[ZennPad] Failed to deploy work branch to main: ${error}`);
  }
}
