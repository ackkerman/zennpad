import * as vscode from "vscode";
import { ZennTreeDataProvider } from "./ui/tree/zennTreeDataProvider";
import { FsMutation, ZennFsProvider } from "./fs/zennFsProvider";
import { PreviewWorkspace } from "./preview/previewWorkspace";
import { PreviewManager } from "./preview/previewManager";
import { isZennUri } from "./utils/path/zennPath";
import { GitHubSync } from "./github/sync";
import { ContentCache } from "./utils/contentCache";
import { registerImageInsertionProviders } from "./ui/imageInsertion";
import { registerCommands } from "./commands/registerCommands";
import { setAutoSyncContext, setSortOrderContext, updateActiveDocumentContext } from "./context";
import { getMainBranch, getRepoConfigSummary, getZennOwner, validateRepoConfig } from "./config";
import { StatusBarController } from "./ui/statusBar";

export function activate(context: vscode.ExtensionContext): void {
  vscode.commands.executeCommand("setContext", "zennpad.activated", true);

  const scheme = "zenn";
  const fsProvider = new ZennFsProvider();
  let contentCache = new ContentCache(context.globalStorageUri, buildCacheNamespace());
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  const statusBar = new StatusBarController(statusBarItem);
  context.subscriptions.push(statusBarItem);
  seedScaffoldContent(fsProvider, scheme);
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(scheme, fsProvider, {
      isCaseSensitive: true
    })
  );

  const treeDataProvider = new ZennTreeDataProvider(fsProvider, context.extensionUri, scheme);
  globalTreeDataProvider = treeDataProvider;
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("zennPadExplorer", treeDataProvider)
  );
  setSortOrderContext(treeDataProvider.getSortOrder());
  applyBranchInfo(treeDataProvider);
  validateRepoConfig();

  const previewWorkspace = new PreviewWorkspace(
    vscode.Uri.joinPath(context.globalStorageUri, "preview-workspace"),
    fsProvider
  );
  const previewManager = new PreviewManager(previewWorkspace, context);
  globalPreviewManager = previewManager;
  const githubSync = new GitHubSync(fsProvider);
  setAutoSyncContext(githubSync.isAutoSyncPaused());
  githubSync.onPendingChange((paths) => {
    treeDataProvider.setDirtyPaths(paths);
    statusBar.setPendingCount(paths.size);
  });
  registerImageInsertionProviders(context, fsProvider, scheme);

  void (async () => {
    await updateAuthStatus();
    const cached = await contentCache.load();
    if (cached) {
      fsProvider.hydrate(
        cached.map((entry) => ({
          ...entry,
          type: entry.type as vscode.FileType
        }))
      );
      treeDataProvider.refresh();
    }
    try {
      await githubSync.pullAll();
      treeDataProvider.refresh();
      await contentCache.save(fsProvider.snapshot());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showWarningMessage(`[ZennPad] GitHub sync skipped: ${message}`);
    }
  })();
  updateActiveDocumentContext();

  registerCommands(context, {
    fsProvider,
    treeDataProvider,
    scheme,
    previewWorkspace,
    previewManager,
    githubSync,
    statusBarItem,
    statusBar,
    updateAuthStatus,
    setAutoSyncContext,
    setSortOrderContext,
    handleAuthError
  });

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (isZennUri(document.uri)) {
        await previewWorkspace.syncDocument(document);
      }
    }),
    fsProvider.onDidMutate(async (mutation: FsMutation) => {
      await previewWorkspace.applyMutation(mutation);
      githubSync.handleMutation(mutation);
      try {
        await contentCache.save(fsProvider.snapshot());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showWarningMessage(`[ZennPad] Failed to persist cache: ${message}`);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => updateActiveDocumentContext()),
    vscode.workspace.onDidOpenTextDocument(() => updateActiveDocumentContext()),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        updateActiveDocumentContext(event.document);
      }
    }),
    vscode.authentication.onDidChangeSessions(async (e) => {
      if (e.provider.id === "github") {
        await updateAuthStatus();
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("zennpad")) {
        applyBranchInfo(treeDataProvider);
        validateRepoConfig();
        updateStatusBar(statusBar, githubSync);
        // reload cache with new namespace on config changes
        contentCache = new ContentCache(context.globalStorageUri, buildCacheNamespace());
        updateActiveDocumentContext();
      }
    })
  );

  updateStatusBar(statusBar, githubSync);
}

export function deactivate(): void {
  globalPreviewManager?.dispose();
}

function seedScaffoldContent(fsProvider: ZennFsProvider, scheme: string): void {
  const ensureDirectory = (path: string): void => {
    const uri = vscode.Uri.from({ scheme, path });
    try {
      fsProvider.createDirectory(uri);
    } catch {
      // Already exists or conflicts; ignore for scaffold seeding.
    }
  };

  ensureDirectory("/");
  ensureDirectory("/articles");
  ensureDirectory("/books");
  ensureDirectory("/books/example-book");
  ensureDirectory("/images");
}

function applyBranchInfo(treeDataProvider: ZennTreeDataProvider): void {
  const config = vscode.workspace.getConfiguration("zennpad");
  const mainBranch = getMainBranch(config);
  const workBranch = config.get<string>("workBranch")?.trim() || "zenn-work";
  treeDataProvider.setBranchInfo({ workBranch, mainBranch });
}

async function updateAuthStatus(): Promise<void> {
  const session = await vscode.authentication.getSession("github", ["repo"], {
    createIfNone: false,
    silent: true
  });
  const hasSession = Boolean(session);
  const hasRepoConfig = Boolean(getRepoConfigSummary());
  void vscode.commands.executeCommand("setContext", "zennpad.isSignedIn", hasSession);
  void vscode.commands.executeCommand("setContext", "zennpad.hasRepoConfig", hasRepoConfig);
  globalTreeDataProvider?.setStatus({ signedIn: hasSession, hasRepoConfig });
}

function handleAuthError(error: unknown, action: string): void {
  const status = (error as { status?: number }).status;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 409) {
    void vscode.window
      .showErrorMessage(`[ZennPad] Conflict detected while trying to ${action}.`, "Refresh from GitHub")
      .then((choice) => {
        if (choice === "Refresh from GitHub") {
          void vscode.commands.executeCommand("zennpad.refresh");
        }
      });
    return;
  }
  if (status === 401 || status === 403) {
    void vscode.window
      .showErrorMessage(`[ZennPad] GitHub authentication required to ${action}.`, "Sign in", "Open Settings")
      .then((choice) => {
        if (choice === "Sign in") {
          void vscode.commands.executeCommand("zennpad.signIn");
        } else if (choice === "Open Settings") {
          void vscode.commands.executeCommand("zennpad.openSettings");
        }
      });
    return;
  }
  vscode.window.showErrorMessage(`[ZennPad] Failed to ${action}: ${message}`);
}

let globalTreeDataProvider: ZennTreeDataProvider | undefined;
let globalPreviewManager: PreviewManager | undefined;

function buildCacheNamespace(): string {
  const config = vscode.workspace.getConfiguration("zennpad");
  const owner = config.get<string>("githubOwner")?.trim() ?? "default";
  const repo = config.get<string>("githubRepo")?.trim() ?? "workspace";
  const mainBranch = getMainBranch(config);
  const workBranch = config.get<string>("workBranch")?.trim() || "zenn-work";
  return `${owner}_${repo}_${mainBranch}_${workBranch}`;
}

function updateStatusBar(statusBar: StatusBarController, githubSync: GitHubSync): void {
  const config = vscode.workspace.getConfiguration("zennpad");
  statusBar.setRepoSummary(getRepoConfigSummary(), getZennOwner(config));
  statusBar.setAutoSyncPaused(githubSync.isAutoSyncPaused());
}
