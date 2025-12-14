import assert from "node:assert/strict";
import test from "node:test";
import { parseFrontmatter, serializeFrontmatter } from "../utils/markdown/frontmatter";

test("parseFrontmatter extracts frontmatter and body", () => {
  const input = ["---", "title: Hello", "published: false", "---", "", "Content line"].join("\n");

  const parsed = parseFrontmatter(input);
  assert.equal(parsed.frontmatter.title, "Hello");
  assert.equal(parsed.frontmatter.published, false);
  assert.equal(parsed.body.trim(), "Content line");
});

test("serializeFrontmatter writes yaml and body with delimiter", () => {
  const fm = { title: "Hello", published: true, topics: ["foo"] };
  const body = "\nParagraph\n";
  const output = serializeFrontmatter(fm, body);
  assert.match(output, /^---\n/);
  assert.match(output, /title: Hello/);
  assert.match(output, /published: true/);
  assert.match(output, /topics:\n\s*- foo/);
  assert.ok(output.trimEnd().endsWith("Paragraph"));
});
