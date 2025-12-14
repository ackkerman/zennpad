import * as vscode from "vscode";

type IconStatusBarItem = vscode.StatusBarItem & {
  iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri };
};

interface StatusBarState {
  repoSummary?: string;
  zennOwner?: string;
  autoSyncPaused: boolean;
  pending: number;
}

export class StatusBarController {
  private state: StatusBarState = {
    autoSyncPaused: false,
    pending: 0
  };
  private readonly logoPaths: { light: vscode.Uri; dark: vscode.Uri };

  constructor(private readonly item: IconStatusBarItem, extensionUri: vscode.Uri) {
    this.logoPaths = {
      light: vscode.Uri.joinPath(extensionUri, "media/logo-only.svg"),
      dark: vscode.Uri.joinPath(extensionUri, "media/logo-only-white.svg")
    };
    this.applyIconPath();
  }

  setRepoSummary(repoSummary: string | undefined, zennOwner: string | undefined): void {
    this.state.repoSummary = repoSummary;
    this.state.zennOwner = zennOwner;
    this.render();
  }

  setAutoSyncPaused(paused: boolean): void {
    this.state.autoSyncPaused = paused;
    this.render();
  }

  setPendingCount(count: number): void {
    this.state.pending = count;
    this.render();
  }

  async withSpinner<T>(text: string, task: () => Promise<T>): Promise<T> {
    const previousText = this.item.text;
    const previousTooltip = this.item.tooltip;
    this.item.text = `$(sync~spin) ${text}`;
    this.item.tooltip = text;
    this.item.show();
    try {
      return await task();
    } finally {
      this.item.text = previousText;
      this.item.tooltip = previousTooltip;
      this.render();
    }
  }

  render(): void {
    this.applyIconPath();
    const repo = this.state.repoSummary ?? "GitHub: 未設定";
    const zenn = this.state.zennOwner ?? "Zenn: 未設定";
    const autoSync = this.state.autoSyncPaused ? "$(debug-pause) AutoSync: Off" : "$(sync) AutoSync: On";
    const pending =
      this.state.pending > 0 ? ` | $(circle-large-filled) Pending: ${this.state.pending}` : " | Pending: 0";
    this.item.text = `$(book) ${repo} → $(globe) ${zenn} | ${autoSync}${pending}`;
    const tooltip = new vscode.MarkdownString(undefined, true);
    tooltip.isTrusted = true;
    tooltip.appendMarkdown(`![ZennPad Logo](${this.activeLogoUri().toString()})\n\n`);
    tooltip.appendMarkdown(`**GitHub**: ${repo}\n\n`);
    tooltip.appendMarkdown(`**Zenn**: ${zenn}\n\n`);
    tooltip.appendMarkdown(`**Auto Sync**: ${this.state.autoSyncPaused ? "Paused" : "Running"}\n\n`);
    tooltip.appendMarkdown(`**Pending changes**: ${this.state.pending}`);
    this.item.tooltip = tooltip;
    this.item.show();
  }

  private applyIconPath(): void {
    this.item.iconPath = this.logoPaths;
  }

  private activeLogoUri(): vscode.Uri {
    const kind = vscode.window.activeColorTheme.kind;
    if (kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight) {
      return this.logoPaths.light;
    }
    return this.logoPaths.dark;
  }
}
