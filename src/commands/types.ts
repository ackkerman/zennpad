import * as vscode from "vscode";
import { ZennFsProvider } from "../fs/zennFsProvider";
import { ZennTreeDataProvider } from "../ui/tree/zennTreeDataProvider";
import { SortOrder } from "../ui/tree/types";
import { PreviewWorkspace } from "../preview/previewWorkspace";
import { PreviewManager } from "../preview/previewManager";
import { GitHubSync } from "../github/sync";
import { StatusBarController } from "../ui/statusBar";

export interface CommandDeps {
  fsProvider: ZennFsProvider;
  treeDataProvider: ZennTreeDataProvider;
  scheme: string;
  previewWorkspace: PreviewWorkspace;
  previewManager: PreviewManager;
  githubSync: GitHubSync;
  statusBarItem: vscode.StatusBarItem;
  statusBar: StatusBarController;
  updateAuthStatus: () => Promise<void>;
  setAutoSyncContext: (paused: boolean) => void;
  setSortOrderContext: (order: SortOrder) => void;
  handleAuthError: (error: unknown, action: string) => void;
}
