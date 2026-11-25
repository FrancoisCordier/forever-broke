import { defineConfig } from "vitest/config";

// Separate from vite.config.ts, whose root is site/: tests live in test/ at the repo root.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
