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
  private readonly mutationListeners: Array<(mutation: FsMutation) => void> = [];

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
    const prefix = uri.path.endsWith("/") ? uri.path : `${uri.path}/`;
    const entries = new Map<string, vscode.FileType>();
    for (const [path, entry] of this.files.entries()) {
      if (path.startsWith(prefix)) {
        const relative = path.slice(prefix.length).split("/")[0];
        if (!relative) {
          continue;
        }
        const existingType = entries.get(relative);
        if (existingType === vscode.FileType.Directory) {
          continue;
        }
        if (entry.type === vscode.FileType.Directory) {
          entries.set(relative, vscode.FileType.Directory);
        } else if (!entries.has(relative)) {
          entries.set(relative, entry.type);
        }
      }
    }
    return Array.from(entries.entries());
  }

  createDirectory(uri: vscode.Uri): void {
    const existing = this.files.get(uri.path);
    if (existing) {
      if (existing.type !== vscode.FileType.Directory) {
        throw vscode.FileSystemError.FileExists(uri);
      }
      return;
    }
    this.files.set(uri.path, {
      type: vscode.FileType.Directory,
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0
    });
    this.emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
  }

  has(uri: vscode.Uri): boolean {
    return this.files.has(uri.path);
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const entry = this.files.get(uri.path);
    if (!entry || !entry.data) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return entry.data;
  }

  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void {
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
    this.notifyMutation({ type: "write", uri, content });
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
    this.notifyMutation({ type: "delete", uri });
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
    this.notifyMutation({ type: "rename", oldUri, newUri });
  }

  onDidMutate(listener: (mutation: FsMutation) => void): vscode.Disposable {
    this.mutationListeners.push(listener);
    return new vscode.Disposable(() => {
      const index = this.mutationListeners.indexOf(listener);
      if (index >= 0) {
        this.mutationListeners.splice(index, 1);
      }
    });
  }

  private notifyMutation(mutation: FsMutation): void {
    for (const listener of [...this.mutationListeners]) {
      try {
        listener(mutation);
      } catch (error) {
        console.error("Failed to handle mutation", error);
      }
    }
  }

  hydrate(
    entries: {
      path: string;
      type: vscode.FileType;
      ctime: number;
      mtime: number;
      size: number;
      data?: string;
    }[]
  ): void {
    this.files.clear();
    for (const entry of entries) {
      this.files.set(entry.path, {
        type: entry.type,
        ctime: entry.ctime,
        mtime: entry.mtime,
        size: entry.size,
        data: entry.data ? Buffer.from(entry.data, "base64") : undefined
      });
    }
    this.emitter.fire([
      { type: vscode.FileChangeType.Changed, uri: vscode.Uri.from({ path: "/", scheme: "zenn" }) }
    ]);
  }

  snapshot(): {
    path: string;
    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;
    data?: string;
  }[] {
    const entries: {
      path: string;
      type: vscode.FileType;
      ctime: number;
      mtime: number;
      size: number;
      data?: string;
    }[] = [];
    for (const [path, entry] of this.files.entries()) {
      entries.push({
        path,
        type: entry.type,
        ctime: entry.ctime,
        mtime: entry.mtime,
        size: entry.size,
        data: entry.data ? Buffer.from(entry.data).toString("base64") : undefined
      });
    }
    return entries;
  }
}

export type FsMutation =
  | { type: "write"; uri: vscode.Uri; content: Uint8Array }
  | { type: "delete"; uri: vscode.Uri }
  | { type: "rename"; oldUri: vscode.Uri; newUri: vscode.Uri };
