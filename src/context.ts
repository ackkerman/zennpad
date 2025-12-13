import * as vscode from "vscode";
import { SortOrder } from "./zennTreeDataProvider";
import { isZennUri } from "./zennPath";

export function setSortOrderContext(order: SortOrder): void {
  void vscode.commands.executeCommand("setContext", "zennpad.sortOrder", order);
}

export function setAutoSyncContext(paused: boolean): void {
  void vscode.commands.executeCommand("setContext", "zennpad.autoSyncPaused", paused);
}

export function updatePreviewableContext(): void {
  const active = vscode.window.activeTextEditor?.document;
  const previewable = Boolean(active && isZennUri(active.uri) && active.languageId === "markdown");
  void vscode.commands.executeCommand("setContext", "zennpad.activeTextEditorPreviewable", previewable);
}
