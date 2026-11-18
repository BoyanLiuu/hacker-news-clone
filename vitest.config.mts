import { defineConfig } from "vitest/config";

// The service tests talk to Postgres now, so they need the same `.env` Next and the Prisma CLI
// read. Absent, they skip rather than fail — see `describe.skipIf` in the service tests.
try {
  process.loadEnvFile();
} catch {
  // No .env: the pure unit tests still run, the integration ones skip.
}

export default defineConfig({
  // Vite resolves the tsconfig `@/*` paths natively; no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // `prisma/` too: the schema and its migrations carry invariants worth asserting
    // (RLS per table, the thread index), and they do not live under src/.
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
  },
});
