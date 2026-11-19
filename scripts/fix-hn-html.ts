/**
 * Convert the already-imported comment and post bodies from HN's HTML to the formatter's syntax.
 *
 * Run: pnpm db:fix-html
 *
 * The importer now converts on the way in, but 92 099 comments were stored before it did and were
 * displaying their own markup. This repairs them in place rather than re-importing: a re-import
 * would fetch 2 000 trees again, and the stories, scores and timestamps are already right — only
 * the body text is wrong.
 *
 * Idempotent, because `fromHnHtml` leaves text with no tags or entities untouched. Batched because
 * a single statement carrying 92 000 bodies is a multi-hundred-megabyte query; each batch is its
 * own transaction, so an interruption leaves the rows it finished converted and the rest unchanged
 * — both states render correctly, which is what makes partial progress safe here.
 */
import pg from "pg";
import { fromHnHtml, looksLikeHnHtml } from "@/lib/from-hn-html";

const SCHEMA = "hacker_news_clone";
const BATCH = 2000;

type Row = { id: number; text: string };

async function convertTable(client: pg.Client, table: "Comment" | "Post"): Promise<void> {
  let converted = 0;
  let scanned = 0;

  for (let cursor = 0; ; ) {
    const { rows } = await client.query<Row>(
      `SELECT id, text FROM "${SCHEMA}"."${table}"
       WHERE id > $1 AND text IS NOT NULL AND text <> ''
       ORDER BY id LIMIT ${BATCH}`,
      [cursor],
    );
    if (rows.length === 0) break;

    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    // One pass: convert, keep only what actually changed. `looksLikeHnHtml` is the cheap screen,
    // and comparing the result to the original is the honest one — a body can match the pattern and
    // still convert to itself.
    const changes: Row[] = [];
    for (const row of rows) {
      if (!looksLikeHnHtml(row.text)) continue;
      const text = fromHnHtml(row.text);
      if (text !== row.text) changes.push({ id: row.id, text });
    }

    if (changes.length > 0) {
      const values = changes.map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::text)`).join(",");
      await client.query(
        `UPDATE "${SCHEMA}"."${table}" t SET text = v.text
         FROM (VALUES ${values}) AS v(id, text) WHERE t.id = v.id`,
        changes.flatMap((change) => [change.id, change.text]),
      );
      converted += changes.length;
    }

    process.stdout.write(`\r  ${table}: scanned ${scanned}, converted ${converted}   `);
  }

  process.stdout.write("\n");
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await convertTable(client, "Comment");
    await convertTable(client, "Post");
  } finally {
    await client.end();
  }

  console.log("\ndone. Thread pages may serve the old text for up to 5 minutes — see getThreadRows.");
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
