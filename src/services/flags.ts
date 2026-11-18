import { db } from "@/lib/db";
import { NotImplementedInStaticPhase, type ItemType, type Post, type ViewerOpts } from "@/lib/types";
import { AUTHOR, toPost } from "./map";

/** Flagging and the moderator actions that act on flagged items. */

/**
 * The review queue: dead items, plus anything carrying flags.
 *
 * Two queries, and that is a direct consequence of Appendix D's `Flag` shape. One table serves both
 * posts and comments — `itemType` plus `itemId`, with a composite primary key that makes flagging
 * idempotent — which means there is no foreign key from `Flag` to `Post`, so Prisma cannot join it
 * or count it through a relation. The counts come from a `groupBy` and are merged here.
 *
 * That trade was made knowingly: idempotent flagging across both item types is worth more than a
 * relational count on the one screen that needs it. It is recorded here because the next person to
 * reach for `_count: { flags: true }` will find it does not exist and should know why.
 *
 * **Fails closed for non-moderators.** The parameter is not decoration: this returns dead and
 * flagged items, which are exactly what a shadow ban and a kill are meant to hide, and a read that
 * accepts a viewer and then ignores it is worse than one that takes none — the next caller trusts
 * it. `/admin/flagged` also gates on `isModerator`, and that redundancy is the point.
 *
 * M13 wires the actions and makes flag counts non-zero.
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

export async function flag(_item: { type: ItemType; id: number }): Promise<void> {
  throw new NotImplementedInStaticPhase("flag");
}

export async function killItem(_item: { type: ItemType; id: number }): Promise<void> {
  throw new NotImplementedInStaticPhase("killItem");
}

export async function restoreItem(_item: { type: ItemType; id: number }): Promise<void> {
  throw new NotImplementedInStaticPhase("restoreItem");
}
