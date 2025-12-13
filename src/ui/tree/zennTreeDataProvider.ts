import * as vscode from "vscode";
import { ZennFsProvider } from "../../fs/zennFsProvider";
import { TreeState } from "./treeState";
import { readFrontmatter, readPublished } from "./frontmatterIO";
import { buildTooltip, compareEntries, isImageFile, resolveLabel } from "./treeUtils";
import { BranchInfo, SortOrder, ZennNodeType } from "./types";

export interface ZennTreeItemDescriptor {
  readonly label: string;
  readonly collapsibleState: vscode.TreeItemCollapsibleState;
  readonly contextValue: ZennNodeType;
  readonly description?: string;
  readonly resourceUri?: vscode.Uri;
  readonly iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | string;
  readonly command?: vscode.Command;
  readonly published?: boolean;
  readonly tooltip?: string;
}

class ZennTreeItem extends vscode.TreeItem {
  constructor(public readonly descriptor: ZennTreeItemDescriptor) {
    super(descriptor.label, descriptor.collapsibleState);
    this.contextValue = descriptor.contextValue;
    this.description = descriptor.description;
    this.resourceUri = descriptor.resourceUri;
    this.tooltip = descriptor.tooltip;
    if (descriptor.resourceUri && descriptor.collapsibleState === vscode.TreeItemCollapsibleState.None) {
      this.command = {
        command: "vscode.open",
        title: "Open Zenn content",
        arguments: [descriptor.resourceUri]
      };
    }
    if (descriptor.iconPath) {
      this.iconPath = descriptor.iconPath;
    }
    if (descriptor.command) {
      this.command = descriptor.command;
    }
    if (typeof descriptor.published === "boolean" && descriptor.contextValue.startsWith("article")) {
      this.contextValue = descriptor.published ? "article:published" : "article:draft";
    }
  }
}

export class ZennTreeDataProvider implements vscode.TreeDataProvider<ZennTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ZennTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ZennTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;
  private readonly state = new TreeState();

  constructor(
    private readonly fsProvider: ZennFsProvider,
    private readonly extensionUri: vscode.Uri,
    private readonly scheme = "zenn"
  ) {}

  setStatus(status: { signedIn: boolean; hasRepoConfig: boolean }): void {
    this.state.setStatus(status);
    this.refresh();
  }

  setDirtyPaths(paths: Set<string>): void {
    this.state.setDirtyPaths(paths);
    this.refresh();
  }

  setBranchInfo(branches: BranchInfo): void {
    this.state.setBranchInfo(branches);
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ZennTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ZennTreeItem): vscode.ProviderResult<ZennTreeItem[]> {
    if (!element) {
      if (!this.state.isSignedIn()) {
        return [
          new ZennTreeItem({
            label: "Sign in to GitHub",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: "articles",
            description: "GitHub authentication required",
            iconPath: new vscode.ThemeIcon("sign-in"),
            command: { command: "zennpad.signIn", title: "Sign in to GitHub" }
          })
        ];
      }
      if (!this.state.hasRepo()) {
        return [
          new ZennTreeItem({
            label: "",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: "articles",
            description: "Set githubOwner/repo",
            iconPath: new vscode.ThemeIcon("gear"),
            command: { command: "zennpad.openSettings", title: "Open ZennPad Settings" }
          })
        ];
      }
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
      case "images":
        return this.getImageItems();
      default:
        return [];
    }
  }

  setSortOrder(order: SortOrder): void {
    this.state.setSortOrder(order);
    this.refresh();
  }

  getSortOrder(): SortOrder {
    return this.state.getSortOrder();
  }

  private getArticleItems(): ZennTreeItem[] {
    const entries = this.readDirectory("/articles")
      .filter(([, type]) => type === vscode.FileType.File)
      .map(([name]) => {
        const uri = this.buildUri(`/articles/${name}`);
        const isImage = isImageFile(name);
        const frontmatter = isImage ? undefined : readFrontmatter(this.fsProvider, uri);
        const published = frontmatter?.published;
        const label = resolveLabel(name, {
          title: frontmatter?.title,
          published,
          isDirty: this.state.isDirty(uri.path)
        });
        return { name, uri, isImage, frontmatter, published, label };
      })
      .sort((a, b) => compareEntries(a, b, this.state.getSortOrder()));

    return entries.map((entry) => {
      return new ZennTreeItem({
        label: entry.label,
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        contextValue: entry.isImage ? "image" : "article",
        resourceUri: entry.uri,
        published: entry.published,
        tooltip: entry.isImage ? `/images/${entry.name}` : buildTooltip(entry.frontmatter),
        description: !entry.isImage && entry.published === false ? "draft" : undefined
      });
    });
  }

  private getDraftItems(): ZennTreeItem[] {
    const drafts = this.readDirectory("/articles")
      .filter(([, type]) => type === vscode.FileType.File)
      .map(([name]) => {
        const uri = this.buildUri(`/articles/${name}`);
        if (isImageFile(name)) {
          return { name, uri, published: undefined, kind: "image" as const, frontmatter: undefined };
        }
        const published = readPublished(this.fsProvider, uri);
        const frontmatter = readFrontmatter(this.fsProvider, uri);
        return { name, uri, published, kind: "article" as const, frontmatter };
      })
      .filter((entry) => entry.kind === "image" || entry.published === false)
      .sort((a, b) => compareEntries(a, b, this.state.getSortOrder()))
      .map((entry) => {
        return new ZennTreeItem({
          label: resolveLabel(entry.name, {
            title: entry.kind === "image" ? undefined : entry.frontmatter?.title,
            published: entry.published,
            isDirty: this.state.isDirty(entry.uri.path)
          }),
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: entry.kind === "image" ? "image" : "article",
          description: entry.kind === "image" ? undefined : "draft",
          resourceUri: entry.uri,
          published: entry.published,
          tooltip: entry.kind === "image" ? `/images/${entry.name}` : buildTooltip(entry.frontmatter)
        });
      });
    return drafts;
  }

  private getBookNodes(): ZennTreeItem[] {
    return [
      new ZennTreeItem({
        label: "Books (coming soon)",
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        contextValue: "book",
        description: "開発中"
      })
    ];
  }

  private getChapterItems(bookNode: ZennTreeItem): ZennTreeItem[] {
    const bookPath = bookNode.descriptor.resourceUri?.path;
    if (!bookPath) {
      return [];
    }
    return this.readDirectory(bookPath)
      .filter(([, type]) => type === vscode.FileType.File)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name]) => {
        const uri = this.buildUri(`${bookPath}/${name}`);
        const isImage = isImageFile(name);
        const frontmatter = isImage ? undefined : readFrontmatter(this.fsProvider, uri);
        const published = frontmatter?.published;
        return new ZennTreeItem({
          label: resolveLabel(name, {
            title: frontmatter?.title,
            published,
            isDirty: this.state.isDirty(uri.path)
          }),
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: isImage ? "image" : "chapter",
          resourceUri: uri,
          published,
          tooltip: isImage ? `/images/${name}` : buildTooltip(frontmatter)
        });
      });
  }

  private get rootNodes(): ZennTreeItemDescriptor[] {
    const branchInfo = this.state.getBranchInfo();
    const branchDescription = branchInfo ? `${branchInfo.workBranch} → ${branchInfo.mainBranch}` : undefined;
    return [
      {
        label: "Drafts / Daily",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: "drafts",
        resourceUri: vscode.Uri.from({ scheme: this.scheme, path: "/articles" }),
        description: branchDescription,
        iconPath: this.buildIconPath("node-drafts")
      },
      {
        label: "Articles",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: "articles",
        resourceUri: vscode.Uri.from({ scheme: this.scheme, path: "/articles" }),
        description: branchDescription,
        iconPath: this.buildIconPath("node-articles")
      },
      {
        label: "Books",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: "books",
        resourceUri: vscode.Uri.from({ scheme: this.scheme, path: "/books" }),
        iconPath: this.buildIconPath("node-books")
      },
      {
        label: "Images",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: "images",
        resourceUri: vscode.Uri.from({ scheme: this.scheme, path: "/images" }),
        iconPath: this.buildIconPath("node-images")
      }
    ];
  }

  private getImageItems(): ZennTreeItem[] {
    return this.readDirectory("/images")
      .filter(([, type]) => type === vscode.FileType.File)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name]) => {
        const uri = this.buildUri(`/images/${name}`);
        return new ZennTreeItem({
          label: name,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: "image",
          resourceUri: uri,
          tooltip: `/images/${name}`
        });
      });
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

  private buildIconPath(name: string): { light: vscode.Uri; dark: vscode.Uri } {
    return {
      light: vscode.Uri.joinPath(this.extensionUri, "media", "icon", `${name}-light.svg`),
      dark: vscode.Uri.joinPath(this.extensionUri, "media", "icon", `${name}-dark.svg`)
    };
  }
}
