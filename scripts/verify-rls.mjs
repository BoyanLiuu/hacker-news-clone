// Verify in Postgres that RLS is on, and policy-free, for every table Prisma manages.
//
// The plan says "RLS enabled on every table with no policies; verify after enabling" — verify, not
// assume. `prisma/schema.test.ts` checks that the migration *says* it; this checks the database
// *did* it, which is the half that can differ.
//
// Talks to Postgres with `pg` rather than the Prisma client: the question is about catalog state,
// not about models, and this way the check still runs when the client has not been generated.
//
// Run: pnpm verify:rls   (needs .env)
import pg from "pg";

process.loadEnvFile();

// The app owns a schema rather than living in `public` — ARCHITECTURE Appendix D. Read from the
// Prisma schema rather than repeated here, so renaming it cannot leave this check pointing at an
// empty namespace and reporting success.
const schemaFile = new URL("../prisma/schema.prisma", import.meta.url);
const APP_SCHEMA = (await import("node:fs")).readFileSync(schemaFile, "utf8").match(
  /schemas\s*=\s*\[\s*"([^"]+)"/,
)?.[1];

if (!APP_SCHEMA) {
  console.error("Could not read the app schema name from prisma/schema.prisma");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(
  `SELECT t.tablename,
          t.rowsecurity,
          (SELECT count(*) FROM pg_policies p
            WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename)::int AS policies
   FROM pg_tables t
   WHERE t.schemaname = $1
   ORDER BY t.tablename`,
  [APP_SCHEMA],
);

if (rows.length === 0) {
  // An empty schema would otherwise pass every assertion below vacuously.
  console.error(`No tables found in schema "${APP_SCHEMA}". Has the migration been applied?`);
  process.exit(1);
}

// Prisma's own bookkeeping table is not ours to lock down: migrate must read and write it.
const managed = rows.filter((r) => !r.tablename.startsWith("_prisma"));

console.log(`schema: ${APP_SCHEMA}\n`);
console.log("table               rls     policies");
for (const r of rows) {
  const internal = r.tablename.startsWith("_prisma");
  console.log(
    `${r.tablename.padEnd(19)} ${String(r.rowsecurity).padEnd(7)} ${r.policies}` +
      (internal ? "   (prisma internal, skipped)" : ""),
  );
}

const unprotected = managed.filter((r) => !r.rowsecurity);
const withPolicies = managed.filter((r) => r.policies !== 0);

console.log(`\n${managed.length} managed tables`);
console.log(`RLS enabled on all:  ${unprotected.length === 0}`);
console.log(`policy-free on all:  ${withPolicies.length === 0}`);

await client.end();

if (unprotected.length > 0) {
  console.error(`\nFAIL — RLS off: ${unprotected.map((r) => r.tablename).join(", ")}`);
  process.exit(1);
}
if (withPolicies.length > 0) {
  // A policy is not automatically wrong, but it means the deny-by-default backstop has become an
  // authorization model, which Appendix D says it is not. Worth failing until someone decides.
  console.error(`\nFAIL — unexpected policies: ${withPolicies.map((r) => r.tablename).join(", ")}`);
  process.exit(1);
}
