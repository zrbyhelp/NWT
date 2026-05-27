import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUnifiedLoginConfig } from "@/lib/unified-login-config";
import { buildFeedbackUrl, getFeedbackServiceSlug } from "@/lib/feedback";

export async function GET(request: NextRequest) {
  const viewer = await requireAuth();
  const { portalBaseUrl, feedbackServiceSlug } = getUnifiedLoginConfig();

  if (!portalBaseUrl) {
    return NextResponse.json({ error: "未配置统一门户地址" }, { status: 500 });
  }

  const sourceUrl = request.nextUrl.searchParams.get("sourceUrl") ?? "";

  return NextResponse.json({
    url: buildFeedbackUrl({
      portalBaseUrl,
      serviceSlug: getFeedbackServiceSlug(feedbackServiceSlug),
      sourceUrl,
      userId: viewer.slug ?? viewer.id
    })
  });
}
