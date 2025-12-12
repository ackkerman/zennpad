import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as readline from "readline";
import getPort from "get-port";
import { PreviewProxyServer } from "./previewProxyServer";
import { PreviewWorkspace } from "./previewWorkspace";
import which from "which";

export class PreviewBackend {
  private constructor(
    private readonly process: ChildProcessWithoutNullStreams,
    private readonly proxyServer: PreviewProxyServer
  ) {}

  static async start(workspace: PreviewWorkspace, initialPath: string): Promise<PreviewBackend> {
    await workspace.ensureReady();
    await workspace.syncAll();

    const backendPort = await getPort();
    const proxyPort = await getPort();

    const zennPath = await resolveZennCliPath();

    const cliProcess = spawn(zennPath, ["preview", "--port", backendPort.toString()], {
      cwd: workspace.rootFsPath,
      shell: process.platform === "win32"
    });

    const readyProcess = await waitForPreview(cliProcess, backendPort);
    const proxyServer = await PreviewProxyServer.start("127.0.0.1", proxyPort, backendPort);
    return new PreviewBackend(readyProcess, proxyServer);
  }

  entrypointUrl(initialPath: string): string {
    return this.proxyServer.entrypointUrl(initialPath);
  }

  stop(): void {
    try {
      this.process.kill();
    } catch {
      // ignore
    }
    this.proxyServer.stop();
  }
}

async function resolveZennCliPath(): Promise<string> {
  try {
    return await which("zenn");
  } catch {
    throw new Error(
      "zenn CLI が見つかりません。`npm install -g zenn-cli` または `npx zenn init` 実行後に再度プレビューしてください。"
    );
  }
}

async function waitForPreview(
  proc: ChildProcessWithoutNullStreams,
  port: number
): Promise<ChildProcessWithoutNullStreams> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error("zenn preview start timeout"));
    }, 10000);

    const stdout = readline.createInterface(proc.stdout);
    const stderr = readline.createInterface(proc.stderr);

    stdout.on("line", (line) => {
      const text = line.toString();
      if (text.includes(`http://localhost:${port}`) || text.includes(`http://127.0.0.1:${port}`)) {
        clearTimeout(timeout);
        resolve(proc);
      }
    });

    stderr.on("line", (line) => {
      console.error(line.toString());
    });

    proc.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    proc.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`zenn preview exited with code ${code ?? "unknown"}`));
    });
  });
}
