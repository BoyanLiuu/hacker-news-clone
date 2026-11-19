/**
 * Creating, editing and deleting a post. Separate from `posts.ts`, which only reads, because
 * `"use server"` turns every export into a public endpoint — the same split as `vote-action.ts`.
 */
"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CFG, HOUR, MINUTE } from "@/lib/config";
import { db } from "@/lib/db";
import type { ViewerOpts } from "@/lib/types";
import { registrableDomain } from "@/lib/domain";
import { networkOf } from "@/lib/network";
import { normaliseSubmission, validateEdit, validateSubmission, type SubmitErrors } from "@/lib/validate";
import { castVote } from "./vote-action";
import { getSubmitQuota } from "./posts";
import { getViewer } from "./viewer";

/**
 * What the form shows after a rejected submission. `fields` comes back because Appendix A requires
 * validation errors to preserve what was typed, and a Server Action's reply is the only thing the
 * no-JS path has left of it — the browser has already replaced the page.
 */
export type SubmitState =
  | { errors: SubmitErrors; fields: { title: string; url: string; text: string } }
  | { limited: string; fields: { title: string; url: string; text: string } }
  | undefined;

function readFields(form: FormData) {
  return {
    title: String(form.get("title") ?? ""),
    url: String(form.get("url") ?? ""),
    text: String(form.get("text") ?? ""),
  };
}

/**
 * Submit a post.
 *
 * Every rule is re-checked here even though the form checks them too: the form's copy is for live
 * feedback, and a Server Action is reachable without ever loading the form.
 *
 * A duplicate URL does not create a second thread. It upvotes the existing one and sends the
 * submitter there, which is the plan's rule and HN's behaviour — and it goes through `castVote`
 * rather than touching `scoreRaw`, so one vote per person per item stays enforced by the primary
 * key instead of by this function remembering to check.
 */
export async function submitPost(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  const fields = readFields(form);

  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  const errors = validateSubmission(fields);
  if (Object.keys(errors).length > 0) return { errors, fields };

  const { title, url, text } = normaliseSubmission(fields);

  // Parsed once and passed down: the check and the record both need it, and reading the header
  // twice meant two chances for the two to disagree about what counts as one network.
  const network = networkOf((await headers()).get("x-forwarded-for"));

  // Both limits before the insert, and the per-user one first: it counts rows this account already
  // owns, so it cannot be gamed, and it is the number the aside on /submit shows.
  const limited = await checkLimits(viewer.opts, network);
  if (limited) return { limited, fields };

  const domain = url ? registrableDomain(url) : null;

  if (url) {
    const existing = await db.post.findFirst({
      where: {
        url,
        isDeleted: false,
        createdAt: { gte: new Date(Date.now() - CFG.dupDays * 24 * HOUR) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (existing) {
      // Count the submitter's interest as the upvote it is, through the vote path so a resubmit by
      // the same person is idempotent rather than a second point.
      const voteForm = new FormData();
      voteForm.set("type", "post");
      voteForm.set("id", String(existing.id));
      voteForm.set("direction", "1");
      // The result is deliberately ignored: resubmitting your *own* link is refused as a self-vote,
      // and landing on the thread is right either way. castVote logs its own failures.
      await castVote(undefined, voteForm);

      // `dup=1` is what makes the landing honest: the thread explains why you are here rather than
      // leaving you to wonder where your submission went. `item/page.tsx` already renders it.
      redirect(`/item?id=${existing.id}&dup=1`);
    }
  }

  const created = await db.post.create({
    data: { authorId: viewer.userId, title, url, text, domain },
    select: { id: true },
  });

  if (network) await db.rateHit.create({ data: { network } });

  // The new post belongs on /newest immediately; / is rebuilt by the ranking cron on its own
  // schedule, and ARCHITECTURE §1.2 chose that staleness deliberately.
  revalidatePath("/newest");
  revalidatePath("/");
  redirect(`/item?id=${created.id}`);
}

/**
 * Both rate limits, as a message or nothing.
 *
 * Returns prose rather than a boolean because the two limits fail for different reasons and a
 * submitter who hit the network limit cannot act on "you have posted too much" — they have not.
 */
async function checkLimits(opts: ViewerOpts, network: string | null): Promise<string | null> {
  // `getSubmitQuota`, not a second count of the same rows: /submit's aside displays that number and
  // disables the button from it, so a separate query here could refuse a submission the page had
  // just said was allowed.
  const quota = await getSubmitQuota(opts);
  if (quota.used >= quota.limit) {
    return `That is ${quota.used} submissions this hour, which is the limit. Try again later — your draft stays here.`;
  }

  // No readable address means no network limit, not a shared bucket: bucketing every unparseable
  // request together would let one malformed header exhaust the allowance for everyone at once.
  if (!network) return null;

  const fromNetwork = await db.rateHit.count({
    where: { network, createdAt: { gte: new Date(Date.now() - HOUR) } },
  });
  if (fromNetwork >= CFG.ratePerIp) {
    return `This network has reached ${CFG.ratePerIp} submissions this hour. Try again later — your draft stays here.`;
  }

  return null;
}

/**
 * Edit a post's title and text, inside the window.
 *
 * Never the URL, which is Appendix A's rule and not an oversight: the URL is what duplicate
 * detection matched on and what every reader already followed, so changing it would rewrite what
 * other people voted for.
 */
export async function editPost(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  const id = Number(form.get("id"));
  const fields = readFields(form);

  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!Number.isInteger(id) || id < 1) return { errors: { title: "That post does not exist." }, fields };

  const post = await db.post.findUnique({
    where: { id },
    select: { authorId: true, createdAt: true, url: true },
  });
  if (!post) return { errors: { title: "That post does not exist." }, fields };

  // Ownership and the window are checked here, not only in the UI: the row offers `edit` to its
  // author, and that is a courtesy, not a permission check.
  if (post.authorId !== viewer.userId) {
    return { errors: { title: "That is not your post." }, fields };
  }
  if (Date.now() - post.createdAt.getTime() > CFG.editMinutes * MINUTE) {
    return { errors: { title: `The ${CFG.editMinutes / 60}-hour edit window has closed.` }, fields };
  }

  // An edit's rules are not the submission rules minus a field — see `validateEdit`. The previous
  // version ran `validateSubmission` and deleted the url error, which let a text post be saved with
  // its body emptied: a row with neither a URL nor text, which nothing can render.
  const errors = validateEdit({ ...fields, hasUrl: post.url !== null });
  if (Object.keys(errors).length > 0) return { errors, fields };

  await db.post.update({
    where: { id },
    data: { title: fields.title.trim(), text: fields.text.trim() || null, editedAt: new Date() },
  });

  revalidatePath(`/item`);
  redirect(`/item?id=${id}`);
}

/**
 * Delete a post, while nothing is attached to it.
 *
 * Soft, via `isDeleted`, because `visiblePostWhere` already filters on it and a hard delete would
 * orphan votes that point at the row by id. The comment-count rule is the real guard: once someone
 * has replied, the thread is theirs too.
 */
export async function deletePost(form: FormData): Promise<void> {
  const id = Number(form.get("id"));

  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!Number.isInteger(id) || id < 1) redirect("/");

  const post = await db.post.findUnique({
    where: { id },
    select: { authorId: true, commentCount: true },
  });
  if (!post) redirect("/");

  // Silent refusal, by redirecting to the thread: a failed delete has nowhere to show an error, and
  // the post still being there is the message.
  if (post.authorId !== viewer.userId || post.commentCount > 0) redirect(`/item?id=${id}`);

  await db.post.update({ where: { id }, data: { isDeleted: true } });

  revalidatePath("/");
  revalidatePath("/newest");
  redirect("/");
}
