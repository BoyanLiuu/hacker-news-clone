import { NotImplementedInStaticPhase, type ItemType } from "@/lib/types";

/** Flagging and the moderator actions that act on flagged items. */

export async function flag(_item: { type: ItemType; id: number }): Promise<void> {
  throw new NotImplementedInStaticPhase("flag");
}

export async function killItem(_item: { type: ItemType; id: number }): Promise<void> {
  throw new NotImplementedInStaticPhase("killItem");
}

export async function restoreItem(_item: { type: ItemType; id: number }): Promise<void> {
  throw new NotImplementedInStaticPhase("restoreItem");
}
