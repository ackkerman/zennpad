import { parse, stringify } from "yaml";

export interface ParsedFrontmatter {
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
}

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

export function parseFrontmatter(text: string): ParsedFrontmatter {
  const match = FRONTMATTER_REGEX.exec(text);
  if (!match) {
    return { frontmatter: {}, body: text };
  }

  try {
    const parsed = parse(match[1]) ?? {};
    return {
      frontmatter: typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {},
      body: match[2] ?? ""
    };
  } catch (error) {
    console.error("Failed to parse frontmatter", error);
    return { frontmatter: {}, body: text };
  }
}

export function serializeFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  const yamlContent = stringify(frontmatter ?? {}).trimEnd();
  const normalizedBody = body ?? "";
  const bodyWithTrailingNewline = normalizedBody.endsWith("\n") ? normalizedBody : `${normalizedBody}\n`;
  return `---\n${yamlContent}\n---\n\n${bodyWithTrailingNewline}`;
}
