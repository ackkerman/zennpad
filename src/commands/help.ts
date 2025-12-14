import * as vscode from "vscode";
import { CommandDeps } from "./types";
import { PRIMARY_HELP_URL } from "../ui/helpGuide";

export function registerHelpCommands(
  context: vscode.ExtensionContext,
  deps: CommandDeps
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("zennpad.openHelpGuide", () => {
      deps.helpGuidePanel.show();
    }),
    vscode.commands.registerCommand("zennpad.openHelpGuideExternal", () => {
      void vscode.env.openExternal(vscode.Uri.parse(PRIMARY_HELP_URL));
    })
  ];
}
