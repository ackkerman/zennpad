import * as vscode from "vscode";

export class ActionsViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "zennpad.actions";

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    const nonce = generateNonce();
    webviewView.webview.html = this.renderHtml(nonce, vscode.env.language ?? "en");
    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      if (typeof message !== "object" || !message) return;
      const { type } = message as { type?: string };
      if (type === "signIn") {
        void vscode.commands.executeCommand("zennpad.signIn");
      }
      if (type === "settings") {
        void vscode.commands.executeCommand("zennpad.openSettingsPanel");
      }
    });
  }

  private renderHtml(nonce: string, locale: string): string {
    const labels = localizedLabels(locale);
    const styles = `
      :root {
        color-scheme: light dark;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
      }
      body {
        margin: 0;
        padding: 0.75rem;
      }
      .actions {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .btn {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        padding: 0.55rem 0.85rem;
        border-radius: 8px;
        border: 1px solid #0f9d58;
        background: linear-gradient(180deg, #12b262 0%, #0f9d58 100%);
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(0,0,0,0.16);
      }
      .btn:active {
        transform: translateY(1px);
      }
      .ghost {
        border: 1px solid #0f9d58;
        background: transparent;
        color: #0f9d58;
        box-shadow: none;
      }
    `;
    const script = `
      const vscode = acquireVsCodeApi();
      document.querySelector('[data-action="signIn"]').addEventListener('click', () => {
        vscode.postMessage({ type: 'signIn' });
      });
      document.querySelector('[data-action="settings"]').addEventListener('click', () => {
        vscode.postMessage({ type: 'settings' });
      });
    `;
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>${styles}</style>
</head>
<body>
  <div class="actions">
    <button class="btn" data-action="signIn">✓ ${labels.signIn}</button>
    <button class="btn ghost" data-action="settings">⚙ ${labels.openSettings}</button>
  </div>
  <script nonce="${nonce}">${script}</script>
</body>
</html>`;
  }
}

function localizedLabels(locale: string): { signIn: string; openSettings: string } {
  const lang = (locale || "en").toLowerCase();
  if (lang.startsWith("ja")) {
    return { signIn: "GitHub にサインイン", openSettings: "設定を開く" };
  }
  return { signIn: "Sign in to GitHub", openSettings: "Open Settings" };
}

function generateNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 16; i += 1) {
    value += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return value;
}
