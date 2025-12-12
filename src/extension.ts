import * as vscode from "vscode";
import { ZennTreeDataProvider } from "./zennTreeDataProvider";
import { ZennFsProvider } from "./zennFsProvider";

export function activate(context: vscode.ExtensionContext): void {
  const scheme = "zenn";
  const treeDataProvider = new ZennTreeDataProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("zennPadExplorer", treeDataProvider)
  );

  const fsProvider = new ZennFsProvider();
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(scheme, fsProvider, {
      isCaseSensitive: true
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("zennpad.refresh", () => {
      treeDataProvider.refresh();
      vscode.window.showInformationMessage("Zenn content refreshed (scaffold)");
    }),
    vscode.commands.registerCommand("zennpad.newArticle", async () => {
      const uri = vscode.Uri.parse(`${scheme}:/articles/${Date.now()}_draft.md`);
      const initialContent = Buffer.from("---\npublished: false\n---\n\nWrite your article here.\n");
      fsProvider.writeFile(uri, initialContent, { create: true, overwrite: true });
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
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
}

export function deactivate(): void {
  // Nothing to clean up in the scaffold yet.
}
