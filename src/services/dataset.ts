import { db } from "@/lib/db";

/**
 * Which dataset is in the database right now.
 *
 * Two seeds exist and they are for different jobs:
 *
 *   - `pnpm db:seed` — the fixtures. Small, deterministic, and the only dataset containing the
 *     moderation states the visibility rules are about: a dead post, a shadow-banned author, a
 *     deleted comment with a surviving reply.
 *   - `pnpm db:seed:hn` — real Hacker News stories. Realistic volume and real comment trees, but
 *     nothing is dead, shadow-banned or deleted, because inventing moderation state and attaching
 *     it to a named real person is not something this project will do.
 *
 * So the integration tests that assert visibility rules need the fixture dataset, and must skip
 * rather than fail against the other one. Detected by content rather than by an environment
 * variable, because the question is "are the rows I need here", and only the database knows.
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
