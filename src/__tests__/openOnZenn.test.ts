import assert from "node:assert/strict";
import test from "node:test";
import { withMockedVscode } from "./helpers/testUtils";

function createVscodeStub() {
  return {
    Uri: class Uri {},
    workspace: { getConfiguration: () => ({ get: () => "" }) }
  };
}

test("buildZennUrl generates article preview and published URLs", async () => {
  await withMockedVscode(async () => {
    const { buildZennUrl } = await import("../commands/openOnZenn");
    const draft = buildZennUrl("alice", "articles/20240101_hello.md", false);
    const published = buildZennUrl("alice", "articles/20240101_hello.md", true);

    assert.equal(draft, "https://zenn.dev/alice/articles/20240101_hello?preview=1");
    assert.equal(published, "https://zenn.dev/alice/articles/20240101_hello");
  }, createVscodeStub());
});

test("buildZennUrl generates book URL", async () => {
  await withMockedVscode(async () => {
    const { buildZennUrl } = await import("../commands/openOnZenn");
    const url = buildZennUrl("bob", "books/my-book/config.yaml", true);
    assert.equal(url, "https://zenn.dev/bob/books/my-book");
  }, createVscodeStub());
});

test("buildZennUrl returns undefined for unsupported paths", async () => {
  await withMockedVscode(async () => {
    const { buildZennUrl } = await import("../commands/openOnZenn");
    assert.equal(buildZennUrl("alice", "images/pic.png", true), undefined);
    assert.equal(buildZennUrl("alice", "README.md", true), undefined);
  }, createVscodeStub());
});
