import { differenceInMinutes, format, isSameDay, isSameYear, subDays } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import type { Locale } from "@/i18n/routing";

export function formatDateTime(value: Date, locale: Locale) {
  return format(value, "yyyy-MM-dd HH:mm", {
    locale: locale === "zh-CN" ? zhCN : enUS
  });
}

export function formatDisplayTime(value: Date | string, locale: Locale, now = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const minutes = differenceInMinutes(now, date);

  if (minutes >= 0 && minutes < 60) {
    if (minutes < 1) {
      return locale === "zh-CN" ? "刚刚" : "Just now";
    }

    return locale === "zh-CN" ? `${minutes} 分钟前` : `${minutes} min ago`;
  }

  if (isSameDay(date, now)) {
    return format(date, "HH:mm");
  }

  if (isSameDay(date, subDays(now, 1))) {
    const time = format(date, "HH:mm");
    return locale === "zh-CN" ? `昨天 ${time}` : `Yesterday ${time}`;
  }

  if (locale === "zh-CN") {
    return format(date, isSameYear(date, now) ? "MM-dd HH:mm" : "yyyy-MM-dd HH:mm", { locale: zhCN });
  }

  return format(date, isSameYear(date, now) ? "MMM d HH:mm" : "MMM d, yyyy HH:mm", { locale: enUS });
}

export function formatCount(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}
