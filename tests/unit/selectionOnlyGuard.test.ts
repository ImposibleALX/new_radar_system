import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("selection-only guard", () => {
  it("keeps active source files free from controlled remnants", () => {
    const paths = [
      "index.html",
      "src/main.ts",
      "src/core/render/ringModel.ts",
      "src/core/render/rangeRings.ts",
      "src/core/render/ringSemantics.ts",
      "src/core/render/canvasRenderer.ts",
      "src/core/sim/locks.ts",
      "src/ui/hud.ts",
      "src/ui/domCache.ts"
    ];

    for (const rel of paths) {
      const content = readFileSync(join(process.cwd(), rel), "utf8");
      expect(content.toLowerCase()).not.toContain("controlled");
    }
  });
});
