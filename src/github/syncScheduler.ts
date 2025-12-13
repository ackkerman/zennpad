export type Clock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
};

export type CommitFn = () => Promise<void>;

/**
 * Debounce + min-interval scheduler that collapses frequent "dirty" marks
 * into a single commit while enforcing a minimum gap between commits.
 */
export class SyncScheduler {
  private debounceId: unknown | null = null;
  private pending = false;
  private lastCommitAt: number;

  constructor(
    private readonly clock: Clock,
    private readonly commit: CommitFn,
    private readonly debounceMs: number,
    private readonly minIntervalMs: number
  ) {
    this.lastCommitAt = -this.minIntervalMs;
  }

  /** Mark that there are unsynced changes. */
  markDirty(): void {
    this.pending = true;
    this.armDebounce();
  }

  /** Force commit ASAP (still respects minIntervalMs). */
  async flush(): Promise<void> {
    this.pending = true;
    await this.tryCommit();
  }

  /** Force commit ignoring min interval. */
  async flushUnsafe(): Promise<void> {
    this.pending = true;
    await this.doCommit();
  }

  private armDebounce(): void {
    if (this.debounceId !== null) {
      this.clock.clearTimeout(this.debounceId);
    }
    this.debounceId = this.clock.setTimeout(() => {
      void this.tryCommit().catch(() => undefined);
    }, this.debounceMs);
  }

  private async tryCommit(): Promise<void> {
    if (!this.pending) {
      return;
    }
    const now = this.clock.now();
    const waitMs = this.lastCommitAt + this.minIntervalMs - now;
    if (waitMs > 0) {
      if (this.debounceId !== null) {
        this.clock.clearTimeout(this.debounceId);
      }
      this.debounceId = this.clock.setTimeout(() => {
        void this.tryCommit().catch(() => undefined);
      }, waitMs);
      return;
    }
    await this.doCommit();
  }

  private async doCommit(): Promise<void> {
    if (!this.pending) {
      return;
    }
    this.pending = false;
    try {
      await this.commit();
      this.lastCommitAt = this.clock.now();
    } catch (error) {
      // Re-arm on failure so we do not lose pending changes.
      this.pending = true;
      this.armDebounce();
      throw error;
    }
  }
}
