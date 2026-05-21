import "server-only";

import OpenAI from "openai";
import { getDefaultImageRuntimeConfig } from "@/lib/ai/model-config";
import { type AiObservationContext, updateAiObservation, withAiObservation } from "@/lib/observability/langfuse";

export async function generateDefaultMaskBoardImage(prompt: string, userId: string, observationContext?: AiObservationContext) {
  const config = await getDefaultImageRuntimeConfig(userId);
  const context: AiObservationContext = {
    ...observationContext,
    feature: observationContext?.feature ?? "image.mask-board",
    input: { prompt, size: "1792x1024" },
    modelId: config.modelId,
    providerName: config.providerName,
    userId: observationContext?.userId ?? userId
  };

  return withAiObservation(context.traceName ?? context.feature, context, async (span) => {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });

    updateAiObservation(span, {
      input: { prompt, size: "1792x1024" },
      metadata: {
        baseUrl: config.baseUrl,
        modelId: config.modelId,
        providerName: config.providerName
      }
    });

    const image = (await client.images.generate({
      model: config.modelId,
      n: 1,
      prompt,
      response_format: "b64_json",
      size: "1792x1024"
    } as Parameters<typeof client.images.generate>[0])) as { data?: Array<{ b64_json?: string; url?: string }> };
    const firstImage = image.data?.[0];

    if (firstImage?.b64_json) {
      const result = {
        contentType: "image/png",
        dataUrl: `data:image/png;base64,${firstImage.b64_json}`,
        fileName: "mask-board.png"
      };

      updateAiObservation(span, {
        metadata: {
          modelId: config.modelId,
          outputKind: "b64_json",
          providerName: config.providerName
        },
        output: {
          contentType: result.contentType,
          fileName: result.fileName,
          hasImage: true
        }
      });

      return result;
    }

    if (firstImage?.url) {
      const response = await fetch(firstImage.url);

      if (!response.ok) {
        throw new Error("MASK_BOARD_IMAGE_FETCH_FAILED");
      }

      const contentType = response.headers.get("content-type")?.split(";")[0] || "image/png";
      const buffer = Buffer.from(await response.arrayBuffer());
      const extension = contentType === "image/webp" ? "webp" : contentType === "image/jpeg" ? "jpg" : "png";
      const result = {
        contentType,
        dataUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
        fileName: `mask-board.${extension}`
      };

      updateAiObservation(span, {
        metadata: {
          modelId: config.modelId,
          outputKind: "url",
          providerName: config.providerName
        },
        output: {
          contentType: result.contentType,
          fileName: result.fileName,
          hasImage: true
        }
      });

      return result;
    }

    throw new Error("MASK_BOARD_IMAGE_EMPTY");
  });
}
