import assert from "node:assert/strict";
import test from "node:test";
import type { Octokit } from "@octokit/rest";
import { resolveGitHubFileBuffer } from "../github/fileContent";
import type { RepoConfig } from "../github/repoConfig";

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
