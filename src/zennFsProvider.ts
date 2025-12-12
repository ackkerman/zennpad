import * as vscode from "vscode";

interface StoredFile {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;
  data?: Uint8Array;
}

export class ZennFsProvider implements vscode.FileSystemProvider {
  private readonly files = new Map<string, StoredFile>();
  private readonly emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this.emitter.event;

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    const entry = this.files.get(uri.path);
    if (!entry) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return { type: entry.type, ctime: entry.ctime, mtime: entry.mtime, size: entry.size };
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    const entries: [string, vscode.FileType][] = [];
    const prefix = uri.path.endsWith("/") ? uri.path : `${uri.path}/`;
    for (const [path, entry] of this.files.entries()) {
      if (path.startsWith(prefix)) {
        const relative = path.slice(prefix.length).split("/")[0];
        entries.push([relative, entry.type]);
      }
    }
    return Array.from(new Map(entries).entries());
  }

  createDirectory(uri: vscode.Uri): void {
    this.files.set(uri.path, {
      type: vscode.FileType.Directory,
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0
    });
    this.emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const entry = this.files.get(uri.path);
    if (!entry || !entry.data) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return entry.data;
  }

  writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void {
    const existing = this.files.get(uri.path);
    if (!existing && !options.create) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    if (existing && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(uri);
    }

    this.files.set(uri.path, {
      type: vscode.FileType.File,
      ctime: existing?.ctime ?? Date.now(),
      mtime: Date.now(),
      size: content.byteLength,
      data: content
    });

    const changeType = existing ? vscode.FileChangeType.Changed : vscode.FileChangeType.Created;
    this.emitter.fire([{ type: changeType, uri }]);
  }

  delete(uri: vscode.Uri, options: { recursive: boolean }): void {
    if (!this.files.has(uri.path)) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    if (!options.recursive) {
      for (const path of this.files.keys()) {
        if (path.startsWith(`${uri.path}/`)) {
          throw vscode.FileSystemError.NoPermissions("Directory is not empty");
        }
      }
    }
    this.files.delete(uri.path);
    this.emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
  }

  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
    const entry = this.files.get(oldUri.path);
    if (!entry) {
      throw vscode.FileSystemError.FileNotFound(oldUri);
    }
    if (!options.overwrite && this.files.has(newUri.path)) {
      throw vscode.FileSystemError.FileExists(newUri);
    }
    this.files.delete(oldUri.path);
    this.files.set(newUri.path, { ...entry, mtime: Date.now() });
    this.emitter.fire([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri }
    ]);
  }
}
