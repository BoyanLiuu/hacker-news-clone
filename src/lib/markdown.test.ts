import { describe, expect, it } from "vitest";
import { parseComment, type Block } from "./markdown";

const spans = (blocks: Block[], i = 0) => {
  const b = blocks[i];
  if (b.kind !== "paragraph") throw new Error("not a paragraph");
  return b.spans;
};

describe("parseComment — safety", () => {
  // Catches: the whole XSS surface. Comment bodies are user input; if markup ever survives parsing
  // as markup rather than text, a stored <script> executes for every reader of the thread.
  it("treats HTML as text, never as markup", () => {
    const blocks = parseComment('<script>alert(1)</script> and <img src=x onerror=alert(1)>');
    expect(blocks).toHaveLength(1);
    expect(spans(blocks)).toEqual([
      { kind: "text", text: '<script>alert(1)</script> and <img src=x onerror=alert(1)>' },
    ]);
  });

  // Catches: a javascript: or data: URL becoming a clickable href. Only http(s) is linkified, so
  // these must stay inert text.
  it("never linkifies a non-http scheme", () => {
    for (const payload of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox"]) {
      const result = spans(parseComment(payload));
      expect(result.every((s) => s.kind !== "link")).toBe(true);
    }
  });

  // Catches: an autolinked URL whose href differs from its visible text, which is how a link can
  // claim to go somewhere it does not.
  it("uses the URL itself as both text and href", () => {
    const link = spans(parseComment("see https://example.com/a?b=1 now")).find((s) => s.kind === "link");
    expect(link).toEqual({ kind: "link", text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" });
  });
});

describe("parseComment — formatting", () => {
  // Catches: blank lines collapsing, so a multi-paragraph comment renders as one wall of text.
  it("splits paragraphs on blank lines and joins wrapped lines", () => {
    const blocks = parseComment("first line\nstill first\n\nsecond");
    expect(blocks).toHaveLength(2);
    expect(spans(blocks, 0)).toEqual([{ kind: "text", text: "first line still first" }]);
    expect(spans(blocks, 1)).toEqual([{ kind: "text", text: "second" }]);
  });

  it("marks italics and inline code", () => {
    expect(spans(parseComment("a *b* c"))).toEqual([
      { kind: "text", text: "a " },
      { kind: "em", text: "b" },
      { kind: "text", text: " c" },
    ]);
    expect(spans(parseComment("use `SKIP LOCKED` here"))).toEqual([
      { kind: "text", text: "use " },
      { kind: "code", text: "SKIP LOCKED" },
      { kind: "text", text: " here" },
    ]);
  });

  // Catches: italics being applied inside code, so `SELECT *` loses its asterisk and the sample
  // code a reader copies is wrong.
  it("leaves markers inside code literal", () => {
    expect(spans(parseComment("`SELECT * FROM t WHERE a*b`"))).toEqual([
      { kind: "code", text: "SELECT * FROM t WHERE a*b" },
    ]);
    const inCode = spans(parseComment("`see https://example.com`"));
    expect(inCode).toEqual([{ kind: "code", text: "see https://example.com" }]);
  });

  // Catches: a two-space-indented block being reflowed as prose, which destroys pasted code.
  it("keeps an indented block verbatim, including its line breaks", () => {
    const blocks = parseComment("UPDATE jobs:\n\n  SET locked_until = now()\n  WHERE id = 1");
    expect(blocks[1]).toEqual({ kind: "code", text: "SET locked_until = now()\nWHERE id = 1" });
  });

  // Catches: an unterminated marker eating the rest of the comment.
  it("leaves a lone marker as text", () => {
    expect(spans(parseComment("2 * 3 = 6"))).toEqual([{ kind: "text", text: "2 * 3 = 6" }]);
    expect(spans(parseComment("a ` b"))).toEqual([{ kind: "text", text: "a ` b" }]);
  });

  it("returns nothing for empty or whitespace-only input", () => {
    expect(parseComment("")).toEqual([]);
    expect(parseComment("   \n\n  ")).toEqual([]);
  });
});
