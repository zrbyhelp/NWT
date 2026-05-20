"use client";

import { LogIn } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { SettingsDialog } from "@/components/settings-dialog";
import type { Locale } from "@/i18n/routing";
import { localePath } from "@/lib/locale-path";
import type { AuthViewer } from "@/lib/auth-types";

export function HeaderActions({
  onLoginClick,
  onViewerChange,
  viewer
}: {
  onLoginClick?: () => void;
  onViewerChange?: (viewer: AuthViewer | null) => void;
  viewer?: AuthViewer | null;
}) {
  const t = useTranslations("home.auth");
  const locale = useLocale() as Locale;
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {!viewer ? (
        <button
          type="button"
          onClick={onLoginClick ?? (() => router.push(localePath(locale, "/login") as never))}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground/72 transition hover:bg-muted hover:text-foreground"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {t("login")}
        </button>
      ) : null}
      <SettingsDialog onLoginClick={onLoginClick} onViewerChange={onViewerChange} viewer={viewer} />
    </div>
  );
}
