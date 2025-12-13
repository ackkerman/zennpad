import * as vscode from "vscode";
import { GitHubSync } from "./githubSync";

type SettingsItem = vscode.QuickPickItem & { run: () => Promise<void> };

export async function showSettingsPanel(
  githubSync: GitHubSync,
  updateAutoSyncContext: (paused: boolean) => void
): Promise<void> {
  const quickPick = vscode.window.createQuickPick<SettingsItem>();
  quickPick.title = "ZennPad Settings";
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;

  const refreshItems = async (): Promise<void> => {
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
    const repoSummary = owner && repo ? `${owner}/${repo}@${mainBranch} (work:${workBranch})` : "リポジトリ未設定";
    const autoSyncPaused = githubSync.isAutoSyncPaused();

    quickPick.items = [
      {
        label: "$(account) サインイン状態",
        description: accountLabel,
        detail: repoSummary,
        run: async () => {}
      },
      {
        label: "$(person) GitHub owner を設定",
        description: owner || "未設定（GitHub認証アカウントがデフォルト）",
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: "GitHub owner (user or organization)",
            value: owner || accountLabel,
            ignoreFocusOut: true
          });
          if (!value) return;
          await config.update("githubOwner", value.trim(), vscode.ConfigurationTarget.Global);
        }
      },
      {
        label: "$(repo) GitHub repo を設定",
        description: repo || "未設定",
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: "GitHub repository name for Zenn content",
            value: repo,
            ignoreFocusOut: true
          });
          if (!value) return;
          await config.update("githubRepo", value.trim(), vscode.ConfigurationTarget.Global);
        }
      },
      {
        label: "$(git-branch) main ブランチ名を設定",
        description: mainBranch || "main",
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: "Branch to deploy articles from",
            value: mainBranch,
            ignoreFocusOut: true
          });
          if (!value) return;
          await config.update("githubBranch", value.trim(), vscode.ConfigurationTarget.Global);
        }
      },
      {
        label: "$(git-branch) work ブランチ名を設定",
        description: workBranch,
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: "Work branch for auto sync",
            value: workBranch,
            ignoreFocusOut: true
          });
          if (!value) return;
          await config.update("workBranch", value.trim(), vscode.ConfigurationTarget.Global);
        }
      },
      {
        label: "$(globe) Zenn アカウントを設定",
        description: zennAccount || "未設定（GitHub owner を使用）",
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: "zenn.dev/{username} で使うユーザー名（空欄なら GitHub owner を使用）",
            value: zennAccount,
            ignoreFocusOut: true
          });
          if (value === undefined) return;
          await config.update("zennAccount", value.trim(), vscode.ConfigurationTarget.Global);
        }
      },
      {
        label: autoSyncPaused ? "$(play) Auto Sync を再開" : "$(debug-pause) Auto Sync を一時停止",
        description: autoSyncPaused ? "現在: 一時停止中" : "現在: 稼働中",
        run: async () => {
          githubSync.setAutoSyncPaused(!autoSyncPaused);
          updateAutoSyncContext(githubSync.isAutoSyncPaused());
          vscode.window.showInformationMessage(
            githubSync.isAutoSyncPaused() ? "Auto Sync を一時停止しました。" : "Auto Sync を再開しました。"
          );
        }
      },
      {
        label: session ? "$(sign-out) GitHub からサインアウト" : "$(sign-in) GitHub にサインイン",
        description: session ? session.account.label : "GitHub 認証が必要です",
        run: async () => {
          if (session) {
            await vscode.commands.executeCommand("zennpad.signOut");
          } else {
            await vscode.commands.executeCommand("zennpad.signIn");
          }
        }
      },
      {
        label: "$(gear) VS Code 設定を開く",
        description: "ZennPad 設定を settings.json / UI で編集",
        run: async () => {
          await vscode.commands.executeCommand("zennpad.openSettings");
        }
      }
    ];
  };

  quickPick.onDidAccept(async () => {
    const item = quickPick.selectedItems[0];
    if (!item) return;
    quickPick.busy = true;
    try {
      await item.run();
    } finally {
      await refreshItems();
      quickPick.busy = false;
    }
  });

  quickPick.onDidHide(() => quickPick.dispose());
  await refreshItems();
  quickPick.show();
}

function getMainBranch(config: vscode.WorkspaceConfiguration): string {
  return config.get<string>("githubBranch")?.trim() || config.get<string>("mainBranch")?.trim() || "main";
}
