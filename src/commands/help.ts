import * as vscode from "vscode";
import { PRIMARY_HELP_URL } from "../ui/helpGuide";

export function registerHelpCommands(
  _context: vscode.ExtensionContext,
  _deps: unknown
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("zennpad.openHelpGuide", () => {
      void vscode.env.openExternal(vscode.Uri.parse(PRIMARY_HELP_URL));
    }),
    vscode.commands.registerCommand("zennpad.openHelpGuideExternal", () => {
      void vscode.env.openExternal(vscode.Uri.parse(PRIMARY_HELP_URL));
    })
  ];
}
