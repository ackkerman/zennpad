import * as vscode from "vscode";
import { ZennFsProvider } from "../fs/zennFsProvider";
import { ZennTreeDataProvider, SortOrder } from "../ui/tree/zennTreeDataProvider";
import { PreviewWorkspace } from "../preview/previewWorkspace";
import { PreviewManager } from "../preview/previewManager";
import { GitHubSync } from "../github/sync";

export interface CommandDeps {
  fsProvider: ZennFsProvider;
  treeDataProvider: ZennTreeDataProvider;
  scheme: string;
  previewWorkspace: PreviewWorkspace;
  previewManager: PreviewManager;
  githubSync: GitHubSync;
  statusBarItem: vscode.StatusBarItem;
  updateAuthStatus: () => Promise<void>;
  setAutoSyncContext: (paused: boolean) => void;
  setSortOrderContext: (order: SortOrder) => void;
  handleAuthError: (error: unknown, action: string) => void;
}
