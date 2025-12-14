import * as vscode from "vscode";
import { isZennUri } from "../utils/path/zennPath";
import { PreviewWorkspace } from "../preview/previewWorkspace";
import { PreviewManager } from "../preview/previewManager";
import { updatePreviewableContext } from "../context";

export function registerPreviewCommands(
  context: vscode.ExtensionContext,
  deps: { previewWorkspace: PreviewWorkspace; previewManager: PreviewManager }
): vscode.Disposable[] {
  const { previewWorkspace, previewManager } = deps;
  return [
    vscode.commands.registerCommand("zennpad.preview", async () => {
      const active = vscode.window.activeTextEditor?.document;
      if (!active || !isZennUri(active.uri)) {
        vscode.window.showWarningMessage("No active ZennPad editor to preview.");
        return;
      }
      await previewWorkspace.syncDocument(active);
      await previewManager.open(active);
      updatePreviewableContext();
    }),
    vscode.commands.registerCommand("zennpad.preview.openPath", async (previewPath?: string) => {
      if (!previewPath || typeof previewPath !== "string") {
        vscode.window.showWarningMessage("[ZennPad Preview] preview path is required.");
        return;
      }
      await previewManager.navigate(previewPath);
    })
  ];
}
