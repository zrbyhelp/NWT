import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSessionForUnifiedLogin } from "@/lib/auth";
import { getUnifiedLoginConfig } from "@/lib/unified-login-config";
import { normalizeReturnTo } from "@/lib/unified-login-urls";
import type { UnifiedServiceUser } from "@/lib/unified-login";

const stateCookieName = "gip_login_state";
const returnCookieName = "gip_login_return";
const themeCookieName = "gip_theme";
const localeCookieName = "gip_locale";
const loginNoticeCookieName = "gip_login_notice";
const displayCookieMaxAge = 60 * 60 * 24 * 365;

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const returnTo = normalizeReturnTo(cookieStore.get(returnCookieName)?.value ?? getLocaleReturnTo(request.nextUrl.searchParams.get("locale")));

  cookieStore.delete(stateCookieName);
  cookieStore.delete(returnCookieName);

  if (!code) {
    return NextResponse.redirect(new URL(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`, request.url));
  }

  const { clientId, clientSecret, portalBaseUrl } = getUnifiedLoginConfig();

  if (!portalBaseUrl || !clientId || !clientSecret) {
    return NextResponse.json({ error: "统一登录服务未配置" }, { status: 500 });
  }

  const tokenResponse = await fetch(`${portalBaseUrl}/api/service-auth/token`, {
    body: JSON.stringify({ clientId, clientSecret, code }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: `统一登录认证失败：${await tokenResponse.text()}` }, { status: 401 });
  }

  const payload = (await tokenResponse.json()) as { user?: Partial<UnifiedServiceUser> };

  if (!payload.user?.id) {
    return NextResponse.json({ error: "统一登录未返回用户信息" }, { status: 401 });
  }

  await createSessionForUnifiedLogin({
    id: String(payload.user.id),
    account: payload.user.account ?? null,
    email: payload.user.email ?? null,
    username: payload.user.username ?? null,
    name: payload.user.name ?? null,
    avatarUrl: payload.user.avatarUrl ?? null,
    status: payload.user.status ?? "ACTIVE"
  });

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  const cookieOptions = {
    maxAge: displayCookieMaxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
  const theme = normalizeTheme(request.nextUrl.searchParams.get("theme"));
  const locale = normalizeLocale(request.nextUrl.searchParams.get("locale"));

  if (theme) {
    response.cookies.set(themeCookieName, theme, cookieOptions);
  }

  if (locale) {
    response.cookies.set(localeCookieName, locale, cookieOptions);
  }

  response.cookies.set(loginNoticeCookieName, randomBytes(16).toString("base64url"), cookieOptions);

  return response;
}

function normalizeTheme(value: string | null) {
  const raw = value?.toLowerCase() ?? "";

  return raw === "dark" || raw === "light" ? raw : null;
}

function normalizeLocale(value: string | null) {
  const raw = value?.toLowerCase() ?? "";

  if (raw.startsWith("en")) {
    return "en";
  }

  if (raw.startsWith("zh") || raw === "cn") {
    return "zh";
  }

  return null;
}

function getLocaleReturnTo(value: string | null) {
  const locale = normalizeLocale(value);

  if (locale === "en") {
    return "/en-US";
  }

  return "/zh-CN";
}
