import * as vscode from "vscode";
import { ZennTreeDataProvider } from "./zennTreeDataProvider";
import { FsMutation, ZennFsProvider } from "./zennFsProvider";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";
import { PreviewWorkspace } from "./previewWorkspace";
import { PreviewManager } from "./previewManager";
import { isZennUri } from "./zennPath";
import { GitHubSync } from "./githubSync";
import { signInToGitHub, getOctokit, signOutFromGitHub } from "./githubAuth";
import { buildZennUrlFromDoc } from "./openOnZenn";
import { ContentCache } from "./contentCache";

export function activate(context: vscode.ExtensionContext): void {
  vscode.commands.executeCommand("setContext", "zennpad.activated", true);

  const scheme = "zenn";
  const fsProvider = new ZennFsProvider();
  const contentCache = new ContentCache(context.globalStorageUri);
  seedScaffoldContent(fsProvider, scheme);
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(scheme, fsProvider, {
      isCaseSensitive: true
    })
  );

  const treeDataProvider = new ZennTreeDataProvider(fsProvider, scheme);
  globalTreeDataProvider = treeDataProvider;
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("zennPadExplorer", treeDataProvider)
  );

  const previewWorkspace = new PreviewWorkspace(
    vscode.Uri.joinPath(context.globalStorageUri, "preview-workspace"),
    fsProvider
  );
  const previewManager = new PreviewManager(previewWorkspace, context);
  const githubSync = new GitHubSync(fsProvider);

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
  updatePreviewableContext();

  context.subscriptions.push(
    vscode.commands.registerCommand("zennpad.refresh", () => {
      githubSync
        .pullAll()
        .then(() => treeDataProvider.refresh())
        .then(() => vscode.window.showInformationMessage("Zenn content refreshed from GitHub"))
        .catch((error) => handleAuthError(error, "refresh from GitHub"));
    }),
    vscode.commands.registerCommand("zennpad.newArticle", async () => {
      await createArticle(fsProvider, treeDataProvider, scheme);
      updatePreviewableContext();
    }),
    vscode.commands.registerCommand("zennpad.newBook", async () => {
      await createBook(fsProvider, treeDataProvider, scheme);
    }),
    vscode.commands.registerCommand("zennpad.newChapter", async () => {
      await createChapter(fsProvider, treeDataProvider, scheme);
    }),
    vscode.commands.registerCommand("zennpad.preview", async () => {
      const active = vscode.window.activeTextEditor?.document;
      if (!active) {
        vscode.window.showWarningMessage("No active editor to preview.");
        return;
      }
      await previewWorkspace.syncDocument(active);
      await previewManager.open(active);
      updatePreviewableContext();
    }),
    vscode.commands.registerCommand("zennpad.publish", async () => {
      await updatePublishedFlag(true);
    }),
    vscode.commands.registerCommand("zennpad.unpublish", async () => {
      await updatePublishedFlag(false);
    }),
    vscode.commands.registerCommand("zennpad.openOnZenn", async () => {
      await openOnZenn();
    }),
    vscode.commands.registerCommand("zennpad.signIn", async () => {
      try {
        await signInToGitHub();
        await updateAuthStatus();
        const repo = getRepoConfigSummary();
        vscode.window.showInformationMessage(`Signed in to GitHub for ZennPad${repo ? ` (${repo})` : ""}.`);
      } catch (error) {
        handleAuthError(error, "sign-in");
      }
    }),
    vscode.commands.registerCommand("zennpad.signOut", async () => {
      await signOutFromGitHub();
      await updateAuthStatus();
      vscode.window.showInformationMessage("Signed out from GitHub for ZennPad.");
    }),
    vscode.commands.registerCommand("zennpad.openSettings", async () => {
      await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:ackkerman.zennpad");
    }),
    vscode.commands.registerCommand("zennpad.authHelp", async () => {
      const selection = await vscode.window.showInformationMessage(
        "Authenticate ZennPad with GitHub to sync articles/books.",
        "Sign in to GitHub",
        "Sign out",
        "Open Settings"
      );
      if (selection === "Sign in to GitHub") {
        await vscode.commands.executeCommand("zennpad.signIn");
      } else if (selection === "Sign out") {
        await vscode.commands.executeCommand("zennpad.signOut");
      } else if (selection === "Open Settings") {
        await vscode.commands.executeCommand("zennpad.openSettings");
      }
    }),
    vscode.commands.registerCommand("zennpad.openZennRoot", async () => {
      const config = vscode.workspace.getConfiguration("zennpad");
      const owner = config.get<string>("githubOwner")?.trim();
      if (!owner) {
        vscode.window.showErrorMessage("Set zennpad.githubOwner to open Zenn.");
        return;
      }
      void vscode.env.openExternal(vscode.Uri.parse(`https://zenn.dev/${owner}`));
    }),
    vscode.commands.registerCommand("zennpad.openGithubRoot", async () => {
      const config = vscode.workspace.getConfiguration("zennpad");
      const owner = config.get<string>("githubOwner")?.trim();
      const repo = config.get<string>("githubRepo")?.trim();
      const branch = config.get<string>("githubBranch")?.trim() || "main";
      if (!owner || !repo) {
        vscode.window.showErrorMessage("Set zennpad.githubOwner and zennpad.githubRepo to open GitHub.");
        return;
      }
      void vscode.env.openExternal(vscode.Uri.parse(`https://github.com/${owner}/${repo}/tree/${branch}`));
    }),
    vscode.commands.registerCommand("zennpad.chooseRepo", async () => {
      try {
        const octokit = await getOctokit();
        const user = await octokit.rest.users.getAuthenticated();
        const login = user.data.login;
        const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
          per_page: 100,
          affiliation: "owner"
        });
        const pick = await vscode.window.showQuickPick(
          repos.map((repo) => ({
            label: repo.name,
            description: repo.private ? `${login} (private)` : `${login} (public)`
          })),
          { placeHolder: "Select a GitHub repository for Zenn content" }
        );
        if (!pick) {
          return;
        }
        const config = vscode.workspace.getConfiguration("zennpad");
        await config.update("githubOwner", login, vscode.ConfigurationTarget.Global);
        await config.update("githubRepo", pick.label, vscode.ConfigurationTarget.Global);
        await updateAuthStatus();
        await githubSync.pullAll();
        treeDataProvider.refresh();
        vscode.window.showInformationMessage(`Repository set to ${login}/${pick.label}`);
      } catch (error) {
        handleAuthError(error, "choose repository");
      }
    }),
    vscode.commands.registerCommand("zennpad.linkCopy", async () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (!doc || !isZennUri(doc.uri)) {
        vscode.window.showWarningMessage("Open a ZennPad file to copy its Zenn link.");
        return;
      }
      const url = buildZennUrlFromDoc(doc);
      if (!url) {
        vscode.window.showErrorMessage("Could not determine Zenn URL for this file.");
        return;
      }
      await vscode.env.clipboard.writeText(url);
      vscode.window.showInformationMessage("Copied Zenn article link to clipboard.");
    }),
    vscode.commands.registerCommand("zennpad.copyZennUrl", async (resource?: vscode.Uri) => {
      await copyZennUrl(resource);
    }),
    vscode.commands.registerCommand("zennpad.copyGithubUrl", async (resource?: vscode.Uri) => {
      await copyGithubUrl(resource);
    }),
    vscode.commands.registerCommand("zennpad.renameNode", async (resource?: vscode.Uri) => {
      await renameNode(resource, fsProvider, treeDataProvider);
    }),
    vscode.commands.registerCommand("zennpad.duplicateNode", async (resource?: vscode.Uri) => {
      await duplicateNode(resource, fsProvider, treeDataProvider);
    }),
    vscode.commands.registerCommand("zennpad.deleteNode", async (resource?: vscode.Uri) => {
      await deleteNode(resource, fsProvider, treeDataProvider);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (isZennUri(document.uri)) {
        await previewWorkspace.syncDocument(document);
      }
    }),
    fsProvider.onDidMutate(async (mutation: FsMutation) => {
      await previewWorkspace.applyMutation(mutation);
      try {
        await githubSync.pushMutation(mutation);
        await contentCache.save(fsProvider.snapshot());
      } catch (error) {
        handleAuthError(error, "sync with GitHub");
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => updatePreviewableContext()),
    vscode.workspace.onDidOpenTextDocument(() => updatePreviewableContext()),
    vscode.authentication.onDidChangeSessions(async (e) => {
      if (e.provider.id === "github") {
        await updateAuthStatus();
      }
    })
  );
}

export function deactivate(): void {
  // Nothing to clean up in the scaffold yet.
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
}

async function copyZennUrl(resource?: vscode.Uri | { resourceUri?: vscode.Uri }): Promise<void> {
  const uri = resolveResourceUri(resource) ?? vscode.window.activeTextEditor?.document?.uri;
  if (!uri || !isZennUri(uri)) {
    vscode.window.showWarningMessage("Open a ZennPad file to copy its Zenn URL.");
    return;
  }
  const doc = await vscode.workspace.openTextDocument(uri);
  const url = buildZennUrlFromDoc(doc);
  if (!url) {
    vscode.window.showErrorMessage("Could not determine Zenn URL for this file.");
    return;
  }
  await vscode.env.clipboard.writeText(url);
  vscode.window.showInformationMessage("Copied Zenn URL to clipboard.");
}

async function copyGithubUrl(resource?: vscode.Uri | { resourceUri?: vscode.Uri }): Promise<void> {
  const uri = resolveResourceUri(resource) ?? vscode.window.activeTextEditor?.document?.uri;
  if (!uri || !isZennUri(uri)) {
    vscode.window.showWarningMessage("Open a ZennPad file to copy its GitHub URL.");
    return;
  }
  const config = vscode.workspace.getConfiguration("zennpad");
  const owner = config.get<string>("githubOwner")?.trim();
  const repo = config.get<string>("githubRepo")?.trim();
  const branch = config.get<string>("githubBranch")?.trim() || "main";
  if (!owner || !repo) {
    vscode.window.showErrorMessage("Set zennpad.githubOwner and zennpad.githubRepo to copy GitHub URL.");
    return;
  }
  const path = uri.path.startsWith("/") ? uri.path.slice(1) : uri.path;
  const url = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
  await vscode.env.clipboard.writeText(url);
  vscode.window.showInformationMessage("Copied GitHub URL to clipboard.");
}

async function renameNode(
  resource: vscode.Uri | { resourceUri?: vscode.Uri } | undefined,
  fsProvider: ZennFsProvider,
  treeDataProvider: ZennTreeDataProvider
): Promise<void> {
  const uri = resolveResourceUri(resource) ?? vscode.window.activeTextEditor?.document?.uri;
  if (!uri || !isZennUri(uri)) {
    vscode.window.showWarningMessage("Select a ZennPad item to rename.");
    return;
  }
  const segments = uri.path.split("/");
  const currentName = segments.pop() ?? "";
  const basePath = segments.join("/");
  const input = await vscode.window.showInputBox({
    prompt: "Enter new file name (with .md)",
    value: currentName,
    ignoreFocusOut: true
  });
  if (!input || input === currentName) {
    return;
  }
  const newUri = vscode.Uri.from({ scheme: uri.scheme, path: `${basePath}/${input}` });
  try {
    fsProvider.rename(uri, newUri, { overwrite: false });
    treeDataProvider.refresh();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`[ZennPad] Rename failed: ${message}`);
  }
}

async function duplicateNode(
  resource: vscode.Uri | { resourceUri?: vscode.Uri } | undefined,
  fsProvider: ZennFsProvider,
  treeDataProvider: ZennTreeDataProvider
): Promise<void> {
  const uri = resolveResourceUri(resource) ?? vscode.window.activeTextEditor?.document?.uri;
  if (!uri || !isZennUri(uri)) {
    vscode.window.showWarningMessage("Select a ZennPad item to duplicate.");
    return;
  }
  let targetContent: Uint8Array;
  try {
    targetContent = fsProvider.readFile(uri);
  } catch (error) {
    vscode.window.showErrorMessage(`[ZennPad] Duplicate failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  const segments = uri.path.split("/");
  const filename = segments.pop() ?? "";
  const basePath = segments.join("/");
  const candidate = filename.replace(/\.md$/, "");
  const newName = `${candidate}-copy.md`;
  const newUri = vscode.Uri.from({ scheme: uri.scheme, path: `${basePath}/${newName}` });
  try {
    fsProvider.writeFile(newUri, targetContent, { create: true, overwrite: false });
    treeDataProvider.refresh();
    const document = await vscode.workspace.openTextDocument(newUri);
    await vscode.window.showTextDocument(document);
  } catch (error) {
    vscode.window.showErrorMessage(`[ZennPad] Duplicate failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function deleteNode(
  resource: vscode.Uri | { resourceUri?: vscode.Uri } | undefined,
  fsProvider: ZennFsProvider,
  treeDataProvider: ZennTreeDataProvider
): Promise<void> {
  const uri = resolveResourceUri(resource) ?? vscode.window.activeTextEditor?.document?.uri;
  if (!uri || !isZennUri(uri)) {
    vscode.window.showWarningMessage("Select a ZennPad item to delete.");
    return;
  }
  const confirm = await vscode.window.showWarningMessage(
    `Delete ${uri.path}? This cannot be undone.`,
    { modal: true },
    "Delete"
  );
  if (confirm !== "Delete") {
    return;
  }
  try {
    fsProvider.delete(uri, { recursive: true });
    treeDataProvider.refresh();
  } catch (error) {
    vscode.window.showErrorMessage(`[ZennPad] Delete failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function resolveResourceUri(resource?: vscode.Uri | { resourceUri?: vscode.Uri }): vscode.Uri | undefined {
  if (!resource) {
    return undefined;
  }
  if (resource instanceof vscode.Uri) {
    return resource;
  }
  if ("resourceUri" in resource && resource.resourceUri instanceof vscode.Uri) {
    return resource.resourceUri;
  }
  return undefined;
}

async function createArticle(fsProvider: ZennFsProvider, treeDataProvider: ZennTreeDataProvider, scheme: string): Promise<void> {
  const title = await vscode.window.showInputBox({
    prompt: "Enter article title (optional)",
    placeHolder: "My first Zenn article",
    ignoreFocusOut: true
  });
  const slug = buildArticleSlug(title);
  const path = `/articles/${slug}.md`;
  const uri = vscode.Uri.from({ scheme, path });
  const content = serializeFrontmatter(
    { title: title ?? "", emoji: "😸", type: "tech", topics: [], published: false },
    "\n"
  );
  fsProvider.writeFile(uri, Buffer.from(content), { create: true, overwrite: true });
  treeDataProvider.refresh();
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
}

async function createBook(fsProvider: ZennFsProvider, treeDataProvider: ZennTreeDataProvider, scheme: string): Promise<void> {
  const title = await vscode.window.showInputBox({
    prompt: "Enter book title",
    placeHolder: "My Zenn Book",
    ignoreFocusOut: true
  });
  if (!title) {
    return;
  }
  const bookSlug = slugify(title);
  const bookRoot = vscode.Uri.from({ scheme, path: `/books/${bookSlug}` });
  fsProvider.createDirectory(bookRoot);
  const chapterPath = vscode.Uri.from({ scheme, path: `/books/${bookSlug}/chapter-1.md` });
  const content = serializeFrontmatter(
    { title: "Chapter 1", emoji: "😸", type: "tech", topics: [], published: false },
    "\n"
  );
  fsProvider.writeFile(chapterPath, Buffer.from(content), { create: true, overwrite: true });
  treeDataProvider.refresh();
  const document = await vscode.workspace.openTextDocument(chapterPath);
  await vscode.window.showTextDocument(document);
}

async function createChapter(fsProvider: ZennFsProvider, treeDataProvider: ZennTreeDataProvider, scheme: string): Promise<void> {
  const books = fsProvider.readDirectory(vscode.Uri.from({ scheme, path: "/books" })).filter(([, t]) => t === vscode.FileType.Directory);
  if (books.length === 0) {
    vscode.window.showWarningMessage("No books found. Create a book first.");
    return;
  }
  const pick = await vscode.window.showQuickPick(
    books.map(([name]) => ({ label: name })),
    { placeHolder: "Select a book to add a chapter" }
  );
  if (!pick) {
    return;
  }
  const title = await vscode.window.showInputBox({
    prompt: "Enter chapter title",
    placeHolder: "New Chapter",
    ignoreFocusOut: true
  });
  if (title === undefined) {
    return;
  }
  const slug = slugify(title || `chapter-${Date.now()}`);
  const uri = vscode.Uri.from({ scheme, path: `/books/${pick.label}/${slug}.md` });
  const content = serializeFrontmatter(
    { title: title ?? "", emoji: "😸", type: "tech", topics: [], published: false },
    "\n"
  );
  fsProvider.writeFile(uri, Buffer.from(content), { create: true, overwrite: true });
  treeDataProvider.refresh();
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
}

async function updatePublishedFlag(published: boolean): Promise<void> {
  const doc = vscode.window.activeTextEditor?.document;
  if (!doc || doc.isUntitled || !isZennUri(doc.uri)) {
    vscode.window.showWarningMessage("Open a ZennPad file to publish/unpublish.");
    return;
  }
  const parsed = parseFrontmatter(doc.getText());
  const next = { ...parsed.frontmatter, published };
  const updated = serializeFrontmatter(next, parsed.body);
  const fullRange = new vscode.Range(0, 0, doc.lineCount, 0);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(doc.uri, fullRange, updated);
  await vscode.workspace.applyEdit(edit);
  await doc.save();
  vscode.window.showInformationMessage(`Set published: ${published}`);
}

async function openOnZenn(): Promise<void> {
  const doc = vscode.window.activeTextEditor?.document;
  if (!doc || doc.isUntitled || !isZennUri(doc.uri)) {
    vscode.window.showWarningMessage("Open a ZennPad file to open on Zenn.");
    return;
  }
  const config = vscode.workspace.getConfiguration("zennpad");
  const owner = config.get<string>("githubOwner")?.trim();
  if (!owner) {
    vscode.window.showErrorMessage("Set zennpad.githubOwner to open on Zenn.");
    return;
  }
  const url = buildZennUrlFromDoc(doc);
  if (!url) {
    vscode.window.showErrorMessage("Could not determine Zenn URL for this file.");
    return;
  }
  void vscode.env.openExternal(vscode.Uri.parse(url));
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-") || `draft-${shortId()}`;
}

function buildArticleSlug(title?: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const base = title ? slugify(title) : `draft-${shortId()}`;
  return `${dateStr}_${base}`;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function updatePreviewableContext(): void {
  const active = vscode.window.activeTextEditor?.document;
  const previewable = Boolean(active && isZennUri(active.uri) && active.languageId === "markdown");
  void vscode.commands.executeCommand("setContext", "zennpad.activeTextEditorPreviewable", previewable);
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

function getRepoConfigSummary(): string | undefined {
  const config = vscode.workspace.getConfiguration("zennpad");
  const owner = config.get<string>("githubOwner")?.trim();
  const repo = config.get<string>("githubRepo")?.trim();
  const branch = config.get<string>("githubBranch")?.trim() || "main";
  if (!owner || !repo) {
    return undefined;
  }
  return `${owner}/${repo}@${branch}`;
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
