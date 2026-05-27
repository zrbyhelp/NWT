import type { NextRequest } from "next/server";
import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { AiConfigError } from "@/lib/ai/config-types";
import { authRequiredCode, isAuthRequiredError } from "@/lib/auth-types";
import {
  prepareMapImagePreviousImage,
  prepareMapImageReferenceImages,
  streamMapImage,
  type MapMaterialCreateInput
} from "@/lib/home-workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await readMapImageRequestBody(request);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        if (!body.input || typeof body.locale !== "string") {
          throw new Error("MAP_IMAGE_DRAFT_REQUIRED");
        }

        await streamMapImage(body.input as MapMaterialCreateInput, resolveLocale(body.locale), (event) => send(event), {
          completedNodeIds: body.completedNodeIds,
          nodeBatchSize: body.nodeBatchSize,
          previousImage: body.previousImage,
          referenceImages: body.referenceImages,
          referencePrompt: body.referencePrompt,
          resumeRound: body.resumeRound
        });
      } catch (error) {
        send({ type: "error", message: resolveMapImageStreamErrorCode(error) });
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

async function readMapImageRequestBody(request: NextRequest): Promise<{
  completedNodeIds?: string[];
  input?: unknown;
  locale?: unknown;
  nodeBatchSize?: unknown;
  previousImage?: Awaited<ReturnType<typeof prepareMapImagePreviousImage>>;
  referenceImages?: Awaited<ReturnType<typeof prepareMapImageReferenceImages>>;
  referencePrompt?: string;
  resumeRound?: unknown;
}> {
  const formData = await request.formData();
  const draftValue = formData.get("draft") ?? formData.get("input");
  const input = typeof draftValue === "string" ? JSON.parse(draftValue) as MapMaterialCreateInput : undefined;
  const referenceFiles = formData
    .getAll("referenceImages")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const previousImageValue = formData.get("previousImage");
  const previousImageFile = previousImageValue instanceof File && previousImageValue.size > 0 ? previousImageValue : null;
  const previousImageUrlValue = formData.get("previousImageUrl");
  const previousImageUrl = typeof previousImageUrlValue === "string" && previousImageUrlValue.trim()
    ? previousImageUrlValue.trim()
    : null;
  const previousImageSource = formData.get("previousImageSource");
  const completedNodeIdsValue = formData.get("completedNodeIds");
  const referencePromptValue = formData.get("referencePrompt");

  return {
    completedNodeIds: typeof completedNodeIdsValue === "string" && completedNodeIdsValue.trim()
      ? JSON.parse(completedNodeIdsValue) as string[]
      : [],
    input,
    locale: formData.get("locale"),
    nodeBatchSize: formData.get("nodeBatchSize"),
    previousImage: await prepareMapImagePreviousImage(previousImageFile, previousImageUrl, request.nextUrl.origin, {
      allowOversizeFile: previousImageSource === "generated"
    }),
    referenceImages: await prepareMapImageReferenceImages(referenceFiles),
    referencePrompt: typeof referencePromptValue === "string" ? referencePromptValue : undefined,
    resumeRound: formData.get("resumeRound")
  };
}

function resolveMapImageStreamErrorCode(error: unknown) {
  if (isAuthRequiredError(error)) {
    return authRequiredCode;
  }

  if (error instanceof AiConfigError) {
    return error.code;
  }

  return error instanceof Error ? error.message : String(error);
}

function resolveLocale(locale: unknown): Locale {
  return routing.locales.includes(locale as Locale) ? (locale as Locale) : routing.defaultLocale;
}
