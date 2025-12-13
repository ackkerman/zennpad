import * as vscode from "vscode";
import { registerAuthCommands } from "./auth";
import { registerContentCommands } from "./content";
import { registerPreviewCommands } from "./preview";
import { registerSortCommands } from "./sort";
import { registerSyncCommands } from "./sync";
import { updatePreviewableContext } from "../context";
import { CommandDeps } from "./types";

export function registerCommands(context: vscode.ExtensionContext, deps: CommandDeps): void {
  const disposables: vscode.Disposable[] = [
    ...registerAuthCommands(context, deps),
    ...registerContentCommands(context, deps),
    ...registerPreviewCommands(context, {
      previewWorkspace: deps.previewWorkspace,
      previewManager: deps.previewManager
    }),
    ...registerSyncCommands(context, deps, deps.treeDataProvider),
    ...registerSortCommands(context, deps, deps.treeDataProvider)
  ];

  disposables.forEach((d) => context.subscriptions.push(d));
  updatePreviewableContext();
}
