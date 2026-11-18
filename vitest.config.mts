import { defineConfig } from "vitest/config";

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
