import "server-only";

import OpenAI, { toFile } from "openai";
import { getDefaultImageRuntimeConfig } from "@/lib/ai/model-config";
import {
  analyzeScenePanoramaFaces,
  stabilizeScenePanoramaFaces,
  type ScenePanoramaQualityReport
} from "@/lib/ai/scene-panorama-postprocess";
import { splitEquirectangularToCubemap } from "@/lib/ai/scene-panorama-projection";
import { type AiObservationContext, updateAiObservation, withAiObservation } from "@/lib/observability/langfuse";

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
  panoramaDrawingStyle: string;
  style: string;
  locale: "zh-CN" | "en-US";
};

export type ScenePanoramaGenerationResult = {
  faces: Record<ScenePanoramaFace, ScenePanoramaFaceImage>;
  mode: "enhanced" | "direct-cut";
  quality?: ScenePanoramaQualityReport;
  qualityBestEffort?: boolean;
  qualityPassed?: boolean;
  repaired: boolean;
};

type FaceBuffer = {
  bytes: Buffer;
  contentType: string;
  face: ScenePanoramaFace;
  fileName: string;
};

type ScenePanoramaRepaintResult = {
  faces: FaceBuffer[];
  quality: ScenePanoramaQualityReport;
  qualityPassed: boolean;
  qualityRepairRounds: number;
  qualityRetriedFaces: ScenePanoramaFace[];
};

const panoramaMotherSize = "1792x1024";
const panoramaFaceSize = 1024;
const maxFaceRedrawAttempts = 3;
const maxAllowedScenePanoramaEdgeDelta = 18;
const maxAllowedScenePanoramaInnerBandDelta = 28;

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

export async function generateDefaultScenePanorama(
  input: ScenePanoramaGenerationInput,
  userId: string,
  observationContext?: AiObservationContext
): Promise<ScenePanoramaGenerationResult> {
  const config = await getDefaultImageRuntimeConfig(userId);
  const context: AiObservationContext = {
    ...observationContext,
    feature: observationContext?.feature ?? "scene.panorama.generate",
    input,
    modelId: config.modelId,
    providerName: config.providerName,
    userId: observationContext?.userId ?? userId
  };

  return withAiObservation(context.traceName ?? context.feature, context, async (span) => {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
    const motherPrompt = buildScenePanoramaMotherPrompt(input);

    updateAiObservation(span, {
      input: {
        ...input,
        motherSize: panoramaMotherSize
      },
      metadata: {
        baseUrl: config.baseUrl,
        faceSize: panoramaFaceSize,
        modelId: config.modelId,
        providerName: config.providerName
      }
    });

    const motherImage = await generateImageBuffer(client, {
      fileName: "scene-panorama-mother.png",
      modelId: config.modelId,
      prompt: motherPrompt,
      size: panoramaMotherSize
    });
    const baseFaces = await splitEquirectangularToCubemap(motherImage.bytes);

    const repaintResult = await redrawScenePanoramaFacesUntilQualityPasses(client, config.modelId, baseFaces, input);
    const faces = faceBuffersToResult(repaintResult.faces);
    const quality = repaintResult.quality;

    updateAiObservation(span, {
      metadata: {
        averageEdgeDelta: quality.averageEdgeDelta,
        averageInnerBandDelta: quality.averageInnerBandDelta,
        faceCount: scenePanoramaFaces.length,
        largestFaceBytes: quality.largestFaceBytes,
        maxEdgeDelta: quality.maxEdgeDelta,
        maxInnerBandDelta: quality.maxInnerBandDelta,
        mode: "enhanced",
        qualityBestEffort: !repaintResult.qualityPassed,
        qualityPassed: repaintResult.qualityPassed,
        qualityRepairRounds: repaintResult.qualityRepairRounds,
        qualityRetriedFaces: repaintResult.qualityRetriedFaces,
        repaired: true,
        totalBytes: quality.totalBytes
      },
      output: {
        averageEdgeDelta: quality.averageEdgeDelta,
        averageInnerBandDelta: quality.averageInnerBandDelta,
        faceCount: scenePanoramaFaces.length,
        largestFaceBytes: quality.largestFaceBytes,
        maxEdgeDelta: quality.maxEdgeDelta,
        maxInnerBandDelta: quality.maxInnerBandDelta,
        mode: "enhanced",
        qualityBestEffort: !repaintResult.qualityPassed,
        qualityPassed: repaintResult.qualityPassed,
        qualityRepairRounds: repaintResult.qualityRepairRounds,
        qualityRetriedFaces: repaintResult.qualityRetriedFaces,
        repaired: true,
        totalBytes: quality.totalBytes
      }
    });

    return {
      faces,
      mode: "enhanced",
      quality,
      qualityBestEffort: !repaintResult.qualityPassed,
      qualityPassed: repaintResult.qualityPassed,
      repaired: true
    };
  });
}

async function generateImageBuffer(
  client: OpenAI,
  {
    fileName,
    modelId,
    prompt,
    size
  }: {
    fileName: string;
    modelId: string;
    prompt: string;
    size: string;
  }
): Promise<FaceBuffer> {
  const image = (await client.images.generate({
    model: modelId,
    n: 1,
    output_format: "png",
    prompt,
    response_format: "b64_json",
    size
  } as Parameters<typeof client.images.generate>[0])) as { data?: Array<{ b64_json?: string; url?: string }> };

  return extractImageBuffer(client, image, fileName, "front");
}

async function editImageBuffer(
  client: OpenAI,
  {
    fileName,
    image,
    modelId,
    prompt
  }: {
    fileName: string;
    image: FaceBuffer;
    modelId: string;
    prompt: string;
  }
): Promise<FaceBuffer> {
  const imageFile = await toFile(image.bytes, image.fileName, { type: image.contentType });
  let edited: { data?: Array<{ b64_json?: string; url?: string }> };

  try {
    edited = await requestImageEdit(client, {
      imageFile,
      modelId,
      prompt,
      useAdvancedOptions: true
    });
  } catch (error) {
    if (!isLikelyImageEditOptionUnsupportedError(error)) {
      throw error;
    }

    edited = await requestImageEdit(client, {
      imageFile,
      modelId,
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

async function requestImageEdit(
  client: OpenAI,
  {
    imageFile,
    modelId,
    prompt,
    useAdvancedOptions
  }: {
    imageFile: File;
    modelId: string;
    prompt: string;
    useAdvancedOptions: boolean;
  }
) {
  return (await client.images.edit({
    image: imageFile,
    model: modelId,
    n: 1,
    prompt,
    size: "1024x1024",
    ...(useAdvancedOptions
      ? {
          input_fidelity: "high",
          output_format: "png",
          quality: "high"
        }
      : {})
  } as Parameters<typeof client.images.edit>[0])) as { data?: Array<{ b64_json?: string; url?: string }> };
}

async function extractImageBuffer(
  _client: OpenAI,
  response: { data?: Array<{ b64_json?: string; url?: string }> },
  fileName: string,
  face: ScenePanoramaFace
): Promise<FaceBuffer> {
  const firstImage = response.data?.[0];

  if (firstImage?.b64_json) {
    return {
      bytes: Buffer.from(firstImage.b64_json, "base64"),
      contentType: "image/png",
      face,
      fileName
    };
  }

  if (firstImage?.url) {
    const fetched = await fetch(firstImage.url);

    if (!fetched.ok) {
      throw new Error("SCENE_PANORAMA_IMAGE_FETCH_FAILED");
    }

    const contentType = fetched.headers.get("content-type")?.split(";")[0] || "image/png";
    const extension = contentType === "image/webp" ? "webp" : contentType === "image/jpeg" ? "jpg" : "png";

    return {
      bytes: Buffer.from(await fetched.arrayBuffer()),
      contentType,
      face,
      fileName: fileName.replace(/\.[a-z0-9]+$/i, `.${extension}`)
    };
  }

  throw new Error("SCENE_PANORAMA_IMAGE_EMPTY");
}

async function redrawScenePanoramaFacesUntilQualityPasses(
  client: OpenAI,
  modelId: string,
  referenceFaces: FaceBuffer[],
  input: ScenePanoramaGenerationInput
): Promise<ScenePanoramaRepaintResult> {
  let enhancedFaces = await redrawScenePanoramaFaces(client, modelId, referenceFaces, input, 1);
  const qualityRetriedFaces = new Set<ScenePanoramaFace>();
  let bestResult: ScenePanoramaRepaintResult | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 1; attempt <= maxFaceRedrawAttempts; attempt += 1) {
    const stabilizedFaces = await stabilizeScenePanoramaFaces(referenceFaces, enhancedFaces);
    const quality = await analyzeScenePanoramaFaces(stabilizedFaces);
    const score = getScenePanoramaQualityScore(quality);

    if (score < bestScore) {
      bestScore = score;
      bestResult = {
        faces: stabilizedFaces,
        quality,
        qualityPassed: false,
        qualityRepairRounds: attempt - 1,
        qualityRetriedFaces: Array.from(qualityRetriedFaces)
      };
    }

    if (isScenePanoramaQualityPassing(quality)) {
      return {
        faces: stabilizedFaces,
        quality,
        qualityPassed: true,
        qualityRepairRounds: attempt - 1,
        qualityRetriedFaces: Array.from(qualityRetriedFaces)
      };
    }

    if (attempt >= maxFaceRedrawAttempts) {
      return bestResult ?? {
        faces: stabilizedFaces,
        quality,
        qualityPassed: false,
        qualityRepairRounds: attempt - 1,
        qualityRetriedFaces: Array.from(qualityRetriedFaces)
      };
    }

    const failedFaces = getScenePanoramaQualityFailedFaces(quality);
    const redrawnFaces = await Promise.all(
      failedFaces.map(async (face) => {
        const referenceFace = getFaceBuffer(referenceFaces, face);
        qualityRetriedFaces.add(face);

        return redrawScenePanoramaFaceWithRetry(client, modelId, referenceFace, input, attempt + 1);
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
  modelId: string,
  faces: FaceBuffer[],
  input: ScenePanoramaGenerationInput,
  firstPromptAttempt = 1
) {
  return Promise.all(faces.map((face) => redrawScenePanoramaFaceWithRetry(client, modelId, face, input, firstPromptAttempt)));
}

async function redrawScenePanoramaFaceWithRetry(
  client: OpenAI,
  modelId: string,
  face: FaceBuffer,
  input: ScenePanoramaGenerationInput,
  firstPromptAttempt = 1
) {
  let lastError: unknown = null;

  for (let attempt = firstPromptAttempt; attempt <= maxFaceRedrawAttempts; attempt += 1) {
    const fileName = `scene-panorama-${face.face}.png`;

    try {
      return await editImageBuffer(client, {
        fileName,
        image: face,
        modelId,
        prompt: buildScenePanoramaFacePrompt(input, face.face, attempt)
      });
    } catch (error) {
      lastError = error;

      if (isLikelyImageEditUnsupportedError(error)) {
        throw new Error("SCENE_PANORAMA_REFERENCE_EDIT_UNSUPPORTED");
      }
    }
  }

  throw lastError ?? new Error(`SCENE_PANORAMA_FACE_REDRAW_FAILED_${face.face}`);
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

function isScenePanoramaQualityPassing(quality: ScenePanoramaQualityReport) {
  return quality.maxEdgeDelta <= maxAllowedScenePanoramaEdgeDelta && quality.maxInnerBandDelta <= maxAllowedScenePanoramaInnerBandDelta;
}

function getScenePanoramaQualityScore(quality: ScenePanoramaQualityReport) {
  return quality.maxEdgeDelta / maxAllowedScenePanoramaEdgeDelta + quality.maxInnerBandDelta / maxAllowedScenePanoramaInnerBandDelta;
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

function buildScenePanoramaMotherPrompt(input: ScenePanoramaGenerationInput) {
  const style = getSceneStylePrompt(input.style, input.locale);
  const drawingStyle = getScenePanoramaDrawingStylePrompt(input.panoramaDrawingStyle, input.locale);

  if (input.locale === "en-US") {
    return [
      "Create one seamless 360-degree equirectangular panorama master image for an interactive fiction scene.",
      "The image must represent a complete interior or exterior space that can wrap horizontally.",
      "The left and right edges must join perfectly as one continuous world; avoid objects, light bands, or perspective lines that break at the wrap seam.",
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
      `Visual style: ${style}.`,
      `Rendering type: ${drawingStyle}.`
    ].join("\n");
  }

  return [
    "生成一张用于交互小说场景的 360 度等距柱状全景母图。",
    "画面必须表现一个可以水平环绕的完整室内或室外空间。",
    "左右边缘必须能无缝闭合成同一个连续世界，避免物体、光带、透视线在环绕接缝处断裂。",
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
    `视觉风格：${style}。`,
    `画面类型：${drawingStyle}。`
  ].join("\n");
}

function buildScenePanoramaFacePrompt(input: ScenePanoramaGenerationInput, face: ScenePanoramaFace, attempt: number) {
  const direction = getScenePanoramaFaceDescription(face, input.locale);
  const adjacency = getScenePanoramaFaceAdjacencyDescription(face, input.locale);
  const retryInstruction = getScenePanoramaFaceRetryInstruction(attempt, input.locale);
  const style = getSceneStylePrompt(input.style, input.locale);
  const drawingStyle = getScenePanoramaDrawingStylePrompt(input.panoramaDrawingStyle, input.locale);

  if (input.locale === "en-US") {
    return [
      "Perform pixel-faithful image upscaling, restoration, and enhancement for this cubemap face.",
      "Use the input image as a strict spatial reference, not as a loose concept sketch.",
      "Keep the exact composition, camera position, field of view, perspective, crop, rotation, object placement, object scale, and horizon level.",
      "Do not add objects, remove objects, move objects, resize objects, rotate objects, repaint the scene as a new illustration, or reinterpret the space.",
      "All wall lines, floor lines, ceiling lines, horizon lines, shadow boundaries, object silhouettes, and material texture directions must stay near the same pixel positions as the reference.",
      "Allowed improvements: higher apparent resolution, clearer texture detail, material readability, gentle noise cleanup, small missing-detail restoration, and richer light quality.",
      "Forbidden artifacts: feathered edges, blurred seams, vignette, frame, border, face-specific color shift, restyling, recropping, or standalone-poster composition.",
      "This face is one side of a shared 360-degree cubemap. Its four edges connect directly to other AI-upscaled faces and must remain sharp, continuous, and stitchable.",
      "Match the reference global exposure, white balance, color grading, lighting direction, time-of-day, material palette, camera height, and spatial scale.",
      `Face direction: ${direction}.`,
      `Face adjacency: ${adjacency}.`,
      `Scene: ${input.sceneName}.`,
      `Scene description: ${input.sceneDescription}.`,
      `Block: ${input.blockName}.`,
      `Block description: ${input.blockDescription}.`,
      `Visual style: ${style}.`,
      `Rendering type: ${drawingStyle}.`,
      retryInstruction
    ].join("\n");
  }

  return [
    "对这张六面体单面图做像素级忠实升级、高清恢复和细节增强。",
    "输入图是严格空间参考，不是宽松概念草图。",
    "必须保持完全相同的构图、机位、视场角、透视、裁切、旋转、物体位置、物体比例和地平线高度。",
    "不要新增物体、删除物体、移动物体、缩放物体、旋转物体、把画面重画成新插画，或重新理解空间。",
    "所有墙线、地线、天花线、地平线、阴影边界、物体轮廓和材质纹理方向，都必须保持在参考图的相同像素位置附近。",
    "允许增强：表观分辨率、纹理清晰度、材质可读性、轻微噪点清理、局部缺失细节恢复和光照质感。",
    "禁止出现：边缘羽化、接缝模糊、暗角、画框、边框、单面独立偏色、风格重绘、重新裁切或海报式构图。",
    "这张图是同一个 360 度六面体空间的一面，四条边会直接连接其他 AI 高清升级后的面，边缘必须清晰、连续、可拼接。",
    "必须匹配参考图的统一曝光、白平衡、调色、光照方向、时间光线、材质色板、机位高度和空间比例。",
    `当前方向：${direction}。`,
    `相邻关系：${adjacency}。`,
    `场景：${input.sceneName}。`,
    `场景说明：${input.sceneDescription}。`,
    `区块：${input.blockName}。`,
    `区块说明：${input.blockDescription}。`,
    `视觉风格：${style}。`,
    `画面类型：${drawingStyle}。`,
    retryInstruction
  ].join("\n");
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
