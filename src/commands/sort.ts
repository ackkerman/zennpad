import * as vscode from "vscode";
import { ZennTreeDataProvider, SortOrder } from "../ui/tree/zennTreeDataProvider";
import { CommandDeps } from "./types";

export function registerSortCommands(
  context: vscode.ExtensionContext,
  deps: CommandDeps,
  treeDataProvider: ZennTreeDataProvider
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("zennpad.sortArticlesByDate", async () => {
      treeDataProvider.setSortOrder("date");
      deps.setSortOrderContext(treeDataProvider.getSortOrder());
      vscode.window.showInformationMessage("記事を日付順で表示します。");
    }),
    vscode.commands.registerCommand("zennpad.sortArticlesByTitle", async () => {
      treeDataProvider.setSortOrder("title");
      deps.setSortOrderContext(treeDataProvider.getSortOrder());
      vscode.window.showInformationMessage("記事をタイトル順で表示します。");
    }),
    vscode.commands.registerCommand("zennpad.toggleSortOrder", async () => {
      const next: SortOrder = treeDataProvider.getSortOrder() === "date" ? "title" : "date";
      treeDataProvider.setSortOrder(next);
      deps.setSortOrderContext(next);
      vscode.window.showInformationMessage(
        next === "date" ? "記事を日付順で表示します。" : "記事をタイトル順で表示します。"
      );
    })
  ];
}
