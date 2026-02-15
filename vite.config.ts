import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    sourcemap: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/core/")) return "core";
          if (id.includes("/src/ui/")) return "ui";
          if (id.includes("/src/features/perfHarness")) return "perf";
          if (id.includes("/src/features/importExport")) return "io";
          return undefined;
        }
      }
    }
  }
});
