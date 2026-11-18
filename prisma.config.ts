import { defineConfig } from "prisma/config";

/**
 * Where the *migrate* connection string lives. It cannot go in `schema.prisma`: Prisma 7 rejects
 * `url` and `directUrl` in a `datasource` block (ARCHITECTURE Appendix D).
 *
 * `DIRECT_URL` is Supabase's **session** pooler on 5432, not the transaction pooler the app uses.
 * `prisma migrate` opens a session, takes advisory locks and runs DDL, none of which survive
 * transaction pooling — point this at 6543 and migrations fail in ways that read like network
 * errors. The app's own connection is the opposite choice, and lives in `src/lib/db.ts`.
 *
 * `DATABASE_URL` and `DIRECT_URL` must be in `.env`, **not** `.env.local`: the Prisma CLI does not
 * read `.env.local`, so that mistake yields a working app and a failing migration.
 *
 * `.env` is loaded here, explicitly, because Prisma evaluates this file *before* it loads `.env` —
 * so `process.env.DIRECT_URL` is empty at this point and every migrate command fails with "the
 * datasource.url property is required". Prisma's own `env()` helper defers resolution to solve
 * that, but it throws when the variable is missing, which breaks `prisma generate` and therefore
 * `postinstall` and therefore `pnpm install` on a fresh clone that has no `.env` yet.
 *
 * `process.loadEnvFile` is Node's built-in and needs no dependency. The catch is the fresh-clone
 * case: no `.env`, so `url` stays undefined, `generate` works, and the migrate commands are the
 * ones that complain — which is exactly when the URL is actually needed.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env yet. Fine for `generate`; the migrate commands will say so when it matters.
}
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL,
  },
  migrations: {
    path: "prisma/migrations",
    // tsx, not Node's type stripping: the seed imports the fixtures, which use the `@/*` tsconfig
    // paths that stripping does not resolve.
    seed: "tsx --env-file=.env prisma/seed.ts",
  },
});
