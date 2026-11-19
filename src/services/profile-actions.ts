/**
 * Saving your own profile. Separate from `users.ts`, which only reads, because `"use server"` turns
 * every export into a public endpoint.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "./viewer";

/** `undefined` before the first submit; otherwise the outcome, so the page can say what happened. */
export type ProfileState = { saved: true } | { error: string } | undefined;

/** The about text's cap. Long enough for a paragraph, short enough that a profile stays a profile. */
const ABOUT_MAX = 2000;

/**
 * Save the about text and the show-dead preference.
 *
 * Whose profile is never an argument — it comes from the session. That was the open question the
 * old stub refused to answer, and it is the whole reason this could not be written before M10.
 *
 * `showDead` is read as a checkbox: an unchecked box sends no field at all, so its absence is
 * `false` rather than "unchanged". That is what makes the toggle able to turn *off*.
 */
export async function saveProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  const about = String(form.get("about") ?? "").trim();
  if (about.length > ABOUT_MAX) {
    return { error: `Shorten your about text to ${ABOUT_MAX} characters.` };
  }

  await db.user.update({
    where: { id: viewer.userId },
    data: { about, showDead: form.get("showDead") === "on" },
  });

  // `showDead` changes what every listing may show this viewer, so the whole app's reads are stale.
  revalidatePath("/", "layout");
  return { saved: true };
}
