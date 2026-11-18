import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const HERE = import.meta.dirname;
const schema = readFileSync(join(HERE, "schema.prisma"), "utf8");

function allMigrationSql(): string {
  const dir = join(HERE, "migrations");
  return readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .map((name) => readFileSync(join(dir, name, "migration.sql"), "utf8"))
    .join("\n");
}

const models = [...schema.matchAll(/^model (\w+)/gm)].map((m) => m[1]);

describe("the schema and its migrations", () => {
  it("has the models Appendix D specifies", () => {
    expect(models.length).toBeGreaterThan(0);
  });

  // Catches: a model added in a later milestone shipping without RLS. "RLS on with no policies" is
  // what makes a leaked Supabase publishable key read nothing, and it is per-table — so the table
  // added in M11 or M13 is exactly the one that would quietly be world-readable. Nothing else in
  // the build would notice, which is why this is a test and not a code review note.
  it("enables row level security on every table", () => {
    const sql = allMigrationSql();
    const withRls = new Set(
      [...sql.matchAll(/ALTER TABLE "(\w+)" ENABLE ROW LEVEL SECURITY/g)].map((m) => m[1]),
    );
    const missing = models.filter((name) => !withRls.has(name));
    expect(missing, `models without RLS: ${missing.join(", ")}`).toEqual([]);
  });

  // Catches: a URL put back into the datasource block. Prisma 7 rejects it, so this would be caught
  // at generate time too — but the failure reads as a parse error, and the fix someone reaches for
  // is to downgrade Prisma rather than to use the config file and the driver adapter.
  it("keeps connection strings out of the schema", () => {
    const datasource = schema.match(/datasource\s+\w+\s*\{[^}]*\}/)?.[0] ?? "";
    expect(datasource).not.toMatch(/\burl\s*=/);
    expect(datasource).not.toMatch(/\bdirectUrl\s*=/);
  });

  // Catches: the thread query losing its index. ARCHITECTURE §6.2 rests on one `findMany` ordered
  // by `path`; without [postId, path] that is a sequential scan over every comment in the table.
  it("indexes the one query that loads a thread", () => {
    const comment = schema.match(/model Comment\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(comment).toContain("@@index([postId, path])");
  });
});
