import type { Octokit } from "@octokit/rest";

export type RepoRef = {
  owner: string;
  repo: string;
};

export type FileContentData = {
  sha: string;
  content?: string | null;
  encoding?: string | null;
};

export async function resolveGitHubFileBuffer(
  octokit: Pick<Octokit, "git">,
  repo: RepoRef,
  file: FileContentData
): Promise<Buffer | null> {
  if (typeof file.content === "string") {
    if (file.encoding && file.encoding !== "base64") {
      throw new Error(`Unsupported encoding (${file.encoding}) for ${repo.owner}/${repo.repo}`);
    }
    return Buffer.from(file.content, "base64");
  }

  const blob = await octokit.git.getBlob({
    owner: repo.owner,
    repo: repo.repo,
    file_sha: file.sha
  });
  const blobContent = (blob.data as { content?: string | null }).content;
  const blobEncoding = (blob.data as { encoding?: string | null }).encoding;
  if (typeof blobContent !== "string") {
    return null;
  }
  if (blobEncoding && blobEncoding !== "base64") {
    throw new Error(`Unsupported encoding (${blobEncoding}) for ${repo.owner}/${repo.repo}`);
  }
  return Buffer.from(blobContent, "base64");
}
