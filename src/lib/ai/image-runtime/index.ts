import "server-only";

import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { getDefaultImageRuntimeConfig } from "@/lib/ai/model-config";
import {
  analyzeScenePanoramaMotherImage,
  analyzeScenePanoramaFaces,
  harmonizeScenePanoramaFaceColors,
  measureFaceReferenceEdgeDelta,
  repairScenePanoramaColorSeams,
  stabilizeScenePanoramaMotherImage,
  stabilizeScenePanoramaFaces,
  type ScenePanoramaColorReport,
  type ScenePanoramaMotherQualityReport,
  type ScenePanoramaQualityReport
} from "@/lib/ai/scene-panorama-postprocess";
import { splitEquirectangularToCubemap } from "@/lib/ai/scene-panorama-projection";
import { type AiObservationContext, updateAiObservation, withAiObservation } from "@/lib/observability/langfuse";
import { configureServerOutboundProxy } from "@/lib/network/proxy";
import {
  appendItemBoardTargetPrompt,
  appendMaskBoardTargetPrompt,
  buildItemModelInputPrompt,
  buildItemViewPrompt,
  buildScenePanoramaFacePrompt,
  buildScenePanoramaMotherPrompt
} from "./scene-panorama-prompts";
import {
  defaultScenePanoramaMaxRedrawAttempts,
  doubaoImageCallPreset,
  geminiDefaultImageOptions,
  geminiOpenAICompatibleImageCallPreset,
  genericImageCallPreset,
  maskBoardTargetResolution,
  maxAllowedScenePanoramaEdgeDelta,
  maxAllowedScenePanoramaInnerBandDelta,
  maxScenePanoramaFaceRequestAttempts,
  maxScenePanoramaMaxRedrawAttempts,
  minScenePanoramaMaxRedrawAttempts,
  scenePanoramaDefaultSizeProfile,
  scenePanoramaGptImage2SizeProfile,
  scenePanoramaFaceRetryBaseDelayMs
} from "./presets";
import {
  scenePanoramaFaces,
  type FaceBuffer,
  type GeminiImageRequestOptions,
  type GeneratedImageBuffer,
  type ImageModelCallPreset,
  type ImageRequestKind,
  type ImageRuntimeConfig,
  type ScenePanoramaFace,
  type ScenePanoramaFaceImage,
  type ScenePanoramaGenerationInput,
  type ScenePanoramaGenerationOptions,
  type ScenePanoramaGenerationResult,
  type ScenePanoramaMotherGenerationResult,
  type ScenePanoramaReferenceImage,
  type ScenePanoramaRepaintResult,
  type ScenePanoramaSizeProfile,
  type ScenePanoramaSizeProfileId,
  type ScenePanoramaStreamCallback,
  type ScenePanoramaStreamEvent,
  type ScenePanoramaStreamImage
} from "./types";

export {
  defaultScenePanoramaMaxRedrawAttempts,
  maxScenePanoramaMaxRedrawAttempts,
  minScenePanoramaMaxRedrawAttempts,
  scenePanoramaFaces
};

export type {
  ScenePanoramaFace,
  ScenePanoramaFaceImage,
  ScenePanoramaGenerationInput,
  ScenePanoramaGenerationOptions,
  ScenePanoramaGenerationResult,
  ScenePanoramaMotherGenerationResult,
  ScenePanoramaMotherQualityReport,
  ScenePanoramaReferenceImage,
  ScenePanoramaSizeProfileId,
  ScenePanoramaStreamCallback,
  ScenePanoramaStreamEvent,
  ScenePanoramaStreamImage
};

async function createImageOpenAiClient(config: ImageRuntimeConfig) {
  await configureServerOutboundProxy();

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl
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
      imageQuality: "high",
      maskBoardSize: "3840x2160",
      referenceEditMode: "openai-edits",
      sceneFaceSize: scenePanoramaGptImage2SizeProfile.faceEditSize,
      sceneMotherSize: scenePanoramaGptImage2SizeProfile.motherSize,
      scenePanoramaSizeProfile: scenePanoramaGptImage2SizeProfile
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

function getScenePanoramaSizeProfile(callPreset: ImageModelCallPreset) {
  return callPreset.scenePanoramaSizeProfile ?? scenePanoramaDefaultSizeProfile;
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
  options?: Pick<ScenePanoramaGenerationOptions, "maxRedrawAttempts" | "referenceImages">
): Promise<ScenePanoramaMotherGenerationResult> {
  return generateScenePanoramaMotherInternal(input, userId, undefined, observationContext, options);
}

export async function streamDefaultScenePanoramaMother(
  input: ScenePanoramaGenerationInput,
  userId: string,
  onEvent: ScenePanoramaStreamCallback,
  observationContext?: AiObservationContext,
  options?: Pick<ScenePanoramaGenerationOptions, "maxRedrawAttempts" | "referenceImages">
): Promise<ScenePanoramaMotherGenerationResult> {
  return generateScenePanoramaMotherInternal(input, userId, onEvent, observationContext, options);
}

async function generateScenePanoramaMotherInternal(
  input: ScenePanoramaGenerationInput,
  userId: string,
  onEvent?: ScenePanoramaStreamCallback,
  observationContext?: AiObservationContext,
  options?: Pick<ScenePanoramaGenerationOptions, "maxRedrawAttempts" | "referenceImages">
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
    const sizeProfile = getScenePanoramaSizeProfile(callPreset);
    const motherPrompt = buildScenePanoramaMotherPrompt(input, sizeProfile);
    const maxMotherAttempts = normalizeScenePanoramaMaxRedrawAttempts(options?.maxRedrawAttempts);

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
        maxMotherAttempts,
        requestMotherSize: callPreset.sceneMotherSize,
        sizeProfile: sizeProfile.id
      }
    });

    const motherResult = await generateScenePanoramaMotherWithQualityGate({
      callPreset,
      client,
      config,
      context,
      emit,
      failOnQualityFailure: false,
      maxAttempts: maxMotherAttempts,
      motherPrompt,
      referenceImages,
      sizeProfile
    });
    const mother = faceBufferToStreamImage(motherResult.image);

    updateAiObservation(span, {
      metadata: {
        motherAttempt: motherResult.attempt,
        motherQualityPassed: motherResult.qualityPassed,
        motherQualityScore: motherResult.quality.score
      },
      output: {
        contentType: mother.contentType,
        fileName: mother.fileName,
        hasImage: true,
        motherQualityPassed: motherResult.qualityPassed,
        sizeProfile: sizeProfile.id
      }
    });
    await emit({
      type: "motherDone",
      attempt: motherResult.attempt,
      image: mother,
      quality: motherResult.quality,
      qualityPassed: motherResult.qualityPassed,
      sizeProfile: sizeProfile.id
    });
    await emit({
      type: "progress",
      messageKey: "sceneForm.panoramaProgressMotherReady",
      progress: 100,
      stage: "mother-ready"
    });

    return {
      attempt: motherResult.attempt,
      mother,
      quality: motherResult.quality,
      qualityPassed: motherResult.qualityPassed,
      sizeProfile: sizeProfile.id
    };
  });
}

async function generateScenePanoramaMotherWithQualityGate({
  callPreset,
  client,
  config,
  context,
  emit,
  failOnQualityFailure,
  maxAttempts,
  motherPrompt,
  referenceImages,
  sizeProfile
}: {
  callPreset: ImageModelCallPreset;
  client: OpenAI;
  config: ImageRuntimeConfig;
  context: AiObservationContext;
  emit: (event: ScenePanoramaStreamEvent) => Promise<void>;
  failOnQualityFailure: boolean;
  maxAttempts: number;
  motherPrompt: string;
  referenceImages: ScenePanoramaReferenceImage[];
  sizeProfile: ScenePanoramaSizeProfile;
}): Promise<{
  attempt: number;
  image: Pick<FaceBuffer, "bytes" | "contentType" | "fileName">;
  quality: ScenePanoramaMotherQualityReport;
  qualityPassed: boolean;
}> {
  let best: {
    attempt: number;
    image: Pick<FaceBuffer, "bytes" | "contentType" | "fileName">;
    quality: ScenePanoramaMotherQualityReport;
    score: number;
  } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await emit({
      type: "progress",
      messageKey: attempt > 1 ? "sceneForm.panoramaProgressMotherRetrying" : "sceneForm.panoramaProgressMother",
      progress: getScenePanoramaProgress(8, 20, attempt, maxAttempts),
      stage: attempt > 1 ? "mother-retrying" : "mother-generating"
    });
    const rawMotherImage = await withAiObservation(
      "scene.panorama.mother.generate",
      {
        feature: "scene.panorama.mother.generate",
        input: { attempt, prompt: motherPrompt, referenceImageCount: referenceImages.length, size: callPreset.sceneMotherSize },
        metadata: {
          attempt,
          baseUrl: config.baseUrl,
          imageCallPreset: callPreset.id,
          maxAttempts,
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
    const image = await stabilizeScenePanoramaMotherImage(rawMotherImage, {
      normalizedHeight: sizeProfile.normalizedHeight,
      normalizedWidth: sizeProfile.normalizedWidth
    });
    const quality = await analyzeScenePanoramaMotherImage(image, {
      normalizedHeight: sizeProfile.normalizedHeight,
      normalizedWidth: sizeProfile.normalizedWidth
    });
    const accepted = !best || quality.passed || quality.score < best.score;

    if (accepted) {
      best = { attempt, image, quality, score: quality.score };
    }

    await emit({ type: "mother", image: faceBufferToStreamImage(image) });
    await emit({
      type: "motherQuality",
      accepted,
      attempt,
      bestAttempt: best?.attempt ?? attempt,
      passed: quality.passed,
      quality,
      score: quality.score
    });

    if (quality.passed) {
      return {
        attempt,
        image,
        quality,
        qualityPassed: true
      };
    }
  }

  if (!best) {
    throw new Error("SCENE_PANORAMA_IMAGE_EMPTY");
  }

  if (failOnQualityFailure) {
    throw new Error("SCENE_PANORAMA_MOTHER_QUALITY_FAILED");
  }

  return {
    attempt: best.attempt,
    image: best.image,
    quality: best.quality,
    qualityPassed: false
  };
}

async function validateProvidedScenePanoramaMotherImage(
  motherImage: FaceBuffer,
  sizeProfile: ScenePanoramaSizeProfile,
  emit: (event: ScenePanoramaStreamEvent) => Promise<void>
): Promise<{
  attempt: number;
  image: Pick<FaceBuffer, "bytes" | "contentType" | "fileName">;
  quality: ScenePanoramaMotherQualityReport;
  qualityPassed: boolean;
}> {
  await emit({
    type: "progress",
    messageKey: "sceneForm.panoramaProgressMotherQuality",
    progress: 18,
    stage: "mother-quality-checking"
  });
  const image = await stabilizeScenePanoramaMotherImage(motherImage, {
    normalizedHeight: sizeProfile.normalizedHeight,
    normalizedWidth: sizeProfile.normalizedWidth
  });
  const quality = await analyzeScenePanoramaMotherImage(image, {
    normalizedHeight: sizeProfile.normalizedHeight,
    normalizedWidth: sizeProfile.normalizedWidth
  });

  await emit({
    type: "motherQuality",
    accepted: quality.passed,
    attempt: 1,
    bestAttempt: 1,
    passed: quality.passed,
    quality,
    score: quality.score
  });

  return {
    attempt: 1,
    image,
    quality,
    qualityPassed: quality.passed
  };
}

export async function generateDefaultItemBoardImage(prompt: string, userId: string, observationContext?: AiObservationContext) {
  const config = await getDefaultImageRuntimeConfig(userId);
  const callPreset = getImageModelCallPreset(config);
  const promptWithTarget = appendItemBoardTargetPrompt(prompt);
  const context: AiObservationContext = {
    ...observationContext,
    feature: observationContext?.feature ?? "image.item-board",
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
      emptyError: "ITEM_BOARD_IMAGE_EMPTY",
      fetchFailedError: "ITEM_BOARD_IMAGE_FETCH_FAILED",
      fileName: "item-board.png",
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

    return {
      ...normalized,
      fileName: "item-board.png"
    };
  });
}

export async function generateDefaultItemViewImages({
  prompt,
  referenceImage,
  userId,
  observationContext
}: {
  prompt: string;
  referenceImage: ScenePanoramaReferenceImage;
  userId: string;
  observationContext?: AiObservationContext;
}): Promise<Record<ScenePanoramaFace, ScenePanoramaFaceImage>> {
  const config = await getDefaultImageRuntimeConfig(userId);
  const callPreset = getImageModelCallPreset(config);
  const context: AiObservationContext = {
    ...observationContext,
    feature: observationContext?.feature ?? "image.item-views",
    input: { prompt, referenceImage: referenceImage.fileName, faces: scenePanoramaFaces },
    modelId: config.modelId,
    providerName: config.providerName,
    userId: observationContext?.userId ?? userId
  };

  return withAiObservation(context.traceName ?? context.feature, context, async (span) => {
    const client = await createImageOpenAiClient(config);

    updateAiObservation(span, {
      metadata: {
        baseUrl: config.baseUrl,
        imageCallPreset: callPreset.id,
        modelId: config.modelId,
        providerName: config.providerName,
        requestSize: callPreset.sceneFaceSize
      }
    });

    const faces = await Promise.all(
      scenePanoramaFaces.map(async (face) => {
        const result = await requestGeneratedImage(client, config, callPreset, {
          emptyError: "ITEM_VIEW_IMAGE_EMPTY",
          fetchFailedError: "ITEM_VIEW_IMAGE_FETCH_FAILED",
          fileName: `item-${face}.png`,
          kind: "sceneFace",
          prompt: buildItemViewPrompt(prompt, face),
          referenceImages: [referenceImage],
          size: callPreset.sceneFaceSize
        });

        return {
          bytes: result.bytes,
          contentType: result.contentType,
          face,
          fileName: `item-${face}.png`
        } satisfies FaceBuffer;
      })
    );

    updateAiObservation(span, {
      output: {
        faces: faces.map((face) => face.face),
        hasImages: faces.length === scenePanoramaFaces.length
      }
    });

    return faces.reduce<Record<ScenePanoramaFace, ScenePanoramaFaceImage>>((result, face) => {
      result[face.face] = faceBufferToScenePanoramaImage(face);

      return result;
    }, {} as Record<ScenePanoramaFace, ScenePanoramaFaceImage>);
  });
}

export async function generateDefaultItemModelInputImage({
  prompt,
  referenceImage,
  userId,
  observationContext
}: {
  prompt: string;
  referenceImage: ScenePanoramaReferenceImage;
  userId: string;
  observationContext?: AiObservationContext;
}): Promise<ScenePanoramaStreamImage> {
  const config = await getDefaultImageRuntimeConfig(userId);
  const callPreset = getImageModelCallPreset(config);
  const promptWithTarget = buildItemModelInputPrompt(prompt);
  const context: AiObservationContext = {
    ...observationContext,
    feature: observationContext?.feature ?? "image.item-model-input",
    input: { prompt: promptWithTarget, referenceImage: referenceImage.fileName },
    modelId: config.modelId,
    providerName: config.providerName,
    userId: observationContext?.userId ?? userId
  };

  return withAiObservation(context.traceName ?? context.feature, context, async (span) => {
    const client = await createImageOpenAiClient(config);

    updateAiObservation(span, {
      metadata: {
        baseUrl: config.baseUrl,
        imageCallPreset: callPreset.id,
        modelId: config.modelId,
        providerName: config.providerName,
        requestSize: callPreset.sceneFaceSize
      }
    });

    const result = await requestGeneratedImage(client, config, callPreset, {
      emptyError: "ITEM_MODEL_INPUT_IMAGE_EMPTY",
      fetchFailedError: "ITEM_MODEL_INPUT_IMAGE_FETCH_FAILED",
      fileName: "item-model-input.png",
      kind: "sceneFace",
      prompt: promptWithTarget,
      referenceImages: [referenceImage],
      size: callPreset.sceneFaceSize
    });
    const image = faceBufferToStreamImage({
      bytes: result.bytes,
      contentType: result.contentType,
      fileName: "item-model-input.png"
    });

    updateAiObservation(span, {
      output: {
        contentType: image.contentType,
        fileName: image.fileName,
        hasImage: true
      }
    });

    return image;
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

      const motherResult = providedMotherImage
        ? await validateProvidedScenePanoramaMotherImage(providedMotherImage, sizeProfile, emit)
        : await generateScenePanoramaMotherWithQualityGate({
            callPreset,
            client,
            config,
            context,
            emit,
            failOnQualityFailure: false,
            maxAttempts: maxRedrawAttempts,
            motherPrompt,
            referenceImages,
            sizeProfile
          });
      const motherImage = motherResult.image;

      if (!providedMotherImage) {
        await emit({
          type: "motherDone",
          attempt: motherResult.attempt,
          image: faceBufferToStreamImage(motherImage),
          quality: motherResult.quality,
          qualityPassed: motherResult.qualityPassed,
          sizeProfile: sizeProfile.id
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
          motherQualityPassed: motherResult.qualityPassed,
          motherQualityScore: motherResult.quality.score,
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
          motherQualityPassed: motherResult.qualityPassed,
          motherQualityScore: motherResult.quality.score,
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
        motherQuality: motherResult.quality,
        motherQualityPassed: motherResult.qualityPassed,
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
        motherQuality: result.motherQuality,
        motherQualityPassed: result.motherQualityPassed,
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

    return runWithSizeProfile(getScenePanoramaSizeProfile(callPreset));
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
  const images = [...(image ? [image] : []), ...(referenceImages ?? [])];

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

  if (callPreset.imageQuality) {
    payload.quality = callPreset.imageQuality;
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
    prompt,
    referenceImages = []
  }: {
    callPreset: ImageModelCallPreset;
    config: ImageRuntimeConfig;
    fileName: string;
    image: FaceBuffer;
    prompt: string;
    referenceImages?: ScenePanoramaReferenceImage[];
  }
): Promise<FaceBuffer> {
  if (callPreset.transport === "gemini-native" || callPreset.referenceEditMode === "generation-image-field") {
    return requestReferenceGenerateImage(client, config, callPreset, fileName, image, prompt, referenceImages);
  }

  const imageFile = await toFile(image.bytes, image.fileName, { type: image.contentType });
  const referenceFiles = await Promise.all(
    referenceImages.map((referenceImage) => toFile(referenceImage.bytes, referenceImage.fileName, { type: referenceImage.contentType }))
  );
  let edited: { data?: Array<{ b64_json?: string; url?: string }> };

  try {
    edited = await requestImageEdit(client, {
      callPreset,
      imageFile,
      modelId: config.modelId,
      prompt,
      referenceFiles,
      useAdvancedOptions: true
    });
  } catch (error) {
    if (callPreset.referenceEditMode === "auto" && isLikelyImageEditUnsupportedError(error)) {
      return requestReferenceGenerateImage(client, config, callPreset, fileName, image, prompt, referenceImages);
    }

    if (!isLikelyImageEditOptionUnsupportedError(error)) {
      throw error;
    }

    edited = await requestImageEdit(client, {
      callPreset,
      imageFile,
      modelId: config.modelId,
      prompt,
      referenceFiles,
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
  prompt: string,
  referenceImages: ScenePanoramaReferenceImage[] = []
): Promise<FaceBuffer> {
  const generated = await requestGeneratedImage(client, config, callPreset, {
    emptyError: "SCENE_PANORAMA_IMAGE_EMPTY",
    fetchFailedError: "SCENE_PANORAMA_IMAGE_FETCH_FAILED",
    fileName,
    image,
    kind: "sceneFace",
    prompt,
    referenceImages,
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
    referenceFiles,
    useAdvancedOptions
  }: {
    callPreset: ImageModelCallPreset;
    imageFile: File;
    modelId: string;
    prompt: string;
    referenceFiles?: File[];
    useAdvancedOptions: boolean;
  }
) {
  const payload: Record<string, unknown> = {
    image: referenceFiles?.length ? [imageFile, ...referenceFiles] : imageFile,
    model: modelId,
    n: 1,
    prompt,
    size: callPreset.sceneFaceSize
  };

  if (callPreset.includeResponseFormat) {
    payload.response_format = "b64_json";
  }

  if (callPreset.includeGenerateOutputFormat) {
    payload.output_format = "png";
  }

  if (callPreset.imageQuality) {
    payload.quality = callPreset.imageQuality;
  }

  if (useAdvancedOptions && callPreset.includeHighFidelityEditOptions) {
    payload.input_fidelity = "high";

    if (!payload.output_format) {
      payload.output_format = "png";
    }

    if (!payload.quality) {
      payload.quality = "high";
    }
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
  const qualityRetriedFaces = new Map<ScenePanoramaFace, number>();
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
        let stabilized = await stabilizeScenePanoramaFaces(referenceFaces, enhancedFaces, { faceSize: sizeProfile.faceSize });
        let report = await analyzeScenePanoramaFaces(stabilized, { faceSize: sizeProfile.faceSize });
        let localRepairApplied = false;

        if (!isScenePanoramaQualityPassing(report) && isScenePanoramaColorOnlyFailure(report)) {
          await emit({
            type: "progress",
            messageKey: "sceneForm.panoramaProgressLocalRepair",
            progress: getScenePanoramaProgress(66, 88, attempt, maxRedrawAttempts),
            stage: "local-repairing"
          });

          try {
            const repaired = await repairScenePanoramaColorSeams(referenceFaces, stabilized, { faceSize: sizeProfile.faceSize });

            if (repaired.applied) {
              stabilized = repaired.faces;
              report = repaired.qualityAfter;
              localRepairApplied = true;
            }
          } catch (error) {
            updateAiObservation(qualitySpan, {
              level: "WARNING",
              metadata: {
                attempt,
                localRepairError: truncateErrorMessage(getErrorMessage(error))
              }
            });
          }
        }

        const failed = isScenePanoramaQualityPassing(report)
          ? []
          : await getScenePanoramaQualityFailedFaces(report, referenceFaces, stabilized, qualityRetriedFaces, sizeProfile.faceSize);
        const reportScore = getScenePanoramaQualityScore(report);
        const reportAccepted = failed.length === 0 || reportScore < bestScore;

        updateAiObservation(qualitySpan, {
          metadata: {
            attempt,
            accepted: reportAccepted,
            averageEdgeDelta: report.averageEdgeDelta,
            averageInnerBandDelta: report.averageInnerBandDelta,
            averageStructureDelta: report.averageStructureDelta,
            bestAttempt: reportAccepted ? attempt : bestResult?.bestAttempt,
            bestScore: Number.isFinite(bestScore) ? bestScore : null,
            failedFaces: failed,
            issueKinds: report.issues.map((issue) => issue.kind),
            localRepairApplied,
            maxEdgeDelta: report.maxEdgeDelta,
            maxInnerBandDelta: report.maxInnerBandDelta,
            maxStructureDelta: report.maxStructureDelta,
            passed: failed.length === 0,
            score: reportScore
          },
          output: {
            accepted: reportAccepted,
            bestAttempt: reportAccepted ? attempt : bestResult?.bestAttempt,
            failedFaces: failed,
            localRepairApplied,
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
      qualityRetriedFaces: Array.from(qualityRetriedFaces.keys()),
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
        qualityRetriedFaces.set(face, (qualityRetriedFaces.get(face) ?? 0) + 1);

        return redrawScenePanoramaFaceWithRetry(
          client,
          config,
          callPreset,
          referenceFace,
          referenceFaces,
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
        faces,
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
  referenceFaces: FaceBuffer[],
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
    referenceImages?: ScenePanoramaReferenceImage[];
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

function createSkippedScenePanoramaColorReport(faces: FaceBuffer[]): ScenePanoramaColorReport {
  return {
    averageFaceColorDeltaAfter: 0,
    averageFaceColorDeltaBefore: 0,
    averageReferenceColorDelta: 0,
    colorAlgorithm: "candidate-preserving-color-match-v2",
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
  return (
    quality.maxEdgeDelta <= maxAllowedScenePanoramaEdgeDelta &&
    quality.maxInnerBandDelta <= maxAllowedScenePanoramaInnerBandDelta &&
    quality.issues.length === 0
  );
}

function getScenePanoramaQualityScore(quality: ScenePanoramaQualityReport) {
  return (
    quality.maxEdgeDelta / maxAllowedScenePanoramaEdgeDelta +
    quality.maxInnerBandDelta / maxAllowedScenePanoramaInnerBandDelta +
    quality.maxStructureDelta / Math.max(1, maxAllowedScenePanoramaEdgeDelta)
  );
}

function getScenePanoramaProgress(start: number, end: number, attempt: number, maxRedrawAttempts: number) {
  const ratio = maxRedrawAttempts <= 1 ? 1 : (attempt - 1) / Math.max(1, maxRedrawAttempts - 1);

  return Math.round(start + (end - start) * Math.max(0, Math.min(1, ratio)));
}

function isScenePanoramaColorOnlyFailure(quality: ScenePanoramaQualityReport) {
  return quality.issues.length > 0 && quality.issues.every((issue) => issue.kind === "color");
}

async function getScenePanoramaQualityFailedFaces(
  quality: ScenePanoramaQualityReport,
  referenceFaces: FaceBuffer[],
  candidateFaces: FaceBuffer[],
  retryCounts: Map<ScenePanoramaFace, number>,
  faceSize: number
) {
  const suspiciousFaces = new Map<ScenePanoramaFace, number>();
  const issues = quality.issues.length > 0
    ? quality.issues
    : quality.edgeDeltas
        .filter((edge) => edge.delta > maxAllowedScenePanoramaEdgeDelta)
        .map((edge) => ({
          ...edge,
          delta: edge.delta,
          edgeDelta: edge.delta,
          innerBandDelta: 0,
          kind: "geometry" as const,
          lumaDelta: 0,
          structureDelta: 0
        }));

  for (const issue of issues) {
    const firstSuspicion = await measureScenePanoramaFaceSuspicion(
      referenceFaces,
      candidateFaces,
      issue.firstFace,
      issue.firstEdge,
      retryCounts,
      faceSize
    );
    const secondSuspicion = await measureScenePanoramaFaceSuspicion(
      referenceFaces,
      candidateFaces,
      issue.secondFace,
      issue.secondEdge,
      retryCounts,
      faceSize
    );
    const suspicionGap = Math.abs(firstSuspicion - secondSuspicion);
    const issueWeight = issue.delta + issue.structureDelta + issue.innerBandDelta / 2;

    if (issue.kind === "geometry" && suspicionGap > 4) {
      const face = firstSuspicion > secondSuspicion ? issue.firstFace : issue.secondFace;

      suspiciousFaces.set(face, (suspiciousFaces.get(face) ?? 0) + issueWeight + Math.max(firstSuspicion, secondSuspicion));
    } else {
      suspiciousFaces.set(issue.firstFace, (suspiciousFaces.get(issue.firstFace) ?? 0) + issueWeight + firstSuspicion);
      suspiciousFaces.set(issue.secondFace, (suspiciousFaces.get(issue.secondFace) ?? 0) + issueWeight + secondSuspicion);
    }
  }

  const selected = Array.from(suspiciousFaces.entries())
    .sort((first, second) => second[1] - first[1])
    .slice(0, 3)
    .map(([face]) => face);

  return selected.length > 0 ? selected : [...scenePanoramaFaces].slice(0, 3);
}

async function measureScenePanoramaFaceSuspicion(
  referenceFaces: FaceBuffer[],
  candidateFaces: FaceBuffer[],
  face: ScenePanoramaFace,
  edge: "top" | "right" | "bottom" | "left",
  retryCounts: Map<ScenePanoramaFace, number>,
  faceSize: number
) {
  const reference = getFaceBuffer(referenceFaces, face);
  const candidate = getFaceBuffer(candidateFaces, face);
  const referenceDelta = await measureFaceReferenceEdgeDelta(reference.bytes, candidate.bytes, edge, { faceSize });
  const retryPenalty = (retryCounts.get(face) ?? 0) * 3;

  return referenceDelta + retryPenalty;
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
