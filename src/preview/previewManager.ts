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
    const view = this.ensureView(entryUrl);
    view.changePath(previewPath);
  }

  async navigate(rawPath: string): Promise<void> {
    const normalized = normalizePreviewTarget(rawPath);
    if (!normalized) {
      vscode.window.showWarningMessage("[ZennPad Preview] Invalid preview path.");
      return;
    }

    await this.workspace.syncAll();

    if (!this.backend) {
      const started = await this.startWithRetry();
      if (!started) {
        return;
      }
    }

    if (!this.backend) {
      return;
    }

    const target = normalized.type === "absolute" ? normalized.url : normalized.path;
    const entryUrl = this.backend.entrypointUrl(target);
    const view = this.ensureView(entryUrl);
    view.changePath(target);
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

  private ensureView(entryUrl: string): PreviewView {
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
    return this.view;
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PreviewTarget =
  | { type: "absolute"; url: string }
  | { type: "relative"; path: string };

function normalizePreviewTarget(raw: string): PreviewTarget | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        const combined = `${url.pathname}${url.search}${url.hash}`;
        const cleanLocal = combined.replace(/^\/+/, "");
        if (cleanLocal) {
          return { type: "relative", path: cleanLocal };
        }
      }
    } catch {
      // fall through
    }
    return { type: "absolute", url: trimmed };
  }
  const clean = trimmed.replace(/^\/+/, "");
  if (isPreviewPath(clean)) {
    return { type: "relative", path: clean };
  }
  return null;
}

function isPreviewPath(path: string): boolean {
  if (path.startsWith("articles/")) {
    return path.split("/").length === 2;
  }
  if (path.startsWith("books/")) {
    const parts = path.split("/");
    return parts.length === 2 || parts.length === 3;
  }
  if (path.startsWith("guide/")) {
    return true;
  }
  return false;
}
