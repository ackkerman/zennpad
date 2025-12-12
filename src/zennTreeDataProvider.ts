import * as vscode from "vscode";

export type ZennNodeType = "articles" | "books" | "drafts" | "chapter" | "book" | "article";

export interface ZennTreeItemDescriptor {
  readonly label: string;
  readonly collapsibleState: vscode.TreeItemCollapsibleState;
  readonly contextValue: ZennNodeType;
  readonly description?: string;
}

class ZennTreeItem extends vscode.TreeItem {
  constructor(public readonly descriptor: ZennTreeItemDescriptor) {
    super(descriptor.label, descriptor.collapsibleState);
    this.contextValue = descriptor.contextValue;
    this.description = descriptor.description;
  }
}

export class ZennTreeDataProvider implements vscode.TreeDataProvider<ZennTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ZennTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ZennTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private readonly scaffoldNodes: ZennTreeItemDescriptor[] = [
    { label: "Articles", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed, contextValue: "articles" },
    { label: "Books", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed, contextValue: "books" },
    { label: "Drafts / Daily", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed, contextValue: "drafts" }
  ];

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ZennTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ZennTreeItem): vscode.ProviderResult<ZennTreeItem[]> {
    if (!element) {
      return this.scaffoldNodes.map((descriptor) => new ZennTreeItem(descriptor));
    }

    switch (element.descriptor.contextValue) {
      case "articles":
        return [
          new ZennTreeItem({
            label: "sample-article.md",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: "article",
            description: "draft"
          })
        ];
      case "books":
        return [
          new ZennTreeItem({
            label: "example-book",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: "book"
          })
        ];
      case "book":
        return [
          new ZennTreeItem({
            label: "chapter-1.md",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: "chapter"
          })
        ];
      case "drafts":
        return [
          new ZennTreeItem({
            label: `${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_daily-draft.md`,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: "article",
            description: "placeholder"
          })
        ];
      default:
        return [];
    }
  }
}
