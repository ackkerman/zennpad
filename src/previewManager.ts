import * as vscode from "vscode";
import { PreviewBackend } from "./previewBackend";
import { PreviewView } from "./previewView";
import { PreviewWorkspace } from "./previewWorkspace";
import { toPreviewUrlPath, toRelativeZennPath } from "./zennPath";

export class PreviewManager {
  private backend: PreviewBackend | undefined;
  private view: PreviewView | undefined;

  constructor(private readonly workspace: PreviewWorkspace, private readonly context: vscode.ExtensionContext) {}

  async open(document: vscode.TextDocument): Promise<void> {
    const relativePath = toRelativeZennPath(document.uri);
    if (!relativePath) {
      vscode.window.showWarningMessage("ZennPad Preview is only available for zenn: scheme files.");
      return;
    }

    const previewPath = toPreviewUrlPath(relativePath);
    if (!previewPath) {
      vscode.window.showWarningMessage("This file is not previewable by Zenn CLI.");
      return;
    }

    await this.workspace.syncDocument(document);

    try {
      if (!this.backend) {
        this.backend = await PreviewBackend.start(this.workspace);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "zenn preview 起動に失敗しました。zenn CLI を確認してください。";
      vscode.window.showErrorMessage(`[ZennPad Preview] ${message}`);
      return;
    }

    const entryUrl = this.backend.entrypointUrl(previewPath);
    if (!this.view) {
      this.view = new PreviewView(this.context, entryUrl);
      this.view.onDidDispose(() => {
        this.backend?.stop();
        this.backend = undefined;
        this.view = undefined;
      });
    } else {
      this.view.updateEntry(entryUrl);
      this.view.reveal();
    }

    this.view.changePath(previewPath);
  }
}
