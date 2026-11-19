/**
 * Casting a vote. Separate from `votes.ts`, which only reads, because `"use server"` turns *every*
 * export into a public endpoint — so a read helper exported from here would be callable by anyone
 * with a session, for no reason.
 */
"use server";

import { revalidatePath } from "next/cache";
import { CFG } from "@/lib/config";
import { ItemType as DbItemType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { ItemType } from "@/lib/types";
import { decideVote } from "@/lib/vote-decision";
import { getViewer } from "./viewer";

/** How long after casting you may take it back. Appendix G: a vote is otherwise final, as on HN. */
const GRACE_MS = 5 * 60_000;

const TABLE = { post: "Post", comment: "Comment" } as const;

/**
 * What the row needs to redraw itself. `points` is authoritative — the optimistic value the client
 * guessed is replaced by this, so a rejected or clamped vote corrects itself rather than lingering.
 */
export type VoteResult =
  | { ok: true; points: number; voted: boolean; savedAt: string }
  | { ok: false; error: string };

function parse(form: FormData): { type: ItemType; id: number; direction: 1 | -1 } | null {
  const type = form.get("type");
  const id = Number(form.get("id"));
  const direction = Number(form.get("direction"));

  if (type !== "post" && type !== "comment") return null;
  if (!Number.isInteger(id) || id < 1) return null;
  if (direction !== 1 && direction !== -1) return null;

  return { type, id, direction };
}

/**
 * Cast, or take back, one vote.
 *
 * Idempotent on `@@id([userId, itemType, itemId])` — ARCHITECTURE §6.4's answer to a
 * double-submitted vote. Clicking the same arrow twice within `GRACE_MS` is an *unvote*, not a
 * second vote, and clicking it after the window is a no-op that reports the standing vote rather
 * than an error: the row already shows the right thing, so there is nothing to tell the voter.
 *
 * The whole thing is one transaction because `scoreRaw` is a denormalised count of this table. A
 * `Vote` row written without its score adjustment, or the reverse, is drift that the nightly karma
 * job cannot repair — that job recomputes `User.karma`, not `scoreRaw`.
 *
 * The acting user comes from the session, never from the form. The item id does come from the form,
 * which is why every rule below is re-checked here: a Server Action is a public endpoint, and the
 * UI not offering a downvote is not the same as the server refusing one.
 *
 * Shaped for `useActionState` — `(prev, form)` — because that hook is what keeps the form working
 * with JavaScript disabled while still handing the result back to the row for its failed state.
 */
export async function castVote(_prev: VoteResult | undefined, form: FormData): Promise<VoteResult> {
  const input = parse(form);
  if (!input) return { ok: false, error: "That vote made no sense." };

  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to vote." };

  // Posts take upvotes only — downvotes are comment-only, by Appendix A's scope list.
  if (input.direction === -1 && input.type === "post") {
    return { ok: false, error: "Posts cannot be downvoted." };
  }
  if (input.direction === -1 && !viewer.canDownvote) {
    return { ok: false, error: `Downvoting needs ${CFG.downvoteKarma} karma.` };
  }

  // The Prisma enum, not the string literal: the `key` built from it is reused by three queries,
  // and a widened `string` there does not satisfy `VoteWhereUniqueInput`.
  const itemType = input.type === "post" ? DbItemType.POST : DbItemType.COMMENT;

  try {
    const result = await db.$transaction(async (tx) => {
      // Locked, not just read: two clicks racing on the same row would otherwise both read the
      // pre-vote score and both write the same +1, losing one of them. The composite key stops a
      // duplicate *row*, not a duplicate *increment*.
      const owner = await lockItem(tx, input.type, input.id);
      if (!owner) return { ok: false as const, error: "That item is gone." };

      if (owner.authorId === viewer.userId) {
        return { ok: false as const, error: "You cannot vote for your own item." };
      }

      const key = { userId_itemType_itemId: { userId: viewer.userId, itemType, itemId: input.id } };

      const existing = await tx.vote.findUnique({ where: key, select: { value: true, createdAt: true } });

      const decision = decideVote({
        // `value` is a plain Int column with no check constraint, so narrow it rather than cast:
        // anything that is not -1 is treated as an upvote, which is what every writer here stores.
        existing: existing ? { value: existing.value === -1 ? -1 : 1, createdAt: existing.createdAt } : null,
        direction: input.direction,
        graceMs: GRACE_MS,
      });

      // Past the window the vote stands and nothing happens — reported with the stamp it was
      // actually cast at, because `saved 14:02:11` on a ten-day-old vote is a fabricated receipt.
      if (decision.kind === "locked") {
        return settled(owner.scoreRaw, true, existing?.createdAt);
      }

      if (decision.kind === "unvote") {
        await tx.vote.delete({ where: key });
        return settled(await bumpScore(tx, input.type, input.id, decision.delta), false);
      }

      await tx.vote.upsert({
        where: key,
        create: { userId: viewer.userId, itemType, itemId: input.id, value: input.direction },
        update: { value: input.direction, createdAt: new Date() },
      });

      return settled(await bumpScore(tx, input.type, input.id, decision.delta), true);
    });

    if (result.ok) {
      // The listing reads `RankedPost`, which the cron rebuilds on its own schedule; this only
      // refreshes what the voter sees now. Everyone else's order stays up to 60 s stale, which
      // ARCHITECTURE §1.2 chose deliberately and the document line reports.
      revalidatePath(input.type === "post" ? "/" : "/item");
    }
    return result;
  } catch (error) {
    // Logged, then made vague. The voter gets a message that cannot imply the vote landed, and the
    // row offers a retry — but a bare `catch {}` would also turn a bug in this function into a
    // silent "the server didn't answer" with nothing in the logs to contradict it. M10 shipped the
    // mirror of this: a `catch` that read every insert failure as a name collision.
    console.error("castVote failed", { type: input.type, id: input.id, error });
    return { ok: false, error: "Vote not saved — the server didn't answer." };
  }
}

function settled(points: number, voted: boolean, at?: Date): VoteResult {
  return { ok: true, points, voted, savedAt: (at ?? new Date()).toISOString() };
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * `SELECT ... FOR UPDATE` on the voted item, returning who owns it and what it currently scores.
 *
 * Raw SQL because Prisma has no `FOR UPDATE`, and the lock is the point: it serialises concurrent
 * votes on one popular item. `TABLE` maps the two item types to identifiers rather than
 * interpolating the caller's string, so `input.type` — which came from a form — never reaches SQL.
 */
async function lockItem(
  tx: Tx,
  type: ItemType,
  id: number,
): Promise<{ authorId: number; scoreRaw: number } | null> {
  const rows = await tx.$queryRawUnsafe<{ authorId: number; scoreRaw: number }[]>(
    `SELECT "authorId", "scoreRaw" FROM "hacker_news_clone"."${TABLE[type]}" WHERE id = $1 FOR UPDATE`,
    id,
  );
  return rows[0] ?? null;
}

/** Move the denormalised score and return what it became, so the caller need not read it again. */
async function bumpScore(tx: Tx, type: ItemType, id: number, by: number): Promise<number> {
  const data = { scoreRaw: { increment: by } };
  const select = { scoreRaw: true };

  const row =
    type === "post"
      ? await tx.post.update({ where: { id }, data, select })
      : await tx.comment.update({ where: { id }, data, select });

  return row.scoreRaw;
}
