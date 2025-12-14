import * as vscode from "vscode";
import { GitHubSync } from "../../github/sync";
import {
  loadSettings,
  updateMainBranch,
  updateOwner,
  updateRepo,
  updateWorkBranch,
  updateZennAccount
} from "./configService";

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
    const snapshot = await loadSettings();
    const autoSyncPaused = githubSync.isAutoSyncPaused();

    quickPick.items = [
      {
        label: "$(account) サインイン状態",
        description: snapshot.accountLabel,
        detail: snapshot.repoSummary,
        run: async () => {}
      },
      {
        label: "$(person) GitHub owner を設定",
        description: snapshot.owner || "未設定（GitHub認証アカウントがデフォルト）",
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: "GitHub owner (user or organization)",
            value: snapshot.owner || snapshot.accountLabel,
            ignoreFocusOut: true
          });
          if (!value) return;
          await updateOwner(value);
        }
      },
      {
        label: "$(repo) GitHub repo を設定",
        description: snapshot.repo || "未設定",
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: "GitHub repository name for Zenn content",
            value: snapshot.repo,
            ignoreFocusOut: true
          });
          if (!value) return;
          await updateRepo(value);
        }
      },
      {
        label: "$(git-branch) main ブランチ名を設定",
        description: snapshot.mainBranch || "main",
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: "Branch to deploy articles from",
            value: snapshot.mainBranch,
            ignoreFocusOut: true
          });
          if (!value) return;
          await updateMainBranch(value);
        }
      },
      {
        label: "$(git-branch) work ブランチ名を設定",
        description: snapshot.workBranch,
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: "Work branch for auto sync",
            value: snapshot.workBranch,
            ignoreFocusOut: true
          });
          if (!value) return;
          await updateWorkBranch(value);
        }
      },
      {
        label: "$(globe) Zenn アカウントを設定",
        description: snapshot.zennAccount || "未設定（GitHub owner を使用）",
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: "zenn.dev/{username} で使うユーザー名（空欄なら GitHub owner を使用）",
            value: snapshot.zennAccount,
            ignoreFocusOut: true
          });
          if (value === undefined) return;
          await updateZennAccount(value);
        }
      },
      {
        label: autoSyncPaused ? "$(play) Auto Sync を再開" : "$(debug-pause) Auto Sync を一時停止",
        description: autoSyncPaused ? "現在: 一時停止中" : "現在: 稼働中",
        run: async () => {
          githubSync.setAutoSyncPaused(!autoSyncPaused);
          updateAutoSyncContext(githubSync.isAutoSyncPaused());
          vscode.window.showInformationMessage(
            githubSync.isAutoSyncPaused()
              ? "Auto Sync を一時停止しました。"
              : "Auto Sync を再開しました。"
          );
        }
      },
      {
        label:
          snapshot.accountLabel !== "未サインイン"
            ? "$(sign-out) GitHub からサインアウト"
            : "$(sign-in) GitHub にサインイン",
        description:
          snapshot.accountLabel !== "未サインイン"
            ? snapshot.accountLabel
            : "GitHub 認証が必要です",
        run: async () => {
          if (snapshot.accountLabel !== "未サインイン") {
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
