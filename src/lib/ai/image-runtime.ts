import "server-only";

import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { getDefaultImageRuntimeConfig } from "@/lib/ai/model-config";
import {
  analyzeScenePanoramaFaces,
  harmonizeScenePanoramaFaceColors,
  stabilizeScenePanoramaMotherImage,
  stabilizeScenePanoramaFaces,
  type ScenePanoramaColorReport,
  type ScenePanoramaQualityReport
} from "@/lib/ai/scene-panorama-postprocess";
import { splitEquirectangularToCubemap } from "@/lib/ai/scene-panorama-projection";
import { type AiObservationContext, updateAiObservation, withAiObservation } from "@/lib/observability/langfuse";
import { configureServerOutboundProxy } from "@/lib/network/proxy";

export const scenePanoramaFaces = ["front", "back", "left", "right", "top", "bottom"] as const;

export type ScenePanoramaFace = (typeof scenePanoramaFaces)[number];

export type ScenePanoramaFaceImage = {
  contentType: string;
  dataUrl: string;
  face: ScenePanoramaFace;
  fileName: string;
};

export type ScenePanoramaGenerationInput = {
  sceneName: string;
  sceneDescription: string;
  blockName: string;
  blockDescription: string;
  blockScaleMeters?: number;
  blockScalePreset?: string;
  panoramaDrawingStyle: string;
  style: string;
  locale: "zh-CN" | "en-US";
};

export type ScenePanoramaGenerationResult = {
  bestAttempt?: number;
  color?: ScenePanoramaColorReport;
  earlyStopped?: boolean;
  faces: Record<ScenePanoramaFace, ScenePanoramaFaceImage>;
  mode: "enhanced" | "direct-cut";
  colorError?: string;
  colorStatus?: ScenePanoramaColorStatus;
  quality?: ScenePanoramaQualityReport;
  qualityBestEffort?: boolean;
  qualityPassed?: boolean;
  repaired: boolean;
  sizeProfile?: ScenePanoramaSizeProfileId;
};

export type ScenePanoramaMotherGenerationResult = {
  mother: ScenePanoramaStreamImage;
  sizeProfile?: ScenePanoramaSizeProfileId;
};

export type ScenePanoramaStreamImage = {
  contentType: string;
  dataUrl: string;
  fileName: string;
};

export type ScenePanoramaStreamEvent =
  | { type: "progress"; progress: number; stage: string; messageKey: string }
  | { type: "mother"; image: ScenePanoramaStreamImage }
  | { type: "motherDone"; image: ScenePanoramaStreamImage; sizeProfile?: ScenePanoramaSizeProfileId }
  | { type: "face"; attempt: number; face: ScenePanoramaFace; image: ScenePanoramaFaceImage; phase: "preview" | "final" }
  | { type: "iterating"; attempt: number; faces: ScenePanoramaFace[] }
  | {
      type: "quality";
      attempt: number;
      failedFaces: ScenePanoramaFace[];
      passed: boolean;
      quality: ScenePanoramaQualityReport;
      accepted?: boolean;
      bestAttempt?: number;
      score?: number;
    }
  | {
      type: "done";
      bestAttempt?: number;
      color?: ScenePanoramaColorReport;
      colorError?: string;
      colorStatus?: ScenePanoramaColorStatus;
      earlyStopped?: boolean;
      mode: ScenePanoramaGenerationResult["mode"];
      quality?: ScenePanoramaQualityReport;
      qualityBestEffort?: boolean;
      qualityPassed?: boolean;
      repaired: boolean;
      sizeProfile?: ScenePanoramaSizeProfileId;
    };

export type ScenePanoramaStreamCallback = (event: ScenePanoramaStreamEvent) => Promise<void> | void;

export type ScenePanoramaColorStatus = "adjusted" | "rejected" | "skipped" | "unchanged";

export type ScenePanoramaReferenceImage = {
  bytes: Buffer;
  contentType: string;
  fileName: string;
};

export type ScenePanoramaGenerationOptions = {
  motherImage?: ScenePanoramaReferenceImage;
  maxRedrawAttempts?: number;
  referenceImages?: ScenePanoramaReferenceImage[];
};

type FaceBuffer = {
  bytes: Buffer;
  contentType: string;
  face: ScenePanoramaFace;
  fileName: string;
};

type ScenePanoramaRepaintResult = {
  bestAttempt: number;
  earlyStopped: boolean;
  faces: FaceBuffer[];
  quality: ScenePanoramaQualityReport;
  qualityPassed: boolean;
  qualityRepairRounds: number;
  qualityRetriedFaces: ScenePanoramaFace[];
  score: number;
};

export type ScenePanoramaSizeProfileId = "4k" | "legacy";

type ScenePanoramaSizeProfile = {
  faceEditSize: string;
  faceSize: number;
  id: ScenePanoramaSizeProfileId;
  motherSize: string;
  normalizedHeight: number;
  normalizedWidth: number;
};

type ImageModelCallPresetId = "doubao" | "gemini" | "openai" | "generic";

type ImageModelCallTransport = "gemini-native" | "openai-compatible";

type ImageReferenceEditMode = "auto" | "generation-image-field" | "openai-edits";

type ImageRequestKind = "maskBoard" | "sceneFace" | "sceneMother";

type GeminiImageRequestOptions = {
  aspectRatio: string;
  imageSize?: "1K" | "2K" | "4K";
};

type ImageModelCallPreset = {
  id: ImageModelCallPresetId;
  includeGenerateOutputFormat: boolean;
  includeHighFidelityEditOptions: boolean;
  includeResponseFormat: boolean;
  maskBoardSize: string;
  referenceEditMode: ImageReferenceEditMode;
  sceneFaceSize: string;
  sceneMotherSize: string;
  transport: ImageModelCallTransport;
  geminiOptions: Record<ImageRequestKind, GeminiImageRequestOptions>;
};

type ImageRuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  modelId: string;
  providerName: string;
};

type GeneratedImageBuffer = {
  bytes: Buffer;
  contentType: string;
  fileName: string;
  outputKind: "base64" | "gemini-inline" | "url";
};

const scenePanoramaDefaultSizeProfile: ScenePanoramaSizeProfile = {
  faceEditSize: "4096x4096",
  faceSize: 4096,
  id: "4k",
  motherSize: "4096x2048",
  normalizedHeight: 2048,
  normalizedWidth: 4096
};
const maskBoardTargetResolution = "3840x2160";
const geminiDefaultImageOptions: Record<ImageRequestKind, GeminiImageRequestOptions> = {
  maskBoard: { aspectRatio: "16:9", imageSize: "4K" },
  sceneFace: { aspectRatio: "1:1", imageSize: "4K" },
  sceneMother: { aspectRatio: "21:9", imageSize: "4K" }
};
const genericImageCallPreset: ImageModelCallPreset = {
  id: "generic",
  geminiOptions: geminiDefaultImageOptions,
  includeGenerateOutputFormat: false,
  includeHighFidelityEditOptions: false,
  includeResponseFormat: true,
  maskBoardSize: maskBoardTargetResolution,
  referenceEditMode: "auto",
  sceneFaceSize: scenePanoramaDefaultSizeProfile.faceEditSize,
  sceneMotherSize: scenePanoramaDefaultSizeProfile.motherSize,
  transport: "openai-compatible"
};
const doubaoImageCallPreset: ImageModelCallPreset = {
  ...genericImageCallPreset,
  id: "doubao",
  referenceEditMode: "generation-image-field"
};
const geminiOpenAICompatibleImageCallPreset: ImageModelCallPreset = {
  ...genericImageCallPreset,
  id: "gemini",
  referenceEditMode: "generation-image-field"
};
export const defaultScenePanoramaMaxRedrawAttempts = 1;
export const maxScenePanoramaMaxRedrawAttempts = 10;
export const minScenePanoramaMaxRedrawAttempts = 1;
const maxAllowedScenePanoramaEdgeDelta = 18;
const maxAllowedScenePanoramaInnerBandDelta = 28;
const maxScenePanoramaFinalFaceBytes = 10 * 1024 * 1024;
const maxScenePanoramaFaceRequestAttempts = 3;
const scenePanoramaFaceRetryBaseDelayMs = 600;

async function createImageOpenAiClient(config: ImageRuntimeConfig) {
  await configureServerOutboundProxy();

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout: 0
  });

  (client as OpenAI & {
    fetchWithTimeout: (
      url: RequestInfo,
      init: RequestInit | undefined,
      ms: number,
      controller: AbortController
    ) => Promise<Response>;
  }).fetchWithTimeout = async (url, init, _ms, controller) => {
    const { signal, method, ...options } = init || {};
    const fetchSignal = mergeAbortSignals(controller.signal, signal);
    const fetchOptions: RequestInit = {
      signal: fetchSignal,
      method: method ? method.toUpperCase() : "GET",
      ...options
    };

    return fetch.call(undefined, url, fetchOptions);
  };

  return client;
}

function mergeAbortSignals(first?: AbortSignal | null, second?: AbortSignal | null) {
  const signals = [first, second].filter((signal): signal is AbortSignal => Boolean(signal));

  if (signals.length <= 1) {
    return signals[0];
  }

  return AbortSignal.any(signals);
}

function getImageModelCallPreset(config: ImageRuntimeConfig): ImageModelCallPreset {
  const baseUrl = config.baseUrl.toLowerCase();
  const modelId = config.modelId.toLowerCase();
  const providerName = config.providerName.toLowerCase();
  const haystack = `${providerName} ${baseUrl} ${modelId}`;

  if (/(doubao|豆包|seedream|seededit|volcengine|volces|byteplus|ark\.cn-|火山|火山方舟)/.test(haystack)) {
    return doubaoImageCallPreset;
  }

  if (isGeminiNativeImageConfig(config)) {
    return getGeminiNativeImageCallPreset(config);
  }

  if (/(gemini|google|imagen|generativelanguage)/.test(haystack)) {
    return geminiOpenAICompatibleImageCallPreset;
  }

  if (isOpenAiImageConfig(config)) {
    return getOpenAiImageCallPreset(modelId);
  }

  return genericImageCallPreset;
}

function isGeminiNativeImageConfig(config: ImageRuntimeConfig) {
  const baseUrl = config.baseUrl.toLowerCase();

  return /generativelanguage\.googleapis\.com/.test(baseUrl);
}

function isOpenAiImageConfig(config: ImageRuntimeConfig) {
  const baseUrl = config.baseUrl.toLowerCase();
  const modelId = config.modelId.toLowerCase();
  const providerName = config.providerName.trim().toLowerCase();

  return baseUrl.includes("api.openai.com") || /(^|[-_])gpt-image|dall-?e/.test(modelId) || providerName === "openai";
}

function getOpenAiImageCallPreset(modelId: string): ImageModelCallPreset {
  if (modelId.includes("gpt-image-2")) {
    return {
      ...genericImageCallPreset,
      id: "openai",
      includeGenerateOutputFormat: true,
      includeResponseFormat: false,
      maskBoardSize: "3840x2160",
      referenceEditMode: "openai-edits",
      sceneFaceSize: "2048x2048",
      sceneMotherSize: "3840x1920"
    };
  }

  if (modelId.includes("dall-e-3")) {
    return {
      ...genericImageCallPreset,
      id: "openai",
      includeResponseFormat: true,
      maskBoardSize: "1792x1024",
      referenceEditMode: "openai-edits",
      sceneFaceSize: "1024x1024",
      sceneMotherSize: "1792x1024"
    };
  }

  return {
    ...genericImageCallPreset,
    id: "openai",
    includeGenerateOutputFormat: true,
    includeHighFidelityEditOptions: !modelId.includes("gpt-image-2"),
    includeResponseFormat: false,
    maskBoardSize: "1536x1024",
    referenceEditMode: "openai-edits",
    sceneFaceSize: "1024x1024",
    sceneMotherSize: "1536x1024"
  };
}

function getGeminiNativeImageCallPreset(config: ImageRuntimeConfig): ImageModelCallPreset {
  const supportsExplicit4K = isGeminiNativeExplicitImageSizeSupported(config.modelId);
  const geminiOptions = supportsExplicit4K
    ? geminiDefaultImageOptions
    : {
        maskBoard: { aspectRatio: "16:9" },
        sceneFace: { aspectRatio: "1:1" },
        sceneMother: { aspectRatio: "21:9" }
      };

  return {
    ...genericImageCallPreset,
    id: "gemini",
    geminiOptions,
    includeResponseFormat: false,
    maskBoardSize: supportsExplicit4K ? "4K 16:9" : "16:9",
    referenceEditMode: "generation-image-field",
    sceneFaceSize: supportsExplicit4K ? "4K 1:1" : "1:1",
    sceneMotherSize: supportsExplicit4K ? "4K 21:9" : "21:9",
    transport: "gemini-native"
  };
}

function isGeminiNativeExplicitImageSizeSupported(modelId: string) {
  const normalized = modelId.toLowerCase();

  return /gemini-(?:3|[4-9])/.test(normalized) || /imagen-(?:4|[5-9])/.test(normalized);
}

export async function generateDefaultMaskBoardImage(prompt: string, userId: string, observationContext?: AiObservationContext) {
  const config = await getDefaultImageRuntimeConfig(userId);
  const callPreset = getImageModelCallPreset(config);
  const promptWithTarget = appendMaskBoardTargetPrompt(prompt);
  const context: AiObservationContext = {
    ...observationContext,
    feature: observationContext?.feature ?? "image.mask-board",
    input: { prompt: promptWithTarget, targetResolution: maskBoardTargetResolution },
    modelId: config.modelId,
    providerName: config.providerName,
    userId: observationContext?.userId ?? userId
  };

  return withAiObservation(context.traceName ?? context.feature, context, async (span) => {
    const client = await createImageOpenAiClient(config);

    updateAiObservation(span, {
      input: { prompt: promptWithTarget, targetResolution: maskBoardTargetResolution },
      metadata: {
        baseUrl: config.baseUrl,
        imageCallPreset: callPreset.id,
        modelId: config.modelId,
        requestSize: callPreset.maskBoardSize,
        providerName: config.providerName,
        targetResolution: maskBoardTargetResolution
      }
    });

    const result = await requestGeneratedImage(client, config, callPreset, {
      emptyError: "MASK_BOARD_IMAGE_EMPTY",
      fetchFailedError: "MASK_BOARD_IMAGE_FETCH_FAILED",
      fileName: "mask-board.png",
      kind: "maskBoard",
      prompt: promptWithTarget,
      size: callPreset.maskBoardSize
    });
    const normalized = await normalizeMaskBoardImageResult(result);

    updateAiObservation(span, {
      metadata: {
        modelId: config.modelId,
        outputKind: result.outputKind,
        providerName: config.providerName
      },
      output: {
        contentType: normalized.contentType,
        fileName: normalized.fileName,
        hasImage: true
      }
    });

    return normalized;
  });
}

export async function generateDefaultScenePanorama(
  input: ScenePanoramaGenerationInput,
  userId: string,
  observationContext?: AiObservationContext,
  options?: ScenePanoramaGenerationOptions
): Promise<ScenePanoramaGenerationResult> {
  return generateScenePanoramaInternal(input, userId, undefined, observationContext, options);
}

export async function streamDefaultScenePanorama(
  input: ScenePanoramaGenerationInput,
  userId: string,
  onEvent: ScenePanoramaStreamCallback,
  observationContext?: AiObservationContext,
  options?: ScenePanoramaGenerationOptions
): Promise<ScenePanoramaGenerationResult> {
  return generateScenePanoramaInternal(input, userId, onEvent, observationContext, options);
}

export async function generateDefaultScenePanoramaMother(
  input: ScenePanoramaGenerationInput,
  userId: string,
  observationContext?: AiObservationContext,
  options?: Pick<ScenePanoramaGenerationOptions, "referenceImages">
): Promise<ScenePanoramaMotherGenerationResult> {
  return generateScenePanoramaMotherInternal(input, userId, undefined, observationContext, options);
}

export async function streamDefaultScenePanoramaMother(
  input: ScenePanoramaGenerationInput,
  userId: string,
  onEvent: ScenePanoramaStreamCallback,
  observationContext?: AiObservationContext,
  options?: Pick<ScenePanoramaGenerationOptions, "referenceImages">
): Promise<ScenePanoramaMotherGenerationResult> {
  return generateScenePanoramaMotherInternal(input, userId, onEvent, observationContext, options);
}

async function generateScenePanoramaMotherInternal(
  input: ScenePanoramaGenerationInput,
  userId: string,
  onEvent?: ScenePanoramaStreamCallback,
  observationContext?: AiObservationContext,
  options?: Pick<ScenePanoramaGenerationOptions, "referenceImages">
): Promise<ScenePanoramaMotherGenerationResult> {
  const config = await getDefaultImageRuntimeConfig(userId);
  const context: AiObservationContext = {
    ...observationContext,
    feature: observationContext?.feature ?? "scene.panorama.mother.generate",
    input,
    modelId: config.modelId,
    providerName: config.providerName,
    userId: observationContext?.userId ?? userId
  };

  return withAiObservation(context.traceName ?? context.feature, context, async (span) => {
    const client = await createImageOpenAiClient(config);
    const callPreset = getImageModelCallPreset(config);
    const emit = (event: ScenePanoramaStreamEvent) => emitScenePanoramaStreamEvent(onEvent, event);
    const referenceImages = options?.referenceImages ?? [];
    const sizeProfile = scenePanoramaDefaultSizeProfile;
    const motherPrompt = buildScenePanoramaMotherPrompt(input, sizeProfile);

    await emit({
      type: "progress",
      messageKey: "sceneForm.panoramaProgressMother",
      progress: 8,
      stage: "mother-generating"
    });
    updateAiObservation(span, {
      input: {
        ...input,
        motherSize: sizeProfile.motherSize,
        referenceImageCount: referenceImages.length,
        sizeProfile: sizeProfile.id
      },
      metadata: {
        baseUrl: config.baseUrl,
        imageCallPreset: callPreset.id,
        modelId: config.modelId,
        providerName: config.providerName,
        referenceImageCount: referenceImages.length,
        referenceImages: summarizeReferenceImages(referenceImages),
        requestMotherSize: callPreset.sceneMotherSize,
        sizeProfile: sizeProfile.id
      }
    });

    const generatedMotherImage = await generateImageBuffer(client, {
      callPreset,
      config,
      fileName: "scene-panorama-mother.png",
      kind: "sceneMother",
      prompt: motherPrompt,
      referenceImages,
      size: callPreset.sceneMotherSize
    });
    const motherImage = await stabilizeScenePanoramaMotherImage(generatedMotherImage, {
      normalizedHeight: sizeProfile.normalizedHeight,
      normalizedWidth: sizeProfile.normalizedWidth
    });
    const mother = faceBufferToStreamImage(motherImage);

    updateAiObservation(span, {
      output: {
        contentType: mother.contentType,
        fileName: mother.fileName,
        hasImage: true,
        sizeProfile: sizeProfile.id
      }
    });
    await emit({ type: "mother", image: mother });
    await emit({ type: "motherDone", image: mother, sizeProfile: sizeProfile.id });
    await emit({
      type: "progress",
      messageKey: "sceneForm.panoramaProgressMotherReady",
      progress: 100,
      stage: "mother-ready"
    });

    return {
      mother,
      sizeProfile: sizeProfile.id
    };
  });
}

async function generateScenePanoramaInternal(
  input: ScenePanoramaGenerationInput,
  userId: string,
  onEvent?: ScenePanoramaStreamCallback,
  observationContext?: AiObservationContext,
  options?: ScenePanoramaGenerationOptions
): Promise<ScenePanoramaGenerationResult> {
  const config = await getDefaultImageRuntimeConfig(userId);
  const maxRedrawAttempts = normalizeScenePanoramaMaxRedrawAttempts(options?.maxRedrawAttempts);
  const context: AiObservationContext = {
    ...observationContext,
    feature: observationContext?.feature ?? "scene.panorama.generate",
    input,
    modelId: config.modelId,
    providerName: config.providerName,
    userId: observationContext?.userId ?? userId
  };

  return withAiObservation(context.traceName ?? context.feature, context, async (span) => {
    const client = await createImageOpenAiClient(config);
    const callPreset = getImageModelCallPreset(config);
    const emit = (event: ScenePanoramaStreamEvent) => emitScenePanoramaStreamEvent(onEvent, event);
    const referenceImages = options?.referenceImages ?? [];
    const providedMotherImage = options?.motherImage ? scenePanoramaReferenceImageToFaceBuffer(options.motherImage) : null;

    const runWithSizeProfile = async (sizeProfile: ScenePanoramaSizeProfile) => {
      const motherPrompt = providedMotherImage ? "" : buildScenePanoramaMotherPrompt(input, sizeProfile);

      if (!providedMotherImage) {
        await emit({
          type: "progress",
          messageKey: "sceneForm.panoramaProgressMother",
          progress: 8,
          stage: "mother-generating"
        });
      }
      updateAiObservation(span, {
          input: {
            ...input,
            faceEditSize: sizeProfile.faceEditSize,
            hasProvidedMotherImage: Boolean(providedMotherImage),
            motherSize: sizeProfile.motherSize,
            referenceImageCount: providedMotherImage ? 0 : referenceImages.length,
            sizeProfile: sizeProfile.id
          },
          metadata: {
          baseUrl: config.baseUrl,
          faceSize: sizeProfile.faceSize,
          imageCallPreset: callPreset.id,
          maxRedrawAttempts,
            hasProvidedMotherImage: Boolean(providedMotherImage),
            modelId: config.modelId,
            normalizedHeight: sizeProfile.normalizedHeight,
            normalizedWidth: sizeProfile.normalizedWidth,
            providerName: config.providerName,
            referenceImageCount: providedMotherImage ? 0 : referenceImages.length,
            referenceImages: providedMotherImage ? [] : summarizeReferenceImages(referenceImages),
            requestFaceSize: callPreset.sceneFaceSize,
          requestMotherSize: callPreset.sceneMotherSize,
          sizeProfile: sizeProfile.id
        }
      });

      const rawMotherImage = providedMotherImage ?? await withAiObservation(
          "scene.panorama.mother.generate",
          {
            feature: "scene.panorama.mother.generate",
            input: { prompt: motherPrompt, referenceImageCount: referenceImages.length, size: callPreset.sceneMotherSize },
            metadata: {
              baseUrl: config.baseUrl,
              imageCallPreset: callPreset.id,
              modelId: config.modelId,
              providerName: config.providerName,
              referenceImageCount: referenceImages.length,
              referenceImages: summarizeReferenceImages(referenceImages),
              requestSize: callPreset.sceneMotherSize,
              sizeProfile: sizeProfile.id
            },
            modelId: config.modelId,
            providerName: config.providerName,
            traceName: context.traceName ?? context.feature,
            userId: context.userId
          },
          async (motherSpan) => {
            const image = await generateImageBuffer(client, {
              callPreset,
              config,
              fileName: "scene-panorama-mother.png",
              kind: "sceneMother",
              prompt: motherPrompt,
              referenceImages,
              size: callPreset.sceneMotherSize
            });

            updateAiObservation(motherSpan, {
              output: {
                contentType: image.contentType,
                fileName: image.fileName,
                hasImage: true
              }
            });

            return image;
          }
        );
      const motherImage = await stabilizeScenePanoramaMotherImage(rawMotherImage, {
        normalizedHeight: sizeProfile.normalizedHeight,
        normalizedWidth: sizeProfile.normalizedWidth
      });

      if (!providedMotherImage) {
        await emit({
          type: "mother",
          image: faceBufferToStreamImage(motherImage)
        });
      }
      await emit({
        type: "progress",
        messageKey: "sceneForm.panoramaProgressFaces",
        progress: 24,
        stage: "faces-generating"
      });
      const baseFaces = await splitEquirectangularToCubemap(motherImage.bytes, {
        faceSize: sizeProfile.faceSize,
        normalizedHeight: sizeProfile.normalizedHeight,
        normalizedWidth: sizeProfile.normalizedWidth
      });

      const repaintResult = await redrawScenePanoramaFacesUntilQualityPasses(
        client,
        config,
        callPreset,
        baseFaces,
        input,
        sizeProfile,
        emit,
        context,
        maxRedrawAttempts
      );
      await emit({
        type: "progress",
        messageKey: "sceneForm.panoramaProgressColor",
        progress: 96,
        stage: "color-harmonizing"
      });
      const colorResult = await withAiObservation(
        "scene.panorama.color.harmonize",
        {
          feature: "scene.panorama.color.harmonize",
          input: {
            bestAttempt: repaintResult.bestAttempt,
            faceCount: repaintResult.faces.length
          },
          metadata: {
            bestAttempt: repaintResult.bestAttempt,
            faceSize: sizeProfile.faceSize,
            maxRedrawAttempts,
            sizeProfile: sizeProfile.id
          },
          modelId: config.modelId,
          providerName: config.providerName,
          traceName: context.traceName ?? context.feature,
          userId: context.userId
        },
        async (colorSpan) => {
          try {
            const harmonized = await harmonizeScenePanoramaFaceColors(baseFaces, repaintResult.faces, {
              faceSize: sizeProfile.faceSize
            });

            updateAiObservation(colorSpan, {
              metadata: {
                averageFaceColorDeltaAfter: harmonized.report.averageFaceColorDeltaAfter,
                averageFaceColorDeltaBefore: harmonized.report.averageFaceColorDeltaBefore,
                averageReferenceColorDelta: harmonized.report.averageReferenceColorDelta,
                colorAlgorithm: harmonized.report.colorAlgorithm,
                colorAdjusted: harmonized.report.colorAdjusted,
                colorRejected: harmonized.report.colorRejected,
                colorStatus: harmonized.report.colorRejected ? "rejected" : harmonized.report.colorAdjusted ? "adjusted" : "unchanged",
                maxFaceColorDelta: harmonized.report.maxFaceColorDelta,
                maxFaceColorDeltaAfter: harmonized.report.maxFaceColorDeltaAfter,
                maxFaceColorDeltaBefore: harmonized.report.maxFaceColorDeltaBefore
              },
              output: harmonized.report
            });

            return {
              ...harmonized,
              status: harmonized.report.colorRejected
                ? "rejected" as const
                : harmonized.report.colorAdjusted
                  ? "adjusted" as const
                  : "unchanged" as const
            };
          } catch (error) {
            const colorError = truncateErrorMessage(error instanceof Error ? error.message : String(error));
            const fallback = {
              faces: repaintResult.faces,
              report: createSkippedScenePanoramaColorReport(repaintResult.faces),
              status: "skipped" as const,
              error: colorError
            };

            updateAiObservation(colorSpan, {
              level: "WARNING",
              metadata: {
                colorError,
                colorStatus: fallback.status
              },
              output: {
                colorError,
                colorStatus: fallback.status
              }
            });

            return fallback;
          }
        }
      );
      assertScenePanoramaFinalFacesWithinLimit(colorResult.faces);

      for (const face of colorResult.faces) {
        await emit({
          type: "face",
          attempt: repaintResult.bestAttempt,
          face: face.face,
          image: faceBufferToScenePanoramaImage(face),
          phase: "final"
        });
      }

      const faces = faceBuffersToResult(colorResult.faces);
      const quality = repaintResult.quality;
      const color = colorResult.report;
      const colorStatus = colorResult.status;
      const colorError = "error" in colorResult ? colorResult.error : undefined;

      updateAiObservation(span, {
        metadata: {
          averageEdgeDelta: quality.averageEdgeDelta,
          averageFaceColorDeltaAfter: color.averageFaceColorDeltaAfter,
          averageFaceColorDeltaBefore: color.averageFaceColorDeltaBefore,
          averageInnerBandDelta: quality.averageInnerBandDelta,
          averageReferenceColorDelta: color.averageReferenceColorDelta,
          bestAttempt: repaintResult.bestAttempt,
          colorAlgorithm: color.colorAlgorithm,
          colorError,
          colorAdjusted: color.colorAdjusted,
          colorRejected: color.colorRejected,
          colorStatus,
          earlyStopped: repaintResult.earlyStopped,
          faceCount: scenePanoramaFaces.length,
          faceEditSize: sizeProfile.faceEditSize,
          faceSize: sizeProfile.faceSize,
          largestFaceBytes: quality.largestFaceBytes,
          maxFaceColorDelta: color.maxFaceColorDelta,
          maxFaceColorDeltaAfter: color.maxFaceColorDeltaAfter,
          maxFaceColorDeltaBefore: color.maxFaceColorDeltaBefore,
          maxEdgeDelta: quality.maxEdgeDelta,
          maxInnerBandDelta: quality.maxInnerBandDelta,
          mode: "enhanced",
          motherSize: sizeProfile.motherSize,
          qualityBestEffort: !repaintResult.qualityPassed,
          qualityPassed: repaintResult.qualityPassed,
          qualityRepairRounds: repaintResult.qualityRepairRounds,
          qualityRetriedFaces: repaintResult.qualityRetriedFaces,
          repaired: true,
          sizeProfile: sizeProfile.id,
          totalBytes: quality.totalBytes
        },
        output: {
          averageEdgeDelta: quality.averageEdgeDelta,
          averageFaceColorDeltaAfter: color.averageFaceColorDeltaAfter,
          averageFaceColorDeltaBefore: color.averageFaceColorDeltaBefore,
          averageInnerBandDelta: quality.averageInnerBandDelta,
          averageReferenceColorDelta: color.averageReferenceColorDelta,
          bestAttempt: repaintResult.bestAttempt,
          colorAlgorithm: color.colorAlgorithm,
          colorError,
          colorAdjusted: color.colorAdjusted,
          colorRejected: color.colorRejected,
          colorStatus,
          earlyStopped: repaintResult.earlyStopped,
          faceCount: scenePanoramaFaces.length,
          largestFaceBytes: quality.largestFaceBytes,
          maxFaceColorDelta: color.maxFaceColorDelta,
          maxFaceColorDeltaAfter: color.maxFaceColorDeltaAfter,
          maxFaceColorDeltaBefore: color.maxFaceColorDeltaBefore,
          maxEdgeDelta: quality.maxEdgeDelta,
          maxInnerBandDelta: quality.maxInnerBandDelta,
          mode: "enhanced",
          qualityBestEffort: !repaintResult.qualityPassed,
          qualityPassed: repaintResult.qualityPassed,
          qualityRepairRounds: repaintResult.qualityRepairRounds,
          qualityRetriedFaces: repaintResult.qualityRetriedFaces,
          repaired: true,
          sizeProfile: sizeProfile.id,
          totalBytes: quality.totalBytes
        }
      });

      const result = {
        bestAttempt: repaintResult.bestAttempt,
        color,
        colorError,
        colorStatus,
        earlyStopped: repaintResult.earlyStopped,
        faces,
        mode: "enhanced",
        quality,
        qualityBestEffort: !repaintResult.qualityPassed,
        qualityPassed: repaintResult.qualityPassed,
        repaired: true,
        sizeProfile: sizeProfile.id
      } satisfies ScenePanoramaGenerationResult;

      await emit({
        type: "done",
        bestAttempt: result.bestAttempt,
        color: result.color,
        colorError: result.colorError,
        colorStatus: result.colorStatus,
        earlyStopped: result.earlyStopped,
        mode: result.mode,
        quality: result.quality,
        qualityBestEffort: result.qualityBestEffort,
        qualityPassed: result.qualityPassed,
        repaired: result.repaired,
        sizeProfile: result.sizeProfile
      });
      await emit({
        type: "progress",
        messageKey: "sceneForm.panoramaProgressDone",
        progress: 100,
        stage: "done"
      });

      return result;
    };

    return runWithSizeProfile(scenePanoramaDefaultSizeProfile);
  });
}

async function generateImageBuffer(
  client: OpenAI,
  {
    callPreset,
    config,
    fileName,
    kind,
    prompt,
    referenceImages,
    size
  }: {
    callPreset: ImageModelCallPreset;
    config: ImageRuntimeConfig;
    fileName: string;
    kind: ImageRequestKind;
    prompt: string;
    referenceImages?: ScenePanoramaReferenceImage[];
    size: string;
  }
): Promise<FaceBuffer> {
  const image = await requestGeneratedImage(client, config, callPreset, {
    emptyError: "SCENE_PANORAMA_IMAGE_EMPTY",
    fetchFailedError: "SCENE_PANORAMA_IMAGE_FETCH_FAILED",
    fileName,
    kind,
    prompt,
    referenceImages,
    size
  });

  return {
    bytes: image.bytes,
    contentType: image.contentType,
    face: "front",
    fileName: image.fileName
  };
}

async function requestGeneratedImage(
  client: OpenAI,
  config: ImageRuntimeConfig,
  callPreset: ImageModelCallPreset,
  {
    emptyError,
    fetchFailedError,
    fileName,
    image,
    kind,
    prompt,
    referenceImages,
    size
  }: {
    emptyError: string;
    fetchFailedError: string;
    fileName: string;
    image?: FaceBuffer;
    kind: ImageRequestKind;
    prompt: string;
    referenceImages?: ScenePanoramaReferenceImage[];
    size: string;
  }
) {
  const images = [...(referenceImages ?? []), ...(image ? [image] : [])];

  if (callPreset.transport === "gemini-native") {
    return requestGeminiNativeImage(config, prompt, fileName, callPreset.geminiOptions[kind], emptyError, images);
  }

  const payload = buildOpenAICompatibleGeneratePayload(config.modelId, prompt, size, callPreset);

  if (images.length === 1) {
    payload.image = imageBufferToDataUrl(images[0]);
  } else if (images.length > 1) {
    payload.image = images.map(imageBufferToDataUrl);
  }

  const response = (await client.images.generate(
    payload as unknown as Parameters<typeof client.images.generate>[0]
  )) as { data?: Array<{ b64_json?: string; url?: string }> };

  return extractGeneratedImageResult(response, fileName, fetchFailedError, emptyError);
}

function buildOpenAICompatibleGeneratePayload(
  modelId: string,
  prompt: string,
  size: string,
  callPreset: ImageModelCallPreset
) {
  const payload: Record<string, unknown> = {
    model: modelId,
    n: 1,
    prompt,
    size
  };

  if (callPreset.includeResponseFormat) {
    payload.response_format = "b64_json";
  }

  if (callPreset.includeGenerateOutputFormat) {
    payload.output_format = "png";
  }

  return payload;
}

async function requestGeminiNativeImage(
  config: ImageRuntimeConfig,
  prompt: string,
  fileName: string,
  options: GeminiImageRequestOptions,
  emptyError: string,
  images: ScenePanoramaReferenceImage[] = []
): Promise<GeneratedImageBuffer> {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];

  images.forEach((image) => {
    parts.push({
      inline_data: {
        data: image.bytes.toString("base64"),
        mime_type: image.contentType
      }
    });
  });

  const generationConfig: Record<string, unknown> = {
    responseModalities: ["IMAGE"],
    responseFormat: {
      image: {
        aspectRatio: options.aspectRatio,
        ...(options.imageSize ? { imageSize: options.imageSize } : {})
      }
    }
  };
  const response = await fetch(buildGeminiGenerateContentUrl(config.baseUrl, config.modelId), {
    body: JSON.stringify({
      contents: [
        {
          parts,
          role: "user"
        }
      ],
      generationConfig
    }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.apiKey
    },
    method: "POST"
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`GEMINI_IMAGE_GENERATION_FAILED_${response.status}: ${truncateErrorMessage(text)}`);
  }

  const body = JSON.parse(text) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }>;
      };
    }>;
  };
  const imagePart = body.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .find((part) => part.inlineData?.data || part.inline_data?.data);
  const inlineData = imagePart?.inlineData
    ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
    : imagePart?.inline_data
      ? { data: imagePart.inline_data.data, mimeType: imagePart.inline_data.mime_type }
      : null;
  const data = inlineData?.data;

  if (!data) {
    throw new Error(emptyError);
  }

  const contentType = inlineData?.mimeType ?? "image/png";
  const extension = contentType === "image/webp" ? "webp" : contentType === "image/jpeg" ? "jpg" : "png";

  return {
    bytes: Buffer.from(data, "base64"),
    contentType,
    fileName: fileName.replace(/\.[a-z0-9]+$/i, `.${extension}`),
    outputKind: "gemini-inline"
  };
}

function buildGeminiGenerateContentUrl(baseUrl: string, modelId: string) {
  const trimmedBaseUrl = baseUrl.replace(/\/+$/, "").replace(/\/openai$/i, "");
  const modelPath = modelId.includes("/") ? modelId : `models/${modelId}`;

  return `${trimmedBaseUrl}/${modelPath}:generateContent`;
}

function imageBufferToDataUrl(image: Pick<ScenePanoramaReferenceImage, "bytes" | "contentType">) {
  return `data:${image.contentType};base64,${image.bytes.toString("base64")}`;
}

function faceBufferToStreamImage(image: Pick<FaceBuffer, "bytes" | "contentType" | "fileName">): ScenePanoramaStreamImage {
  return {
    contentType: image.contentType,
    dataUrl: `data:${image.contentType};base64,${image.bytes.toString("base64")}`,
    fileName: image.fileName
  };
}

function faceBufferToScenePanoramaImage(image: FaceBuffer): ScenePanoramaFaceImage {
  return {
    ...faceBufferToStreamImage(image),
    face: image.face
  };
}

function scenePanoramaReferenceImageToFaceBuffer(image: ScenePanoramaReferenceImage): FaceBuffer {
  return {
    bytes: image.bytes,
    contentType: image.contentType,
    face: "front",
    fileName: image.fileName || "scene-panorama-mother.png"
  };
}

async function emitScenePanoramaStreamEvent(onEvent: ScenePanoramaStreamCallback | undefined, event: ScenePanoramaStreamEvent) {
  if (onEvent) {
    await onEvent(event);
  }
}

export function normalizeScenePanoramaMaxRedrawAttempts(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;

  if (!Number.isFinite(parsed)) {
    return defaultScenePanoramaMaxRedrawAttempts;
  }

  return Math.min(maxScenePanoramaMaxRedrawAttempts, Math.max(minScenePanoramaMaxRedrawAttempts, Math.round(parsed)));
}

function truncateErrorMessage(message: string) {
  return message.length > 500 ? `${message.slice(0, 500)}...` : message;
}

async function editImageBuffer(
  client: OpenAI,
  {
    callPreset,
    config,
    fileName,
    image,
    prompt
  }: {
    callPreset: ImageModelCallPreset;
    config: ImageRuntimeConfig;
    fileName: string;
    image: FaceBuffer;
    prompt: string;
  }
): Promise<FaceBuffer> {
  if (callPreset.transport === "gemini-native" || callPreset.referenceEditMode === "generation-image-field") {
    return requestReferenceGenerateImage(client, config, callPreset, fileName, image, prompt);
  }

  const imageFile = await toFile(image.bytes, image.fileName, { type: image.contentType });
  let edited: { data?: Array<{ b64_json?: string; url?: string }> };

  try {
    edited = await requestImageEdit(client, {
      callPreset,
      imageFile,
      modelId: config.modelId,
      prompt,
      useAdvancedOptions: true
    });
  } catch (error) {
    if (callPreset.referenceEditMode === "auto" && isLikelyImageEditUnsupportedError(error)) {
      return requestReferenceGenerateImage(client, config, callPreset, fileName, image, prompt);
    }

    if (!isLikelyImageEditOptionUnsupportedError(error)) {
      throw error;
    }

    edited = await requestImageEdit(client, {
      callPreset,
      imageFile,
      modelId: config.modelId,
      prompt,
      useAdvancedOptions: false
    });
  }

  return {
    ...(await extractImageBuffer(client, edited, fileName, image.face)),
    face: image.face,
    fileName
  };
}

async function requestReferenceGenerateImage(
  client: OpenAI,
  config: ImageRuntimeConfig,
  callPreset: ImageModelCallPreset,
  fileName: string,
  image: FaceBuffer,
  prompt: string
): Promise<FaceBuffer> {
  const generated = await requestGeneratedImage(client, config, callPreset, {
    emptyError: "SCENE_PANORAMA_IMAGE_EMPTY",
    fetchFailedError: "SCENE_PANORAMA_IMAGE_FETCH_FAILED",
    fileName,
    image,
    kind: "sceneFace",
    prompt,
    size: callPreset.sceneFaceSize
  });

  return {
    bytes: generated.bytes,
    contentType: generated.contentType,
    face: image.face,
    fileName: generated.fileName
  };
}

async function requestImageEdit(
  client: OpenAI,
  {
    callPreset,
    imageFile,
    modelId,
    prompt,
    useAdvancedOptions
  }: {
    callPreset: ImageModelCallPreset;
    imageFile: File;
    modelId: string;
    prompt: string;
    useAdvancedOptions: boolean;
  }
) {
  const payload: Record<string, unknown> = {
    image: imageFile,
    model: modelId,
    n: 1,
    prompt,
    size: callPreset.sceneFaceSize
  };

  if (callPreset.includeResponseFormat) {
    payload.response_format = "b64_json";
  }

  if (useAdvancedOptions && callPreset.includeHighFidelityEditOptions) {
    payload.input_fidelity = "high";
    payload.output_format = "png";
    payload.quality = "high";
  }

  return (await client.images.edit(payload as unknown as Parameters<typeof client.images.edit>[0])) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
}

async function extractImageBuffer(
  _client: OpenAI,
  response: { data?: Array<{ b64_json?: string; url?: string }> },
  fileName: string,
  face: ScenePanoramaFace
): Promise<FaceBuffer> {
  const image = await extractGeneratedImageResult(
    response,
    fileName,
    "SCENE_PANORAMA_IMAGE_FETCH_FAILED",
    "SCENE_PANORAMA_IMAGE_EMPTY"
  );

  return {
    bytes: image.bytes,
    contentType: image.contentType,
    face,
    fileName: image.fileName
  };
}

async function extractGeneratedImageResult(
  response: { data?: Array<{ b64_json?: string; url?: string }> },
  fileName: string,
  fetchFailedError: string,
  emptyError: string
): Promise<GeneratedImageBuffer> {
  const firstImage = response.data?.[0];

  if (firstImage?.b64_json) {
    return {
      bytes: Buffer.from(firstImage.b64_json, "base64"),
      contentType: "image/png",
      fileName,
      outputKind: "base64"
    };
  }

  if (firstImage?.url) {
    const fetched = await fetch(firstImage.url);

    if (!fetched.ok) {
      throw new Error(fetchFailedError);
    }

    const contentType = fetched.headers.get("content-type")?.split(";")[0] || "image/png";
    const extension = contentType === "image/webp" ? "webp" : contentType === "image/jpeg" ? "jpg" : "png";

    return {
      bytes: Buffer.from(await fetched.arrayBuffer()),
      contentType,
      fileName: fileName.replace(/\.[a-z0-9]+$/i, `.${extension}`),
      outputKind: "url"
    };
  }

  throw new Error(emptyError);
}

async function normalizeMaskBoardImageResult(image: GeneratedImageBuffer) {
  const { height, width } = parseImageSize(maskBoardTargetResolution);
  const bytes = await sharp(image.bytes)
    .resize(width, height, {
      background: { alpha: 1, b: 18, g: 15, r: 11 },
      fit: "contain"
    })
    .png()
    .toBuffer();

  return {
    contentType: "image/png",
    dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
    fileName: image.fileName.replace(/\.[a-z0-9]+$/i, ".png")
  };
}

function parseImageSize(size: string) {
  const [width, height] = size.split("x").map((part) => Number.parseInt(part, 10));

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`INVALID_IMAGE_SIZE_${size}`);
  }

  return { height, width };
}

async function redrawScenePanoramaFacesUntilQualityPasses(
  client: OpenAI,
  config: ImageRuntimeConfig,
  callPreset: ImageModelCallPreset,
  referenceFaces: FaceBuffer[],
  input: ScenePanoramaGenerationInput,
  sizeProfile: ScenePanoramaSizeProfile,
  emit: ScenePanoramaStreamCallback,
  observationContext: AiObservationContext,
  maxRedrawAttempts: number
): Promise<ScenePanoramaRepaintResult> {
  let enhancedFaces = await redrawScenePanoramaFaces(
    client,
    config,
    callPreset,
    referenceFaces,
    input,
    sizeProfile,
    1,
    emit,
    observationContext,
    maxRedrawAttempts
  );
  const qualityRetriedFaces = new Set<ScenePanoramaFace>();
  let bestResult: ScenePanoramaRepaintResult | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 1; attempt <= maxRedrawAttempts; attempt += 1) {
    await emit({
      type: "progress",
      messageKey: "sceneForm.panoramaProgressQuality",
      progress: getScenePanoramaProgress(62, 92, attempt, maxRedrawAttempts),
      stage: "quality-checking"
    });
    const { failedFaces, quality, stabilizedFaces } = await withAiObservation(
      "scene.panorama.quality.check",
      {
        feature: "scene.panorama.quality.check",
        input: { attempt, faceCount: enhancedFaces.length },
        metadata: {
          attempt,
          faceSize: sizeProfile.faceSize,
          maxRedrawAttempts,
          sizeProfile: sizeProfile.id
        },
        modelId: config.modelId,
        providerName: config.providerName,
        traceName: observationContext.traceName ?? observationContext.feature,
        userId: observationContext.userId
      },
      async (qualitySpan) => {
        const stabilized = await stabilizeScenePanoramaFaces(referenceFaces, enhancedFaces, { faceSize: sizeProfile.faceSize });
        const report = await analyzeScenePanoramaFaces(stabilized, { faceSize: sizeProfile.faceSize });
        const failed = isScenePanoramaQualityPassing(report) ? [] : getScenePanoramaQualityFailedFaces(report);
        const reportScore = getScenePanoramaQualityScore(report);
        const reportAccepted = failed.length === 0 || reportScore < bestScore;

        updateAiObservation(qualitySpan, {
          metadata: {
            attempt,
            accepted: reportAccepted,
            averageEdgeDelta: report.averageEdgeDelta,
            averageInnerBandDelta: report.averageInnerBandDelta,
            bestAttempt: reportAccepted ? attempt : bestResult?.bestAttempt,
            bestScore: Number.isFinite(bestScore) ? bestScore : null,
            failedFaces: failed,
            maxEdgeDelta: report.maxEdgeDelta,
            maxInnerBandDelta: report.maxInnerBandDelta,
            passed: failed.length === 0,
            score: reportScore
          },
          output: {
            accepted: reportAccepted,
            bestAttempt: reportAccepted ? attempt : bestResult?.bestAttempt,
            failedFaces: failed,
            passed: failed.length === 0,
            score: reportScore
          }
        });

        return {
          failedFaces: failed,
          quality: report,
          stabilizedFaces: stabilized
        };
      }
    );
    const score = getScenePanoramaQualityScore(quality);
    const passed = failedFaces.length === 0;
    const candidate: ScenePanoramaRepaintResult = {
      bestAttempt: attempt,
      earlyStopped: false,
      faces: stabilizedFaces,
      quality,
      qualityPassed: passed,
      qualityRepairRounds: attempt - 1,
      qualityRetriedFaces: Array.from(qualityRetriedFaces),
      score
    };
    const accepted = passed || score < bestScore;

    if (accepted) {
      bestScore = Math.min(bestScore, score);
      bestResult = candidate;
    }

    await emit({
      type: "quality",
      attempt,
      accepted,
      bestAttempt: bestResult?.bestAttempt ?? attempt,
      failedFaces,
      passed,
      quality,
      score
    });

    if (passed) {
      return {
        ...candidate,
        earlyStopped: attempt < maxRedrawAttempts
      };
    }

    if (attempt >= maxRedrawAttempts) {
      return bestResult ?? candidate;
    }

    if (!accepted && bestResult && score >= bestScore && attempt > 1) {
      return {
        ...bestResult,
        earlyStopped: true
      };
    }

    await emit({
      type: "iterating",
      attempt: attempt + 1,
      faces: failedFaces
    });
    await emit({
      type: "progress",
      messageKey: "sceneForm.panoramaProgressIterating",
      progress: getScenePanoramaProgress(70, 95, attempt, maxRedrawAttempts),
      stage: "iterating"
    });
    const redrawnFaces = await Promise.all(
      failedFaces.map(async (face) => {
        const referenceFace = getFaceBuffer(referenceFaces, face);
        qualityRetriedFaces.add(face);

        return redrawScenePanoramaFaceWithRetry(
          client,
          config,
          callPreset,
          referenceFace,
          input,
          sizeProfile,
          attempt + 1,
          emit,
          observationContext,
          maxRedrawAttempts
        );
      })
    );

    enhancedFaces = replaceScenePanoramaFaces(enhancedFaces, redrawnFaces);
  }

  if (bestResult) {
    return bestResult;
  }

  throw new Error("SCENE_PANORAMA_IMAGE_EMPTY");
}

async function redrawScenePanoramaFaces(
  client: OpenAI,
  config: ImageRuntimeConfig,
  callPreset: ImageModelCallPreset,
  faces: FaceBuffer[],
  input: ScenePanoramaGenerationInput,
  sizeProfile: ScenePanoramaSizeProfile,
  firstPromptAttempt: number,
  emit: ScenePanoramaStreamCallback,
  observationContext: AiObservationContext,
  maxRedrawAttempts: number
) {
  return Promise.all(
    faces.map((face) =>
      redrawScenePanoramaFaceWithRetry(
        client,
        config,
        callPreset,
        face,
        input,
        sizeProfile,
        firstPromptAttempt,
        emit,
        observationContext,
        maxRedrawAttempts
      )
    )
  );
}

async function redrawScenePanoramaFaceWithRetry(
  client: OpenAI,
  config: ImageRuntimeConfig,
  callPreset: ImageModelCallPreset,
  face: FaceBuffer,
  input: ScenePanoramaGenerationInput,
  sizeProfile: ScenePanoramaSizeProfile,
  firstPromptAttempt: number,
  emit: ScenePanoramaStreamCallback,
  observationContext: AiObservationContext,
  maxRedrawAttempts: number
) {
  let lastError: unknown = null;

  for (let attempt = firstPromptAttempt; attempt <= maxRedrawAttempts; attempt += 1) {
    const fileName = `scene-panorama-${face.face}.png`;

    try {
      const prompt = buildScenePanoramaFacePrompt(input, face.face, attempt, sizeProfile);
      const redrawn = await withAiObservation(
        `scene.panorama.face.${face.face}.generate`,
        {
          feature: "scene.panorama.face.generate",
          input: { attempt, face: face.face, prompt, size: callPreset.sceneFaceSize },
          metadata: {
            attempt,
            baseUrl: config.baseUrl,
            face: face.face,
            imageCallPreset: callPreset.id,
            maxRedrawAttempts,
            modelId: config.modelId,
            providerName: config.providerName,
            requestSize: callPreset.sceneFaceSize,
            sizeProfile: sizeProfile.id
          },
          modelId: config.modelId,
          providerName: config.providerName,
          traceName: observationContext.traceName ?? observationContext.feature,
          userId: observationContext.userId
        },
        async (faceSpan) => {
          const image = await editImageBufferWithScenePanoramaFaceRequestRetry(
            client,
            {
              callPreset,
              config,
              fileName,
              image: face,
              prompt
            },
            faceSpan,
            attempt
          );

          updateAiObservation(faceSpan, {
            output: {
              contentType: image.contentType,
              face: image.face,
              fileName: image.fileName,
              hasImage: true
            }
          });

          return image;
        }
      );

      await emit({
        type: "face",
        attempt,
        face: redrawn.face,
        image: faceBufferToScenePanoramaImage(redrawn),
        phase: "preview"
      });

      return redrawn;
    } catch (error) {
      lastError = error;

      if (isLikelyImageEditUnsupportedError(error)) {
        throw new Error("SCENE_PANORAMA_REFERENCE_EDIT_UNSUPPORTED");
      }
    }
  }

  throw lastError ?? new Error(`SCENE_PANORAMA_FACE_REDRAW_FAILED_${face.face}`);
}

async function editImageBufferWithScenePanoramaFaceRequestRetry(
  client: OpenAI,
  request: {
    callPreset: ImageModelCallPreset;
    config: ImageRuntimeConfig;
    fileName: string;
    image: FaceBuffer;
    prompt: string;
  },
  span: Parameters<typeof updateAiObservation>[0],
  promptAttempt: number
) {
  let lastError: unknown = null;

  for (let requestAttempt = 1; requestAttempt <= maxScenePanoramaFaceRequestAttempts; requestAttempt += 1) {
    try {
      return await editImageBuffer(client, request);
    } catch (error) {
      lastError = error;

      if (
        requestAttempt >= maxScenePanoramaFaceRequestAttempts ||
        !isRetriableScenePanoramaFaceGenerationError(error)
      ) {
        throw error;
      }

      const retryDelayMs = getScenePanoramaFaceRequestRetryDelayMs(requestAttempt);

      updateAiObservation(span, {
        level: "WARNING",
        metadata: {
          face: request.image.face,
          faceRequestAttempt: requestAttempt,
          faceRequestMaxAttempts: maxScenePanoramaFaceRequestAttempts,
          nextFaceRequestAttempt: requestAttempt + 1,
          promptAttempt,
          retryDelayMs,
          retryError: truncateErrorMessage(getErrorMessage(error))
        }
      });

      if (retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  throw lastError ?? new Error(`SCENE_PANORAMA_FACE_REDRAW_FAILED_${request.image.face}`);
}

function getFaceBuffer(faces: FaceBuffer[], face: ScenePanoramaFace) {
  const image = faces.find((item) => item.face === face);

  if (!image) {
    throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
  }

  return image;
}

function replaceScenePanoramaFaces(currentFaces: FaceBuffer[], redrawnFaces: FaceBuffer[]) {
  const redrawnByFace = new Map(redrawnFaces.map((face) => [face.face, face]));

  return currentFaces.map((face) => redrawnByFace.get(face.face) ?? face);
}

function faceBuffersToResult(faces: FaceBuffer[]): Record<ScenePanoramaFace, ScenePanoramaFaceImage> {
  return scenePanoramaFaces.reduce<Record<ScenePanoramaFace, ScenePanoramaFaceImage>>((result, face) => {
    const image = faces.find((item) => item.face === face);

    if (!image) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    result[face] = {
      contentType: image.contentType,
      dataUrl: `data:${image.contentType};base64,${image.bytes.toString("base64")}`,
      face,
      fileName: image.fileName
    };

    return result;
  }, {} as Record<ScenePanoramaFace, ScenePanoramaFaceImage>);
}

function assertScenePanoramaFinalFacesWithinLimit(faces: FaceBuffer[]) {
  const oversized = faces.find((face) => face.bytes.byteLength > maxScenePanoramaFinalFaceBytes);

  if (oversized) {
    throw new Error(`SCENE_PANORAMA_FINAL_FACE_TOO_LARGE_${oversized.face}`);
  }
}

function createSkippedScenePanoramaColorReport(faces: FaceBuffer[]): ScenePanoramaColorReport {
  return {
    averageFaceColorDeltaAfter: 0,
    averageFaceColorDeltaBefore: 0,
    averageReferenceColorDelta: 0,
    colorAlgorithm: "mother-guided-color-transfer-v1",
    colorAdjusted: false,
    colorRejected: false,
    faceDeltas: faces.map((face) => ({
      afterDelta: 0,
      beforeDelta: 0,
      face: face.face
    })),
    maxFaceColorDeltaAfter: 0,
    maxFaceColorDeltaBefore: 0,
    maxFaceColorDelta: 0
  };
}

function summarizeReferenceImages(images: ScenePanoramaReferenceImage[]) {
  return images.map((image) => ({
    byteSize: image.bytes.byteLength,
    contentType: image.contentType,
    fileName: image.fileName
  }));
}

function isScenePanoramaQualityPassing(quality: ScenePanoramaQualityReport) {
  return quality.maxEdgeDelta <= maxAllowedScenePanoramaEdgeDelta && quality.maxInnerBandDelta <= maxAllowedScenePanoramaInnerBandDelta;
}

function getScenePanoramaQualityScore(quality: ScenePanoramaQualityReport) {
  return quality.maxEdgeDelta / maxAllowedScenePanoramaEdgeDelta + quality.maxInnerBandDelta / maxAllowedScenePanoramaInnerBandDelta;
}

function getScenePanoramaProgress(start: number, end: number, attempt: number, maxRedrawAttempts: number) {
  const ratio = maxRedrawAttempts <= 1 ? 1 : (attempt - 1) / Math.max(1, maxRedrawAttempts - 1);

  return Math.round(start + (end - start) * Math.max(0, Math.min(1, ratio)));
}

function getScenePanoramaQualityFailedFaces(quality: ScenePanoramaQualityReport) {
  const faces = new Set<ScenePanoramaFace>();

  quality.edgeDeltas.forEach((edge) => {
    if (edge.delta > maxAllowedScenePanoramaEdgeDelta) {
      faces.add(edge.firstFace);
      faces.add(edge.secondFace);
    }
  });
  quality.innerBandDeltas.forEach((edge) => {
    if (edge.delta > maxAllowedScenePanoramaInnerBandDelta) {
      faces.add(edge.firstFace);
      faces.add(edge.secondFace);
    }
  });

  return Array.from(faces.size > 0 ? faces : new Set(scenePanoramaFaces));
}

function appendMaskBoardTargetPrompt(prompt: string) {
  const target = hasCjkText(prompt)
    ? [
        `目标输出：4K 16:9 横版角色设定板，${maskBoardTargetResolution}。`,
        "不要在画面中写尺寸说明文字，不要水印，不要 UI 操作控件。"
      ]
    : [
        `Target output: 4K 16:9 horizontal character setting board, ${maskBoardTargetResolution}.`,
        "Do not add text explaining the size, watermarks, or UI controls."
      ];

  return [prompt, ...target].join("\n");
}

function hasCjkText(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function buildScenePanoramaMotherPrompt(input: ScenePanoramaGenerationInput, sizeProfile: ScenePanoramaSizeProfile) {
  const style = getSceneStylePrompt(input.style, input.locale);
  const drawingStyle = getScenePanoramaDrawingStylePrompt(input.panoramaDrawingStyle, input.locale);
  const blockScale = getScenePanoramaBlockScalePrompt(input);

  if (input.locale === "en-US") {
    return [
      "Create one seamless 360-degree equirectangular panorama master image for an interactive fiction scene.",
      `Target output: 4K equirectangular panorama, ${sizeProfile.motherSize}, 2:1 aspect ratio. Do not add text explaining the size.`,
      "If reference images are provided, use them for layout, materials, atmosphere, lighting, and spatial scale. Do not copy text, UI, frames, watermarks, or non-scene artifacts from the references.",
      "The image must represent a complete interior or exterior space that can wrap horizontally.",
      "The left and right edges must join perfectly as one continuous world; the leftmost 8% and rightmost 8% must be the same continuous wall, floor, ceiling, terrain, lighting gradient, and perspective flow.",
      "Do not place doors, windows, mirrors, posters, characters, bright lamps, large props, text, or high-contrast silhouettes crossing the horizontal wrap seam.",
      "Avoid objects, light bands, color-temperature changes, shadow cuts, or perspective lines that break at the wrap seam.",
      "Use one global exposure, white balance, color grading, lighting direction, and material language across the entire image.",
      "Keep one fixed camera height, one horizon level, one focal length feeling, and one time-of-day across the full 360 degrees.",
      "Place architecture, furniture, terrain, shadows, and large props so they remain coherent when later split into front/back/left/right/top/bottom cubemap faces.",
      "Avoid face-specific hero objects, sudden color-temperature changes, or repeated motifs that would make adjacent faces look like different rooms.",
      "No text, no labels, no watermark, no UI, no character close-ups.",
      "Keep spatial continuity, believable perspective, consistent lighting, and clear materials.",
      `Scene: ${input.sceneName}.`,
      `Scene description: ${input.sceneDescription}.`,
      `Block: ${input.blockName}.`,
      `Block description: ${input.blockDescription}.`,
      `Block scale: ${blockScale}.`,
      `Visual style: ${style}.`,
      `Rendering type: ${drawingStyle}.`
    ].join("\n");
  }

  return [
    "生成一张用于交互小说场景的 360 度等距柱状全景母图。",
    `目标输出：4K 等距柱状全景母图，${sizeProfile.motherSize}，2:1 画幅；不要在画面中写尺寸说明文字。`,
    "如果提供了参考图，请参考其布局、材质、氛围、光照和空间尺度；不要复制参考图中的文字、UI、边框、水印或非场景杂物。",
    "画面必须表现一个可以水平环绕的完整室内或室外空间。",
    "左右边缘必须能无缝闭合成同一个连续世界；最左 8% 和最右 8% 必须延续同一面墙、地面、天花、地形、光照渐变和透视走向。",
    "不要让门、窗、镜子、海报、人物、强光灯、大型道具、文字或高对比轮廓跨过水平环绕接缝。",
    "避免物体、光带、色温变化、阴影切口或透视线在环绕接缝处断裂。",
    "整张图必须使用统一曝光、统一白平衡、统一调色、统一光照方向和统一材质语言。",
    "完整 360 度空间必须保持同一机位高度、同一地平线、同一镜头透视感和同一时间光照。",
    "建筑、家具、地形、阴影和大型道具的摆放要能在后续切成前、后、左、右、上、下六面图时继续连贯。",
    "避免只属于某一面的突兀主体、突然变化的色温，或让相邻面看起来像不同房间的重复元素。",
    "不要文字、标签、水印、UI，也不要近景人物特写。",
    "保持空间连续、透视可信、光照一致、材质清晰。",
    `场景：${input.sceneName}。`,
    `场景说明：${input.sceneDescription}。`,
    `区块：${input.blockName}。`,
    `区块说明：${input.blockDescription}。`,
    `区块规模：${blockScale}。`,
    `视觉风格：${style}。`,
    `画面类型：${drawingStyle}。`
  ].join("\n");
}

function buildScenePanoramaFacePrompt(
  input: ScenePanoramaGenerationInput,
  face: ScenePanoramaFace,
  attempt: number,
  sizeProfile: ScenePanoramaSizeProfile
) {
  const direction = getScenePanoramaFaceDescription(face, input.locale);
  const adjacency = getScenePanoramaFaceAdjacencyDescription(face, input.locale);
  const retryInstruction = getScenePanoramaFaceRetryInstruction(attempt, input.locale);
  const style = getSceneStylePrompt(input.style, input.locale);
  const drawingStyle = getScenePanoramaDrawingStylePrompt(input.panoramaDrawingStyle, input.locale);
  const blockScale = getScenePanoramaBlockScalePrompt(input);

  if (input.locale === "en-US") {
    return [
      "Perform pixel-faithful image upscaling, restoration, and enhancement for this cubemap face.",
      `Target output: 4K square cubemap face, ${sizeProfile.faceEditSize}. Do not add text explaining the size.`,
      "Use the input image as a strict spatial reference, not as a loose concept sketch.",
      "Keep the exact composition, camera position, field of view, perspective, crop, rotation, object placement, object scale, and horizon level.",
      "Do not add objects, remove objects, move objects, resize objects, rotate objects, repaint the scene as a new illustration, or reinterpret the space.",
      "All wall lines, floor lines, ceiling lines, horizon lines, shadow boundaries, object silhouettes, and material texture directions must stay near the same pixel positions as the reference.",
      "Allowed improvements: higher apparent resolution, clearer texture detail, material readability, gentle noise cleanup, small missing-detail restoration, and richer light quality.",
      "Forbidden artifacts: feathered edges, blurred seams, vignette, frame, border, face-specific color shift, restyling, recropping, or standalone-poster composition.",
      "Do not perform independent color grading for this face. Inherit the mother panorama's overall exposure, white balance, black level, highlight rolloff, saturation, material palette, and ambient light.",
      "Keep dark scenes dark. Do not brighten one face independently, add artificial fill light, cool/warm only this face, or turn the face into a separate corrected photograph.",
      "This face is one side of a shared 360-degree cubemap. Its four edges connect directly to other AI-upscaled faces and must remain sharp, continuous, and stitchable.",
      "The outer 6% of every edge is a stitching zone: preserve the input pixels' structures, colors, brightness, line directions, and object cuts especially strictly there.",
      "Do not add edge-only glow, haze, vignette, blur, shadow, color wash, or new detail that is not present in the input edge region.",
      "Match the reference global exposure, white balance, color grading, lighting direction, time-of-day, material palette, camera height, and spatial scale.",
      `Face direction: ${direction}.`,
      `Face adjacency: ${adjacency}.`,
      `Scene: ${input.sceneName}.`,
      `Scene description: ${input.sceneDescription}.`,
      `Block: ${input.blockName}.`,
      `Block description: ${input.blockDescription}.`,
      `Block scale: ${blockScale}.`,
      `Visual style: ${style}.`,
      `Rendering type: ${drawingStyle}.`,
      retryInstruction
    ].join("\n");
  }

  return [
    "对这张六面体单面图做像素级忠实升级、高清恢复和细节增强。",
    `目标输出：4K 正方形六面体单面图，${sizeProfile.faceEditSize}；不要在画面中写尺寸说明文字。`,
    "输入图是严格空间参考，不是宽松概念草图。",
    "必须保持完全相同的构图、机位、视场角、透视、裁切、旋转、物体位置、物体比例和地平线高度。",
    "不要新增物体、删除物体、移动物体、缩放物体、旋转物体、把画面重画成新插画，或重新理解空间。",
    "所有墙线、地线、天花线、地平线、阴影边界、物体轮廓和材质纹理方向，都必须保持在参考图的相同像素位置附近。",
    "允许增强：表观分辨率、纹理清晰度、材质可读性、轻微噪点清理、局部缺失细节恢复和光照质感。",
    "禁止出现：边缘羽化、接缝模糊、暗角、画框、边框、单面独立偏色、风格重绘、重新裁切或海报式构图。",
    "不要对当前单面做独立调色。必须继承母图的整体曝光、白平衡、黑位、高光压缩、饱和度、材质色板和环境光。",
    "暗光场景要保持暗光氛围。不要单独提亮某一面、添加补光、只让这一面变冷或变暖，也不要把它修成一张独立校色照片。",
    "这张图是同一个 360 度六面体空间的一面，四条边会直接连接其他 AI 高清升级后的面，边缘必须清晰、连续、可拼接。",
    "每条边外侧 6% 是拼接保护区：这里必须特别严格保留输入图的结构、颜色、亮度、线条方向和物体切口。",
    "不要在边缘单独添加辉光、雾化、暗角、模糊、阴影、色块或输入边缘区域不存在的新细节。",
    "必须匹配参考图的统一曝光、白平衡、调色、光照方向、时间光线、材质色板、机位高度和空间比例。",
    `当前方向：${direction}。`,
    `相邻关系：${adjacency}。`,
    `场景：${input.sceneName}。`,
    `场景说明：${input.sceneDescription}。`,
    `区块：${input.blockName}。`,
    `区块说明：${input.blockDescription}。`,
    `区块规模：${blockScale}。`,
    `视觉风格：${style}。`,
    `画面类型：${drawingStyle}。`,
    retryInstruction
  ].join("\n");
}

function getScenePanoramaBlockScalePrompt(input: ScenePanoramaGenerationInput) {
  const meters = typeof input.blockScaleMeters === "number" && Number.isFinite(input.blockScaleMeters)
    ? input.blockScaleMeters
    : null;
  const preset = input.blockScalePreset || "mid";

  if (input.locale === "en-US") {
    return meters ? `${preset}, about ${meters} meters across` : preset;
  }

  return meters ? `${preset}，约 ${meters} 米跨度` : preset;
}

function getScenePanoramaFaceAdjacencyDescription(face: ScenePanoramaFace, locale: ScenePanoramaGenerationInput["locale"]) {
  const zh: Record<ScenePanoramaFace, string> = {
    back: "back.left 接 right.right；back.right 接 left.left；back.top 接 top.top；back.bottom 接 bottom.bottom",
    bottom: "bottom.top 接 front.bottom；bottom.right 接 right.bottom；bottom.bottom 接 back.bottom；bottom.left 接 left.bottom",
    front: "front.left 接 left.right；front.right 接 right.left；front.top 接 top.bottom；front.bottom 接 bottom.top",
    left: "left.left 接 back.right；left.right 接 front.left；left.top 接 top.left；left.bottom 接 bottom.left",
    right: "right.left 接 front.right；right.right 接 back.left；right.top 接 top.right；right.bottom 接 bottom.right",
    top: "top.bottom 接 front.top；top.right 接 right.top；top.top 接 back.top；top.left 接 left.top"
  };
  const en: Record<ScenePanoramaFace, string> = {
    back: "back.left connects to right.right; back.right connects to left.left; back.top connects to top.top; back.bottom connects to bottom.bottom",
    bottom: "bottom.top connects to front.bottom; bottom.right connects to right.bottom; bottom.bottom connects to back.bottom; bottom.left connects to left.bottom",
    front: "front.left connects to left.right; front.right connects to right.left; front.top connects to top.bottom; front.bottom connects to bottom.top",
    left: "left.left connects to back.right; left.right connects to front.left; left.top connects to top.left; left.bottom connects to bottom.left",
    right: "right.left connects to front.right; right.right connects to back.left; right.top connects to top.right; right.bottom connects to bottom.right",
    top: "top.bottom connects to front.top; top.right connects to right.top; top.top connects to back.top; top.left connects to left.top"
  };

  return locale === "en-US" ? en[face] : zh[face];
}

function getScenePanoramaFaceRetryInstruction(attempt: number, locale: ScenePanoramaGenerationInput["locale"]) {
  if (attempt <= 1) {
    return locale === "en-US"
      ? "First pass: preserve the reference exactly and only improve fidelity."
      : "首次生成：严格保留参考图，只提升清晰度和细节可信度。";
  }

  return locale === "en-US"
    ? `Retry pass ${attempt}: the previous attempt changed structure or caused seam mismatch. Reduce creativity, stay closer to the reference, and perform only conservative high-definition restoration.`
    : `重试轮次 ${attempt}：上一轮可能改变结构或造成接缝不匹配。降低创造性，更贴近参考图，只做保守的高清恢复。`;
}

function getScenePanoramaFaceDescription(face: ScenePanoramaFace, locale: ScenePanoramaGenerationInput["locale"]) {
  const zh: Record<ScenePanoramaFace, string> = {
    back: "后方回望视角，与左、右和上下边缘连续",
    bottom: "地面或下方视角，避免新增主体，保持地面纹理连续",
    front: "主前方视角，与左右和上下边缘连续",
    left: "左侧视角，与前后方向连续",
    right: "右侧视角，与前后方向连续",
    top: "天花、天空或上方视角，避免新增主体，保持顶部结构连续"
  };
  const en: Record<ScenePanoramaFace, string> = {
    back: "rear view, continuous with left, right, top, and bottom edges",
    bottom: "floor or downward view, avoid new focal subjects, keep ground texture continuous",
    front: "main forward view, continuous with left, right, top, and bottom edges",
    left: "left-side view, continuous with front and back directions",
    right: "right-side view, continuous with front and back directions",
    top: "ceiling, sky, or upward view, avoid new focal subjects, keep overhead structure continuous"
  };

  return locale === "en-US" ? en[face] : zh[face];
}

function getSceneStylePrompt(style: string, locale: ScenePanoramaGenerationInput["locale"]) {
  const zh: Record<string, string> = {
    apocalyptic: "末世废墟感，磨损材质，压抑但可读的空间层次",
    classical: "古风空间，东方审美，结构克制，细节雅致",
    cyberpunk: "赛博霓虹，高科技材质，冷暖光对比强",
    fantasy: "玄幻幻想空间，材质奇异但空间可信",
    mystery: "悬疑氛围，低调光线，隐藏线索感",
    realistic: "写实质感，真实光照，空间比例可信",
    sciFi: "科幻空间，清晰结构，金属、玻璃与能量光源"
  };
  const en: Record<string, string> = {
    apocalyptic: "apocalyptic ruin atmosphere, worn materials, oppressive but readable spatial layers",
    classical: "classical Chinese-inspired space, restrained structure, refined details",
    cyberpunk: "cyberpunk neon lighting, high-tech materials, strong warm-cool contrast",
    fantasy: "fantasy space, uncanny materials with believable spatial logic",
    mystery: "mystery atmosphere, low-key lighting, hidden-clue feeling",
    realistic: "realistic materials, natural lighting, believable proportions",
    sciFi: "sci-fi space, clear structure, metal, glass, and energy lighting"
  };

  return locale === "en-US" ? en[style] ?? en.realistic : zh[style] ?? zh.realistic;
}

function getScenePanoramaDrawingStylePrompt(style: string, locale: ScenePanoramaGenerationInput["locale"]) {
  const zh: Record<string, string> = {
    anime: "二次元插画空间，干净线条，色块清晰，适合轻小说式场景漫游",
    cel: "赛璐璐动画空间，边缘利落，光影分层明确，适合动画感全景",
    comic: "漫画场景风，线条明确，黑白与色彩张力强，但保持空间透视准确",
    concept: "概念设定图空间，设计感强，结构清楚，适合世界观设定展示",
    guofeng: "国风插画空间，东方审美，材质和装饰细节克制精致",
    painterly: "厚涂插画空间，笔触丰富，光影和材质表现更强",
    photo: "真实摄影质感，自然镜头光线，材质细节可信",
    realistic: "写实空间渲染，比例自然，材质可信，适合沉浸式探索"
  };
  const en: Record<string, string> = {
    anime: "anime environment illustration, clean linework, clear color blocks for light-novel scene exploration",
    cel: "cel-shaded animated environment, crisp edges and clearly layered lighting",
    comic: "comic environment style with clear ink lines and strong visual energy while preserving accurate perspective",
    concept: "environment concept art, design-forward, structurally clear, suitable for worldbuilding presentation",
    guofeng: "Chinese-inspired illustrated environment with refined eastern aesthetics and restrained detail",
    painterly: "painterly environment illustration with rich brushwork and stronger light and material rendering",
    photo: "photographic look with natural camera lighting and believable material detail",
    realistic: "realistic environment rendering with natural proportions, believable materials, and immersive exploration"
  };

  return locale === "en-US" ? en[style] ?? en.realistic : zh[style] ?? zh.realistic;
}

function isLikelyImageEditUnsupportedError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  const status = typeof error === "object" && error && "status" in error ? (error as { status?: unknown }).status : null;

  return (
    status === 404 ||
    message.includes("not support") ||
    message.includes("unsupported") ||
    message.includes("not implemented") ||
    message.includes("unknown url") ||
    message.includes("invalid endpoint") ||
    message.includes("image edit") ||
    message.includes("images.edit") ||
    message.includes("edit endpoint")
  );
}

function isLikelyImageEditOptionUnsupportedError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  const status = typeof error === "object" && error && "status" in error ? (error as { status?: unknown }).status : null;

  return (
    status === 400 &&
    (
      message.includes("input_fidelity") ||
      message.includes("output_format") ||
      message.includes("quality") ||
      message.includes("unknown parameter") ||
      message.includes("unexpected parameter") ||
      message.includes("unsupported parameter")
    )
  );
}

function isRetriableScenePanoramaFaceGenerationError(error: unknown) {
  if (isLikelyImageEditUnsupportedError(error) || isLikelyImageEditOptionUnsupportedError(error)) {
    return false;
  }

  const status = getErrorStatus(error);
  const message = getErrorMessage(error).toLowerCase();

  if (typeof status === "number") {
    if (status === 400 || status === 401 || status === 403 || status === 404) {
      return false;
    }

    return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
  }

  return (
    message.includes("scene_panorama_image_empty") ||
    message.includes("scene_panorama_image_fetch_failed") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("socket") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("temporarily") ||
    message.includes("try again") ||
    message.includes("rate limit") ||
    message.includes("overloaded") ||
    message.includes("bad gateway") ||
    message.includes("gateway timeout") ||
    message.includes("internal server error") ||
    message.includes("gemini_image_generation_failed_5")
  );
}

function getScenePanoramaFaceRequestRetryDelayMs(requestAttempt: number) {
  if (process.env.NODE_ENV === "test") {
    return 0;
  }

  return Math.min(2500, scenePanoramaFaceRetryBaseDelayMs * 2 ** Math.max(0, requestAttempt - 1));
}

function getErrorStatus(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? (error as { status?: unknown }).status : null;

  if (typeof status === "number") {
    return status;
  }

  if (typeof status === "string") {
    const parsed = Number.parseInt(status, 10);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
