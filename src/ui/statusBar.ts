import * as vscode from "vscode";

export async function withStatusBarSpinner<T>(
  item: vscode.StatusBarItem,
  text: string,
  task: () => Promise<T>
): Promise<T> {
  item.text = `$(sync~spin) ${text}`;
  item.tooltip = text;
  item.show();
  try {
    return await task();
  } finally {
    item.hide();
  }
}
