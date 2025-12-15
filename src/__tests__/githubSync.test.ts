import assert from "node:assert/strict";
import test from "node:test";
import type { Octokit } from "@octokit/rest";
import { resolveGitHubFileBuffer } from "../github/fileContent";
import type { RepoConfig } from "../github/repoConfig";
import { createVscodeStub, withMockedVscode } from "./helpers/testUtils";

const repoConfig: RepoConfig = {
  owner: "owner",
  repo: "repo",
  mainBranch: "main",
  workBranch: "work"
};

test("resolveGitHubFileBuffer decodes inline base64 content without blob fetch", async () => {
  let blobCalled = false;
  const octokit = {
    git: {
      async getBlob(): Promise<{ data: { content: string } }> {
        blobCalled = true;
        return { data: { content: "" } };
      }
    }
  } as unknown as Pick<Octokit, "git">;

  const buffer = await resolveGitHubFileBuffer(octokit, repoConfig, {
    sha: "sha123",
    content: Buffer.from("hello").toString("base64"),
    encoding: "base64"
  });

  assert.equal(blobCalled, false);
  assert.equal(buffer?.toString("utf8"), "hello");
});

test("resolveGitHubFileBuffer falls back to git.getBlob when content is absent", async () => {
  let blobCalls = 0;
  const expected = Buffer.from("image-bytes");
  const octokit = {
    git: {
      async getBlob(params: {
        file_sha: string;
      }): Promise<{ data: { content: string; encoding: string } }> {
        blobCalls += 1;
        assert.equal(params.file_sha, "sha456");
        return { data: { content: expected.toString("base64"), encoding: "base64" } };
      }
    }
  } as unknown as Pick<Octokit, "git">;

  const buffer = await resolveGitHubFileBuffer(octokit, repoConfig, {
    sha: "sha456"
  });

  assert.equal(blobCalls, 1);
  assert.equal(buffer?.toString("utf8"), expected.toString("utf8"));
});

test("pullDirectory creates directories and prunes stale local entries", async () => {
  await withMockedVscode(async () => {
    const { GitHubSync } = await import("../github/sync");
    const { ZennFsProvider } = await import("../fs/zennFsProvider");
    const vscode = await import("vscode");

    const octokit = {
      repos: {
        async getContent({ path }: { path: string }) {
          if (path === "articles") {
            return {
              data: [
                { type: "dir", path: "articles/posts" },
                { type: "file", path: "articles/keep.md" }
              ]
            };
          }
          if (path === "articles/posts") {
            return { data: [{ type: "file", path: "articles/posts/new.md" }] };
          }
          if (path === "articles/keep.md") {
            return {
              data: {
                type: "file",
                sha: "keep-sha",
                content: Buffer.from("keep").toString("base64"),
                encoding: "base64"
              }
            };
          }
          if (path === "articles/posts/new.md") {
            return {
              data: {
                type: "file",
                sha: "new-sha",
                content: Buffer.from("new content").toString("base64"),
                encoding: "base64"
              }
            };
          }
          throw new Error(`Unexpected path ${path}`);
        }
      }
    } as unknown as Pick<Octokit, "repos">;

    const fsProvider = new ZennFsProvider();
    const githubSync = new GitHubSync(fsProvider);

    const staleUri = vscode.Uri.from({ scheme: "zenn", path: "/articles/stale.md" });
    fsProvider.writeFile(staleUri, Buffer.from("stale"), { create: true, overwrite: true });

    const pulled = await (githubSync as unknown as {
      pullDirectory(
        octokit: Pick<Octokit, "repos">,
        repoConfig: RepoConfig,
        remotePath: string,
        branch: string
      ): Promise<Set<string>>;
    }).pullDirectory(octokit, repoConfig, "articles", repoConfig.workBranch);

    const remotePaths = new Set<string>([...pulled, "/"]);
    (githubSync as unknown as {
      pruneLocalEntries(remotePaths: Set<string>): void;
    }).pruneLocalEntries(remotePaths);

    const articles = vscode.Uri.from({ scheme: "zenn", path: "/articles" });
    const posts = vscode.Uri.from({ scheme: "zenn", path: "/articles/posts" });
    const entries = fsProvider
      .readDirectory(articles)
      .sort((a, b) => a[0].localeCompare(b[0]));

    assert.deepEqual(entries, [
      ["keep.md", vscode.FileType.File],
      ["posts", vscode.FileType.Directory]
    ]);
    assert.deepEqual(fsProvider.readDirectory(posts), [["new.md", vscode.FileType.File]]);
    assert.equal(
      fsProvider.readFile(vscode.Uri.from({ scheme: "zenn", path: "/articles/keep.md" })).toString(),
      "keep"
    );
    assert.throws(() => fsProvider.readFile(staleUri));
  }, createVscodeStub());
});
