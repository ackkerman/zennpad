import * as vscode from "vscode";
import { parseFrontmatter, serializeFrontmatter } from "../utils/frontmatter";
import { ZennFsProvider } from "../fs/zennFsProvider";
import { ZennTreeDataProvider } from "../ui/tree/zennTreeDataProvider";
import { isZennUri } from "../utils/zennPath";
import { randomEmoji } from "../utils/emojiPool";
import { insertImageFromFile } from "../utils/imageInsertion";
import { buildZennUrlFromDoc } from "./openOnZenn";
import { getMainBranch, getZennOwner } from "../config";
import { CommandDeps } from "./types";

export function registerContentCommands(context: vscode.ExtensionContext, deps: CommandDeps): vscode.Disposable[] {
  const { fsProvider, treeDataProvider, scheme } = deps;
  return [
    vscode.commands.registerCommand("zennpad.newArticle", async () => {
      await createArticle(fsProvider, treeDataProvider, scheme);
      deps.setSortOrderContext(treeDataProvider.getSortOrder());
    }),
    vscode.commands.registerCommand("zennpad.newBook", async () => {
      await createBook(fsProvider, treeDataProvider, scheme);
    }),
    vscode.commands.registerCommand("zennpad.newChapter", async () => {
      await createChapter(fsProvider, treeDataProvider, scheme);
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
    vscode.commands.registerCommand("zennpad.copyPath", async (resource?: vscode.Uri) => {
      await copyPath(resource, false);
    }),
    vscode.commands.registerCommand("zennpad.copyRelativePath", async (resource?: vscode.Uri) => {
      await copyPath(resource, true);
    }),
    vscode.commands.registerCommand("zennpad.renameNode", async (resource?: vscode.Uri) => {
      await renameNode(resource, fsProvider, treeDataProvider);
    }),
    vscode.commands.registerCommand("zennpad.duplicateNode", async (resource?: vscode.Uri) => {
      await duplicateNode(resource, fsProvider, treeDataProvider);
    }),
    vscode.commands.registerCommand("zennpad.deleteNode", async (resource?: vscode.Uri) => {
      await deleteNode(resource, fsProvider, treeDataProvider);
    }),
    vscode.commands.registerCommand("zennpad.insertImageFromFile", async () => {
      await insertImageFromFile(fsProvider, scheme);
    })
  ];
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
  const branch = getMainBranch(config);
  if (!owner || !repo) {
    vscode.window.showErrorMessage("Set zennpad.githubOwner and zennpad.githubRepo to copy GitHub URL.");
    return;
  }
  const path = uri.path.startsWith("/") ? uri.path.slice(1) : uri.path;
  const url = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
  await vscode.env.clipboard.writeText(url);
  vscode.window.showInformationMessage("Copied GitHub URL to clipboard.");
}

async function copyPath(resource?: vscode.Uri | { resourceUri?: vscode.Uri }, relative = false): Promise<void> {
  const uri = resolveResourceUri(resource) ?? vscode.window.activeTextEditor?.document?.uri;
  if (!uri || !isZennUri(uri)) {
    vscode.window.showWarningMessage("Select a ZennPad item to copy its path.");
    return;
  }
  const path = relative ? uri.path.replace(/^\//, "") : uri.path;
  await vscode.env.clipboard.writeText(path);
  vscode.window.showInformationMessage(`Copied ${relative ? "relative" : "absolute"} path to clipboard.`);
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
  const candidate = filename.replace(/\\.md$/, "");
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
    { title: title ?? "", emoji: randomEmoji(), type: "tech", topics: [], published: false },
    "\\n"
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
    { title: "Chapter 1", emoji: randomEmoji(), type: "tech", topics: [], published: false },
    "\\n"
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
    { title: title ?? "", emoji: randomEmoji(), type: "tech", topics: [], published: false },
    "\\n"
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
  const owner = getZennOwner(config);
  if (!owner) {
    vscode.window.showErrorMessage("Set zennpad.githubOwner or zennpad.zennAccount to open on Zenn.");
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
