import { db } from "@/lib/db";
import type { ItemType } from "@/lib/types";
import { getViewer } from "./viewer";

/**
 * Which items this viewer has voted on, and which way — the thin per-user overlay from
 * ARCHITECTURE §5, kept out of the cached listing read so one cache entry serves everyone.
 *
 * One query per page, not per row: the primary key leads with `userId`, so this is an index scan
 * over just this person's votes. Returned as a Map because a listing asks about 30 ids and a
 * thread about hundreds.
 */
export async function getVotes(type: ItemType, ids: readonly number[]): Promise<Map<number, 1 | -1>> {
  if (ids.length === 0) return new Map();

  const viewer = await getViewer();
  if (!viewer) return new Map();

  const rows = await db.vote.findMany({
    where: {
      userId: viewer.userId,
      itemType: type === "post" ? "POST" : "COMMENT",
      itemId: { in: [...ids] },
    },
    select: { itemId: true, value: true },
  });

  return new Map(rows.map((r) => [r.itemId, r.value === -1 ? -1 : 1]));
}
