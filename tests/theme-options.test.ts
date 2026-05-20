import { describe, expect, it } from "vitest";
import { colorThemes, typographyPresets } from "@/lib/theme-options";

describe("theme options", () => {
  it("keeps multiple AI-world color themes available", () => {
    expect(colorThemes.map((item) => item.id)).toEqual(["star-map", "matrix", "deep-space", "morning-fog"]);
  });

  it("provides full-application typography presets", () => {
    expect(typographyPresets.length).toBeGreaterThanOrEqual(3);
  });
});

