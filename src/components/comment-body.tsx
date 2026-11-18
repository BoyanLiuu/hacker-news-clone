import { parseComment } from "@/lib/markdown";

/**
 * Renders a comment body from the parsed token tree. Every branch emits a React element, so user
 * text can never become markup — see lib/markdown.ts.
 *
 * Body links are petrol-ink with a pale underline; code sits in a well. Width is capped at 70ch,
 * which is the design's reading measure.
 */
export function CommentBody({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parseComment(text);

  return (
    <div className={`max-w-[70ch] text-[15px] leading-[1.58] ${className}`}>
      {blocks.map((block, i) =>
        block.kind === "code" ? (
          <pre
            key={i}
            className="my-2 overflow-x-auto rounded-hair border border-rule bg-well px-3 py-2 font-mono text-[13px] leading-[1.5]"
          >
            {block.text}
          </pre>
        ) : (
          <p key={i} className="mt-2 first:mt-0">
            {block.spans.map((span, j) => {
              switch (span.kind) {
                case "em":
                  return <em key={j}>{span.text}</em>;
                case "code":
                  return (
                    <code key={j} className="rounded-hair bg-well px-1 font-mono text-[13.5px]">
                      {span.text}
                    </code>
                  );
                case "link":
                  return (
                    <a
                      key={j}
                      href={span.href}
                      rel="nofollow noopener noreferrer"
                      className="text-petrol-ink underline decoration-body-link-underline underline-offset-2"
                    >
                      {span.text}
                    </a>
                  );
                default:
                  return <span key={j}>{span.text}</span>;
              }
            })}
          </p>
        ),
      )}
    </div>
  );
}
