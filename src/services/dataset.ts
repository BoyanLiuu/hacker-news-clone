import { db } from "@/lib/db";

/**
 * Whether the fixture dataset (`pnpm db:seed`) is loaded, rather than the Hacker News import.
 *
 * Only the fixtures carry moderation state — a dead post, a shadow-banned author, a deleted comment
 * with a surviving reply — because the import would have to invent it and attach it to named real
 * people. So the visibility tests skip against the import instead of failing.
 *
 * Detected by content, not an env var: the question is whether the rows exist.
 */
export async function hasFixtureDataset(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;

  try {
    const [dead, shadowed] = await Promise.all([
      db.post.count({ where: { isDead: true } }),
      db.user.count({ where: { isShadowBanned: true } }),
    ]);
    return dead > 0 && shadowed > 0;
  } catch {
    // No reachable database is the same answer as no dataset, for the purpose of skipping.
    return false;
  }
}
