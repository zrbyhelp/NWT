import { NextResponse } from "next/server";
import { getCurrentViewer } from "@/lib/auth";

export async function GET() {
  const viewer = await getCurrentViewer();

  return NextResponse.json({
    authenticated: Boolean(viewer),
    user: viewer
  });
}
