import type { NextRequest } from "next/server";
import type { MapMaterialCreateInput } from "@/lib/home-workspace";
import { generateMapGeoJson } from "@/lib/home-workspace/map-geojson";
import { isValidMaterialImageFile } from "@/lib/storage/material";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const draftValue = formData.get("draft");
    const imageValue = formData.get("image");
    const sourceValue = formData.get("source");
    const source = sourceValue === "generated" ? "generated" : "uploaded";

    if (typeof draftValue !== "string") {
      throw new Error("MAP_GEOJSON_DRAFT_REQUIRED");
    }

    const image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;

    if (image && !isValidMaterialImageFile(image, { allowOversize: source === "generated" })) {
      throw new Error("INVALID_MAP_IMAGE_FILE");
    }

    const geojson = await generateMapGeoJson(JSON.parse(draftValue) as MapMaterialCreateInput, {
      image: image
        ? {
            bytes: Buffer.from(await image.arrayBuffer()),
            contentType: image.type,
            fileName: image.name
          }
        : null
    });

    return Response.json(geojson);
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
