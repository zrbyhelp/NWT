import "server-only";

import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { getDefaultImageRuntimeConfig } from "@/lib/ai/model-config";
import {
  analyzeScenePanoramaFaces,
  stabilizeScenePanoramaFaces,
  type ScenePanoramaQualityReport
} from "@/lib/ai/scene-panorama-postprocess";
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
  repaired: boolean;
};

type FaceBuffer = {
  bytes: Buffer;
  contentType: string;
  face: ScenePanoramaFace;
  fileName: string;
};

const panoramaMotherSize = "1792x1024";
const normalizedPanoramaWidth = 2048;
const normalizedPanoramaHeight = 1024;
const panoramaFaceSize = 1024;
const sceneFaceEditMaskLockWidth = 176;
const sceneFaceEditMaskFeatherWidth = 96;
const maxFaceRedrawAttempts = 3;
const maxAllowedScenePanoramaEdgeDelta = 18;
let scenePanoramaCenterEditMaskPromise: Promise<Buffer> | null = null;

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

    try {
      const enhancedFaces = await redrawScenePanoramaFaces(client, config.modelId, baseFaces, input);
      const stabilizedFaces = await stabilizeScenePanoramaFaces(baseFaces, enhancedFaces);
      const quality = await ensureScenePanoramaQuality(stabilizedFaces);
      const faces = faceBuffersToResult(stabilizedFaces);

      updateAiObservation(span, {
        metadata: {
          averageEdgeDelta: quality.averageEdgeDelta,
          faceCount: scenePanoramaFaces.length,
          largestFaceBytes: quality.largestFaceBytes,
          maxEdgeDelta: quality.maxEdgeDelta,
          mode: "enhanced",
          repaired: true,
          totalBytes: quality.totalBytes
        },
        output: {
          averageEdgeDelta: quality.averageEdgeDelta,
          faceCount: scenePanoramaFaces.length,
          largestFaceBytes: quality.largestFaceBytes,
          maxEdgeDelta: quality.maxEdgeDelta,
          mode: "enhanced",
          repaired: true,
          totalBytes: quality.totalBytes
        }
      });

      return {
        faces,
        mode: "enhanced",
        quality,
        repaired: true
      };
    } catch (error) {
      if (!isLikelyImageEditUnsupportedError(error)) {
        throw error;
      }

      const stabilizedFaces = await stabilizeScenePanoramaFaces(baseFaces, baseFaces);
      const quality = await ensureScenePanoramaQuality(stabilizedFaces);
      const faces = faceBuffersToResult(stabilizedFaces);

      updateAiObservation(span, {
        metadata: {
          averageEdgeDelta: quality.averageEdgeDelta,
          editFallbackReason: getErrorMessage(error),
          faceCount: scenePanoramaFaces.length,
          largestFaceBytes: quality.largestFaceBytes,
          maxEdgeDelta: quality.maxEdgeDelta,
          mode: "direct-cut",
          repaired: true,
          totalBytes: quality.totalBytes
        },
        output: {
          averageEdgeDelta: quality.averageEdgeDelta,
          faceCount: scenePanoramaFaces.length,
          largestFaceBytes: quality.largestFaceBytes,
          maxEdgeDelta: quality.maxEdgeDelta,
          mode: "direct-cut",
          repaired: true,
          totalBytes: quality.totalBytes
        }
      });

      return {
        faces,
        mode: "direct-cut",
        quality,
        repaired: true
      };
    }
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
    mask,
    modelId,
    prompt
  }: {
    fileName: string;
    image: FaceBuffer;
    mask?: Buffer | null;
    modelId: string;
    prompt: string;
  }
): Promise<FaceBuffer> {
  const imageFile = await toFile(image.bytes, image.fileName, { type: image.contentType });
  const maskFile = mask ? await toFile(mask, `mask-${image.fileName}`, { type: "image/png" }) : undefined;
  let edited: { data?: Array<{ b64_json?: string; url?: string }> };

  try {
    edited = await requestImageEdit(client, {
      imageFile,
      maskFile,
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
      maskFile,
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
    maskFile,
    modelId,
    prompt,
    useAdvancedOptions
  }: {
    imageFile: File;
    maskFile?: File;
    modelId: string;
    prompt: string;
    useAdvancedOptions: boolean;
  }
) {
  return (await client.images.edit({
    image: imageFile,
    mask: maskFile,
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

async function splitEquirectangularToCubemap(bytes: Buffer): Promise<FaceBuffer[]> {
  const normalized = await sharp(bytes)
    .resize(normalizedPanoramaWidth, normalizedPanoramaHeight, { fit: "fill" })
    .toColorspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer();

  return Promise.all(
    scenePanoramaFaces.map(async (face) => ({
      bytes: await renderCubemapFace(normalized, face),
      contentType: "image/png",
      face,
      fileName: `scene-panorama-${face}.png`
    }))
  );
}

async function renderCubemapFace(sourcePixels: Buffer, face: ScenePanoramaFace) {
  const output = Buffer.alloc(panoramaFaceSize * panoramaFaceSize * 4);

  for (let y = 0; y < panoramaFaceSize; y += 1) {
    for (let x = 0; x < panoramaFaceSize; x += 1) {
      const a = (2 * (x + 0.5)) / panoramaFaceSize - 1;
      const b = (2 * (y + 0.5)) / panoramaFaceSize - 1;
      const [dx, dy, dz] = getFaceDirection(face, a, b);
      const length = Math.hypot(dx, dy, dz);
      const nx = dx / length;
      const ny = dy / length;
      const nz = dz / length;
      const lon = Math.atan2(nx, nz);
      const lat = Math.asin(ny);
      const sourceX = wrapCoordinate((lon / (2 * Math.PI) + 0.5) * normalizedPanoramaWidth, normalizedPanoramaWidth);
      const sourceY = clampCoordinate((0.5 - lat / Math.PI) * normalizedPanoramaHeight, normalizedPanoramaHeight);
      const color = sampleBilinear(sourcePixels, sourceX, sourceY);
      const targetIndex = (y * panoramaFaceSize + x) * 4;

      output[targetIndex] = color[0];
      output[targetIndex + 1] = color[1];
      output[targetIndex + 2] = color[2];
      output[targetIndex + 3] = color[3];
    }
  }

  return sharp(output, {
    raw: {
      channels: 4,
      height: panoramaFaceSize,
      width: panoramaFaceSize
    }
  }).png().toBuffer();
}

function getScenePanoramaCenterEditMask() {
  scenePanoramaCenterEditMaskPromise ??= createScenePanoramaCenterEditMask();

  return scenePanoramaCenterEditMaskPromise;
}

async function createScenePanoramaCenterEditMask() {
  const pixels = Buffer.alloc(panoramaFaceSize * panoramaFaceSize * 4);

  for (let y = 0; y < panoramaFaceSize; y += 1) {
    for (let x = 0; x < panoramaFaceSize; x += 1) {
      const index = (y * panoramaFaceSize + x) * 4;
      const distanceToEdge = Math.min(x, y, panoramaFaceSize - 1 - x, panoramaFaceSize - 1 - y);
      const alpha = getScenePanoramaMaskAlpha(distanceToEdge);

      pixels[index] = 255;
      pixels[index + 1] = 255;
      pixels[index + 2] = 255;
      pixels[index + 3] = alpha;
    }
  }

  return sharp(pixels, {
    raw: {
      channels: 4,
      height: panoramaFaceSize,
      width: panoramaFaceSize
    }
  }).png().toBuffer();
}

function getScenePanoramaMaskAlpha(distanceToEdge: number) {
  if (distanceToEdge <= sceneFaceEditMaskLockWidth) {
    return 255;
  }

  if (distanceToEdge >= sceneFaceEditMaskLockWidth + sceneFaceEditMaskFeatherWidth) {
    return 0;
  }

  const progress = (distanceToEdge - sceneFaceEditMaskLockWidth) / sceneFaceEditMaskFeatherWidth;

  return Math.round(255 * (1 - smoothstep(progress)));
}

function getFaceDirection(face: ScenePanoramaFace, a: number, b: number): [number, number, number] {
  switch (face) {
    case "front":
      return [a, -b, 1];
    case "back":
      return [-a, -b, -1];
    case "left":
      return [-1, -b, a];
    case "right":
      return [1, -b, -a];
    case "top":
      return [a, 1, b];
    case "bottom":
      return [a, -1, -b];
  }
}

function sampleBilinear(pixels: Buffer, x: number, y: number): [number, number, number, number] {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = (x0 + 1) % normalizedPanoramaWidth;
  const y1 = Math.min(normalizedPanoramaHeight - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const c00 = readPixel(pixels, x0, y0);
  const c10 = readPixel(pixels, x1, y0);
  const c01 = readPixel(pixels, x0, y1);
  const c11 = readPixel(pixels, x1, y1);

  return [0, 1, 2, 3].map((index) =>
    Math.round(
      c00[index] * (1 - tx) * (1 - ty) +
        c10[index] * tx * (1 - ty) +
        c01[index] * (1 - tx) * ty +
        c11[index] * tx * ty
    )
  ) as [number, number, number, number];
}

function readPixel(pixels: Buffer, x: number, y: number): [number, number, number, number] {
  const index = (y * normalizedPanoramaWidth + x) * 4;

  return [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
}

function wrapCoordinate(value: number, max: number) {
  return ((value % max) + max) % max;
}

function clampCoordinate(value: number, max: number) {
  return Math.max(0, Math.min(max - 1, value));
}

function smoothstep(progress: number) {
  const value = Math.max(0, Math.min(1, progress));

  return value * value * (3 - 2 * value);
}

async function redrawScenePanoramaFaces(
  client: OpenAI,
  modelId: string,
  faces: FaceBuffer[],
  input: ScenePanoramaGenerationInput
) {
  return Promise.all(faces.map((face) => redrawScenePanoramaFaceWithRetry(client, modelId, face, input)));
}

async function redrawScenePanoramaFaceWithRetry(
  client: OpenAI,
  modelId: string,
  face: FaceBuffer,
  input: ScenePanoramaGenerationInput
) {
  let lastError: unknown = null;
  const centerEditMask = await getScenePanoramaCenterEditMask();

  for (let attempt = 1; attempt <= maxFaceRedrawAttempts; attempt += 1) {
    const fileName = `scene-panorama-${face.face}.png`;

    try {
      return await editImageBuffer(client, {
        fileName,
        image: face,
        mask: centerEditMask,
        modelId,
        prompt: buildScenePanoramaFacePrompt(input, face.face, attempt, true)
      });
    } catch (error) {
      lastError = error;

      if (isLikelyMaskUnsupportedError(error)) {
        try {
          return await editImageBuffer(client, {
            fileName,
            image: face,
            modelId,
            prompt: buildScenePanoramaFacePrompt(input, face.face, attempt, false)
          });
        } catch (fallbackError) {
          lastError = fallbackError;

          if (isLikelyImageEditUnsupportedError(fallbackError)) {
            throw fallbackError;
          }
        }

        continue;
      }

      if (isLikelyImageEditUnsupportedError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error(`SCENE_PANORAMA_FACE_REDRAW_FAILED_${face.face}`);
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

async function ensureScenePanoramaQuality(faces: FaceBuffer[]) {
  const quality = await analyzeScenePanoramaFaces(faces);

  if (quality.maxEdgeDelta > maxAllowedScenePanoramaEdgeDelta) {
    throw new Error("SCENE_PANORAMA_QUALITY_FAILED");
  }

  return quality;
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

function buildScenePanoramaFacePrompt(input: ScenePanoramaGenerationInput, face: ScenePanoramaFace, attempt: number, maskedEdit: boolean) {
  const direction = getScenePanoramaFaceDescription(face, input.locale);
  const style = getSceneStylePrompt(input.style, input.locale);
  const drawingStyle = getScenePanoramaDrawingStylePrompt(input.panoramaDrawingStyle, input.locale);

  if (input.locale === "en-US") {
    return [
      "Enhance this cubemap face for a 360-degree interactive fiction panorama.",
      "Use the input image as strict spatial reference: preserve composition, object placement, perspective, and edge continuity.",
      maskedEdit
        ? "A mask protects the seam border. Only the transparent center may be repainted; the opaque border must remain unchanged."
        : "Treat the outer 18% border as a protected seam zone: keep geometry, brightness, color temperature, horizon lines, and object silhouettes unchanged there.",
      "Only improve central texture fidelity, light quality, readable materials, and atmosphere without inventing new focal subjects.",
      "Preserve the same camera height, horizon level, focal length feeling, light direction, time-of-day, material palette, and scale as the reference.",
      "This face is one side of the same cubemap room/world, not a standalone illustration; do not restyle, recompose, crop differently, or change the scene identity.",
      "Match the same global exposure, white balance, color grading, lighting direction, and material language as the reference.",
      "Do not add, remove, resize, rotate, or move any object that touches an edge.",
      "Keep edge shadows, floor lines, wall lines, ceiling lines, sky gradients, and repeated textures aligned with neighboring faces.",
      "No text, labels, watermark, UI, or frame.",
      `Face direction: ${direction}.`,
      `Scene: ${input.sceneName}.`,
      `Scene description: ${input.sceneDescription}.`,
      `Block: ${input.blockName}.`,
      `Block description: ${input.blockDescription}.`,
      `Visual style: ${style}.`,
      `Rendering type: ${drawingStyle}.`,
      `Retry pass: ${attempt}. Keep closer to the reference if uncertain.`
    ].join("\n");
  }

  return [
    "增强这张 360 度全景六面体的单面图。",
    "必须严格参考输入图：保留构图、物体位置、透视关系和边缘连续性。",
    maskedEdit
      ? "当前编辑带有遮罩保护接缝边缘：只允许重绘透明中心区域，不要改变不透明边缘区域。"
      : "把外侧 18% 边缘视为受保护接缝区：边缘区域的几何、亮度、色温、地平线和物体轮廓都不要改变。",
    "只增强中心区域的纹理、光影、材质可读性和氛围，不要凭空新增主体。",
    "必须保留参考图的同一机位高度、同一地平线、同一镜头透视感、同一光照方向、同一时间光线、同一材质色板和同一空间比例。",
    "这张图只是同一个六面体空间的一面，不是独立插画；不要重新构图、不要换风格、不要换房间、不要改变空间身份。",
    "必须匹配参考图的统一曝光、白平衡、调色、光照方向和材质语言。",
    "不要新增、删除、缩放、旋转或移动任何触碰边缘的物体。",
    "保持边缘阴影、地面线、墙线、天花线、天空渐变和重复纹理能与相邻面接上。",
    "不要文字、标签、水印、UI 或画框。",
    `当前方向：${direction}。`,
    `场景：${input.sceneName}。`,
    `场景说明：${input.sceneDescription}。`,
    `区块：${input.blockName}。`,
    `区块说明：${input.blockDescription}。`,
    `视觉风格：${style}。`,
    `画面类型：${drawingStyle}。`,
    `重试轮次：${attempt}。如果不确定，请更贴近参考图。`
  ].join("\n");
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

function isLikelyMaskUnsupportedError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  const status = typeof error === "object" && error && "status" in error ? (error as { status?: unknown }).status : null;

  return (
    status === 400 &&
    (
      message.includes("mask") ||
      message.includes("transparent area")
    )
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
