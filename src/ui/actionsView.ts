import * as vscode from "vscode";
import { getZennOwner } from "../config";

export class ActionsViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "zennpad.actions";

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    const nonce = generateNonce();
    const initialZenn = getZennOwner(vscode.workspace.getConfiguration("zennpad")) ?? "";
    webviewView.webview.html = this.renderHtml(
      nonce,
      vscode.env.language ?? "en",
      initialZenn
    );
    webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
      if (typeof message !== "object" || !message) return;
      const { type, user } = message as { type?: string; user?: unknown };
      if (type === "signIn") {
        void vscode.commands.executeCommand("zennpad.signIn");
      }
      if (type === "settings") {
        void vscode.commands.executeCommand("zennpad.openSettingsPanel");
      }
      if (type === "openZenn") {
        const config = vscode.workspace.getConfiguration("zennpad");
        const inputUser = typeof user === "string" ? user.trim() : "";
        const targetUser = inputUser || getZennOwner(config);
        if (!targetUser) {
          void vscode.window.showWarningMessage("Zenn ユーザー名を入力してください。");
          return;
        }
        if (inputUser) {
          await config.update("zennAccount", targetUser, vscode.ConfigurationTarget.Global);
        }
        void vscode.env.openExternal(vscode.Uri.parse(`https://zenn.dev/${targetUser}`));
      }
    });
  }

  private renderHtml(nonce: string, locale: string, initialZennUser: string): string {
    const labels = localizedLabels(locale);
    const safeInitialZenn = escapeHtml(initialZennUser);
    const styles = `
      :root {
        color-scheme: light dark;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
      }
      body {
        margin: 0;
        padding: 0.85rem;
        background: var(--vscode-sideBar-background, #0f172a);
        color: var(--vscode-foreground);
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .card {
        border: 1px solid var(--vscode-input-border, rgba(148, 163, 184, 0.28));
        border-radius: 10px;
        padding: 0.85rem;
        background: var(--vscode-editor-background, #0b1120);
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.5rem 0.9rem;
        border-radius: 9px;
        border: 1px solid #0f9d58;
        background: linear-gradient(180deg, #12b262 0%, #0f9d58 100%);
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22);
      }
      .btn:active {
        transform: translateY(1px);
      }
      .btn.ghost {
        background: transparent;
        color: #0f9d58;
        box-shadow: none;
      }
      .input-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
        align-items: center;
      }
      .input {
        width: 100%;
        padding: 0.55rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--vscode-input-border, rgba(148, 163, 184, 0.28));
        background: var(--vscode-input-background, #0b1120);
        color: var(--vscode-foreground);
        font-size: 0.95rem;
      }
      .label {
        font-size: 0.92rem;
        margin-bottom: 0.35rem;
        color: var(--vscode-foreground);
      }
    `;
    const script = `
      const vscode = acquireVsCodeApi();
      const bind = (selector, cb) => {
        const el = document.querySelector(selector);
        if (el) {
          el.addEventListener('click', (event) => {
            event.preventDefault();
            cb();
          });
        }
      };
      bind('[data-action="signIn"]', () => vscode.postMessage({ type: 'signIn' }));
      bind('[data-action="settings"]', () => vscode.postMessage({ type: 'settings' }));
      const form = document.querySelector('[data-form="openZenn"]');
      const input = document.querySelector('[data-input="zennUser"]');
      if (form && input) {
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          vscode.postMessage({ type: 'openZenn', user: input.value });
        });
      }
    `;
    return `<!DOCTYPE html>
<html lang="${labels.lang}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">${styles}</style>
</head>
<body>
  <div class="stack">
    <section class="card">
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <button class="btn" data-action="signIn">✓ ${labels.signIn}</button>
        <button class="btn ghost" data-action="settings">⚙ ${labels.openSettings}</button>
      </div>
    </section>
    <section class="card">
      <div class="label">${labels.zennUserLabel}</div>
      <form class="input-row" data-form="openZenn">
        <input class="input" data-input="zennUser" type="text" value="${safeInitialZenn}" placeholder="${labels.zennUserPlaceholder}" />
        <button class="btn" type="submit">↗ ${labels.openZenn}</button>
      </form>
    </section>
  </div>
  <script nonce="${nonce}">${script}</script>
</body>
</html>`;
  }
}

function localizedLabels(locale: string): {
  lang: string;
  signIn: string;
  openSettings: string;
  zennUserLabel: string;
  zennUserPlaceholder: string;
  openZenn: string;
} {
  const lang = (locale || "en").toLowerCase();
  if (lang.startsWith("ja")) {
    return {
      lang: "ja",
      signIn: "GitHub にサインイン",
      openSettings: "設定を開く",
      zennUserLabel: "Zenn ユーザー名",
      zennUserPlaceholder: "zenn.dev/{username}",
      openZenn: "Zennを開く"
    };
  }
  return {
    lang: "en",
    signIn: "Sign in to GitHub",
    openSettings: "Open Settings",
    zennUserLabel: "Zenn username",
    zennUserPlaceholder: "zenn.dev/{username}",
    openZenn: "Open Zenn"
  };
}

function generateNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 16; i += 1) {
    value += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
