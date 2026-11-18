import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite resolves the tsconfig `@/*` paths natively; no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
