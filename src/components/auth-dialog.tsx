"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthPanel } from "@/components/auth-panel";
import type { AuthViewer } from "@/lib/auth-types";

export function AuthDialog({
  onAuthenticated,
  onClose,
  open
}: {
  onAuthenticated: (viewer: AuthViewer) => void;
  onClose: () => void;
  open: boolean;
}) {
  const t = useTranslations("home.auth");

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm">
      <section
        className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/58 transition hover:bg-muted hover:text-foreground"
            aria-label={t("close")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <AuthPanel onAuthenticated={onAuthenticated} />
      </section>
    </div>
  );
}
