export const routing = {
  locales: ["zh-CN", "en-US"],
  defaultLocale: "zh-CN"
} as const;

export type Locale = (typeof routing.locales)[number];

