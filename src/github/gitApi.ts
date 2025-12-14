import { Octokit } from "@octokit/rest";
import { RepoConfig } from "./repoConfig";

export async function ensureWorkBranch(octokit: Octokit, repoConfig: RepoConfig): Promise<void> {
  try {
    await octokit.git.getRef({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      ref: `heads/${repoConfig.workBranch}`
    });
    return;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }
  const mainHead = await octokit.git.getRef({
    owner: repoConfig.owner,
    repo: repoConfig.repo,
    ref: `heads/${repoConfig.mainBranch}`
  });
  await octokit.git.createRef({
    owner: repoConfig.owner,
    repo: repoConfig.repo,
    ref: `refs/heads/${repoConfig.workBranch}`,
    sha: mainHead.data.object.sha
  });
}

export async function getHeadRefs(
  branch: string,
  octokit: Octokit,
  repoConfig: RepoConfig
): Promise<{ headSha: string; treeSha: string }> {
  const head = await octokit.git.getRef({
    owner: repoConfig.owner,
    repo: repoConfig.repo,
    ref: `heads/${branch}`
  });
  const headSha = head.data.object.sha;
  const commit = await octokit.git.getCommit({
    owner: repoConfig.owner,
    repo: repoConfig.repo,
    commit_sha: headSha
  });
  return { headSha, treeSha: commit.data.tree.sha };
}

export async function buildTreeEntries(
  octokit: Octokit,
  repoConfig: RepoConfig,
  writesSnapshot: Array<[string, { content: Uint8Array }]>,
  deletesSnapshot: string[]
): Promise<Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }>> {
  const treeEntries: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }> = [];
  for (const [path, write] of writesSnapshot) {
    const blob = await octokit.git.createBlob({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      content: Buffer.from(write.content).toString("base64"),
      encoding: "base64"
    });
    treeEntries.push({ path, mode: "100644", type: "blob", sha: blob.data.sha });
  }
  for (const path of deletesSnapshot) {
    treeEntries.push({ path, mode: "100644", type: "blob", sha: null });
  }
  return treeEntries;
}

export function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status?: number }).status === 404
  );
}
