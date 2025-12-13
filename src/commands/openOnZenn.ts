import * as vscode from "vscode";
import { parseFrontmatter } from "../utils/frontmatter";

export function buildZennUrl(owner: string, path: string, published: boolean): string | undefined {
  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "articles") {
    const slug = segments[1]?.replace(/\.md$/, "");
    if (!slug) return undefined;
    return published
      ? `https://zenn.dev/${owner}/articles/${slug}`
      : `https://zenn.dev/${owner}/articles/${slug}?preview=1`;
  }
  if (segments[0] === "books" && segments.length >= 3) {
    const book = segments[1];
    return `https://zenn.dev/${owner}/books/${book}`;
  }
  return undefined;
}

export function buildZennUrlFromDoc(doc: vscode.TextDocument): string | undefined {
  if (!doc.uri.path) return undefined;
  const config = vscode.workspace.getConfiguration("zennpad");
  const owner =
    config.get<string>("zennAccount")?.trim() || config.get<string>("githubOwner")?.trim();
  if (!owner) {
    return undefined;
  }
  const parsed = parseFrontmatter(doc.getText());
  const published = Boolean(parsed.frontmatter.published);
  return buildZennUrl(owner, doc.uri.path, published);
}
