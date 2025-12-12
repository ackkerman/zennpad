import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { FsMutation, ZennFsProvider } from "./zennFsProvider";
import { toRelativeZennPath } from "./zennPath";

export class PreviewWorkspace {
  constructor(private readonly baseUri: vscode.Uri, private readonly fsProvider: ZennFsProvider) {}

  get rootFsPath(): string {
    return this.baseUri.fsPath;
  }

  async ensureReady(): Promise<void> {
    await fs.mkdir(this.rootFsPath, { recursive: true });
    await Promise.all([
      fs.mkdir(path.join(this.rootFsPath, "articles"), { recursive: true }),
      fs.mkdir(path.join(this.rootFsPath, "books"), { recursive: true })
    ]);
  }

  async syncAll(): Promise<void> {
    await this.ensureReady();
    await Promise.all([
      this.syncDirectory("/articles", path.join(this.rootFsPath, "articles")),
      this.syncDirectory("/books", path.join(this.rootFsPath, "books"))
    ]);
  }

  async syncDocument(document: vscode.TextDocument): Promise<void> {
    const relative = toRelativeZennPath(document.uri);
    if (!relative) {
      return;
    }
    await this.ensureReady();
    const target = path.join(this.rootFsPath, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, document.getText(), "utf8");
  }

  private async syncDirectory(virtualPath: string, targetDir: string): Promise<void> {
    try {
      const entries = this.fsProvider.readDirectory(vscode.Uri.from({ scheme: "zenn", path: virtualPath }));
      await fs.mkdir(targetDir, { recursive: true });
      for (const [name, type] of entries) {
        const virtualEntryPath = path.posix.join(virtualPath, name);
        const targetPath = path.join(targetDir, name);
        if (type === vscode.FileType.Directory) {
          await this.syncDirectory(virtualEntryPath, targetPath);
        } else if (type === vscode.FileType.File) {
          try {
            const data = this.fsProvider.readFile(vscode.Uri.from({ scheme: "zenn", path: virtualEntryPath }));
            await fs.writeFile(targetPath, data);
          } catch {
            // Ignore files that disappear during sync.
          }
        }
      }
    } catch {
      // Directory may not exist yet; ignore.
    }
  }

  async applyMutation(mutation: FsMutation): Promise<void> {
    switch (mutation.type) {
      case "write":
        await this.syncBinaryFile(mutation.uri, mutation.content);
        break;
      case "delete":
        await this.deletePath(mutation.uri);
        break;
      case "rename":
        await this.renamePath(mutation.oldUri, mutation.newUri);
        break;
    }
  }

  private async syncBinaryFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    const relative = toRelativeZennPath(uri);
    if (!relative) {
      return;
    }
    await this.ensureReady();
    const target = path.join(this.rootFsPath, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }

  private async deletePath(uri: vscode.Uri): Promise<void> {
    const relative = toRelativeZennPath(uri);
    if (!relative) {
      return;
    }
    await this.ensureReady();
    const target = path.join(this.rootFsPath, relative);
    await fs.rm(target, { recursive: true, force: true });
  }

  private async renamePath(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {
    const oldRelative = toRelativeZennPath(oldUri);
    const newRelative = toRelativeZennPath(newUri);
    if (!oldRelative || !newRelative) {
      return;
    }
    await this.ensureReady();
    const oldPath = path.join(this.rootFsPath, oldRelative);
    const newPath = path.join(this.rootFsPath, newRelative);
    await fs.mkdir(path.dirname(newPath), { recursive: true });
    try {
      await fs.rename(oldPath, newPath);
    } catch {
      // Fallback: copy then delete
      try {
        const data = await fs.readFile(oldPath);
        await fs.writeFile(newPath, data);
        await fs.rm(oldPath, { recursive: true, force: true });
      } catch {
        // ignore failures
      }
    }
  }
}
