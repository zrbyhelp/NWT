import type { NextRequest } from "next/server";
import { generateMapImageOutlinePreview } from "@/lib/home-workspace/map-image-outline";
import { isValidMaterialImageFile } from "@/lib/storage/material";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageValue = formData.get("image");
    const sourceValue = formData.get("source");
    const source = sourceValue === "generated" ? "generated" : "uploaded";

    if (!(imageValue instanceof File) || imageValue.size <= 0) {
      throw new Error("INVALID_MAP_IMAGE_FILE");
    }

    if (!isValidMaterialImageFile(imageValue, { allowOversize: source === "generated" })) {
      throw new Error("INVALID_MAP_IMAGE_FILE");
    }

    const outline = await generateMapImageOutlinePreview(Buffer.from(await imageValue.arrayBuffer()));

    return Response.json(outline);
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
