/**
 * Replace every imported Hacker News username with a generated one.
 *
 * Run: pnpm db:anonymise
 *
 * This settles ARCHITECTURE Appendix G question 5. The HN import brought 25 560 real people's
 * handles and attached their real writing to them, which is fine on a laptop and not fine anywhere
 * reachable. Renaming the authors breaks the link between a person and what they wrote, which is
 * the part that matters: the text was already public, the attribution is what this removes.
 *
 * Names are derived from the row's own id, so the script is **idempotent** — running it twice
 * produces the same names and changes nothing. There is no mapping file, deliberately: a file that
 * turned the new names back into the old ones would undo the entire point of running this.
 *
 * Only rows whose `clerkId` starts with `hn:` are touched. A real Clerk account has a `user_...`
 * id and keeps the username its owner chose.
 *
 * **Thread pages keep serving the old names for up to five minutes afterwards.** Signed-out thread
 * rows are cached by tag (`getThreadRows`), and a script writing straight to Postgres has no
 * `updateTag` to call — this is exactly the case the 300 s backstop on that cache exists for.
 * Observed: the front page updated at once, a thread did not until the cache expired. Restart the
 * server, or wait it out.
 */
import pg from "pg";

const SCHEMA = "hacker_news_clone";

/**
 * Two wordlists and a base36 suffix. The suffix is what guarantees uniqueness — ids are unique, so
 * the names are too, with no collision check and no state kept between runs.
 */
const ADJECTIVES = `amber brisk calm civic clear dusk early fair glad grey harsh ideal just keen
late mild north odd plain quiet rapid soft terse upper vivid warm west young zonal blunt crisp`.split(
  /\s+/,
);

const NOUNS = `anvil bay cedar delta ember fern gorse harbor inlet jetty kiln loam marsh nook
orchard pike quarry ridge slate thorn vale weir yard brook cairn dune flint grove heath lane`.split(
  /\s+/,
);

/** A small integer hash, so the wordlist pick is spread rather than sequential. */
function spread(n: number, salt: number): number {
  let h = (n ^ salt) * 2654435761;
  h = (h ^ (h >>> 15)) * 2246822519;
  return Math.abs(h ^ (h >>> 13));
}

/**
 * The handle for a given row id. Lowercase, within 3–20 characters, letters/digits/underscore —
 * the same shape `claimUsername` enforces, so a generated name is one a person could have chosen.
 */
export function handleFor(id: number): string {
  const adjective = ADJECTIVES[spread(id, 0x9e37) % ADJECTIVES.length];
  const noun = NOUNS[spread(id, 0x85eb) % NOUNS.length];
  return `${adjective}_${noun}${id.toString(36)}`;
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows: users } = await client.query<{ id: number; username: string }>(
      `SELECT id, username FROM "${SCHEMA}"."User" WHERE "clerkId" LIKE 'hn:%' ORDER BY id`,
    );
    console.log(`${users.length} imported accounts found`);
    if (users.length === 0) return;

    const renames = users
      .map((user) => ({ id: user.id, from: user.username, to: handleFor(user.id) }))
      .filter((rename) => rename.from !== rename.to);

    if (renames.length === 0) {
      console.log("already anonymised — names come from the row id, so there is nothing to do");
      return;
    }

    await client.query("BEGIN");

    // One statement, not 25 560. `clerkId` carries the username too (`hn:<name>`), and leaving it
    // stale would keep the real handle in the database in a second place.
    const values = renames.map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::text)`).join(",");
    const params = renames.flatMap((rename) => [rename.id, rename.to]);
    await client.query(
      `UPDATE "${SCHEMA}"."User" u
       SET username = v.name, "clerkId" = 'hn:' || v.name
       FROM (VALUES ${values}) AS v(id, name)
       WHERE u.id = v.id`,
      params,
    );
    console.log(`  renamed ${renames.length} accounts`);

    /**
     * `@handle` mentions inside comment bodies. A rename does not reach these, and they are the
     * one place a real handle survives in readable form. Rewritten to the new name so the thread
     * still reads, rather than blanked.
     *
     * Bare handles — "as tptacek said", with no `@` — are **not** caught. Matching 25 560 names
     * against 134 459 bodies is the wrong shape of job, and many short handles are ordinary words,
     * so the false positives would damage real sentences. Stated plainly rather than left implied:
     * this reduces the residue, it does not eliminate it.
     */
    const map = new Map(renames.map((rename) => [rename.from, rename.to]));

    // Two round trips, not 25 560. The first version ran one UPDATE per renamed handle, which at
    // ~28 ms to Supabase is twelve minutes of latency to rewrite a few hundred rows — the mistake
    // this codebase has measured more than once. Only comments containing an `@` can hold a
    // mention, and there are few, so fetch those, rewrite them here, and write them back at once.
    const { rows: mentioning } = await client.query<{ id: number; text: string }>(
      `SELECT id, text FROM "${SCHEMA}"."Comment" WHERE text LIKE '%@%'`,
    );

    const rewritten: { id: number; text: string }[] = [];
    for (const comment of mentioning) {
      // `@` followed by a handle, bounded so `@tom` does not match inside `@tommy`.
      const next = comment.text.replace(
        /@([A-Za-z0-9_-]+)/g,
        (whole, handle: string) => (map.has(handle) ? `@${map.get(handle)}` : whole),
      );
      if (next !== comment.text) rewritten.push({ id: comment.id, text: next });
    }

    if (rewritten.length > 0) {
      const textValues = rewritten.map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::text)`).join(",");
      await client.query(
        `UPDATE "${SCHEMA}"."Comment" c
         SET text = v.text
         FROM (VALUES ${textValues}) AS v(id, text)
         WHERE c.id = v.id`,
        rewritten.flatMap((r) => [r.id, r.text]),
      );
    }
    console.log(
      `  scanned ${mentioning.length} comments containing "@", rewrote mentions in ${rewritten.length}`,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log("\ndone. There is no mapping back — that is the point.");
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
