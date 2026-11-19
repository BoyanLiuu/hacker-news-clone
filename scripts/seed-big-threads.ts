/**
 * Two synthetic threads, 500 and 1 000 comments, for M14's measurements.
 *
 * Run: pnpm db:seed:big
 *
 * The HN import caps at 400 comments per story (`MAX_COMMENTS_PER_STORY`), chosen in M8 because
 * uncapped measured ~760 MB against a 500 MB tier. That cap makes the plan's 500- and
 * 1 000-comment measurements impossible against real data, so these are generated instead: the
 * numbers being measured are render and query cost, which depend on row count, depth and text
 * length, not on who wrote the text.
 *
 * Shaped like a real argument rather than a flat list — a third of comments reply to an existing
 * one, so depth grows and `path` does real work. A flat thread would make `buildTree` and the
 * depth cap look free.
 *
 * Idempotent: it deletes its own posts by URL first, so re-running does not accumulate.
 */
import pg from "pg";
import { childPath, depthOf } from "@/lib/path";

const SCHEMA = "hacker_news_clone";
const SIZES = [500, 1000];
const MARKER = "https://example.invalid/tally-load-test/";

/** Deterministic, so two runs produce the same thread and a measurement is comparable. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const WORDS = `the cap is the design a thread is not a list and depth costs more than count
because every level adds a prefix to the path which the index sorts on so the shape of the
argument is what the database has to carry not merely its size`.split(/\s+/);

function body(random: () => number): string {
  // ~282 characters, the measured mean of the real imported comments (M8). A shorter body would
  // make the HTML budget look better than it is.
  const n = 44 + Math.floor(random() * 10);
  const words = Array.from({ length: n }, () => WORDS[Math.floor(random() * WORDS.length)]);
  return words.join(" ") + ".";
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const author = (
      await client.query<{ id: number }>(`SELECT id FROM "${SCHEMA}"."User" ORDER BY id LIMIT 1`)
    ).rows[0];
    if (!author) throw new Error("No users. Run the seed first.");

    const voices = (
      await client.query<{ id: number }>(`SELECT id FROM "${SCHEMA}"."User" ORDER BY id LIMIT 200`)
    ).rows.map((r) => r.id);

    await client.query("BEGIN");

    // Idempotent: drop whatever a previous run left, children first.
    const old = await client.query<{ id: number }>(
      `SELECT id FROM "${SCHEMA}"."Post" WHERE url LIKE $1`,
      [`${MARKER}%`],
    );
    if (old.rows.length > 0) {
      const ids = old.rows.map((r) => r.id);
      await client.query(`DELETE FROM "${SCHEMA}"."Comment" WHERE "postId" = ANY($1)`, [ids]);
      await client.query(`DELETE FROM "${SCHEMA}"."RankedPost" WHERE "postId" = ANY($1)`, [ids]);
      await client.query(`DELETE FROM "${SCHEMA}"."Post" WHERE id = ANY($1)`, [ids]);
      console.log(`  removed ${ids.length} thread(s) from a previous run`);
    }

    for (const size of SIZES) {
      const random = rng(size);
      const post = (
        await client.query<{ id: number }>(
          `INSERT INTO "${SCHEMA}"."Post" ("authorId", title, url, domain, "scoreRaw", "commentCount", "createdAt")
           VALUES ($1, $2, $3, 'example.invalid', $4, $5, now() - interval '3 hours') RETURNING id`,
          [author.id, `Load test: a ${size}-comment thread`, `${MARKER}${size}`, 200, size],
        )
      ).rows[0];

      // Breadth-first-ish: a third of comments reply to an existing comment, so the tree deepens.
      const made: { id: number; path: string }[] = [];
      for (let i = 0; i < size; i++) {
        const parent =
          made.length > 0 && random() < 0.34 ? made[Math.floor(random() * made.length)] : null;

        const row = (
          await client.query<{ id: number }>(
            `INSERT INTO "${SCHEMA}"."Comment"
               ("postId","parentId","authorId",text,path,depth,"scoreRaw","childCount","createdAt")
             VALUES ($1,$2,$3,$4,'pending',0,$5,0, now() - interval '3 hours' + ($6 || ' seconds')::interval)
             RETURNING id`,
            [post.id, parent?.id ?? null, voices[i % voices.length], body(random), 1 + Math.floor(random() * 20), i * 7],
          )
        ).rows[0];

        const path = childPath(parent?.path ?? null, row.id);
        await client.query(
          `UPDATE "${SCHEMA}"."Comment" SET path=$1, depth=$2 WHERE id=$3`,
          [path, depthOf(path), row.id],
        );
        if (parent) {
          await client.query(
            `UPDATE "${SCHEMA}"."Comment" SET "childCount" = "childCount" + 1 WHERE id=$1`,
            [parent.id],
          );
        }
        made.push({ id: row.id, path });
      }

      const depth = (
        await client.query<{ max: number }>(
          `SELECT max(depth) AS max FROM "${SCHEMA}"."Comment" WHERE "postId"=$1`,
          [post.id],
        )
      ).rows[0];
      console.log(`  thread ${post.id}: ${size} comments, max depth ${depth.max}`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log("\ndone.");
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
