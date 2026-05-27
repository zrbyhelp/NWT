import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getUnifiedLoginConfig } from "@/lib/unified-login-config";
import { buildUnifiedLoginUrl, normalizeReturnTo } from "@/lib/unified-login-urls";

const stateCookieName = "gip_login_state";
const returnCookieName = "gip_login_return";
const transientCookieMaxAge = 60 * 10;

export async function GET(request: NextRequest) {
  const { appUrl, clientId, portalBaseUrl } = getUnifiedLoginConfig();

  if (!portalBaseUrl || !clientId) {
    return NextResponse.json({ error: "统一登录服务未配置" }, { status: 500 });
  }

  const returnTo = normalizeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const state = randomBytes(16).toString("base64url");
  const response = NextResponse.redirect(buildUnifiedLoginUrl({ appUrl, clientId, portalBaseUrl, state }));
  const cookieOptions = {
    httpOnly: true,
    maxAge: transientCookieMaxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };

  response.cookies.set(stateCookieName, state, cookieOptions);
  response.cookies.set(returnCookieName, returnTo, cookieOptions);

  return response;
}
