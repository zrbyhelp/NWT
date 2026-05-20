import { describe, expect, it } from "vitest";
import { switchLocalePath } from "@/lib/locale-path";
import { colorThemes, typographyPresets } from "@/lib/theme-options";

describe("theme options", () => {
  it("keeps multiple AI-world color themes available", () => {
    expect(colorThemes.map((item) => item.id)).toEqual(["star-map", "matrix", "deep-space", "morning-fog"]);
  });

  it("provides full-application typography presets", () => {
    expect(typographyPresets.length).toBeGreaterThanOrEqual(3);
  });
});

describe("locale paths", () => {
  it("switches locale for the home route", () => {
    expect(switchLocalePath("/zh-CN", "en-US")).toBe("/en-US");
  });

  it("switches locale for admin routes", () => {
    expect(switchLocalePath("/zh-CN/admin", "en-US")).toBe("/en-US/admin");
    expect(switchLocalePath("/en-US/admin", "zh-CN")).toBe("/zh-CN/admin");
  });
});
