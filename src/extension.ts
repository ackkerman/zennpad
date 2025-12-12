import * as vscode from "vscode";
import { ZennTreeDataProvider } from "./zennTreeDataProvider";
import { FsMutation, ZennFsProvider } from "./zennFsProvider";
import { serializeFrontmatter } from "./frontmatter";
import { PreviewWorkspace } from "./previewWorkspace";
import { PreviewManager } from "./previewManager";
import { isZennUri } from "./zennPath";

export function activate(context: vscode.ExtensionContext): void {
  const scheme = "zenn";
  const fsProvider = new ZennFsProvider();
  seedScaffoldContent(fsProvider, scheme);
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(scheme, fsProvider, {
      isCaseSensitive: true
    })
  );

  const treeDataProvider = new ZennTreeDataProvider(fsProvider, scheme);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("zennPadExplorer", treeDataProvider)
  );

  const previewWorkspace = new PreviewWorkspace(
    vscode.Uri.joinPath(context.globalStorageUri, "preview-workspace"),
    fsProvider
  );
  const previewManager = new PreviewManager(previewWorkspace, context);

  context.subscriptions.push(
    vscode.commands.registerCommand("zennpad.refresh", () => {
      treeDataProvider.refresh();
      vscode.window.showInformationMessage("Zenn content refreshed (scaffold)");
    }),
    vscode.commands.registerCommand("zennpad.newArticle", async () => {
      const uri = vscode.Uri.parse(`${scheme}:/articles/${Date.now()}_draft.md`);
      const initialContent = Buffer.from(
        serializeFrontmatter(
          { title: "", emoji: "😸", type: "tech", topics: [], published: false },
          "Write your article here.\n"
        )
      );
      fsProvider.writeFile(uri, initialContent, { create: true, overwrite: true });
      treeDataProvider.refresh();
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    }),
    vscode.commands.registerCommand("zennpad.preview", async () => {
      const active = vscode.window.activeTextEditor?.document;
      if (!active) {
        vscode.window.showWarningMessage("No active editor to preview.");
        return;
      }
      await previewWorkspace.syncDocument(active);
      await previewManager.open(active);
    }),
    vscode.commands.registerCommand("zennpad.publish", () => {
      vscode.window.showInformationMessage("Publish command triggered (scaffold)");
    }),
    vscode.commands.registerCommand("zennpad.unpublish", () => {
      vscode.window.showInformationMessage("Unpublish command triggered (scaffold)");
    }),
    vscode.commands.registerCommand("zennpad.openOnZenn", () => {
      vscode.window.showInformationMessage("Open on Zenn command triggered (scaffold)");
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

  const seedFile = (path: string, content: string): void => {
    const uri = vscode.Uri.from({ scheme, path });
    if (!fsProvider.has(uri)) {
      fsProvider.writeFile(uri, Buffer.from(content), { create: true, overwrite: true });
    }
  };

  seedFile(
    "/articles/sample-article.md",
    serializeFrontmatter(
      { title: "Sample Article", emoji: "😸", type: "tech", topics: ["zenn"], published: false },
      "This is a scaffold article body.\n"
    )
  );

  seedFile(
    "/articles/20240529_daily-draft.md",
    serializeFrontmatter(
      { title: "Daily Draft", emoji: "😸", type: "tech", topics: ["zenn", "daily"], published: false },
      "Start writing your daily draft here.\n"
    )
  );

  seedFile(
    "/books/example-book/chapter-1.md",
    serializeFrontmatter(
      {
        title: "Chapter 1: Getting Started",
        emoji: "😸",
        type: "tech",
        topics: ["book"],
        published: false
      },
      "Book chapter scaffold content.\n"
    )
  );
}
