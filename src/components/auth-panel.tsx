"use client";

import { KeyRound, Loader2, LogIn, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { loginHomeAccount, registerHomeAccount } from "@/app/[locale]/actions";
import type { Locale } from "@/i18n/routing";
import { localePath } from "@/lib/locale-path";
import type { AuthViewer } from "@/lib/auth-types";

type AuthMode = "login" | "register";

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
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const isLogin = mode === "login";

  function handleSuccess(viewer: AuthViewer) {
    toast.success(t(isLogin ? "loginSuccess" : "registerSuccess"));
    onAuthenticated?.(viewer);

    if (!onAuthenticated) {
      if (variant === "page") {
        router.push((successPath ?? localePath(locale)) as never);
      } else {
        router.refresh();
      }
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(async () => {
          try {
            const result = isLogin
              ? await loginHomeAccount({ account, password })
              : await registerHomeAccount({ account, password });

            handleSuccess(result.viewer);
          } catch (error) {
            toast.error(resolveAuthError(error, t));
          }
        });
      }}
    >
      <div className="text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white">
          {isLogin ? <LogIn className="h-5 w-5" aria-hidden="true" /> : <UserPlus className="h-5 w-5" aria-hidden="true" />}
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-normal">
          {t(isLogin ? "loginTitle" : "registerTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-foreground/58">
          {t(isLogin ? "loginDescription" : "registerDescription")}
        </p>
      </div>

      <div className="space-y-3">
        <label className="space-y-1.5 text-sm">
          <span className="text-foreground/64">{t("account")}</span>
          <input
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={64}
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-foreground/64">{t("password")}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={6}
            maxLength={128}
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/38"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
        {t(isLogin ? "login" : "register")}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(isLogin ? "register" : "login");
          setPassword("");
        }}
        className="w-full rounded-md px-3 py-2 text-sm text-foreground/62 transition hover:bg-muted hover:text-foreground"
      >
        {t(isLogin ? "goRegister" : "goLogin")}
      </button>
    </form>
  );
}

function resolveAuthError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("ACCOUNT_EXISTS")) {
    return t("errors.accountExists");
  }

  if (message.includes("INVALID_CREDENTIALS")) {
    return t("errors.invalidCredentials");
  }

  if (message.includes("INVALID_ACCOUNT")) {
    return t("errors.invalidAccount");
  }

  if (message.includes("INVALID_PASSWORD")) {
    return t("errors.invalidPassword");
  }

  return t("errors.generic");
}
