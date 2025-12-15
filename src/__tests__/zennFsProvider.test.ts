import assert from "node:assert/strict";
import test from "node:test";
import { createVscodeStub, withMockedVscode } from "./helpers/testUtils";

test("ZennFsProvider writes, reads, lists, and notifies mutations", async () => {
  await withMockedVscode(async () => {
    const { ZennFsProvider } = await import("../fs/zennFsProvider");
    const vscode = await import("vscode");
    const provider = new ZennFsProvider();
    const mutations: unknown[] = [];
    provider.onDidMutate((m) => mutations.push(m));

    const root = vscode.Uri.from({ scheme: "zenn", path: "/" });
    const articles = vscode.Uri.from({ scheme: "zenn", path: "/articles" });
    provider.createDirectory(root);
    provider.createDirectory(articles);

    const fileUri = vscode.Uri.from({ scheme: "zenn", path: "/articles/a.md" });
    provider.writeFile(fileUri, Buffer.from("hello"), { create: true, overwrite: true });

    assert.equal(provider.readFile(fileUri).toString(), "hello");
    assert.deepEqual(provider.readDirectory(root), [["articles", vscode.FileType.Directory]]);
    assert.deepEqual(provider.readDirectory(articles), [["a.md", vscode.FileType.File]]);
    assert.equal((mutations[0] as { type: string }).type, "write");
  }, createVscodeStub());
});

test("ZennFsProvider rename and delete emit mutations and move data", async () => {
  await withMockedVscode(async () => {
    const { ZennFsProvider } = await import("../fs/zennFsProvider");
    const vscode = await import("vscode");
    const provider = new ZennFsProvider();
    const mutations: Array<{ type: string; uri?: { path: string }; newUri?: { path: string } }> =
      [];
    provider.onDidMutate((m) => mutations.push(m as (typeof mutations)[number]));

    const oldUri = vscode.Uri.from({ scheme: "zenn", path: "/articles/old.md" });
    const newUri = vscode.Uri.from({ scheme: "zenn", path: "/articles/new.md" });
    provider.writeFile(oldUri, Buffer.from("hello"), { create: true, overwrite: true });

    provider.rename(oldUri, newUri, { overwrite: false });
    assert.equal(provider.readFile(newUri).toString(), "hello");

    provider.delete(newUri, { recursive: true });
    assert.throws(() => provider.readFile(newUri));

    const types = mutations.map((m) => m.type);
    assert.deepEqual(types, ["write", "rename", "delete"]);
    assert.equal(mutations[1]?.type, "rename");
    assert.equal(mutations[1]?.newUri?.path, "/articles/new.md");
  }, createVscodeStub());
});

test("delete without recursive flag fails when directory has children", async () => {
  await withMockedVscode(async () => {
    const { ZennFsProvider } = await import("../fs/zennFsProvider");
    const vscode = await import("vscode");
    const provider = new ZennFsProvider();
    const dir = vscode.Uri.from({ scheme: "zenn", path: "/images" });
    const child = vscode.Uri.from({ scheme: "zenn", path: "/images/icon.png" });

    provider.createDirectory(dir);
    provider.writeFile(child, Buffer.from("data"), { create: true, overwrite: true });

    assert.throws(() => provider.delete(dir, { recursive: false }));
  }, createVscodeStub());
});
