"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const USERNAME = /^[a-z0-9_]{3,20}$/;

/** Prisma's unique-constraint code. Matched on the field rather than the class, so a driver-level
 *  wrapper or a version bump cannot silently turn this into a catch-all. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** `tried` is what they typed, so a rejection can hand it back — see `field.tsx`: the input is
 *  always preserved. Without it the field clears and they retype from nothing. */
export type ClaimResult = { error: string; tried: string } | undefined;

/**
 * Claim a username, creating this app's `User` row for a Clerk identity.
 *
 * Clerk owns the account; the username is ours, because it is the URL of every profile and the text
 * of every byline. Permanent by Appendix G question 6: changing it would need redirects or a
 * username-history table.
 *
 * The row is created here rather than by a Clerk webhook. A webhook that fails leaves an account
 * that can sign in and does not exist, which is a support problem with no UI; creating it on the
 * path that needs it cannot drift.
 */
export async function claimUsername(_prev: ClaimResult, form: FormData): Promise<ClaimResult> {
  // Read the field before awaiting anything, so every rejection below — including an expired
  // session, the one most annoying to retype after — can hand the text back.
  const typed = String(form.get("username") ?? "");
  const raw = typed.trim().toLowerCase();

  // Authorisation inside the action, not only at the page: a Server Action is a public endpoint.
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: "Sign in first.", tried: typed };

  if (!USERNAME.test(raw)) {
    return {
      error: "3–20 characters, lowercase letters, numbers and underscores only.",
      tried: typed,
    };
  }

  // Already claimed one? Then this is a stale form, and silently renaming would break every link.
  if (await db.user.count({ where: { clerkId } })) redirect("/");

  try {
    await db.user.create({ data: { clerkId, username: raw } });
  } catch (error) {
    // The unique index is the arbiter, not a prior read: two people can pass a check-then-insert at
    // the same time and only one can win. But only P2002 means "taken" — a bare catch would report
    // a database outage as a naming collision and send someone off inventing new usernames.
    if (isUniqueViolation(error)) return { error: `"${raw}" is taken. Try another.`, tried: typed };
    throw error;
  }

  redirect("/");
}
