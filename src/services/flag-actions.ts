/**
 * Flagging, and the moderator actions that act on flagged items. Separate from `flags.ts`, which
 * only reads, because `"use server"` turns every export into a public endpoint.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ItemType as DbItemType } from "@/generated/prisma/enums";
import { CFG } from "@/lib/config";
import { db } from "@/lib/db";
import type { ItemType } from "@/lib/types";
import { getViewer } from "./viewer";

/** Reported back to the row that submitted, so a refusal is never silent. */
export type FlagResult = { ok: true; dead: boolean } | { ok: false; error: string } | undefined;

function parse(form: FormData): { type: ItemType; id: number } | null {
  const type = form.get("type");
  const id = Number(form.get("id"));

  if (type !== "post" && type !== "comment") return null;
  if (!Number.isInteger(id) || id < 1) return null;

  return { type, id };
}

/**
 * Flag an item.
 *
 * Idempotent on `@@id([userId, itemType, itemId])`, so flagging twice is flagging once — the same
 * primary-key trick as voting, and for the same reason: brigading is easier if a refresh counts.
 *
 * Gated on account age *and* karma, which Appendix A states as "flags count only from established
 * accounts". The gate is checked here and not only in the UI, because the row offering no `flag`
 * link is a courtesy and this action is reachable without the row.
 *
 * The flag and the kill are one transaction. A flag written without re-counting would leave an
 * item one flag over the threshold and alive, and nothing would ever revisit it — the count is only
 * consulted at the moment a flag arrives.
 */
export async function flagItem(_prev: FlagResult, form: FormData): Promise<FlagResult> {
  const input = parse(form);
  if (!input) return { ok: false, error: "That flag made no sense." };

  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  // `canFlag` is account age and karma together — see `getViewer`.
  if (!viewer.canFlag) {
    return {
      ok: false,
      error: `Flagging needs an account ${CFG.flagMinDays} days old with ${CFG.flagMinKarma} karma.`,
    };
  }

  const itemType = input.type === "post" ? DbItemType.POST : DbItemType.COMMENT;
  const key = { userId_itemType_itemId: { userId: viewer.userId, itemType, itemId: input.id } };

  try {
    const dead = await db.$transaction(async (tx) => {
      const owner = await findOwner(tx, input.type, input.id);
      if (!owner) return null;
      // Flagging your own item is a request to delete it, not a moderation signal.
      if (owner.authorId === viewer.userId) return "own" as const;

      await tx.flag.upsert({
        where: key,
        create: { userId: viewer.userId, itemType, itemId: input.id },
        update: {},
      });

      // Counted inside the transaction, after the insert, so two simultaneous flags cannot both
      // read the pre-insert total and both decide the item is one short of dying.
      const flags = await tx.flag.count({ where: { itemType, itemId: input.id } });
      if (flags < CFG.flagsToDie) return false;

      if (input.type === "post") {
        await tx.post.update({ where: { id: input.id }, data: { isDead: true } });
      } else {
        await tx.comment.update({ where: { id: input.id }, data: { isDead: true } });
      }
      return true;
    });

    if (dead === null) return { ok: false, error: "That item is gone." };
    if (dead === "own") return { ok: false, error: "You cannot flag your own item." };

    // A dead post leaves the listings, so the ranked table has to lose it rather than wait for the
    // cron: `refresh_ranked_posts` excludes dead posts, but up to 60 s of staleness would keep a
    // killed item on the front page, which is the one place it must not be.
    if (dead) await db.rankedPost.deleteMany({ where: { postId: input.id } });

    // Next re-renders the page the action was submitted from on its own, so these calls are only
    // about *other* cached routes. The thread and the queue always change — the control's word
    // becomes "flagged", and the count moves. The listings only change when the item actually left
    // them, and `getRankedPage` is cached for every signed-out viewer, so busting it on a flag that
    // killed nothing would throw away a shared cache entry to no effect.
    revalidatePath("/item");
    revalidatePath("/admin/flagged");
    if (dead) {
      revalidatePath("/");
      revalidatePath("/newest");
    }
    return { ok: true, dead };
  } catch (error) {
    console.error("flagItem failed", { type: input.type, id: input.id, error });
    return { ok: false, error: "Flag not saved — the server didn't answer." };
  }
}

/**
 * Kill or restore an item directly. Moderators only.
 *
 * A moderator's decision is not a flag and does not touch the `Flag` rows: restoring an item leaves
 * its flags in place deliberately, so the queue still shows that it was contested and a second
 * flagger cannot immediately re-kill it by pushing the count back over the line — the count is
 * already over. `isDead` is the moderator's word on it, and `flagItem` only ever sets it.
 */
export async function setDead(form: FormData): Promise<void> {
  const input = parse(form);
  if (!input) redirect("/admin/flagged");

  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  // Silent redirect rather than an error: a non-moderator should not learn whether the id exists.
  if (!viewer.user.isModerator) redirect("/");

  const dead = form.get("dead") === "1";

  if (input.type === "post") {
    await db.post.update({ where: { id: input.id }, data: { isDead: dead } });
    // Killed items leave the ranked table now; the cron would otherwise keep one for up to 60 s.
    // A restored post is picked up by the next tick, which is the staleness §1.2 already accepts.
    if (dead) await db.rankedPost.deleteMany({ where: { postId: input.id } });
  } else {
    await db.comment.update({ where: { id: input.id }, data: { isDead: dead } });
  }

  revalidatePath("/");
  revalidatePath("/newest");
  revalidatePath("/item");
  revalidatePath("/admin/flagged");
  redirect("/admin/flagged");
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function findOwner(tx: Tx, type: ItemType, id: number): Promise<{ authorId: number } | null> {
  if (type === "post") return tx.post.findUnique({ where: { id }, select: { authorId: true } });
  return tx.comment.findUnique({ where: { id }, select: { authorId: true } });
}
