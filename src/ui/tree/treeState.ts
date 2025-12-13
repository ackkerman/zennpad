import { SortOrder, BranchInfo } from "./types";

export class TreeState {
  private signedIn = false;
  private hasRepoConfig = false;
  private dirtyPaths = new Set<string>();
  private branchInfo: BranchInfo | undefined;
  private sortOrder: SortOrder = "date";

  setStatus(status: { signedIn: boolean; hasRepoConfig: boolean }): void {
    this.signedIn = status.signedIn;
    this.hasRepoConfig = status.hasRepoConfig;
  }

  setDirtyPaths(paths: Set<string>): void {
    this.dirtyPaths = new Set(paths);
  }

  setBranchInfo(branches: BranchInfo): void {
    this.branchInfo = branches;
  }

  setSortOrder(order: SortOrder): void {
    this.sortOrder = order;
  }

  getSortOrder(): SortOrder {
    return this.sortOrder;
  }

  getBranchInfo(): BranchInfo | undefined {
    return this.branchInfo;
  }

  isSignedIn(): boolean {
    return this.signedIn;
  }

  hasRepo(): boolean {
    return this.hasRepoConfig;
  }

  isDirty(path: string): boolean {
    return this.dirtyPaths.has(path);
  }
}
