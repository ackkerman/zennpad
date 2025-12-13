import assert from "node:assert/strict";
import test from "node:test";
import { SyncScheduler, type Clock } from "../syncScheduler";

class FakeClock implements Clock {
  private t = 0;
  private timers: Array<{ at: number; fn: () => void; id: number }> = [];
  private nextId = 1;

  now(): number {
    return this.t;
  }

  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timers.push({ at: this.t + ms, fn, id });
    this.timers.sort((a, b) => a.at - b.at);
    return id;
  }

  clearTimeout(id: unknown): void {
    this.timers = this.timers.filter((x) => x.id !== id);
  }

  advance(ms: number): void {
    const target = this.t + ms;
    while (true) {
      this.timers.sort((a, b) => a.at - b.at);
      const next = this.timers[0];
      if (!next || next.at > target) {
        break;
      }
      this.t = next.at;
      this.timers.shift();
      next.fn();
    }
    this.t = target;
  }
}

test("debounces multiple dirty marks into one commit", async () => {
  const clock = new FakeClock();
  let commits = 0;
  const scheduler = new SyncScheduler(
    clock,
    async () => {
      commits += 1;
    },
    30_000,
    0
  );

  scheduler.markDirty();
  clock.advance(10_000);
  scheduler.markDirty();
  clock.advance(10_000);
  scheduler.markDirty();
  assert.equal(commits, 0);

  clock.advance(30_000);
  await Promise.resolve();

  assert.equal(commits, 1);
});

test("respects minimum interval between commits", async () => {
  const clock = new FakeClock();
  let commits = 0;
  const scheduler = new SyncScheduler(
    clock,
    async () => {
      commits += 1;
    },
    1_000,
    60_000
  );

  scheduler.markDirty();
  clock.advance(1_000);
  await Promise.resolve();
  assert.equal(commits, 1);

  scheduler.markDirty();
  clock.advance(1_000);
  await Promise.resolve();
  assert.equal(commits, 1);

  clock.advance(60_000);
  await Promise.resolve();
  assert.equal(commits, 2);
});

test("re-arms when commit fails", async () => {
  const clock = new FakeClock();
  let attempts = 0;
  const scheduler = new SyncScheduler(
    clock,
    async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("fail once");
      }
    },
    5_000,
    0
  );

  scheduler.markDirty();
  clock.advance(5_000);
  await Promise.resolve().catch(() => undefined);
  assert.equal(attempts, 1);

  clock.advance(5_000);
  await Promise.resolve();
  assert.equal(attempts, 2);
});
