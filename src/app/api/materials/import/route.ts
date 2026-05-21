import type { NextRequest } from "next/server";
import { authRequiredCode, isAuthRequiredError } from "@/lib/auth-types";
import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { importMaterialsZip, MaterialTransferError } from "@/lib/material-transfer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const locale = parseLocale(request.nextUrl.searchParams.get("locale"));

  try {
    const formData = await request.formData();
    const archive = formData.get("archive");

    if (!(archive instanceof File) || !isZipFile(archive)) {
      return Response.json({ error: "INVALID_MATERIAL_ZIP" }, { status: 400 });
    }

    return Response.json(await importMaterialsZip(await archive.arrayBuffer(), locale));
  } catch (error) {
    return createErrorResponse(error);
  }
}

function parseLocale(value: string | null): Locale {
  return routing.locales.includes(value as Locale) ? value as Locale : routing.defaultLocale;
}

function isZipFile(file: File) {
  const normalizedType = file.type.toLowerCase();
  const normalizedName = file.name.toLowerCase();

  return normalizedName.endsWith(".zip") || normalizedType === "application/zip" || normalizedType === "application/x-zip-compressed";
}

function createErrorResponse(error: unknown) {
  if (isAuthRequiredError(error)) {
    return Response.json({ error: authRequiredCode }, { status: 401 });
  }

  if (error instanceof MaterialTransferError) {
    return Response.json({ error: error.code }, { status: getMaterialTransferStatus(error.code) });
  }

  return Response.json({ error: "MATERIAL_IMPORT_FAILED" }, { status: 500 });
}

function getMaterialTransferStatus(code: string) {
  if (code === "INVALID_MATERIAL_ZIP" || code === "INVALID_MATERIAL_IMAGE_FILE") {
    return 400;
  }

  if (code === "MATERIAL_MANIFEST_REQUIRED" || code === "MATERIAL_IMAGE_REQUIRED") {
    return 400;
  }

  if (code === "UNSUPPORTED_MATERIAL_ARCHIVE" || code === "MATERIAL_ARCHIVE_EMPTY" || code === "INVALID_MATERIAL_MANIFEST") {
    return 400;
  }

  return 500;
}
