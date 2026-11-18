import { cache } from "react";
import { db } from "@/lib/db";
import { NotImplementedInStaticPhase, type User } from "@/lib/types";
import { toUser } from "./map";

/**
 * Profiles. Unconditional by design: a shadow-banned author's *content* is hidden, but their
 * profile page is not — the whole point of a shadow ban is that the account looks normal to its
 * owner, and a 404 on your own profile would announce it.
 */
export const getUserByName = cache(async (username: string): Promise<User | null> => {
  const row = await db.user.findUnique({
    where: { username },
    select: {
      username: true,
      about: true,
      karma: true,
      isModerator: true,
      isShadowBanned: true,
      showDead: true,
      createdAt: true,
    },
  });

  return row ? toUser(row) : null;
});

export async function updateProfile(_input: { about: string; showDead: boolean }): Promise<User> {
  // M10 brings the session this needs. Writing it now would mean deciding whose profile to update
  // from an argument, which is exactly the mistake §6.4 warns about.
  throw new NotImplementedInStaticPhase("updateProfile");
}
