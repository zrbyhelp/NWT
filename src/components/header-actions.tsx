"use client";

import { Languages, Shield } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { localePath, switchLocalePath } from "@/lib/locale-path";

const languageNames: Record<Locale, string> = {
  "zh-CN": "中文",
  "en-US": "English"
};

export function HeaderActions() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("home.actions");

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background/82 px-3 text-sm text-foreground/76 shadow-sm backdrop-blur">
        <Languages className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="sr-only">{t("language")}</span>
        <select
          value={locale}
          aria-label={t("language")}
          onChange={(event) => router.push(switchLocalePath(pathname, event.target.value as Locale))}
          className="bg-transparent text-sm outline-none"
        >
          {routing.locales.map((item) => (
            <option key={item} value={item}>
              {languageNames[item]}
            </option>
          ))}
        </select>
      </label>

      <a
        href={localePath(locale, "/admin")}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-primary/35 bg-primary px-3 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90"
      >
        <Shield className="h-4 w-4" aria-hidden="true" />
        {t("admin")}
      </a>
    </div>
  );
}

