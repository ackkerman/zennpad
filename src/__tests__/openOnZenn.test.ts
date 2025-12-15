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

test("buildZennUrl generates book preview and published URLs", async () => {
  await withMockedVscode(async () => {
    const { buildZennUrl } = await import("../commands/openOnZenn");
    const draft = buildZennUrl("bob", "books/my-book/config.yaml", false);
    const published = buildZennUrl("bob", "books/my-book/config.yaml", true);

    assert.equal(draft, "https://zenn.dev/bob/books/my-book?preview=1");
    assert.equal(published, "https://zenn.dev/bob/books/my-book");
  }, createVscodeStub());
});

test("buildZennUrl generates book chapter URLs", async () => {
  await withMockedVscode(async () => {
    const { buildZennUrl } = await import("../commands/openOnZenn");
    const draft = buildZennUrl("carol", "books/my-book/01-intro.md", false);
    const published = buildZennUrl("carol", "books/my-book/01-intro.md", true);

    assert.equal(draft, "https://zenn.dev/carol/books/my-book/chapters/01-intro?preview=1");
    assert.equal(published, "https://zenn.dev/carol/books/my-book/chapters/01-intro");
  }, createVscodeStub());
});

test("buildZennUrl returns undefined for non-markdown book files", async () => {
  await withMockedVscode(async () => {
    const { buildZennUrl } = await import("../commands/openOnZenn");
    assert.equal(buildZennUrl("dave", "books/my-book/assets/logo.png", true), undefined);
    assert.equal(buildZennUrl("dave", "books/my-book/assets", false), undefined);
  }, createVscodeStub());
});

test("buildZennUrl returns undefined for unsupported paths", async () => {
  await withMockedVscode(async () => {
    const { buildZennUrl } = await import("../commands/openOnZenn");
    assert.equal(buildZennUrl("alice", "images/pic.png", true), undefined);
    assert.equal(buildZennUrl("alice", "README.md", true), undefined);
  }, createVscodeStub());
});
