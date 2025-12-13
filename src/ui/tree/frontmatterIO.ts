import * as vscode from "vscode";
import { ZennFsProvider } from "../../fs/zennFsProvider";
import { parseFrontmatter } from "../../utils/frontmatter";

export interface ParsedFrontmatter {
  title?: string;
  emoji?: string;
  type?: string;
  topics?: unknown;
  published?: boolean;
}

export function readFrontmatter(fsProvider: ZennFsProvider, uri: vscode.Uri): ParsedFrontmatter | undefined {
  try {
    const content = Buffer.from(fsProvider.readFile(uri)).toString();
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

export function readPublished(fsProvider: ZennFsProvider, uri: vscode.Uri): boolean | undefined {
  return readFrontmatter(fsProvider, uri)?.published;
}
