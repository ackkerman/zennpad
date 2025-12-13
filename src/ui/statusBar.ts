import * as vscode from "vscode";

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

  constructor(private readonly item: vscode.StatusBarItem) {}

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
    const repo = this.state.repoSummary ?? "GitHub: 未設定";
    const zenn = this.state.zennOwner ?? "Zenn: 未設定";
    const autoSync = this.state.autoSyncPaused ? "$(debug-pause) AutoSync: Off" : "$(sync) AutoSync: On";
    const pending =
      this.state.pending > 0 ? ` | $(circle-large-filled) Pending: ${this.state.pending}` : " | Pending: 0";
    this.item.text = `$(book) ${repo} → $(globe) ${zenn} | ${autoSync}${pending}`;
    const tooltipLines = [
      `GitHub: ${repo}`,
      `Zenn: ${zenn}`,
      `Auto Sync: ${this.state.autoSyncPaused ? "Paused" : "Running"}`,
      `Pending changes: ${this.state.pending}`
    ];
    this.item.tooltip = tooltipLines.join("\n");
    this.item.show();
  }
}
