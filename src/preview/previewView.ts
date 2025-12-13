import * as vscode from "vscode";

export class PreviewView {
  private readonly panel: vscode.WebviewPanel;

  constructor(context: vscode.ExtensionContext, entryUrl: string) {
    this.panel = vscode.window.createWebviewPanel(
      "zennpad.preview",
      "ZennPad Preview",
      {
        viewColumn: vscode.ViewColumn.Two,
        preserveFocus: true
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    context.subscriptions.push(this.panel);
    this.panel.webview.html = this.buildHtml(entryUrl);
  }

  updateEntry(entryUrl: string): void {
    this.panel.webview.html = this.buildHtml(entryUrl);
  }

  changePath(relativePath: string): void {
    this.panel.webview.postMessage({ command: "change_path", path: relativePath });
  }

  onDidDispose(listener: () => void): void {
    this.panel.onDidDispose(listener);
  }

  dispose(): void {
    this.panel.dispose();
  }

  reveal(): void {
    this.panel.reveal(undefined, true);
  }

  private buildHtml(entryUrl: string): string {
    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        padding: 0;
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: #111;
      }
      iframe {
        border: 0;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <iframe id="zennpad-proxy" src="${entryUrl}" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
    <script>
      const frame = document.getElementById("zennpad-proxy");
      window.addEventListener("message", (event) => {
        if (event.data && event.data.command === "change_path" && frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ path: event.data.path }, "*");
        }
      });
    </script>
  </body>
</html>
`;
  }
}
