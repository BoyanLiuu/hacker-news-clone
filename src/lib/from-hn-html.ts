/**
 * Convert a Hacker News comment body into the markdown-ish text `parseComment` understands.
 *
 * The Algolia API returns comment bodies as **HTML**, and M8's importer stored them verbatim. The
 * renderer parses to a token tree and never interprets markup — which is what makes XSS safety
 * structural rather than a matter of remembering to escape — so every imported comment with any
 * formatting displayed its own tags: `See also the 2020 book <i>Dark Towers</i>:<p>&gt; <i>In Dark
 * Towers, ...`. 67.7% of comments were affected.
 *
 * The fix belongs here and not in the renderer. Teaching `parseComment` a "safe subset" of HTML
 * would mean parsing markup, and the moment it parses markup the structural guarantee is gone.
 *
 * The vocabulary is closed, which is what makes this tractable rather than a general HTML parser.
 * Measured across 135 963 imported comments:
 *
 *   &#x27; 47.4%   <p> 41.9%   &quot; 14.9%   &gt; 10.3%
 *   <a href> 8.2%  <i> 5.9%    &amp; 1.0%     <pre><code> 0.6%
 *   <b>, <u>, <br> — none at all
 */

/** `<pre><code>…</code></pre>` becomes a two-space-indented block, which is what the parser reads. */
function convertCodeBlocks(html: string): string {
  return html.replace(/<pre>\s*<code>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_whole, body: string) => {
    const lines = decodeEntities(body).replace(/\r\n?/g, "\n").split("\n");
    // A blank line each side, so the block is its own chunk however it was packed in the original.
    return `\n\n${lines.map((line) => `  ${line}`).join("\n")}\n\n`;
  });
}

/**
 * Entities, decoded in one pass with `&amp;` handled by the same pass rather than afterwards.
 *
 * Order is the trap: decoding `&amp;` first turns `&amp;gt;` into `&gt;` and then into `>`, so text
 * that deliberately showed an entity becomes the character it names. One pass over the whole string
 * cannot double-decode.
 */
function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1] === "x" || body[1] === "X"
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      // Control characters stay as they were rather than becoming invisible bytes in a comment.
      return Number.isFinite(code) && code >= 32 ? String.fromCodePoint(code) : whole;
    }
    return named[body.toLowerCase()] ?? whole;
  });
}

/**
 * `<a href="X">Y</a>` becomes the bare URL, which `parseComment` autolinks.
 *
 * The href wins over the link text, because HN truncates long link text for display
 * (`https://exa...le.com/path`) and that truncation is not a URL. Where the text is a different
 * readable thing, it is kept alongside — losing it would drop a word the author wrote.
 */
function convertLinks(html: string): string {
  return html.replace(
    /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_whole, href: string, label: string) => {
      const url = decodeEntities(href).trim();
      const text = decodeEntities(stripTags(label)).trim();
      if (!url) return text;
      // HN's own display truncation, and the common case where the text *is* the URL.
      if (!text || text === url || text.includes("...") || url.startsWith(text.replace(/\.{3}$/, ""))) {
        return url;
      }
      return `${text} ${url}`;
    },
  );
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * The whole conversion. Idempotent on text that holds no tags or entities, so it is safe to run
 * over a table twice — which matters, because that is how it will be applied to existing rows.
 */
export function fromHnHtml(html: string): string {
  let text = html;

  // Code first: its contents must not have `<i>` or `<p>` rules applied inside them.
  text = convertCodeBlocks(text);
  text = convertLinks(text);

  // `<p>` on HN is a paragraph *separator*, not a wrapper — it has no closing tag in their output.
  text = text.replace(/<\/?p>/gi, "\n\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Italics and bold both map to the one emphasis the formatter has.
  text = text.replace(/<\/?(i|em|b|strong)>/gi, "*");
  text = text.replace(/<\/?code>/gi, "`");

  // Anything left is a tag this vocabulary does not include. Dropped rather than shown: a stray
  // `<div>` in a comment is noise either way, and leaving it reproduces the bug being fixed.
  text = stripTags(text);
  text = decodeEntities(text);

  // Collapse the runs of blank lines the `<p>` substitution creates, and trim the ends.
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** True when a body still looks like HN's HTML, so a migration can skip what it has already done. */
export function looksLikeHnHtml(text: string): boolean {
  return /<\/?(p|i|em|b|strong|a|pre|code|br)\b[^>]*>|&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos|nbsp);/i.test(
    text,
  );
}
