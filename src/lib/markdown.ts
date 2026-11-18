/**
 * The markdown-ish comment formatter: paragraphs, *italics*, `code`, two-space-indented code
 * blocks, and autolinked URLs. Nothing else.
 *
 * It parses to a token tree rather than producing an HTML string, and the renderer emits React
 * elements. That is the whole XSS story: there is no `dangerouslySetInnerHTML` anywhere, so a
 * comment containing `<script>` is text by construction rather than by escaping — you cannot forget
 * to escape something that is never interpreted as markup.
 */

export type Span =
  | { kind: "text"; text: string }
  | { kind: "em"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block = { kind: "paragraph"; spans: Span[] } | { kind: "code"; text: string };

/** Bare URLs become links. Trailing punctuation is left out so "see https://x.com." works. */
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g;
const INLINE_PATTERN = /`([^`]+)`|\*([^*\n]+)\*/g;

export function parseComment(text: string): Block[] {
  const blocks: Block[] = [];
  // Blank lines separate blocks; \r\n is normalised so pasted text behaves.
  const chunks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);

  for (const chunk of chunks) {
    const lines = chunk.split("\n");

    // A block where every non-blank line starts with two spaces is code, verbatim.
    const indented = lines.filter((l) => l.trim() !== "");
    if (indented.length > 0 && indented.every((l) => l.startsWith("  "))) {
      blocks.push({ kind: "code", text: lines.map((l) => l.replace(/^ {2}/, "")).join("\n").trimEnd() });
      continue;
    }

    const paragraph = lines.join(" ").trim();
    if (paragraph) blocks.push({ kind: "paragraph", spans: parseSpans(paragraph) });
  }

  return blocks;
}

function parseSpans(input: string): Span[] {
  const spans: Span[] = [];
  let cursor = 0;

  // Inline code wins over italics, so `*not italic*` stays literal inside backticks.
  for (const match of input.matchAll(INLINE_PATTERN)) {
    const at = match.index;
    if (at > cursor) spans.push(...linkify(input.slice(cursor, at)));

    const [, code, em] = match;
    if (code !== undefined) spans.push({ kind: "code", text: code });
    else if (em !== undefined) spans.push({ kind: "em", text: em });

    cursor = at + match[0].length;
  }

  if (cursor < input.length) spans.push(...linkify(input.slice(cursor)));
  return spans;
}

/** Splits plain text around bare URLs. Never runs inside code, so a URL in backticks stays text. */
function linkify(input: string): Span[] {
  const spans: Span[] = [];
  let cursor = 0;

  for (const match of input.matchAll(URL_PATTERN)) {
    const at = match.index;
    if (at > cursor) spans.push({ kind: "text", text: input.slice(cursor, at) });

    const href = match[0];
    // Only http(s) is linkified at all, so javascript: and data: URLs can never become hrefs.
    spans.push({ kind: "link", text: href, href });
    cursor = at + href.length;
  }

  if (cursor < input.length) spans.push({ kind: "text", text: input.slice(cursor) });
  return spans;
}
