import { describe, expect, it } from "vitest";
import { fromHnHtml, looksLikeHnHtml } from "./from-hn-html";
import { parseComment } from "./markdown";

/**
 * The bug: 67.7% of imported comments displayed their own markup, because Algolia returns HTML and
 * the renderer deliberately never interprets markup. These pin the conversion *and* that its output
 * survives `parseComment` — a conversion that produced text the formatter then mangled would look
 * fixed in a unit test and still be broken on screen.
 */
describe("fromHnHtml", () => {
  it("converts the exact body from the reported screenshot", () => {
    const out = fromHnHtml(
      "See also perhaps the 2020 book <i>Dark Towers</i>:<p>&gt; <i>In Dark Towers, award-winning journalist David Enrich reveals the truth.</i>",
    );
    expect(out).toBe(
      "See also perhaps the 2020 book *Dark Towers*:\n\n> *In Dark Towers, award-winning journalist David Enrich reveals the truth.*",
    );
    expect(out).not.toContain("<");
    expect(out).not.toContain("&gt;");
  });

  it("turns <p> into a paragraph break the formatter actually splits on", () => {
    const blocks = parseComment(fromHnHtml("First thought.<p>Second thought."));
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: "paragraph" });
  });

  it("renders italics as emphasis rather than literal asterisks", () => {
    const [block] = parseComment(fromHnHtml("that is <i>important</i> here"));
    expect(block).toMatchObject({ kind: "paragraph" });
    if (block.kind !== "paragraph") throw new Error("expected a paragraph");
    expect(block.spans.some((s) => s.kind === "em" && s.text === "important")).toBe(true);
  });

  it("keeps the href, not HN's truncated link text", () => {
    // HN shortens long link text for display, and that ellipsis is not a URL.
    const out = fromHnHtml('<a href="https://example.com/a/very/long/path" rel="nofollow">https://exa...path</a>');
    expect(out).toBe("https://example.com/a/very/long/path");
    const [block] = parseComment(out);
    if (block.kind !== "paragraph") throw new Error("expected a paragraph");
    expect(block.spans[0]).toMatchObject({ kind: "link", href: "https://example.com/a/very/long/path" });
  });

  it("keeps readable link text alongside the URL, because the author wrote it", () => {
    expect(fromHnHtml('<a href="https://example.com/x">the paper</a>')).toBe(
      "the paper https://example.com/x",
    );
  });

  it("makes a code block the formatter reads as code, verbatim", () => {
    const blocks = parseComment(fromHnHtml("try:<pre><code>const x = 1;\nconst y = 2;</code></pre>"));
    const code = blocks.find((b) => b.kind === "code");
    expect(code).toMatchObject({ kind: "code", text: "const x = 1;\nconst y = 2;" });
  });

  it("does not decode an entity twice", () => {
    // `&amp;gt;` is an author showing the text "&gt;". Decoding `&amp;` first would turn it into
    // ">", silently rewriting what they wrote.
    expect(fromHnHtml("write &amp;gt; to quote")).toBe("write &gt; to quote");
  });

  it("decodes the entities that actually appear in the data", () => {
    expect(fromHnHtml("it&#x27;s &quot;quoted&quot; &amp; done")).toBe(`it's "quoted" & done`);
  });

  it("leaves plain text untouched and is safe to run twice", () => {
    const plain = "A normal comment with *emphasis* and https://example.com/x in it.";
    expect(fromHnHtml(plain)).toBe(plain);
    expect(fromHnHtml(fromHnHtml(plain))).toBe(plain);
  });

  it("never leaves a tag behind, including ones outside the vocabulary", () => {
    const out = fromHnHtml('<div class="x">text</div><script>alert(1)</script>');
    expect(out).not.toMatch(/<[a-zA-Z/]/);
  });
});

describe("looksLikeHnHtml", () => {
  it("is true for bodies needing conversion and false for converted ones", () => {
    expect(looksLikeHnHtml("a <i>b</i>")).toBe(true);
    expect(looksLikeHnHtml("it&#x27;s")).toBe(true);
    expect(looksLikeHnHtml("a *b* and > a quote")).toBe(false);
  });
});
