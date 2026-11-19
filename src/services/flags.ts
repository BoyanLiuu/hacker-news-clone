import { db } from "@/lib/db";
import type { ItemType, Post, ViewerOpts } from "@/lib/types";
import { AUTHOR, JOIN, toPost } from "./map";
import { getViewer } from "./viewer";

/** Flagging and the moderator actions that act on flagged items. */

/**
 * The review queue: dead items, plus anything carrying flags.
 *
 * Two queries, because one `Flag` table serves both posts and comments (`itemType` + `itemId`, with
 * a composite key that makes flagging idempotent). That leaves no foreign key to `Post`, so Prisma
 * cannot count through a relation and the counts come from a `groupBy` merged here. Worth knowing
 * before reaching for `_count: { flags: true }`, which does not exist.
 *
 * **Fails closed for non-moderators.** This returns the dead and flagged items a shadow ban exists
 * to hide, so the viewer parameter is load-bearing: a read that accepts one and ignores it is worse
 * than one that takes none, because the next caller trusts it. `/admin/flagged` gates too, and that
 * redundancy is the point.
 */
export type FlaggedPost = Post & { flags: number };

export async function getFlagged(opts: ViewerOpts): Promise<FlaggedPost[]> {
  if (!opts.isModerator) return [];

  const grouped = await db.flag.groupBy({
    by: ["itemId"],
    where: { itemType: "POST" },
    _count: { itemId: true },
  });

  const flagCounts = new Map(grouped.map((g) => [g.itemId, g._count.itemId]));

  const rows = await db.post.findMany({
    ...JOIN,
    where: {
      isDeleted: false,
      OR: [{ isDead: true }, { id: { in: [...flagCounts.keys()] } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      url: true,
      text: true,
      domain: true,
      scoreRaw: true,
      commentCount: true,
      createdAt: true,
      editedAt: true,
      isDead: true,
      isDeleted: true,
      author: AUTHOR,
    },
  });

  return rows.map((row) => ({ ...toPost(row), flags: flagCounts.get(row.id) ?? 0 }));
}


/**
 * Which of these items this viewer has already flagged.
 *
 * The same shape as `getVotes`, and for the same reason: after flagging, `revalidatePath` re-renders
 * the page, which remounts the client control and resets its `useActionState` — so the word read
 * "flag" again as though nothing had happened. Action state cannot carry a fact that outlives the
 * request that produced it. The server knows, so the server says.
 *
 * One query per page rather than per row: the primary key leads with `userId`.
 */
export async function getViewerFlags(type: ItemType, ids: readonly number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();

  const viewer = await getViewer();
  if (!viewer) return new Set();

  const rows = await db.flag.findMany({
    where: {
      userId: viewer.userId,
      itemType: type === "post" ? "POST" : "COMMENT",
      itemId: { in: [...ids] },
    },
    select: { itemId: true },
  });

  return new Set(rows.map((r) => r.itemId));
}
