import { NextRequest } from "next/server";
import {
  generateInstantMeshModelFromImage,
  type InstantMeshInputImage,
  type InstantMeshStreamEvent
} from "@/lib/ai/instantmesh-runtime";
import { requireAuth } from "@/lib/auth";
import { isValidMaterialImageFile } from "@/lib/storage/material";

export async function POST(request: NextRequest) {
  const viewer = await requireAuth();
  const formData = await request.formData();
  const image = await prepareInstantMeshImage(formData);
  const scaleHint = getStringValue(formData.get("scaleHint"));
  const extraParams = getStringValue(formData.get("extraParams"));
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: InstantMeshStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await generateInstantMeshModelFromImage({
          extraParams,
          image,
          onEvent: send,
          scaleHint,
          userId: viewer.id
        });
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : String(error)
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no"
    }
  });
}

async function prepareInstantMeshImage(formData: FormData): Promise<InstantMeshInputImage> {
  const file = formData.get("modelInputImage");
  const source = formData.get("modelInputImageSource");

  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("ITEM_MODEL_INPUT_IMAGE_REQUIRED");
  }

  if (!isValidMaterialImageFile(file, { allowOversize: source === "generated" })) {
    throw new Error("INVALID_ITEM_MODEL_INPUT_IMAGE_FILE");
  }

  return {
    bytes: Buffer.from(await file.arrayBuffer()),
    contentType: file.type || "image/png",
    fileName: file.name || "model-input.png"
  };
}

function getStringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}
