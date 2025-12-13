import assert from "node:assert/strict";
import test from "node:test";
import { PendingState, hashContent } from "../github/pendingState";

test("pending state records writes and deletes with hash dedupe", () => {
  const state = new PendingState();
  const content = Buffer.from("hello");
  const hash = hashContent(content);

  // first write should register
  assert.equal(state.recordWrite("work", "articles/a.md", content, hash), true);
  // same hash should be ignored
  assert.equal(state.recordWrite("work", "articles/a.md", content, hash), false);

  // delete then write should re-register
  state.recordDelete("articles/a.md");
  assert.equal(state.recordWrite("work", "articles/a.md", content, hash), true);
});

test("applyCommitResult clears pending and updates hashes", () => {
  const state = new PendingState();
  const content = Buffer.from("hello");
  const hash = hashContent(content);

  state.recordWrite("work", "articles/a.md", content, hash);
  const snapshot = state.snapshot();
  const treeEntries = [{ path: "articles/a.md", sha: "abc" }];

  state.applyCommitResult("work", treeEntries, snapshot);

  assert.equal(state.hasPending(), false);
  const hashes = state.getBranchHashMap("work");
  assert.equal(hashes["articles/a.md"], hash);
});

test("recordRename moves delete and write atoms", () => {
  const state = new PendingState();
  const content = Buffer.from("hello");
  const hash = hashContent(content);

  state.recordWrite("work", "articles/old.md", content, hash);
  state.recordRename("work", "articles/old.md", "articles/new.md", content, hash);

  const snapshot = state.snapshot();
  const writes = snapshot.writes.map(([p]) => p);
  const deletes = snapshot.deletes;

  assert.deepEqual(writes, ["articles/new.md"]);
  assert.deepEqual(deletes, ["articles/old.md"]);
});
