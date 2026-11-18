import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/*
 * The one PrismaClient for the app.
 *
 * `DATABASE_URL` is meant to be Supabase's **transaction** pooler on 6543 with `?pgbouncer=true` —
 * the opposite end from `prisma.config.ts`, which needs a session for DDL. A serverless app opens
 * and drops connections constantly, which is what transaction pooling is for.
 *
 * **Locally it is the session pooler on 5432 instead, because 6543 is blocked on this network.**
 * Verified: `nc` reaches 5432 and times out on 6543. So the transaction pooler is the one piece of
 * this wiring that deployment will exercise for the first time — recorded as a known gap rather
 * than left to be discovered then.
 *
 * The URL reaches Prisma through a driver adapter rather than a `datasource` block because Prisma 7
 * no longer accepts a URL in the schema (ARCHITECTURE Appendix D).
 *
 * Cached on `globalThis` in development only: `next dev` re-evaluates modules on every edit, and a
 * fresh client per reload leaks a connection pool each time until Postgres refuses new ones. In
 * production the module is evaluated once, so the global would be pointless indirection.
 */

/**
 * Connections this process may hold. `pg` defaults to 10, which is too many.
 *
 * The session pooler allows **15 clients for the whole project**, and the budget is per *process* —
 * Next runs several render workers, each evaluating this module and opening its own pool. So the
 * constraint is `workers x max < 15`, not `max < 15`. Exceeding it fails every query with
 * `(EMAXCONNSESSION) max clients reached in session mode`, while the app still renders its shell
 * with all the data missing, which reads like a UI bug rather than a database one.
 *
 * Three is the local compromise. These numbers are measured, not guessed: a sibling project on this
 * same pooler found 6 still exhausted it and 2 did not.
 *
 * **Deployed on the transaction pooler, set `DATABASE_POOL_MAX=6`** — it returns a connection per
 * transaction rather than per client, so the ceiling moves to per-instance.
 */
const MAX_CONNECTIONS = Number(process.env.DATABASE_POOL_MAX ?? 3);

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Failing here, by name, beats a driver error forty frames deep — and beats a silent fallback
    // to some default database, which is how test data ends up in production.
    throw new Error(
      "DATABASE_URL is not set. It belongs in .env (not .env.local — the Prisma CLI cannot read that). " +
        "See .env.example for which pooler to use; 6543 is blocked on this network, so local uses 5432.",
    );
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: MAX_CONNECTIONS }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
