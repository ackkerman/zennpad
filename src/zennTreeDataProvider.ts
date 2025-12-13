import * as vscode from "vscode";
import { ZennFsProvider } from "./zennFsProvider";
import { parseFrontmatter } from "./frontmatter";

export type ZennNodeType =
  | "articles"
  | "books"
  | "drafts"
  | "images"
  | "chapter"
  | "book"
  | "article"
  | "image";

export interface ZennTreeItemDescriptor {
  readonly label: string;
  readonly collapsibleState: vscode.TreeItemCollapsibleState;
  readonly contextValue: ZennNodeType;
  readonly description?: string;
  readonly resourceUri?: vscode.Uri;
  readonly iconPath?: vscode.ThemeIcon;
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
  private signedIn = false;
  private hasRepoConfig = false;
  private dirtyPaths = new Set<string>();
  private branchInfo: { workBranch: string; mainBranch: string } | undefined;

  constructor(private readonly fsProvider: ZennFsProvider, private readonly scheme = "zenn") {}

  setStatus(status: { signedIn: boolean; hasRepoConfig: boolean }): void {
    this.signedIn = status.signedIn;
    this.hasRepoConfig = status.hasRepoConfig;
    this.refresh();
  }

  setDirtyPaths(paths: Set<string>): void {
    this.dirtyPaths = new Set(paths);
    this.refresh();
  }

  setBranchInfo(branches: { workBranch: string; mainBranch: string }): void {
    this.branchInfo = branches;
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
      if (!this.signedIn) {
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
      if (!this.hasRepoConfig) {
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

  private getArticleItems(): ZennTreeItem[] {
    return this.readDirectory("/articles")
      .filter(([, type]) => type === vscode.FileType.File)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name]) => {
        const uri = this.buildUri(`/articles/${name}`);
        const isImage = this.isImageFile(name);
        const frontmatter = isImage ? undefined : this.readFrontmatter(uri);
        const published = frontmatter?.published;
        return new ZennTreeItem({
          label: this.resolveLabel(name, frontmatter?.title, published, uri.path),
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: isImage ? "image" : "article",
          resourceUri: uri,
          published,
          tooltip: isImage ? `/images/${name}` : this.buildTooltip(frontmatter),
          description: !isImage && published === false ? "draft" : undefined
        });
      });
  }

  private getDraftItems(): ZennTreeItem[] {
    return this.readDirectory("/articles")
      .filter(([, type]) => type === vscode.FileType.File)
      .map(([name]) => {
        const uri = this.buildUri(`/articles/${name}`);
        if (this.isImageFile(name)) {
          return { name, uri, published: undefined, kind: "image" as const };
        }
        const published = this.readPublished(uri);
        return { name, uri, published, kind: "article" as const };
      })
      .filter((entry) => entry.kind === "image" || entry.published === false)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => {
        const frontmatter = entry.kind === "image" ? undefined : this.readFrontmatter(entry.uri);
        return new ZennTreeItem({
          label: this.resolveLabel(entry.name, frontmatter?.title, entry.published, entry.uri.path),
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: entry.kind === "image" ? "image" : "article",
          description: entry.kind === "image" ? undefined : "draft",
          resourceUri: entry.uri,
          published: entry.published,
          tooltip: entry.kind === "image" ? `/images/${entry.name}` : this.buildTooltip(frontmatter)
        });
      });
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
        const isImage = this.isImageFile(name);
        const frontmatter = isImage ? undefined : this.readFrontmatter(uri);
        const published = frontmatter?.published;
        return new ZennTreeItem({
          label: this.resolveLabel(name, frontmatter?.title, published, uri.path),
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: isImage ? "image" : "chapter",
          resourceUri: uri,
          published,
          tooltip: isImage ? `/images/${name}` : this.buildTooltip(frontmatter)
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

  private readPublished(uri: vscode.Uri): boolean | undefined {
    try {
      const content = this.fsProvider.readFile(uri).toString();
      const match = /^---\s*\n([\s\S]*?)\n---/m.exec(content);
      if (match) {
        const yaml = match[1];
        const publishedMatch = /^published:\s*(true|false)\b/m.exec(yaml);
        if (publishedMatch) {
          return publishedMatch[1] === "true";
        }
      }
    } catch {
      // Ignore parse failures.
    }
    return undefined;
  }

  private readFrontmatter(
    uri: vscode.Uri
  ): { title?: string; emoji?: string; type?: string; topics?: unknown; published?: boolean } | undefined {
    try {
      const content = this.fsProvider.readFile(uri).toString();
      const parsed = parseFrontmatter(content);
      const fm = parsed.frontmatter;
      return {
        title: typeof fm.title === "string" ? fm.title : undefined,
        emoji: typeof fm.emoji === "string" ? fm.emoji : undefined,
        type: typeof fm.type === "string" ? fm.type : undefined,
        topics: Array.isArray(fm.topics) ? fm.topics : undefined,
        published: typeof fm.published === "boolean" ? fm.published : undefined
      };
    } catch {
      return undefined;
    }
  }

  private buildTooltip(
    fm?: { title?: string; emoji?: string; type?: string; topics?: unknown; published?: boolean }
  ): string | undefined {
    if (!fm) {
      return undefined;
    }
    const topics = Array.isArray(fm.topics) ? fm.topics.join(", ") : undefined;
    const lines = [
      fm.title ? `title: ${fm.title}` : undefined,
      fm.emoji ? `emoji: ${fm.emoji}` : undefined,
      fm.type ? `type: ${fm.type}` : undefined,
      topics ? `topics: [${topics}]` : undefined,
      typeof fm.published === "boolean" ? `published: ${fm.published}` : undefined
    ].filter(Boolean);
    return lines.length ? lines.join("\n") : undefined;
  }

  private resolveLabel(fileName: string, title?: string, published?: boolean, resourcePath?: string): string {
    const base = title && title.trim().length > 0 ? title.trim() : fileName;
    const status = resourcePath ? (this.dirtyPaths.has(resourcePath) ? "● " : "✓ ") : "";
    if (published === false) {
      return `${status}🔒 ${base}`;
    }
    return `${status}${base}`;
  }

  private isImageFile(name: string): boolean {
    return /\.(png|jpe?g|gif|webp)$/i.test(name);
  }

  private get rootNodes(): ZennTreeItemDescriptor[] {
    const branchDescription = this.branchInfo
      ? `${this.branchInfo.workBranch} → ${this.branchInfo.mainBranch}`
      : undefined;
    return [
      {
        label: "Drafts / Daily",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: "drafts",
        resourceUri: vscode.Uri.from({ scheme: this.scheme, path: "/articles" }),
        description: branchDescription
      },
      {
        label: "Articles",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: "articles",
        resourceUri: vscode.Uri.from({ scheme: this.scheme, path: "/articles" }),
        description: branchDescription
      },
      {
        label: "Books",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: "books",
        resourceUri: vscode.Uri.from({ scheme: this.scheme, path: "/books" })
      },
      {
        label: "Images",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: "images",
        resourceUri: vscode.Uri.from({ scheme: this.scheme, path: "/images" }),
        iconPath: new vscode.ThemeIcon("file-media")
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
}
