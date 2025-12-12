import * as vscode from "vscode";
import { ZennFsProvider } from "./zennFsProvider";

export type ZennNodeType = "articles" | "books" | "drafts" | "chapter" | "book" | "article";

export interface ZennTreeItemDescriptor {
  readonly label: string;
  readonly collapsibleState: vscode.TreeItemCollapsibleState;
  readonly contextValue: ZennNodeType;
  readonly description?: string;
  readonly resourceUri?: vscode.Uri;
}

class ZennTreeItem extends vscode.TreeItem {
  constructor(public readonly descriptor: ZennTreeItemDescriptor) {
    super(descriptor.label, descriptor.collapsibleState);
    this.contextValue = descriptor.contextValue;
    this.description = descriptor.description;
    this.resourceUri = descriptor.resourceUri;
    if (descriptor.resourceUri && descriptor.collapsibleState === vscode.TreeItemCollapsibleState.None) {
      this.command = {
        command: "vscode.open",
        title: "Open Zenn content",
        arguments: [descriptor.resourceUri]
      };
    }
  }
}

export class ZennTreeDataProvider implements vscode.TreeDataProvider<ZennTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ZennTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ZennTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(private readonly fsProvider: ZennFsProvider, private readonly scheme = "zenn") {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ZennTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ZennTreeItem): vscode.ProviderResult<ZennTreeItem[]> {
    if (!element) {
      return this.rootNodes.map((descriptor) => new ZennTreeItem(descriptor));
    }

    switch (element.descriptor.contextValue) {
      case "articles":
        return this.getArticleItems();
      case "books":
        return this.getBookNodes();
      case "book":
        return this.getChapterItems(element);
      case "drafts":
        return this.getDraftItems();
      default:
        return [];
    }
  }

  private getArticleItems(): ZennTreeItem[] {
    return this.readDirectory("/articles")
      .filter(([, type]) => type === vscode.FileType.File)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name]) =>
        new ZennTreeItem({
          label: name,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: "article",
          resourceUri: this.buildUri(`/articles/${name}`)
        })
      );
  }

  private getDraftItems(): ZennTreeItem[] {
    const draftPattern = /(draft|daily)/i;
    return this.readDirectory("/articles")
      .filter(([name, type]) => type === vscode.FileType.File && draftPattern.test(name))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name]) =>
        new ZennTreeItem({
          label: name,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: "article",
          description: "draft",
          resourceUri: this.buildUri(`/articles/${name}`)
        })
      );
  }

  private getBookNodes(): ZennTreeItem[] {
    return this.readDirectory("/books")
      .filter(([, type]) => type === vscode.FileType.Directory)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name]) =>
        new ZennTreeItem({
          label: name,
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
          contextValue: "book",
          resourceUri: this.buildUri(`/books/${name}`)
        })
      );
  }

  private getChapterItems(bookNode: ZennTreeItem): ZennTreeItem[] {
    const bookPath = bookNode.descriptor.resourceUri?.path;
    if (!bookPath) {
      return [];
    }
    return this.readDirectory(bookPath)
      .filter(([, type]) => type === vscode.FileType.File)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name]) =>
        new ZennTreeItem({
          label: name,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: "chapter",
          resourceUri: this.buildUri(`${bookPath}/${name}`)
        })
      );
  }

  private readDirectory(path: string): [string, vscode.FileType][] {
    try {
      return this.fsProvider.readDirectory(this.buildUri(path));
    } catch {
      return [];
    }
  }

  private buildUri(path: string): vscode.Uri {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return vscode.Uri.from({ scheme: this.scheme, path: normalizedPath });
  }

  private get rootNodes(): ZennTreeItemDescriptor[] {
    return [
      {
        label: "Articles",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: "articles",
        resourceUri: vscode.Uri.from({ scheme: this.scheme, path: "/articles" })
      },
      {
        label: "Books",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: "books",
        resourceUri: vscode.Uri.from({ scheme: this.scheme, path: "/books" })
      },
      {
        label: "Drafts / Daily",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: "drafts",
        resourceUri: vscode.Uri.from({ scheme: this.scheme, path: "/articles" })
      }
    ];
  }
}
