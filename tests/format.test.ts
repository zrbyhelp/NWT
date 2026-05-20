import { describe, expect, it } from "vitest";
import { formatDisplayTime } from "@/lib/format";

describe("display time formatting", () => {
  const now = new Date(2026, 4, 20, 12, 30);

  it("formats recent times as localized relative minutes", () => {
    expect(formatDisplayTime(new Date(2026, 4, 20, 12, 30), "zh-CN", now)).toBe("刚刚");
    expect(formatDisplayTime(new Date(2026, 4, 20, 12, 25), "zh-CN", now)).toBe("5 分钟前");
    expect(formatDisplayTime(new Date(2026, 4, 20, 12, 25), "en-US", now)).toBe("5 min ago");
  });

  it("formats today, yesterday, and older dates", () => {
    expect(formatDisplayTime(new Date(2026, 4, 20, 10, 5), "zh-CN", now)).toBe("10:05");
    expect(formatDisplayTime(new Date(2026, 4, 19, 23, 15), "zh-CN", now)).toBe("昨天 23:15");
    expect(formatDisplayTime(new Date(2026, 4, 19, 23, 15), "en-US", now)).toBe("Yesterday 23:15");
    expect(formatDisplayTime(new Date(2026, 4, 18, 8, 4), "zh-CN", now)).toBe("05-18 08:04");
    expect(formatDisplayTime(new Date(2026, 4, 18, 8, 4), "en-US", now)).toBe("May 18 08:04");
    expect(formatDisplayTime(new Date(2025, 11, 31, 23, 59), "zh-CN", now)).toBe("2025-12-31 23:59");
    expect(formatDisplayTime(new Date(2025, 11, 31, 23, 59), "en-US", now)).toBe("Dec 31, 2025 23:59");
  });
});
