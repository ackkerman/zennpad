import * as vscode from "vscode";
import { getZennOwner } from "../config";
import { HELP_LINKS, HelpLink, helpLinkLabel } from "./helpGuide";

type TreeNode =
  | {
      type: "action";
      id: string;
      label: string;
      description?: string;
      icon: vscode.ThemeIcon;
      command: vscode.Command;
    }
  | {
      type: "group";
      id: string;
      label: string;
      icon: vscode.ThemeIcon;
    }
  | {
      type: "help";
      id: string;
      link: HelpLink;
      label: string;
      description?: string;
      icon: vscode.ThemeIcon;
    };

export class ActionsViewProvider implements vscode.TreeDataProvider<TreeNode> {
  static readonly viewId = "zennpad.actions";
  private readonly emitter = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.commands.registerCommand("zennpad.actions.openZennFromTree", async () => {
        await this.handleOpenZenn();
      }),
      vscode.commands.registerCommand("zennpad.actions.openHelpLink", async (link: HelpLink) => {
        await this.handleOpenHelp(link);
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration("zennpad.zennAccount") ||
          e.affectsConfiguration("zennpad.githubOwner")
        ) {
          this.refresh();
        }
      })
    );
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.type === "group") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = element.icon;
      return item;
    }
    if (element.type === "help") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      const desc = element.description;
      item.description = desc && desc.includes("localhost") ? undefined : desc;
      item.command = {
        command: "zennpad.actions.openHelpLink",
        title: element.label,
        arguments: [element.link]
      };
      return item;
    }
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    const desc = element.description;
    item.description = desc && desc.includes("localhost") ? undefined : desc;
    item.iconPath = element.icon;
    item.command = element.command;
    return item;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    const locale = vscode.env.language ?? "en";
    const labels = localizedLabels(locale);
    if (element?.type === "group" && element.id === "help") {
      return HELP_LINKS.map((link, index) => ({
        type: "help" as const,
        id: `help-${index}`,
        link,
        label: `${link.icon} ${helpLinkLabel(link, locale)}`,
        description: link.url,
        icon: new vscode.ThemeIcon("globe")
      }));
    }
    const config = vscode.workspace.getConfiguration("zennpad");
    const zennUser = getZennOwner(config);
    const zennDescription = zennUser ? `zenn.dev/${zennUser}` : labels.zennUserPlaceholder;
    return [
      {
        type: "action",
        id: "signin",
        label: labels.signIn,
        icon: new vscode.ThemeIcon("sign-in"),
        command: { command: "zennpad.signIn", title: labels.signIn }
      },
      {
        type: "action",
        id: "settings",
        label: labels.openSettings,
        icon: new vscode.ThemeIcon("gear"),
        command: { command: "zennpad.openSettingsPanel", title: labels.openSettings }
      },
      {
        type: "action",
        id: "open-zenn",
        label: labels.openZenn,
        description: zennDescription,
        icon: new vscode.ThemeIcon("globe"),
        command: { command: "zennpad.actions.openZennFromTree", title: labels.openZenn }
      },
      {
        type: "group",
        id: "help",
        label: labels.helpLabel,
        icon: new vscode.ThemeIcon("question")
      }
    ];
  }

  refresh(): void {
    this.emitter.fire();
  }

  private async handleOpenZenn(): Promise<void> {
    const config = vscode.workspace.getConfiguration("zennpad");
    const current = getZennOwner(config) ?? "";
    const locale = vscode.env.language ?? "en";
    const labels = localizedLabels(locale);
    const input = await vscode.window.showInputBox({
      title: labels.openZenn,
      prompt: labels.zennUserPlaceholder,
      value: current
    });
    if (input === undefined) {
      return;
    }
    const trimmed = input.trim();
    if (!trimmed) {
      void vscode.window.showWarningMessage(labels.requireUser);
      return;
    }
    await config.update("zennAccount", trimmed, vscode.ConfigurationTarget.Global);
    void vscode.env.openExternal(vscode.Uri.parse(`https://zenn.dev/${trimmed}`));
    this.refresh();
  }

  private async handleOpenHelp(link: HelpLink): Promise<void> {
    if (link.previewPath) {
      await vscode.commands.executeCommand("zennpad.preview.openPath", link.previewPath);
      return;
    }
    await vscode.env.openExternal(vscode.Uri.parse(link.url));
  }
}

function localizedLabels(locale: string): {
  lang: string;
  signIn: string;
  openSettings: string;
  zennUserPlaceholder: string;
  openZenn: string;
  requireUser: string;
  helpLabel: string;
} {
  const lang = (locale || "en").toLowerCase();
  if (lang.startsWith("ja")) {
    return {
      lang: "ja",
      signIn: "GitHub にサインイン",
      openSettings: "設定を開く",
      zennUserPlaceholder: "zenn.dev/{username}",
      openZenn: "Zenn を開く",
      requireUser: "Zenn ユーザー名を入力してください。",
      helpLabel: "ヘルプ"
    };
  }
  return {
    lang: "en",
    signIn: "Sign in to GitHub",
    openSettings: "Open Settings",
    zennUserPlaceholder: "zenn.dev/{username}",
    openZenn: "Open Zenn",
    requireUser: "Enter your Zenn username.",
    helpLabel: "Help"
  };
}
