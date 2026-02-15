import { defineConfig } from "vite";

function resolvePagesBase(): string {
  const explicitBase = process.env.VITE_BASE_PATH;
  if (explicitBase && explicitBase.trim().length > 0) {
    const normalized = explicitBase.trim();
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  }

  if (!process.env.GITHUB_ACTIONS) return "/";

  const repository = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "";
  if (!repository || repository.endsWith(".github.io")) return "/";
  return `/${repository}/`;
}

export default defineConfig({
  base: resolvePagesBase(),
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
