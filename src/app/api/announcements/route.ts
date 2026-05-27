import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUnifiedLoginConfig } from "@/lib/unified-login-config";
import { fetchServiceAnnouncements } from "@/lib/unified-login";

export async function GET() {
  await requireAuth();

  const { clientId, clientSecret, portalBaseUrl } = getUnifiedLoginConfig();
  const announcements = await fetchServiceAnnouncements({ clientId, clientSecret, portalBaseUrl });

  return NextResponse.json({ announcements });
}
