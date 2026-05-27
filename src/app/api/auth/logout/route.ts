import { NextResponse } from "next/server";
import { logoutCurrentViewer } from "@/lib/auth";
import { getUnifiedLoginConfig } from "@/lib/unified-login-config";

export async function POST() {
  await logoutCurrentViewer();

  const { portalBaseUrl } = getUnifiedLoginConfig();
  const logoutUrl = portalBaseUrl ? new URL("/relogin", portalBaseUrl).toString() : null;

  return NextResponse.json({ ok: true, logoutUrl });
}

export async function GET() {
  return POST();
}
