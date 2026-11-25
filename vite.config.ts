import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));

// The site lives in site/ and imports shared logic from src/shared (ADR-0006, ADR-0008).
export default defineConfig({
  root: "site",
  base: "/forever-broke/", // GitHub Pages project path
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { fs: { allow: [repoRoot] } },
});
