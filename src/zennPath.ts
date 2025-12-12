import * as path from "path";
import * as vscode from "vscode";

export function isZennUri(uri: vscode.Uri): boolean {
  return uri.scheme === "zenn";
}

export function toRelativeZennPath(uri: vscode.Uri): string | null {
  if (!isZennUri(uri)) {
    return null;
  }
  const normalized = uri.path.startsWith("/") ? uri.path.slice(1) : uri.path;
  return normalized;
}

export function toPreviewUrlPath(relativePath: string): string | null {
  const parsed = path.parse(relativePath);
  if (!parsed.dir) {
    return null;
  }

  if (parsed.dir === "articles" && parsed.ext === ".md") {
    return `${parsed.dir}/${parsed.name}`;
  }

  if (parsed.dir.match(/^books\/[^/]+$/) && parsed.ext === ".md") {
    return `${parsed.dir}/${parsed.name}`;
  }

  if (parsed.base === "config.yaml" && parsed.dir.match(/^books\/[^/]+$/)) {
    return parsed.dir;
  }

  return null;
}
