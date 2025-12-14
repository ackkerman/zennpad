import * as vscode from "vscode";

type GuideVariant = "panel" | "view";

const LINKS: Array<{ labelJa: string; labelEn: string; url: string; icon: string }> = [
  {
    labelJa: "記事の作成ガイド",
    labelEn: "Article guide",
    url: "http://localhost:8000/guide/zenn-cli-guide#cli-%E3%81%A7%E8%A8%98%E4%BA%8B%EF%BC%88article%EF%BC%89%E3%82%92%E7%AE%A1%E7%90%86%E3%81%99%E3%82%8B",
    icon: "📝"
  },
  {
    labelJa: "本の作成ガイド",
    labelEn: "Book guide",
    url: "http://localhost:8000/guide/zenn-cli-guide#cli-%E3%81%A7%E6%9C%AC%EF%BC%88book%EF%BC%89%E3%82%92%E7%AE%A1%E7%90%86%E3%81%99%E3%82%8B",
    icon: "📕"
  },
  {
    labelJa: "画像管理ガイド",
    labelEn: "Image guide",
    url: "http://localhost:8000/guide/deploy-github-images",
    icon: "🖼"
  },
  {
    labelJa: "マークダウン記法",
    labelEn: "Markdown",
    url: "https://zenn.dev/zenn/articles/markdown-guide",
    icon: "✏️"
  },
  {
    labelJa: "画像のアップロード",
    labelEn: "Image uploader",
    url: "https://zenn.dev/dashboard/uploader",
    icon: "📷"
  }
];

export const HELP_LINKS = LINKS;
export const PRIMARY_HELP_URL = LINKS[0]?.url ?? "https://zenn.dev/zenn/articles/markdown-guide";

export class HelpGuidePanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "zennpad.helpGuide",
      localizedLabels(vscode.env.language ?? "en").panelTitle,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri]
      }
    );
    this.panel = panel;
    panel.webview.html = renderGuideHtml(panel.webview, vscode.env.language ?? "en", "panel");
    const disposable = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (typeof message !== "object" || !message) return;
      const { type, href } = message as { type?: string; href?: string };
      if (type === "openExternal" && href) {
        const uri = parseExternalUri(href);
        if (uri) {
          void vscode.env.openExternal(uri);
        }
      }
    });
    panel.onDidDispose(() => {
      disposable.dispose();
      this.panel = undefined;
    });
  }
}

export class HelpViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "zennpad.help";

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly guidePanel: HelpGuidePanel
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = renderGuideHtml(
      webviewView.webview,
      vscode.env.language ?? "en",
      "view"
    );
    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      if (typeof message !== "object" || !message) return;
      const { type, href } = message as { type?: string; href?: string };
      if (type === "openExternal" && href) {
        const uri = parseExternalUri(href);
        if (uri) {
          void vscode.env.openExternal(uri);
        }
      }
      if (type === "openPanel") {
        this.guidePanel.show();
      }
    });
  }
}

function renderGuideHtml(webview: vscode.Webview, locale: string, variant: GuideVariant): string {
  const labels = localizedLabels(locale);
  const nonce = generateNonce();
  const csp = [
    "default-src 'none'",
    `style-src 'nonce-${nonce}' 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`
  ].join("; ");
  const showOpenPanel = variant === "view";
  const linkItems = LINKS.map((link) => {
    const text = locale.toLowerCase().startsWith("ja") ? link.labelJa : link.labelEn;
    const externalMark = link.url.startsWith("http://localhost:8000") ? "" : " ↗";
    return `<li class="link-row" data-href="${link.url}">
      <span class="icon">${link.icon}</span>
      <span class="label">${text}${externalMark}</span>
    </li>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="${labels.lang}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style nonce="${nonce}">
    :root {
      color-scheme: light dark;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
    }
    body {
      margin: 0;
      padding: 0.9rem;
      background: var(--vscode-sideBar-background, #0f172a);
      color: var(--vscode-foreground);
    }
    .shell {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
    }
    .actions {
      display: inline-flex;
      gap: 0.4rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.45rem 0.8rem;
      border-radius: 8px;
      border: 1px solid #0f9d58;
      background: transparent;
      color: #0f9d58;
      font-weight: 600;
      cursor: pointer;
      box-shadow: none;
    }
    .btn:active {
      transform: translateY(1px);
    }
    .list {
      list-style: none;
      padding: 0.4rem 0;
      margin: 0;
      border: 1px solid var(--vscode-input-border, rgba(148, 163, 184, 0.28));
      border-radius: 12px;
      background: var(--vscode-editor-background, #0b1120);
    }
    .link-row {
      display: grid;
      grid-template-columns: 28px 1fr;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0.85rem;
      cursor: pointer;
    }
    .link-row:hover {
      background: rgba(18, 178, 98, 0.08);
    }
    .icon {
      font-size: 1rem;
      opacity: 0.9;
      text-align: center;
    }
    .label {
      font-size: 0.98rem;
      color: var(--vscode-foreground);
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="header">
      <h1 class="title">${labels.heading}</h1>
      <div class="actions">
        ${showOpenPanel ? `<button class="btn" data-action="openPanel">↗ ${labels.openPanel}</button>` : ""}
      </div>
    </div>
    <ul class="list">
      ${linkItems}
    </ul>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (event) => {
      const element = event.target instanceof HTMLElement ? event.target : null;
      const row = element ? element.closest('.link-row') : null;
      if (row && row instanceof HTMLElement && row.dataset?.href) {
        event.preventDefault();
        vscode.postMessage({ type: 'openExternal', href: row.dataset.href });
      }
    });
    const openPanel = document.querySelector('[data-action="openPanel"]');
    if (openPanel) {
      openPanel.addEventListener('click', () => {
        vscode.postMessage({ type: 'openPanel' });
      });
    }
  </script>
</body>
</html>`;
}

function localizedLabels(locale: string): {
  lang: string;
  heading: string;
  openPanel: string;
  panelTitle: string;
} {
  const lang = (locale || "en").toLowerCase();
  if (lang.startsWith("ja")) {
    return {
      lang: "ja",
      heading: "Zenn ガイド",
      openPanel: "大きく開く",
      panelTitle: "ZennPad: ヘルプ"
    };
  }
  return {
    lang: "en",
    heading: "Zenn Guides",
    openPanel: "Open larger",
    panelTitle: "ZennPad: Help"
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

function parseExternalUri(href: string): vscode.Uri | undefined {
  try {
    const uri = vscode.Uri.parse(href);
    if (uri.scheme === "https" || uri.scheme === "http") {
      return uri;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
