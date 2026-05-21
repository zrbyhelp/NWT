import type { NextRequest } from "next/server";
import { authRequiredCode, isAuthRequiredError } from "@/lib/auth-types";
import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { exportSelfCreatedMaterialsZip, MaterialTransferError } from "@/lib/material-transfer";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const locale = parseLocale(request.nextUrl.searchParams.get("locale"));
  const materialId = request.nextUrl.searchParams.get("materialId");

  try {
    const archive = await exportSelfCreatedMaterialsZip({
      locale,
      materialId,
      origin: request.nextUrl.origin
    });

    return new Response(Buffer.from(archive.bytes), {
      headers: {
        "Content-Disposition": createContentDisposition(archive.fileName),
        "Content-Length": String(archive.bytes.byteLength),
        "Content-Type": "application/zip"
      }
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

function parseLocale(value: string | null): Locale {
  return routing.locales.includes(value as Locale) ? value as Locale : routing.defaultLocale;
}

function createContentDisposition(fileName: string) {
  const asciiFileName = fileName.replace(/[^\w.-]+/g, "-") || "materials.zip";

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function createErrorResponse(error: unknown) {
  if (isAuthRequiredError(error)) {
    return Response.json({ error: authRequiredCode }, { status: 401 });
  }

  if (error instanceof MaterialTransferError) {
    return Response.json({ error: error.code }, { status: getMaterialTransferStatus(error.code) });
  }

  return Response.json({ error: "MATERIAL_EXPORT_FAILED" }, { status: 500 });
}

function getMaterialTransferStatus(code: string) {
  if (code === "MATERIAL_NOT_EXPORTABLE" || code === "NO_SELF_CREATED_MATERIALS") {
    return 404;
  }

  if (code === "MATERIAL_IMAGE_DOWNLOAD_FAILED") {
    return 502;
  }

  return 400;
}
