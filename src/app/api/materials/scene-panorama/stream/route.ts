import type { NextRequest } from "next/server";
import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { AiConfigError } from "@/lib/ai/config-types";
import { authRequiredCode, isAuthRequiredError } from "@/lib/auth-types";
import {
  prepareScenePanoramaMotherImage,
  prepareScenePanoramaReferenceImages,
  streamSceneBlockPanorama,
  type SceneMaterialCreateInput
} from "@/lib/home-workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await readPanoramaRequestBody(request);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        if (!body.input || typeof body.blockId !== "string") {
          throw new Error("SCENE_BLOCK_REQUIRED");
        }

        await streamSceneBlockPanorama(
          body.input as SceneMaterialCreateInput,
          body.blockId,
          resolveLocale(body.locale),
          (event) => send(event),
          {
            maxRedrawAttempts: normalizeMaxRedrawAttempts(body.maxRedrawAttempts),
            motherImage: body.motherImage,
            referenceImages: body.referenceImages
          }
        );
      } catch (error) {
        send({ type: "error", message: resolvePanoramaStreamErrorCode(error) });
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

async function readPanoramaRequestBody(request: NextRequest): Promise<{
  blockId?: unknown;
  input?: unknown;
  locale?: unknown;
  maxRedrawAttempts?: unknown;
  motherImage?: Awaited<ReturnType<typeof prepareScenePanoramaMotherImage>>;
  referenceImages?: Awaited<ReturnType<typeof prepareScenePanoramaReferenceImages>>;
}> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    const body = (await request.json()) as {
      blockId?: unknown;
      input?: unknown;
      locale?: unknown;
      maxRedrawAttempts?: unknown;
    };

    return body;
  }

  const formData = await request.formData();
  const draftValue = formData.get("draft") ?? formData.get("input");
  const input = typeof draftValue === "string" ? JSON.parse(draftValue) as SceneMaterialCreateInput : undefined;
  const referenceFiles = formData
    .getAll("referenceImages")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const motherValue = formData.get("motherImage");
  const motherFile = motherValue instanceof File && motherValue.size > 0 ? motherValue : null;
  const motherUrlValue = formData.get("motherUrl");
  const motherUrl = typeof motherUrlValue === "string" && motherUrlValue.trim() ? motherUrlValue.trim() : null;
  const motherSource = formData.get("motherSource");

  return {
    blockId: formData.get("blockId"),
    input,
    locale: formData.get("locale"),
    maxRedrawAttempts: formData.get("maxRedrawAttempts"),
    motherImage: await prepareScenePanoramaMotherImage(motherFile, motherUrl, request.nextUrl.origin, {
      allowOversizeFile: motherSource === "generated"
    }),
    referenceImages: await prepareScenePanoramaReferenceImages(referenceFiles)
  };
}

function resolvePanoramaStreamErrorCode(error: unknown) {
  if (isAuthRequiredError(error)) {
    return authRequiredCode;
  }

  if (error instanceof AiConfigError) {
    return error.code;
  }

  return error instanceof Error ? error.message : String(error);
}

function normalizeMaxRedrawAttempts(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseInt(value, 10);
  }

  return undefined;
}

function resolveLocale(locale: unknown): Locale {
  return routing.locales.includes(locale as Locale) ? (locale as Locale) : routing.defaultLocale;
}
