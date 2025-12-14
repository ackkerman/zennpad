import * as vscode from "vscode";
import { Octokit } from "@octokit/rest";

const providerId = "github";
const scopes = ["repo"];

export async function getOctokit(): Promise<Octokit> {
  const session = await vscode.authentication.getSession(providerId, scopes, {
    createIfNone: true
  });
  if (!session) {
    throw new Error("GitHub authentication is required to access Zenn content.");
  }
  return new Octokit({ auth: session.accessToken });
}

export async function signInToGitHub(): Promise<void> {
  await vscode.authentication.getSession(providerId, scopes, { createIfNone: true });
}

export async function signOutFromGitHub(): Promise<void> {
  try {
    await vscode.commands.executeCommand("github.signout");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("github.signout")) {
      void vscode.window.showWarningMessage(
        "GitHub sign-out command is unavailable. Please remove the session from VS Code Accounts or reload the GitHub Authentication extension."
      );
      return;
    }
    throw error;
  }
}
