import * as vscode from "vscode";
import { getOctokit, signInToGitHub, signOutFromGitHub } from "../github/auth";
import { getMainBranch, getRepoConfigSummary, getZennOwner } from "../config";
import { showSettingsPanel } from "../ui/settingsPanel";
import { CommandDeps } from "./types";

export function registerAuthCommands(context: vscode.ExtensionContext, deps: CommandDeps): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("zennpad.signIn", async () => {
      try {
        await signInToGitHub();
        await deps.updateAuthStatus();
        const repo = getRepoConfigSummary();
        vscode.window.showInformationMessage(`Signed in to GitHub for ZennPad${repo ? ` (${repo})` : ""}.`);
      } catch (error) {
        deps.handleAuthError(error, "sign-in");
      }
    }),
    vscode.commands.registerCommand("zennpad.signOut", async () => {
      await signOutFromGitHub();
      await deps.updateAuthStatus();
      vscode.window.showInformationMessage("Signed out from GitHub for ZennPad.");
    }),
    vscode.commands.registerCommand("zennpad.openSettings", async () => {
      await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:ackkerman.zennpad");
    }),
    vscode.commands.registerCommand("zennpad.authHelp", async () => {
      await showSettingsPanel(deps.githubSync, deps.setAutoSyncContext);
    }),
    vscode.commands.registerCommand("zennpad.openSettingsPanel", async () => {
      await showSettingsPanel(deps.githubSync, deps.setAutoSyncContext);
    }),
    vscode.commands.registerCommand("zennpad.openZennRoot", async () => {
      const config = vscode.workspace.getConfiguration("zennpad");
      const owner = getZennOwner(config);
      if (!owner) {
        vscode.window.showErrorMessage("Set zennpad.githubOwner or zennpad.zennAccount to open Zenn.");
        return;
      }
      void vscode.env.openExternal(vscode.Uri.parse(`https://zenn.dev/${owner}`));
    }),
    vscode.commands.registerCommand("zennpad.openGithubRoot", async () => {
      const config = vscode.workspace.getConfiguration("zennpad");
      const owner = config.get<string>("githubOwner")?.trim();
      const repo = config.get<string>("githubRepo")?.trim();
      const branch = getMainBranch(config);
      if (!owner || !repo) {
        vscode.window.showErrorMessage("Set zennpad.githubOwner and zennpad.githubRepo to open GitHub.");
        return;
      }
      void vscode.env.openExternal(vscode.Uri.parse(`https://github.com/${owner}/${repo}/tree/${branch}`));
    }),
    vscode.commands.registerCommand("zennpad.chooseRepo", async () => {
      try {
        const octokit = await getOctokit();
        const user = await octokit.rest.users.getAuthenticated();
        const login = user.data.login;
        const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
          per_page: 100,
          affiliation: "owner"
        });
        const pick = await vscode.window.showQuickPick(
          repos.map((repoItem) => ({
            label: repoItem.name,
            description: repoItem.private ? `${login} (private)` : `${login} (public)`
          })),
          { placeHolder: "Select a GitHub repository for Zenn content" }
        );
        if (!pick) {
          return;
        }
        const config = vscode.workspace.getConfiguration("zennpad");
        await config.update("githubOwner", login, vscode.ConfigurationTarget.Global);
        await config.update("githubRepo", pick.label, vscode.ConfigurationTarget.Global);
        await deps.updateAuthStatus();
        await deps.githubSync.pullAll();
        deps.treeDataProvider.refresh();
        vscode.window.showInformationMessage(`Repository set to ${login}/${pick.label}`);
      } catch (error) {
        deps.handleAuthError(error, "choose repository");
      }
    })
  ];
}
