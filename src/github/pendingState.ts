export type ShaMap = Record<string, string>;

export interface PendingWrite {
  path: string;
  content: Uint8Array;
  hash: string;
}

import { createHash } from "crypto";

export class PendingState {
  private readonly shaMapByBranch: Map<string, ShaMap> = new Map();
  private readonly hashMapByBranch: Map<string, ShaMap> = new Map();
  private readonly pendingWrites = new Map<string, PendingWrite>();
  private readonly pendingDeletes = new Set<string>();

  recordWrite(branch: string, path: string, content: Uint8Array, hash: string): boolean {
    const existing = this.pendingWrites.get(path);
    if (existing && existing.hash === hash && !this.pendingDeletes.has(path)) {
      return false;
    }
    const hashes = this.getBranchHashMap(branch);
    if (hashes[path] === hash && !this.pendingDeletes.has(path)) {
      return false;
    }
    this.pendingDeletes.delete(path);
    this.pendingWrites.set(path, { path, content, hash });
    return true;
  }

  recordDelete(path: string): boolean {
    this.pendingWrites.delete(path);
    this.pendingDeletes.add(path);
    return true;
  }

  recordRename(branch: string, oldPath: string, newPath: string, content: Uint8Array, hash: string): boolean {
    this.pendingWrites.delete(oldPath);
    this.pendingDeletes.add(oldPath);
    this.pendingDeletes.delete(newPath);
    this.pendingWrites.set(newPath, { path: newPath, content, hash });
    return true;
  }

  hasPending(): boolean {
    return this.pendingWrites.size > 0 || this.pendingDeletes.size > 0;
  }

  snapshot(): { writes: Array<[string, PendingWrite]>; deletes: string[] } {
    return {
      writes: Array.from(this.pendingWrites.entries()),
      deletes: Array.from(this.pendingDeletes.values())
    };
  }

  applyCommitResult(branch: string, treeEntries: Array<{ path: string; sha: string | null }>, snapshot: { writes: Array<[string, PendingWrite]>; deletes: string[] }): void {
    const shaMap = this.getBranchShaMap(branch);
    const hashes = this.getBranchHashMap(branch);
    for (const [path, write] of snapshot.writes) {
      const treeEntry = treeEntries.find((entry) => entry.path === path && entry.sha);
      if (treeEntry?.sha) {
        shaMap[path] = treeEntry.sha;
        hashes[path] = write.hash;
      }
      this.pendingWrites.delete(path);
    }
    for (const path of snapshot.deletes) {
      delete shaMap[path];
      delete hashes[path];
      this.pendingDeletes.delete(path);
    }
  }

  setRemoteState(branch: string, path: string, sha: string, hash: string): void {
    const shaMap = this.getBranchShaMap(branch);
    const hashes = this.getBranchHashMap(branch);
    shaMap[path] = sha;
    hashes[path] = hash;
  }

  getPendingPaths(): Set<string> {
    const paths = new Set<string>();
    for (const path of this.pendingWrites.keys()) {
      paths.add(`/${path}`);
    }
    for (const path of this.pendingDeletes.values()) {
      paths.add(`/${path}`);
    }
    return paths;
  }

  getBranchShaMap(branch: string): ShaMap {
    if (!this.shaMapByBranch.has(branch)) {
      this.shaMapByBranch.set(branch, {});
    }
    return this.shaMapByBranch.get(branch)!;
  }

  getBranchHashMap(branch: string): ShaMap {
    if (!this.hashMapByBranch.has(branch)) {
      this.hashMapByBranch.set(branch, {});
    }
    return this.hashMapByBranch.get(branch)!;
  }
}

export function hashContent(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}
