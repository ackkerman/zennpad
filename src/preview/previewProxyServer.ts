import http from "http";
import httpProxy from "http-proxy";
import { URL } from "url";

const INDEX_PREFIX = "/__vscode_zenn_editor_preview_proxy_index/";

export class PreviewProxyServer {
  private constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly server: http.Server,
    private readonly proxy: httpProxy
  ) {}

  static async start(host: string, port: number, backendPort: number): Promise<PreviewProxyServer> {
    return new Promise((resolve, reject) => {
      const proxy = httpProxy.createProxyServer({
        target: { host, port: backendPort },
        ws: true
      });

      const server = http.createServer((req, res) => {
        if (!req.url) {
          res.writeHead(400);
          res.end();
          return;
        }

        if (req.url.startsWith(INDEX_PREFIX)) {
          const url = new URL(req.url, `http://${host}:${port}`);
          if (url.pathname.endsWith("/controller.js")) {
            res.writeHead(200, { "Content-Type": "application/javascript" });
            res.end(buildControllerScript());
          } else {
            const initialPath = url.searchParams.get("path") ?? "";
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(buildIndexHtml(initialPath));
          }
          return;
        }

        proxy.web(req, res);
      });

      server.on("upgrade", (req, socket, head) => {
        proxy.ws(req, socket, head);
      });

      server.on("error", (error) => {
        reject(error);
      });

      server.listen(port, host, () => resolve(new PreviewProxyServer(host, port, server, proxy)));
    });
  }

  entrypointUrl(initialPath?: string): string {
    const suffix = initialPath ? `?path=${encodeURIComponent(initialPath)}` : "";
    return `http://${this.host}:${this.port}${INDEX_PREFIX}index${suffix}`;
  }

  stop(): void {
    this.server.close();
    this.proxy.close();
  }
}

function buildIndexHtml(initialPath: string): string {
  const safePath = initialPath.replace(/^\//, "");
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      iframe {
        border: 0;
        width: 100%;
        height: 100%;
      }
    </style>
    <script src="${INDEX_PREFIX}controller.js"></script>
  </head>
  <body>
    <iframe id="zennpad-preview-frame" src="/${safePath}"></iframe>
  </body>
</html>
`;
}

function buildControllerScript(): string {
  return `
(() => {
  const params = new URLSearchParams(window.location.search);
  const frame = document.getElementById("zennpad-preview-frame");
  const initialPath = params.get("path");
  if (frame && initialPath) {
    const clean = initialPath.replace(/^\\//, "");
    frame.setAttribute("src", "/" + clean);
  }
  window.addEventListener("message", (event) => {
    const path = event.data && event.data.path;
    if (typeof path !== "string" || !frame) {
      return;
    }
    const clean = path.replace(/^\\//, "");
    frame.setAttribute("src", "/" + clean);
  });
})();
`;
}
