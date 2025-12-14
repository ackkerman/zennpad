import assert from "node:assert/strict";
import test from "node:test";
import { withMockedVscode } from "./helpers/testUtils";

function createVscodeStub() {
  class Uri {
    constructor(
      public readonly scheme: string,
      public readonly path: string
    ) {}
    static from(init: { scheme: string; path: string }): Uri {
      return new Uri(init.scheme, init.path);
    }
  }

  const FileType = {
    File: 1,
    Directory: 2
  } as const;

  return {
    Uri,
    FileType
  };
}

test("zenn path helpers handle relative path extraction and preview routing", async () => {
  await withMockedVscode(async () => {
    const { toRelativeZennPath, toPreviewUrlPath, isZennUri } =
      await import("../utils/path/zennPath");
    const vscode = await import("vscode");

    const articleUri = vscode.Uri.from({ scheme: "zenn", path: "/articles/20240101_hello.md" });
    assert.equal(isZennUri(articleUri), true);
    assert.equal(toRelativeZennPath(articleUri), "articles/20240101_hello.md");
    assert.equal(toPreviewUrlPath("articles/20240101_hello.md"), "articles/20240101_hello");

    const bookChapter = "books/my-book/01-intro.md";
    assert.equal(toPreviewUrlPath(bookChapter), "books/my-book/01-intro");

    const bookConfig = "books/my-book/config.yaml";
    assert.equal(toPreviewUrlPath(bookConfig), "books/my-book");

    const nonPreviewable = "images/pic.png";
    assert.equal(toPreviewUrlPath(nonPreviewable), null);

    const nonZennUri = vscode.Uri.from({ scheme: "file", path: "/articles/20240101_hello.md" });
    assert.equal(toRelativeZennPath(nonZennUri), null);
  }, createVscodeStub());
});
