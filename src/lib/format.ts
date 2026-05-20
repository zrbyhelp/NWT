import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import type { Locale } from "@/i18n/routing";

export function formatDateTime(value: Date, locale: Locale) {
  return format(value, "yyyy-MM-dd HH:mm", {
    locale: locale === "zh-CN" ? zhCN : enUS
  });
}

export function formatCount(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

