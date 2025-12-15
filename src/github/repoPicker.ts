import * as vscode from "vscode";
import { getOctokit } from "./auth";

interface RepoQuickPickItem extends vscode.QuickPickItem {
  owner: string;
  repo: string;
}

export interface RepoSelection {
  owner: string;
  repo: string;
}

export async function pickGitHubRepo(placeHolder: string): Promise<RepoSelection | undefined> {
  const octokit = await getOctokit();
  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    per_page: 100,
    affiliation: "owner,collaborator,organization_member"
  });

  if (repos.length === 0) {
    void vscode.window.showWarningMessage("No accessible GitHub repositories were found.");
    return undefined;
  }

  const items: RepoQuickPickItem[] = repos
    .map((repo) => ({
      label: repo.full_name ?? `${repo.owner?.login ?? ""}/${repo.name}`,
      description: repo.private ? "Private" : "Public",
      detail: repo.description || undefined,
      owner: repo.owner?.login ?? "",
      repo: repo.name
    }))
    .filter((item) => !!item.owner && !!item.repo)
    .sort((a, b) => a.label.localeCompare(b.label));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder,
    matchOnDetail: true
  });
  if (!picked) {
    return undefined;
  }

  return { owner: picked.owner, repo: picked.repo };
}
