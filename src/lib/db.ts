import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * The one PrismaClient for the app. Connection details and the 6543-vs-5432 choice live in
 * `.env.example` and ARCHITECTURE Appendix D; a driver adapter rather than a `datasource` block
 * because Prisma 7 rejects URLs in the schema.
 */

/**
 * `pg` defaults to 10, which exceeds the budget: Supabase's session pooler allows 15 clients for
 * the whole project, and Next runs several render workers each holding its own pool — so the
 * constraint is `workers × max < 15`. Over it, every query fails with `(EMAXCONNSESSION)` while the
 * app still renders its shell, so it reads as a UI bug rather than a database one.
 *
 * Measured on this pooler: 6 still exhausted it, 2 did not. Deployed on the transaction pooler, set
 * `DATABASE_POOL_MAX=6` — it returns a connection per transaction, so the ceiling is per instance.
 */
const MAX_CONNECTIONS = Number(process.env.DATABASE_POOL_MAX ?? 3);

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. It belongs in .env (not .env.local — the Prisma CLI cannot read that). " +
        "See .env.example for which pooler to use; 6543 is blocked on this network, so local uses 5432.",
    );
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: MAX_CONNECTIONS }) });
}

// `next dev` re-evaluates modules on every edit; a fresh client per reload leaks a pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
