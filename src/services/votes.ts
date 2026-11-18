import { NotImplementedInStaticPhase, type ItemType } from "@/lib/types";

/**
 * Nothing to read here in phase 1: no vote can be cast, so no vote exists. Declared so M2's vote
 * button is written against the signature it will keep.
 *
 * In phase 2 this is idempotent on the composite key (userId, itemType, itemId) — see
 * ARCHITECTURE §6.4. The acting user comes from the session, never from an argument.
 */
export async function vote(_item: { type: ItemType; id: number }, _direction: 1 | -1): Promise<void> {
  throw new NotImplementedInStaticPhase("vote");
}

/** Which items this viewer has voted on — the thin per-user overlay from ARCHITECTURE §5. */
export async function getVotedItemIds(_type: ItemType): Promise<Set<number>> {
  return new Set();
}
