import * as vscode from "vscode";
import { PreviewBackend } from "./previewBackend";
import { PreviewView } from "./previewView";
import { PreviewWorkspace } from "./previewWorkspace";
import { toPreviewUrlPath, toRelativeZennPath } from "../utils/path/zennPath";

export class PreviewManager {
  private backend: PreviewBackend | undefined;
  private view: PreviewView | undefined;

  constructor(
    private readonly workspace: PreviewWorkspace,
    private readonly context: vscode.ExtensionContext
  ) {}

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

    if (!this.backend) {
      const started = await this.startWithRetry();
      if (!started) {
        return;
      }
    }

    if (!this.backend) {
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

  dispose(): void {
    try {
      this.backend?.stop();
    } catch {
      // ignore
    }
    try {
      this.view?.onDidDispose(() => undefined);
      this.view = undefined;
    } catch {
      // ignore
    }
    this.backend = undefined;
  }

  private async startWithRetry(): Promise<boolean> {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        this.backend = await PreviewBackend.start(this.workspace);
        return true;
      } catch (error) {
        this.backend?.stop();
        this.backend = undefined;
        if (attempt === maxAttempts) {
          const message =
            error instanceof Error
              ? error.message
              : "zenn preview 起動に失敗しました。zenn CLI を確認してください。";
          vscode.window.showErrorMessage(`[ZennPad Preview] ${message}`);
          return false;
        }
        await delay(500);
      }
    }
    return false;
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
