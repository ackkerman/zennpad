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
  const strings = localizedStrings(vscode.env.language ?? "en");
  quickPick.title = strings.title;
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;

  const refreshItems = async (): Promise<void> => {
    const snapshot = await loadSettings();
    const autoSyncPaused = githubSync.isAutoSyncPaused();

    quickPick.items = [
      {
        label: strings.signInStatus,
        description: snapshot.accountLabel,
        detail: snapshot.repoSummary,
        run: async () => {}
      },
      {
        label: strings.setOwner,
        description: snapshot.owner || strings.ownerUnset,
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: strings.ownerPrompt,
            value: snapshot.owner || snapshot.accountLabel,
            ignoreFocusOut: true
          });
          if (!value) return;
          await updateOwner(value);
        }
      },
      {
        label: strings.setRepo,
        description: snapshot.repo || strings.repoUnset,
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: strings.repoPrompt,
            value: snapshot.repo,
            ignoreFocusOut: true
          });
          if (!value) return;
          await updateRepo(value);
        }
      },
      {
        label: strings.setMainBranch,
        description: snapshot.mainBranch || strings.mainBranchDefault,
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: strings.mainBranchPrompt,
            value: snapshot.mainBranch,
            ignoreFocusOut: true
          });
          if (!value) return;
          await updateMainBranch(value);
        }
      },
      {
        label: strings.setWorkBranch,
        description: snapshot.workBranch,
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: strings.workBranchPrompt,
            value: snapshot.workBranch,
            ignoreFocusOut: true
          });
          if (!value) return;
          await updateWorkBranch(value);
        }
      },
      {
        label: strings.setZennAccount,
        description: snapshot.zennAccount || strings.zennAccountUnset,
        run: async () => {
          const value = await vscode.window.showInputBox({
            prompt: strings.zennAccountPrompt,
            value: snapshot.zennAccount,
            ignoreFocusOut: true
          });
          if (value === undefined) return;
          await updateZennAccount(value);
        }
      },
      {
        label: autoSyncPaused ? strings.autoSyncResume : strings.autoSyncPause,
        description: autoSyncPaused ? strings.autoSyncPaused : strings.autoSyncRunning,
        run: async () => {
          githubSync.setAutoSyncPaused(!autoSyncPaused);
          updateAutoSyncContext(githubSync.isAutoSyncPaused());
          vscode.window.showInformationMessage(
            githubSync.isAutoSyncPaused() ? strings.autoSyncPausedMsg : strings.autoSyncResumedMsg
          );
        }
      },
      {
        label:
          snapshot.accountLabel !== strings.signedOutLabel
            ? strings.signOut
            : strings.signIn,
        description:
          snapshot.accountLabel !== strings.signedOutLabel
            ? snapshot.accountLabel
            : strings.signInRequired,
        run: async () => {
          if (snapshot.accountLabel !== strings.signedOutLabel) {
            await vscode.commands.executeCommand("zennpad.signOut");
          } else {
            await vscode.commands.executeCommand("zennpad.signIn");
          }
        }
      },
      {
        label: strings.openSettings,
        description: strings.openSettingsDesc,
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

function localizedStrings(locale: string): {
  title: string;
  signInStatus: string;
  setOwner: string;
  ownerUnset: string;
  ownerPrompt: string;
  setRepo: string;
  repoUnset: string;
  repoPrompt: string;
  setMainBranch: string;
  mainBranchDefault: string;
  mainBranchPrompt: string;
  setWorkBranch: string;
  workBranchPrompt: string;
  setZennAccount: string;
  zennAccountUnset: string;
  zennAccountPrompt: string;
  autoSyncPause: string;
  autoSyncResume: string;
  autoSyncPaused: string;
  autoSyncRunning: string;
  autoSyncPausedMsg: string;
  autoSyncResumedMsg: string;
  signOut: string;
  signIn: string;
  signInRequired: string;
  signedOutLabel: string;
  openSettings: string;
  openSettingsDesc: string;
} {
  const lang = (locale || "en").toLowerCase();
  if (lang.startsWith("ja")) {
    return {
      title: "ZennPad 設定",
      signInStatus: "$(account) サインイン状態",
      setOwner: "$(person) GitHub owner を設定",
      ownerUnset: "未設定（GitHub認証アカウントがデフォルト）",
      ownerPrompt: "GitHub owner (user or organization)",
      setRepo: "$(repo) GitHub repo を設定",
      repoUnset: "未設定",
      repoPrompt: "GitHub repository name for Zenn content",
      setMainBranch: "$(git-branch) main ブランチ名を設定",
      mainBranchDefault: "main",
      mainBranchPrompt: "Branch to deploy articles from",
      setWorkBranch: "$(git-branch) work ブランチ名を設定",
      workBranchPrompt: "Work branch for auto sync",
      setZennAccount: "$(globe) Zenn アカウントを設定",
      zennAccountUnset: "未設定（GitHub owner を使用）",
      zennAccountPrompt: "zenn.dev/{username} で使うユーザー名（空欄なら GitHub owner を使用）",
      autoSyncPause: "$(debug-pause) Auto Sync を一時停止",
      autoSyncResume: "$(play) Auto Sync を再開",
      autoSyncPaused: "現在: 一時停止中",
      autoSyncRunning: "現在: 稼働中",
      autoSyncPausedMsg: "Auto Sync を一時停止しました。",
      autoSyncResumedMsg: "Auto Sync を再開しました。",
      signOut: "$(sign-out) GitHub からサインアウト",
      signIn: "$(sign-in) GitHub にサインイン",
      signInRequired: "GitHub 認証が必要です",
      signedOutLabel: "未サインイン",
      openSettings: "$(gear) VS Code 設定を開く",
      openSettingsDesc: "ZennPad 設定を settings.json / UI で編集"
    };
  }
  return {
    title: "ZennPad Settings",
    signInStatus: "$(account) Sign-in status",
    setOwner: "$(person) Set GitHub owner",
    ownerUnset: "Not set (default to signed-in account)",
    ownerPrompt: "GitHub owner (user or organization)",
    setRepo: "$(repo) Set GitHub repo",
    repoUnset: "Not set",
    repoPrompt: "GitHub repository name for Zenn content",
    setMainBranch: "$(git-branch) Set main branch",
    mainBranchDefault: "main",
    mainBranchPrompt: "Branch to deploy articles from",
    setWorkBranch: "$(git-branch) Set work branch",
    workBranchPrompt: "Work branch for auto sync",
    setZennAccount: "$(globe) Set Zenn account",
    zennAccountUnset: "Not set (use GitHub owner)",
    zennAccountPrompt: "zenn.dev/{username}; empty to use GitHub owner",
    autoSyncPause: "$(debug-pause) Pause Auto Sync",
    autoSyncResume: "$(play) Resume Auto Sync",
    autoSyncPaused: "Status: paused",
    autoSyncRunning: "Status: running",
    autoSyncPausedMsg: "Auto Sync paused.",
    autoSyncResumedMsg: "Auto Sync resumed.",
    signOut: "$(sign-out) Sign out of GitHub",
    signIn: "$(sign-in) Sign in to GitHub",
    signInRequired: "GitHub authentication is required",
    signedOutLabel: "Signed out",
    openSettings: "$(gear) Open VS Code settings",
    openSettingsDesc: "Edit ZennPad settings via settings UI / JSON"
  };
}
