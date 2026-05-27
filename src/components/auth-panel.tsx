"use client";

import { LogIn, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { localePath } from "@/lib/locale-path";
import type { AuthViewer } from "@/lib/auth-types";

export function AuthPanel({
  onAuthenticated,
  successPath,
  variant = "dialog"
}: {
  onAuthenticated?: (viewer: AuthViewer) => void;
  successPath?: string;
  variant?: "dialog" | "page";
}) {
  const t = useTranslations("home.auth");
  const locale = useLocale() as Locale;
  const pathname = usePathname();

  function startUnifiedLogin() {
    void onAuthenticated;
    const returnTo = successPath ?? (variant === "page" ? localePath(locale) : pathname || localePath(locale));

    window.location.assign(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return (
    <div
      className="space-y-5"
    >
      <div className="text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-normal">
          {t("loginTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-foreground/58">
          {t("loginDescription")}
        </p>
      </div>

      <button
        type="button"
        onClick={startUnifiedLogin}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/38"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        {t("unifiedLogin")}
      </button>

      <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs leading-5 text-foreground/52">
        {t("unifiedHint")}
      </p>
    </div>
  );
}
