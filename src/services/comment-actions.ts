/**
 * Creating a comment. Separate from `comments.ts`, which only reads, because `"use server"` turns
 * every export into a public endpoint — the same split as `vote-action.ts` and `post-actions.ts`.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { childPath, depthOf } from "@/lib/path";
import { validateComment } from "@/lib/validate";
import { getViewer } from "./viewer";

/** `text` returns on rejection: Appendix A requires the input to survive a validation error. */
export type ReplyState = { error: string; text: string } | undefined;

/**
 * Add a comment to a post, or a reply to a comment. One action for both, which is the plan's
 * "reply and comment creation through the same path" — the only difference is whether the target
 * id names a post or a comment, and that is resolved by looking it up rather than by a flag the
 * caller supplies.
 *
 * Two statements in a transaction rather than one insert, because `path` contains the row's own id
 * and that id does not exist until the insert returns. The alternative — a sequence lookup before
 * inserting — would guess an id that another writer could take.
 *
 * `childCount` and `commentCount` move in the same transaction. They are denormalised counts, and
 * a comment inserted without them is a thread whose header disagrees with its own body.
 */
export async function createComment(_prev: ReplyState, form: FormData): Promise<ReplyState> {
  const text = String(form.get("text") ?? "");
  const targetId = Number(form.get("id"));
  // Which table the id names. A hint from the form, not a permission: the lookup below still has
  // to find the row. Without it the id is ambiguous — `Post` and `Comment` have separate sequences,
  // so from M12 onward a post and a comment can share an id and a reply could land on the wrong
  // one. The form always knows: a thread page replies to its post, `/reply` to a comment.
  const kind = form.get("kind") === "comment" ? "comment" : "post";

  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  const error = validateComment(text);
  if (error) return { error, text };

  if (!Number.isInteger(targetId) || targetId < 1) {
    return { error: "That thread does not exist.", text };
  }

  // One lookup, in the table the form named.
  let postId: number;
  let parentId: number | null;
  let parentPath: string | null;

  if (kind === "post") {
    const post = await db.post.findUnique({
      where: { id: targetId },
      select: { id: true, isDeleted: true, isDead: true },
    });
    if (!post || post.isDeleted) return { error: "That thread does not exist.", text };
    if (post.isDead) return { error: "This thread is closed.", text };

    postId = post.id;
    parentId = null;
    parentPath = null;
  } else {
    const parent = await db.comment.findUnique({
      where: { id: targetId },
      select: { id: true, postId: true, path: true, isDeleted: true },
    });
    // A deleted comment keeps its children, so replying *under* one is fine; replying *to* the
    // deleted node itself is not, because there is nothing there to answer.
    if (!parent || parent.isDeleted) return { error: "That comment is gone.", text };

    postId = parent.postId;
    parentId = parent.id;
    parentPath = parent.path;
  }

  const created = await db.$transaction(async (tx) => {
    // `path` is set in a second statement, from the id the insert just issued. "pending" never
    // reaches a reader: both statements are in one transaction, so a failure between them rolls the
    // row back. It is a placeholder for the NOT NULL column, nothing more.
    const row = await tx.comment.create({
      data: { postId, parentId, authorId: viewer.userId, text: text.trim(), path: "pending", depth: 0 },
      select: { id: true },
    });

    const path = childPath(parentPath, row.id);
    await tx.comment.update({
      where: { id: row.id },
      data: { path, depth: depthOf(path) },
    });

    await tx.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
    if (parentId !== null) {
      await tx.comment.update({ where: { id: parentId }, data: { childCount: { increment: 1 } } });
    }

    return row;
  });

  // The thread and the listings both show a count that just moved.
  revalidatePath("/item");
  revalidatePath("/newest");
  revalidatePath("/");

  // Anchored on the new comment, so a 350-comment thread does not reload at the top. The id on the
  // article in `comment-node.tsx` is what makes this resolve; without it the fragment is a no-op.
  redirect(`/item?id=${postId}#c${created.id}`);
}
