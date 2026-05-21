import "server-only";

import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { getDefaultImageRuntimeConfig } from "@/lib/ai/model-config";
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
const maxFaceRedrawAttempts = 3;

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
      const repairedFaces = await repairScenePanoramaSeams(client, config.modelId, enhancedFaces, input);
      const faces = faceBuffersToResult(repairedFaces);

      updateAiObservation(span, {
        metadata: {
          faceCount: scenePanoramaFaces.length,
          mode: "enhanced",
          repaired: true
        },
        output: {
          faceCount: scenePanoramaFaces.length,
          mode: "enhanced",
          repaired: true
        }
      });

      return {
        faces,
        mode: "enhanced",
        repaired: true
      };
    } catch (error) {
      if (!isLikelyImageEditUnsupportedError(error)) {
        throw error;
      }

      const faces = faceBuffersToResult(baseFaces);

      updateAiObservation(span, {
        metadata: {
          editFallbackReason: getErrorMessage(error),
          faceCount: scenePanoramaFaces.length,
          mode: "direct-cut",
          repaired: false
        },
        output: {
          faceCount: scenePanoramaFaces.length,
          mode: "direct-cut",
          repaired: false
        }
      });

      return {
        faces,
        mode: "direct-cut",
        repaired: false
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
  const edited = (await client.images.edit({
    image: imageFile,
    input_fidelity: "high",
    mask: maskFile,
    model: modelId,
    n: 1,
    output_format: "png",
    prompt,
    quality: "high",
    size: "1024x1024"
  } as Parameters<typeof client.images.edit>[0])) as { data?: Array<{ b64_json?: string; url?: string }> };

  return {
    ...(await extractImageBuffer(client, edited, fileName, image.face)),
    face: image.face,
    fileName
  };
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

  for (let attempt = 1; attempt <= maxFaceRedrawAttempts; attempt += 1) {
    try {
      return await editImageBuffer(client, {
        fileName: `scene-panorama-${face.face}.png`,
        image: face,
        modelId,
        prompt: buildScenePanoramaFacePrompt(input, face.face, attempt)
      });
    } catch (error) {
      lastError = error;

      if (isLikelyImageEditUnsupportedError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error(`SCENE_PANORAMA_FACE_REDRAW_FAILED_${face.face}`);
}

async function repairScenePanoramaSeams(
  client: OpenAI,
  modelId: string,
  faces: FaceBuffer[],
  input: ScenePanoramaGenerationInput
) {
  const repairMask = await createSeamRepairMask();

  return Promise.all(
    faces.map(async (face) =>
      editImageBuffer(client, {
        fileName: `scene-panorama-${face.face}.png`,
        image: face,
        mask: repairMask,
        modelId,
        prompt: buildScenePanoramaSeamRepairPrompt(input, face.face)
      })
    )
  );
}

async function createSeamRepairMask() {
  const border = 96;
  const opaque = Buffer.from([255, 255, 255, 255]);
  const transparent = Buffer.from([0, 0, 0, 0]);
  const pixels = Buffer.alloc(panoramaFaceSize * panoramaFaceSize * 4);

  for (let y = 0; y < panoramaFaceSize; y += 1) {
    for (let x = 0; x < panoramaFaceSize; x += 1) {
      const isBorder = x < border || y < border || x >= panoramaFaceSize - border || y >= panoramaFaceSize - border;
      const color = isBorder ? transparent : opaque;

      color.copy(pixels, (y * panoramaFaceSize + x) * 4);
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

function buildScenePanoramaMotherPrompt(input: ScenePanoramaGenerationInput) {
  const style = getSceneStylePrompt(input.style, input.locale);
  const drawingStyle = getScenePanoramaDrawingStylePrompt(input.panoramaDrawingStyle, input.locale);

  if (input.locale === "en-US") {
    return [
      "Create one seamless 360-degree equirectangular panorama master image for an interactive fiction scene.",
      "The image must represent a complete interior or exterior space that can wrap horizontally.",
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
  const style = getSceneStylePrompt(input.style, input.locale);
  const drawingStyle = getScenePanoramaDrawingStylePrompt(input.panoramaDrawingStyle, input.locale);

  if (input.locale === "en-US") {
    return [
      "Enhance this cubemap face for a 360-degree interactive fiction panorama.",
      "Use the input image as strict spatial reference: preserve composition, object placement, perspective, and edge continuity.",
      "Improve texture fidelity, light quality, readable materials, and atmosphere without inventing new focal subjects.",
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
    "只增强纹理、光影、材质可读性和氛围，不要凭空新增主体。",
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

function buildScenePanoramaSeamRepairPrompt(input: ScenePanoramaGenerationInput, face: ScenePanoramaFace) {
  const direction = getScenePanoramaFaceDescription(face, input.locale);
  const drawingStyle = getScenePanoramaDrawingStylePrompt(input.panoramaDrawingStyle, input.locale);

  if (input.locale === "en-US") {
    return [
      "Repair only the transparent border mask area of this cubemap face.",
      "Keep the center unchanged. Smooth edge lighting, texture direction, and perspective so this face joins neighboring cubemap faces naturally.",
      "Do not add new objects, text, labels, UI, watermark, or frame.",
      `Face direction: ${direction}.`,
      `Scene: ${input.sceneName}. Block: ${input.blockName}.`,
      `Rendering type: ${drawingStyle}.`
    ].join("\n");
  }

  return [
    "只修复这张六面体图透明遮罩覆盖的边缘区域。",
    "保持中心区域不变。让边缘光照、纹理方向和透视自然衔接相邻面。",
    "不要新增物体、文字、标签、UI、水印或画框。",
    `当前方向：${direction}。`,
    `场景：${input.sceneName}。区块：${input.blockName}。`,
    `画面类型：${drawingStyle}。`
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
    status === 400 ||
    status === 404 ||
    message.includes("not support") ||
    message.includes("unsupported") ||
    message.includes("unknown url") ||
    message.includes("invalid endpoint") ||
    message.includes("image edit")
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
