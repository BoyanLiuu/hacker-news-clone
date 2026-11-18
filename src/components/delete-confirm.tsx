import Link from "next/link";

/**
 * The inline confirm for deleting your own post, in the red destructive tone — DESIGN.md's State
 * Colour Rule, where red means error, dead or destructive and appears nowhere else.
 *
 * URL-driven rather than client state, so it survives a reload and needs no JavaScript. Not a
 * `Notice`: a notice reports a state, this asks a question and carries both answers.
 *
 * The hidden `id` is load-bearing: with no `action`, a submit is a GET to the current path, which
 * replaces the query string and would drop `id` into a 404. M12 brings `deletePost`.
 */
export function DeleteConfirm({ postId }: { postId: number }) {
  return (
    <form
      role="group"
      aria-label="Confirm deletion"
      className="mt-3 flex flex-col gap-3 rounded-hair border border-red-line bg-red-bg px-[14px] py-[10px] text-[14px] sm:ml-[38px] sm:flex-row sm:items-center sm:gap-x-4"
    >
      <input type="hidden" name="id" value={postId} />

      {/* Column on a phone: side by side, the buttons squeeze the sentence into a seven-line
          ribbon, and the sentence is the part that has to be read before deciding. */}
      <p className="min-w-0 sm:flex-1">
        Delete this post? Nobody has commented yet, so it will be removed for everyone.
      </p>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-hair bg-red px-4 text-[14px] font-semibold text-paper hover:brightness-90"
        >
          Delete post
        </button>
        <Link
          href={`/item?id=${postId}`}
          scroll={false}
          className="inline-flex h-9 items-center rounded-hair border border-field bg-white px-4 text-[14px] font-semibold text-ink hover:border-field-hover"
        >
          Keep it
        </Link>
      </div>
    </form>
  );
}
