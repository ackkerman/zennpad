import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";

export interface CacheEntry {
  path: string;
  type: number;
  ctime: number;
  mtime: number;
  size: number;
  data?: string; // base64
  sha?: string;
  updatedAt?: string;
  createdAt?: string;
}

export class ContentCache {
  private readonly cacheFilePath: string;
  private readonly version = 1;

  constructor(storageUri: vscode.Uri, namespace = "default") {
    const safeNamespace = sanitizeNamespace(namespace);
    this.cacheFilePath = path.join(storageUri.fsPath, "cache", `${safeNamespace}.json`);
  }

  async load(): Promise<CacheEntry[] | null> {
    try {
      const raw = await fs.readFile(this.cacheFilePath, "utf8");
      const parsed = JSON.parse(raw) as { version: number; entries: CacheEntry[] };
      if (parsed.version !== this.version || !Array.isArray(parsed.entries)) {
        return null;
      }
      return parsed.entries;
    } catch {
      return null;
    }
  }

  async save(entries: CacheEntry[]): Promise<void> {
    await fs.mkdir(path.dirname(this.cacheFilePath), { recursive: true });
    const payload = JSON.stringify({ version: this.version, entries });
    await fs.writeFile(this.cacheFilePath, payload, "utf8");
  }
}

function sanitizeNamespace(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "_") || "default";
}
