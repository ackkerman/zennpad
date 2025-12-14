import * as vscode from "vscode";
import { SortOrder } from "./ui/tree/types";
import { isZennUri } from "./utils/path/zennPath";
import { parseFrontmatter } from "./utils/markdown/frontmatter";

export function setSortOrderContext(order: SortOrder): void {
  void vscode.commands.executeCommand("setContext", "zennpad.sortOrder", order);
}

export function setAutoSyncContext(paused: boolean): void {
  void vscode.commands.executeCommand("setContext", "zennpad.autoSyncPaused", paused);
}

export function updatePreviewableContext(): void {
  updateActiveDocumentContext();
}

export function updateActiveDocumentContext(doc?: vscode.TextDocument): void {
  const activeDoc = doc ?? vscode.window.activeTextEditor?.document;
  const isZennDoc = Boolean(activeDoc && isZennUri(activeDoc.uri));
  const isMarkdown = Boolean(activeDoc && activeDoc.languageId === "markdown");
  const previewable = Boolean(isZennDoc && isMarkdown);
  void vscode.commands.executeCommand(
    "setContext",
    "zennpad.activeTextEditorPreviewable",
    previewable
  );
  void vscode.commands.executeCommand("setContext", "zennpad.activeDocIsZenn", isZennDoc);

  let published: boolean | undefined;
  if (previewable && activeDoc) {
    try {
      const parsed = parseFrontmatter(activeDoc.getText());
      if (typeof parsed.frontmatter.published === "boolean") {
        published = parsed.frontmatter.published;
      }
    } catch {
      // ignore parse errors for context updates
    }
  }

  void vscode.commands.executeCommand(
    "setContext",
    "zennpad.activeDocPublished",
    published === true
  );
  void vscode.commands.executeCommand("setContext", "zennpad.activeDocDraft", published === false);
}
