import { SortOrder } from "./types";

export function isImageFile(name: string): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(name);
}

export function resolveLabel(
  fileName: string,
  options: { title?: string; published?: boolean; isDirty?: boolean }
): string {
  const base = options.title && options.title.trim().length > 0 ? options.title.trim() : fileName;
  const status = options.isDirty ? "● " : "✓ ";
  if (options.published === false) {
    return `${status}🔒 ${base}`;
  }
  return `${status}${base}`;
}

export function buildTooltip(fm?: {
  title?: string;
  emoji?: string;
  type?: string;
  topics?: unknown;
  published?: boolean;
}): string | undefined {
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

export function compareEntries(
  a: { name: string; frontmatter?: { title?: string } },
  b: { name: string; frontmatter?: { title?: string } },
  sortOrder: SortOrder
): number {
  if (sortOrder === "title") {
    return buildTitleKey(a).localeCompare(buildTitleKey(b));
  }
  return compareByDateThenName(a.name, b.name);
}

function buildTitleKey(entry: { name: string; frontmatter?: { title?: string } }): string {
  return (entry.frontmatter?.title ?? entry.name).toLowerCase();
}

function compareByDateThenName(aName: string, bName: string): number {
  const aDate = extractDateKey(aName);
  const bDate = extractDateKey(bName);
  if (aDate !== bDate) {
    return (bDate ?? 0) - (aDate ?? 0);
  }
  return aName.localeCompare(bName);
}

function extractDateKey(name: string): number | undefined {
  const match = name.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) {
    return undefined;
  }
  const [, y, m, d] = match;
  return Number(`${y}${m}${d}`);
}
