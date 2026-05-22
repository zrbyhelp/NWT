import sharp from "sharp";

export const scenePanoramaPostprocessFaces = ["front", "back", "left", "right", "top", "bottom"] as const;

export type ScenePanoramaPostprocessFace = (typeof scenePanoramaPostprocessFaces)[number];

export type ScenePanoramaPostprocessImage = {
  bytes: Buffer;
  contentType: string;
  face: ScenePanoramaPostprocessFace;
  fileName: string;
};

export type ScenePanoramaPostprocessEdge = "top" | "right" | "bottom" | "left";

export type ScenePanoramaQualityReport = {
  averageEdgeDelta: number;
  averageInnerBandDelta: number;
  edgeDeltas: Array<{
    delta: number;
    firstEdge: ScenePanoramaPostprocessEdge;
    firstFace: ScenePanoramaPostprocessFace;
    reversed: boolean;
    secondEdge: ScenePanoramaPostprocessEdge;
    secondFace: ScenePanoramaPostprocessFace;
  }>;
  faceByteSizes: Record<ScenePanoramaPostprocessFace, number>;
  innerBandDeltas: Array<{
    bandWidth: number;
    delta: number;
    firstEdge: ScenePanoramaPostprocessEdge;
    firstFace: ScenePanoramaPostprocessFace;
    reversed: boolean;
    secondEdge: ScenePanoramaPostprocessEdge;
    secondFace: ScenePanoramaPostprocessFace;
  }>;
  largestFaceBytes: number;
  maxEdgeDelta: number;
  maxInnerBandDelta: number;
  totalBytes: number;
};

export type ScenePanoramaColorReport = {
  averageFaceColorDeltaAfter: number;
  averageFaceColorDeltaBefore: number;
  averageReferenceColorDelta: number;
  averageSeamDeltaAfter?: number;
  averageSeamDeltaBefore?: number;
  colorAlgorithm: "mother-guided-color-transfer-v1" | "whole-face-balanced-v1";
  colorAdjusted: boolean;
  colorRejected: boolean;
  faceDeltas: Array<{
    afterDelta: number;
    beforeDelta: number;
    face: ScenePanoramaPostprocessFace;
  }>;
  maxFaceColorDeltaAfter: number;
  maxFaceColorDeltaBefore: number;
  maxFaceColorDelta: number;
  maxSeamDeltaAfter?: number;
  maxSeamDeltaBefore?: number;
};

export type ScenePanoramaColorHarmonizationResult = {
  faces: ScenePanoramaPostprocessImage[];
  report: ScenePanoramaColorReport;
};

export type ScenePanoramaMotherStabilizationResult = {
  bytes: Buffer;
  contentType: string;
  fileName: string;
};

export type ScenePanoramaPostprocessOptions = {
  faceSize?: number;
  innerBandQualityWidth?: number;
  normalizedHeight?: number;
  normalizedWidth?: number;
};

const defaultFaceSize = 4096;
const maxGeneratedFaceBytes = 9_500_000;
const webpQualitySteps = [92, 86, 80, 74, 68, 60, 52, 45, 38, 32] as const;
const colorAlgorithm = "mother-guided-color-transfer-v1" as const;
const colorStatsSize = 160;
const colorLowFrequencySize = 192;
const colorLowFrequencyBlur = 2.4;
const colorLumaDetailStrength = 0.88;
const colorChromaDetailStrength = 0.12;
const colorCandidateResidualStrength = 0.08;
const colorCloseEnoughDelta = 3;
const colorGateMinimumImprovement = 1.1;
const colorGateAllowedFaceRegression = 1.5;
const colorGateAllowedSeamRegression = 2;
const colorDetailRatioMin = 0.58;
const colorDetailRatioMax = 1.55;
const colorChromaRatioMin = 0.72;
const colorChromaRatioMax = 1.28;
const seamBlendStrength = 0.42;
const seamBlendWidthRatio = 1 / 48;
const motherWrapBlendStrength = 0.45;
const motherWrapBlendWidthRatio = 0.045;
const motherMaxGeneratedBytes = 9_500_000;
const scenePanoramaAdjacentEdges: Array<{
  firstEdge: ScenePanoramaPostprocessEdge;
  firstFace: ScenePanoramaPostprocessFace;
  reversed: boolean;
  secondEdge: ScenePanoramaPostprocessEdge;
  secondFace: ScenePanoramaPostprocessFace;
}> = [
  { firstFace: "front", firstEdge: "left", secondFace: "left", secondEdge: "right", reversed: false },
  { firstFace: "front", firstEdge: "right", secondFace: "right", secondEdge: "left", reversed: false },
  { firstFace: "front", firstEdge: "top", secondFace: "top", secondEdge: "bottom", reversed: false },
  { firstFace: "front", firstEdge: "bottom", secondFace: "bottom", secondEdge: "top", reversed: false },
  { firstFace: "right", firstEdge: "right", secondFace: "back", secondEdge: "left", reversed: false },
  { firstFace: "right", firstEdge: "top", secondFace: "top", secondEdge: "right", reversed: true },
  { firstFace: "right", firstEdge: "bottom", secondFace: "bottom", secondEdge: "right", reversed: false },
  { firstFace: "left", firstEdge: "left", secondFace: "back", secondEdge: "right", reversed: false },
  { firstFace: "left", firstEdge: "top", secondFace: "top", secondEdge: "left", reversed: false },
  { firstFace: "left", firstEdge: "bottom", secondFace: "bottom", secondEdge: "left", reversed: true },
  { firstFace: "back", firstEdge: "top", secondFace: "top", secondEdge: "top", reversed: true },
  { firstFace: "back", firstEdge: "bottom", secondFace: "bottom", secondEdge: "bottom", reversed: true }
];

type RgbaImage = {
  pixels: Buffer;
  height: number;
  width: number;
};

type ColorStats = {
  contrast: number;
  high: [number, number, number];
  low: [number, number, number];
  lumaHigh: number;
  lumaLow: number;
  lumaMedian: number;
  mean: [number, number, number];
  median: [number, number, number];
  saturationMean: number;
  saturationMedian: number;
  std: [number, number, number];
};

export async function stabilizeScenePanoramaFaces(
  _referenceFaces: ScenePanoramaPostprocessImage[],
  candidateFaces: ScenePanoramaPostprocessImage[],
  options: ScenePanoramaPostprocessOptions = {}
): Promise<ScenePanoramaPostprocessImage[]> {
  const { faceSize } = resolveScenePanoramaPostprocessOptions(options);
  const stabilizedFaces: ScenePanoramaPostprocessImage[] = [];

  for (const face of scenePanoramaPostprocessFaces) {
    const candidate = candidateFaces.find((item) => item.face === face);

    if (!candidate) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    const candidateImage = await decodeFaceToRgba(candidate.bytes, faceSize);

    stabilizedFaces.push({
      ...candidate,
      bytes: await encodeRgbaToWebp(candidateImage.pixels, candidateImage.width, candidateImage.height),
      contentType: "image/webp",
      fileName: candidate.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
    });
  }

  return stabilizedFaces;
}

export async function harmonizeScenePanoramaFaceColors(
  referenceFaces: ScenePanoramaPostprocessImage[],
  candidateFaces: ScenePanoramaPostprocessImage[],
  options: ScenePanoramaPostprocessOptions = {}
): Promise<ScenePanoramaColorHarmonizationResult> {
  const { faceSize } = resolveScenePanoramaPostprocessOptions(options);
  const referenceStatsByFace = new Map<ScenePanoramaPostprocessFace, ColorStats>();
  const candidateStatsByFace = new Map<ScenePanoramaPostprocessFace, ColorStats>();

  for (const face of scenePanoramaPostprocessFaces) {
    const reference = getPostprocessFace(referenceFaces, face);
    const candidate = getPostprocessFace(candidateFaces, face);

    referenceStatsByFace.set(face, await measureFaceColorStats(reference.bytes, faceSize));
    candidateStatsByFace.set(face, await measureFaceColorStats(candidate.bytes, faceSize));
  }

  const candidateOutputFaces: ScenePanoramaPostprocessImage[] = [];
  const transferredFaces: Array<ScenePanoramaPostprocessImage & { decoded: RgbaImage }> = [];
  const faceDeltas: ScenePanoramaColorReport["faceDeltas"] = [];

  for (const face of scenePanoramaPostprocessFaces) {
    const candidate = getPostprocessFace(candidateFaces, face);
    const reference = getPostprocessFace(referenceFaces, face);
    const referenceStats = referenceStatsByFace.get(face);
    const candidateStats = candidateStatsByFace.get(face);

    if (!referenceStats || !candidateStats) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    candidateOutputFaces.push(await normalizeColorOutputFace(candidate, faceSize));
    const beforeDelta = measureColorStatsDelta(candidateStats, referenceStats);
    const decodedReference = await decodeFaceToRgba(reference.bytes, faceSize);
    const decodedCandidate = await decodeFaceToRgba(candidate.bytes, faceSize);
    const transferred = await transferFaceColorFromReference(decodedReference, decodedCandidate, faceSize);

    transferredFaces.push({
      ...candidate,
      bytes: Buffer.alloc(0),
      contentType: "image/webp",
      decoded: transferred,
      fileName: candidate.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
    });
    faceDeltas.push({
      afterDelta: beforeDelta,
      beforeDelta,
      face
    });
  }

  const seamBalancedFaces = await equalizeScenePanoramaFaceSeams(transferredFaces, faceSize);
  const harmonizedFaces: ScenePanoramaPostprocessImage[] = [];

  for (const face of scenePanoramaPostprocessFaces) {
    const image = seamBalancedFaces.find((item) => item.face === face);
    const referenceStats = referenceStatsByFace.get(face);
    const faceDelta = faceDeltas.find((item) => item.face === face);

    if (!image || !referenceStats || !faceDelta) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    const finalBytes = await encodeRgbaToWebp(image.decoded.pixels, image.decoded.width, image.decoded.height);
    const adjustedStats = await measureFaceColorStats(finalBytes, faceSize);

    faceDelta.afterDelta = measureColorStatsDelta(adjustedStats, referenceStats);
    harmonizedFaces.push({
      ...image,
      bytes: finalBytes,
      contentType: "image/webp",
      fileName: image.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
    });
  }

  const seamQualityBefore = await measureColorGateSeamQuality(candidateOutputFaces, faceSize);
  const seamQualityAfter = await measureColorGateSeamQuality(harmonizedFaces, faceSize);
  const averageFaceColorDeltaBefore = faceDeltas.reduce((sum, item) => sum + item.beforeDelta, 0) / Math.max(1, faceDeltas.length);
  const averageFaceColorDeltaAfter = faceDeltas.reduce((sum, item) => sum + item.afterDelta, 0) / Math.max(1, faceDeltas.length);
  const maxFaceColorDeltaBefore = Math.max(...faceDeltas.map((item) => item.beforeDelta));
  const maxFaceColorDeltaAfter = Math.max(...faceDeltas.map((item) => item.afterDelta));
  const shouldApply = shouldApplyColorHarmonization(
    faceDeltas,
    averageFaceColorDeltaBefore,
    averageFaceColorDeltaAfter,
    maxFaceColorDeltaBefore,
    maxFaceColorDeltaAfter,
    seamQualityBefore,
    seamQualityAfter
  );

  if (!shouldApply) {
    const isAlreadyClose =
      averageFaceColorDeltaBefore <= colorCloseEnoughDelta &&
      maxFaceColorDeltaBefore <= colorCloseEnoughDelta * 1.5;
    const fallbackFaceDeltas = faceDeltas.map((item) => ({
      ...item,
      afterDelta: item.beforeDelta
    }));

    return {
      faces: candidateOutputFaces,
      report: {
        averageFaceColorDeltaAfter: averageFaceColorDeltaBefore,
        averageFaceColorDeltaBefore,
        averageReferenceColorDelta: averageFaceColorDeltaBefore,
        averageSeamDeltaAfter: seamQualityBefore.average,
        averageSeamDeltaBefore: seamQualityBefore.average,
        colorAlgorithm,
        colorAdjusted: false,
        colorRejected: !isAlreadyClose,
        faceDeltas: fallbackFaceDeltas,
        maxFaceColorDeltaAfter: maxFaceColorDeltaBefore,
        maxFaceColorDeltaBefore,
        maxFaceColorDelta: maxFaceColorDeltaBefore,
        maxSeamDeltaAfter: seamQualityBefore.max,
        maxSeamDeltaBefore: seamQualityBefore.max
      }
    };
  }

  return {
    faces: harmonizedFaces,
    report: {
      averageFaceColorDeltaAfter,
      averageFaceColorDeltaBefore,
      averageReferenceColorDelta: averageFaceColorDeltaAfter,
      averageSeamDeltaAfter: seamQualityAfter.average,
      averageSeamDeltaBefore: seamQualityBefore.average,
      colorAlgorithm,
      colorAdjusted: faceDeltas.some((item) => item.afterDelta < item.beforeDelta - 0.5),
      colorRejected: false,
      faceDeltas,
      maxFaceColorDeltaAfter,
      maxFaceColorDeltaBefore,
      maxFaceColorDelta: maxFaceColorDeltaAfter,
      maxSeamDeltaAfter: seamQualityAfter.max,
      maxSeamDeltaBefore: seamQualityBefore.max
    }
  };
}

export async function stabilizeScenePanoramaMotherImage(
  image: Pick<ScenePanoramaPostprocessImage, "bytes" | "contentType" | "fileName">,
  options: ScenePanoramaPostprocessOptions = {}
): Promise<ScenePanoramaMotherStabilizationResult> {
  const normalizedWidth = options.normalizedWidth ?? 4096;
  const normalizedHeight = options.normalizedHeight ?? 2048;
  const decoded = await decodeEquirectangularToRgba(image.bytes, normalizedWidth, normalizedHeight);
  const stabilized = stabilizeEquirectangularWrapSeam(decoded);
  const bytes = await encodeRgbaToWebpWithLimit(stabilized.pixels, stabilized.width, stabilized.height, motherMaxGeneratedBytes);

  return {
    bytes,
    contentType: "image/webp",
    fileName: image.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
  };
}

export async function analyzeScenePanoramaFaces(
  faces: ScenePanoramaPostprocessImage[],
  options: ScenePanoramaPostprocessOptions = {}
): Promise<ScenePanoramaQualityReport> {
  const { faceSize, innerBandQualityWidth } = resolveScenePanoramaPostprocessOptions(options);
  const faceByteSizes = scenePanoramaPostprocessFaces.reduce<Record<ScenePanoramaPostprocessFace, number>>((result, face) => {
    const image = faces.find((item) => item.face === face);

    if (!image) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    result[face] = image.bytes.byteLength;

    return result;
  }, {} as Record<ScenePanoramaPostprocessFace, number>);
  const decodedFaces = await decodeScenePanoramaFaces(faces, faceSize);
  const edgeDeltas = scenePanoramaAdjacentEdges.map((edge) => {
    const first = getDecodedFaceImage(decodedFaces, edge.firstFace);
    const second = getDecodedFaceImage(decodedFaces, edge.secondFace);

    return {
      ...edge,
      delta: measureFaceEdgeDeltaBetween(first, second, edge.firstEdge, edge.secondEdge, edge.reversed, faceSize)
    };
  });
  const innerBandDeltas = scenePanoramaAdjacentEdges.map((edge) => {
    const first = getDecodedFaceImage(decodedFaces, edge.firstFace);
    const second = getDecodedFaceImage(decodedFaces, edge.secondFace);

    return {
      ...edge,
      bandWidth: innerBandQualityWidth,
      delta: measureFaceInnerBandDeltaBetween(
        first,
        second,
        edge.firstEdge,
        edge.secondEdge,
        edge.reversed,
        faceSize,
        innerBandQualityWidth
      )
    };
  });
  const totalBytes = Object.values(faceByteSizes).reduce((sum, size) => sum + size, 0);
  const maxEdgeDelta = Math.max(...edgeDeltas.map((edge) => edge.delta));
  const maxInnerBandDelta = Math.max(...innerBandDeltas.map((edge) => edge.delta));

  return {
    averageEdgeDelta: edgeDeltas.reduce((sum, edge) => sum + edge.delta, 0) / Math.max(1, edgeDeltas.length),
    averageInnerBandDelta: innerBandDeltas.reduce((sum, edge) => sum + edge.delta, 0) / Math.max(1, innerBandDeltas.length),
    edgeDeltas,
    faceByteSizes,
    innerBandDeltas,
    largestFaceBytes: Math.max(...Object.values(faceByteSizes)),
    maxEdgeDelta,
    maxInnerBandDelta,
    totalBytes
  };
}

export async function measureFaceEdgeDelta(
  firstBytes: Buffer,
  secondBytes: Buffer,
  edge: ScenePanoramaPostprocessEdge,
  options: ScenePanoramaPostprocessOptions = {}
) {
  const { faceSize } = resolveScenePanoramaPostprocessOptions(options);
  const first = await decodeFaceToRgba(firstBytes, faceSize);
  const second = await decodeFaceToRgba(secondBytes, faceSize);

  return measureFaceEdgeDeltaBetween(first, second, edge, edge, false, faceSize);
}

function measureFaceEdgeDeltaBetween(
  first: RgbaImage,
  second: RgbaImage,
  firstEdge: ScenePanoramaPostprocessEdge,
  secondEdge: ScenePanoramaPostprocessEdge,
  reverseSecondEdge: boolean,
  faceSize: number
) {
  let total = 0;
  let count = 0;

  for (let i = 0; i < faceSize; i += 1) {
    const secondOffset = reverseSecondEdge ? faceSize - 1 - i : i;
    const [firstX, firstY] = getEdgePixelPosition(firstEdge, i, first.width, first.height);
    const [secondX, secondY] = getEdgePixelPosition(secondEdge, secondOffset, second.width, second.height);
    const firstIndex = (firstY * first.width + firstX) * 4;
    const secondIndex = (secondY * second.width + secondX) * 4;

    total += Math.abs(first.pixels[firstIndex] - second.pixels[secondIndex]);
    total += Math.abs(first.pixels[firstIndex + 1] - second.pixels[secondIndex + 1]);
    total += Math.abs(first.pixels[firstIndex + 2] - second.pixels[secondIndex + 2]);
    count += 3;
  }

  return total / Math.max(1, count);
}

function measureFaceInnerBandDeltaBetween(
  first: RgbaImage,
  second: RgbaImage,
  firstEdge: ScenePanoramaPostprocessEdge,
  secondEdge: ScenePanoramaPostprocessEdge,
  reverseSecondEdge: boolean,
  faceSize: number,
  bandWidth: number
) {
  let total = 0;
  let count = 0;

  for (let depth = 0; depth < bandWidth; depth += 1) {
    for (let i = 0; i < faceSize; i += 1) {
      const secondOffset = reverseSecondEdge ? faceSize - 1 - i : i;
      const [firstX, firstY] = getInnerBandPixelPosition(firstEdge, i, depth, first.width, first.height);
      const [secondX, secondY] = getInnerBandPixelPosition(secondEdge, secondOffset, depth, second.width, second.height);
      const firstIndex = (firstY * first.width + firstX) * 4;
      const secondIndex = (secondY * second.width + secondX) * 4;

      total += Math.abs(first.pixels[firstIndex] - second.pixels[secondIndex]);
      total += Math.abs(first.pixels[firstIndex + 1] - second.pixels[secondIndex + 1]);
      total += Math.abs(first.pixels[firstIndex + 2] - second.pixels[secondIndex + 2]);
      count += 3;
    }
  }

  return total / Math.max(1, count);
}

async function decodeScenePanoramaFaces(faces: ScenePanoramaPostprocessImage[], faceSize: number) {
  const decodedFaces = new Map<ScenePanoramaPostprocessFace, RgbaImage>();

  for (const face of scenePanoramaPostprocessFaces) {
    const image = faces.find((item) => item.face === face);

    if (!image) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    decodedFaces.set(face, await decodeFaceToRgba(image.bytes, faceSize));
  }

  return decodedFaces;
}

function getDecodedFaceImage(faces: Map<ScenePanoramaPostprocessFace, RgbaImage>, face: ScenePanoramaPostprocessFace) {
  const image = faces.get(face);

  if (!image) {
    throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
  }

  return image;
}

function getPostprocessFace(faces: ScenePanoramaPostprocessImage[], face: ScenePanoramaPostprocessFace) {
  const image = faces.find((item) => item.face === face);

  if (!image) {
    throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
  }

  return image;
}

async function transferFaceColorFromReference(reference: RgbaImage, candidate: RgbaImage, faceSize: number): Promise<RgbaImage> {
  const lowSize = Math.min(colorLowFrequencySize, Math.max(32, Math.round(faceSize / 8)));
  const referenceLow = await createLowFrequencyColorMap(reference, lowSize);
  const candidateLow = await createLowFrequencyColorMap(candidate, lowSize);
  const output = Buffer.alloc(faceSize * faceSize * 4);

  for (let y = 0; y < faceSize; y += 1) {
    for (let x = 0; x < faceSize; x += 1) {
      const index = (y * faceSize + x) * 4;
      const referencePixel = sampleLowFrequencyPixel(referenceLow, x, y, faceSize, lowSize);
      const candidatePixel = [
        candidate.pixels[index],
        candidate.pixels[index + 1],
        candidate.pixels[index + 2]
      ] as [number, number, number];
      const candidateLowPixel = sampleLowFrequencyPixel(candidateLow, x, y, faceSize, lowSize);
      const referenceLuma = Math.max(1, measureRgbLuma(referencePixel));
      const candidateLuma = measureRgbLuma(candidatePixel);
      const candidateLowLuma = Math.max(8, measureRgbLuma(candidateLowPixel));
      const detailRatio = clamp(candidateLuma / candidateLowLuma, colorDetailRatioMin, colorDetailRatioMax);
      const targetLuma = referenceLuma * (1 + (detailRatio - 1) * colorLumaDetailStrength);
      const lumaScale = targetLuma / referenceLuma;

      for (let channel = 0; channel < 3; channel += 1) {
        const referenceChannel = referencePixel[channel];
        const candidateChannel = candidatePixel[channel];
        const candidateLowChannel = Math.max(8, candidateLowPixel[channel]);
        const chromaRatio = clamp(candidateChannel / candidateLowChannel, colorChromaRatioMin, colorChromaRatioMax);
        const chromaGuided = referenceChannel * lumaScale * (1 + (chromaRatio - 1) * colorChromaDetailStrength);
        const residualGuided = (candidateChannel - candidateLowPixel[channel]) * colorCandidateResidualStrength;

        output[index + channel] = Math.round(clamp(chromaGuided + residualGuided, 0, 255));
      }
      output[index + 3] = candidate.pixels[index + 3] || 255;
    }
  }

  return {
    pixels: output,
    height: faceSize,
    width: faceSize
  };
}

async function createLowFrequencyColorMap(image: RgbaImage, lowSize: number) {
  return createSharpRgbaInput(image.pixels, image.width, image.height)
    .resize(lowSize, lowSize, { fit: "fill", kernel: "lanczos3" })
    .blur(colorLowFrequencyBlur)
    .ensureAlpha()
    .raw()
    .toBuffer();
}

function sampleLowFrequencyPixel(
  pixels: Buffer,
  x: number,
  y: number,
  faceSize: number,
  lowSize: number
): [number, number, number] {
  const lowX = (x + 0.5) * lowSize / faceSize - 0.5;
  const lowY = (y + 0.5) * lowSize / faceSize - 0.5;
  const x0 = clamp(Math.floor(lowX), 0, lowSize - 1);
  const y0 = clamp(Math.floor(lowY), 0, lowSize - 1);
  const x1 = clamp(x0 + 1, 0, lowSize - 1);
  const y1 = clamp(y0 + 1, 0, lowSize - 1);
  const tx = clamp(lowX - x0, 0, 1);
  const ty = clamp(lowY - y0, 0, 1);
  const c00 = readRgbPixel(pixels, x0, y0, lowSize);
  const c10 = readRgbPixel(pixels, x1, y0, lowSize);
  const c01 = readRgbPixel(pixels, x0, y1, lowSize);
  const c11 = readRgbPixel(pixels, x1, y1, lowSize);

  return [0, 1, 2].map((channel) =>
    c00[channel] * (1 - tx) * (1 - ty) +
      c10[channel] * tx * (1 - ty) +
      c01[channel] * (1 - tx) * ty +
      c11[channel] * tx * ty
  ) as [number, number, number];
}

async function equalizeScenePanoramaFaceSeams(
  faces: Array<ScenePanoramaPostprocessImage & { decoded: RgbaImage }>,
  faceSize: number
) {
  const balancedFaces = faces.map((face) => ({
    ...face,
    decoded: {
      ...face.decoded,
      pixels: Buffer.from(face.decoded.pixels)
    }
  }));
  const decodedByFace = new Map(balancedFaces.map((face) => [face.face, face.decoded]));
  const bandWidth = Math.max(4, Math.round(faceSize * seamBlendWidthRatio));

  scenePanoramaAdjacentEdges.forEach((edge) => {
    const first = decodedByFace.get(edge.firstFace);
    const second = decodedByFace.get(edge.secondFace);

    if (!first || !second) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${edge.firstFace}`);
    }

    for (let depth = 0; depth < bandWidth; depth += 1) {
      const depthWeight = seamBlendStrength * Math.pow(1 - depth / bandWidth, 2);

      for (let offset = 0; offset < faceSize; offset += 1) {
        const secondOffset = edge.reversed ? faceSize - 1 - offset : offset;
        const [firstX, firstY] = getInnerBandPixelPosition(edge.firstEdge, offset, depth, faceSize, faceSize);
        const [secondX, secondY] = getInnerBandPixelPosition(edge.secondEdge, secondOffset, depth, faceSize, faceSize);
        const firstIndex = (firstY * faceSize + firstX) * 4;
        const secondIndex = (secondY * faceSize + secondX) * 4;

        for (let channel = 0; channel < 3; channel += 1) {
          const firstValue = first.pixels[firstIndex + channel];
          const secondValue = second.pixels[secondIndex + channel];
          const target = (firstValue + secondValue) / 2;

          first.pixels[firstIndex + channel] = Math.round(clamp(firstValue + (target - firstValue) * depthWeight, 0, 255));
          second.pixels[secondIndex + channel] = Math.round(clamp(secondValue + (target - secondValue) * depthWeight, 0, 255));
        }
      }
    }
  });

  return balancedFaces;
}

async function measureColorGateSeamQuality(faces: ScenePanoramaPostprocessImage[], faceSize: number) {
  const gateFaceSize = Math.min(faceSize, 512);
  const report = await analyzeScenePanoramaFaces(faces, {
    faceSize: gateFaceSize,
    innerBandQualityWidth: Math.max(4, Math.round(gateFaceSize / 32))
  });

  return {
    average: (report.averageEdgeDelta + report.averageInnerBandDelta) / 2,
    max: Math.max(report.maxEdgeDelta, report.maxInnerBandDelta)
  };
}

async function decodeEquirectangularToRgba(bytes: Buffer, width: number, height: number): Promise<RgbaImage> {
  const pixels = await sharp(bytes)
    .resize(width, height, { fit: "fill" })
    .toColorspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer();

  return {
    pixels,
    height,
    width
  };
}

function stabilizeEquirectangularWrapSeam(image: RgbaImage): RgbaImage {
  const output = Buffer.from(image.pixels);
  const bandWidth = Math.max(8, Math.round(image.width * motherWrapBlendWidthRatio));

  for (let y = 0; y < image.height; y += 1) {
    for (let depth = 0; depth < bandWidth; depth += 1) {
      const weight = motherWrapBlendStrength * Math.pow(1 - depth / bandWidth, 2);
      const leftX = depth;
      const rightX = image.width - 1 - depth;
      const leftIndex = (y * image.width + leftX) * 4;
      const rightIndex = (y * image.width + rightX) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const left = output[leftIndex + channel];
        const right = output[rightIndex + channel];
        const target = (left + right) / 2;

        output[leftIndex + channel] = Math.round(clamp(left + (target - left) * weight, 0, 255));
        output[rightIndex + channel] = Math.round(clamp(right + (target - right) * weight, 0, 255));
      }
    }
  }

  return {
    ...image,
    pixels: output
  };
}

async function measureFaceColorStats(bytes: Buffer, faceSize: number): Promise<ColorStats> {
  const statsWidth = Math.min(colorStatsSize, faceSize);
  const pixels = await sharp(bytes)
    .resize(statsWidth, statsWidth, { fit: "fill" })
    .toColorspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer();
  const samples = collectColorSamples(pixels);
  const lumaValues = samples.map((sample) => sample.luma).sort((first, second) => first - second);
  const lumaLowCut = getPercentile(lumaValues, 0.08);
  const lumaHighCut = getPercentile(lumaValues, 0.92);
  const shouldFilterExtremes = lumaHighCut - lumaLowCut >= 8;
  const filteredSamples = shouldFilterExtremes
    ? samples.filter((sample) => sample.luma >= lumaLowCut && sample.luma <= lumaHighCut)
    : samples;
  const selectedSamples = filteredSamples.length >= Math.max(16, samples.length * 0.2) ? filteredSamples : samples;
  const channelValues = [[], [], []] as [number[], number[], number[]];
  const selectedLumaValues: number[] = [];
  const selectedSaturationValues: number[] = [];

  selectedSamples.forEach((sample) => {
    channelValues[0].push(sample.r);
    channelValues[1].push(sample.g);
    channelValues[2].push(sample.b);
    selectedLumaValues.push(sample.luma);
    selectedSaturationValues.push(sample.saturation);
  });
  channelValues.forEach((values) => values.sort((first, second) => first - second));
  selectedLumaValues.sort((first, second) => first - second);
  selectedSaturationValues.sort((first, second) => first - second);

  const mean = channelValues.map(getMean) as [number, number, number];
  const std = channelValues.map((values, channel) => getStandardDeviation(values, mean[channel])) as [number, number, number];
  const low = channelValues.map((values) => getPercentile(values, 0.12)) as [number, number, number];
  const high = channelValues.map((values) => getPercentile(values, 0.88)) as [number, number, number];
  const lumaLow = getPercentile(selectedLumaValues, 0.12);
  const lumaHigh = getPercentile(selectedLumaValues, 0.88);

  return {
    contrast: lumaHigh - lumaLow,
    high,
    low,
    lumaHigh,
    lumaLow,
    lumaMedian: getPercentile(selectedLumaValues, 0.5),
    mean,
    median: channelValues.map((values) => getPercentile(values, 0.5)) as [number, number, number],
    saturationMean: getMean(selectedSaturationValues),
    saturationMedian: getPercentile(selectedSaturationValues, 0.5),
    std
  };
}

function measureColorStatsDelta(first: ColorStats, second: ColorStats) {
  let medianRgbDelta = 0;

  for (let channel = 0; channel < 3; channel += 1) {
    medianRgbDelta += Math.abs(first.median[channel] - second.median[channel]);
  }
  medianRgbDelta /= 3;
  const lumaDelta = Math.abs(first.lumaMedian - second.lumaMedian);
  const contrastDelta = Math.abs(first.contrast - second.contrast);
  const saturationDelta = Math.abs(first.saturationMedian - second.saturationMedian) * 100;

  return medianRgbDelta * 0.68 + lumaDelta * 0.18 + contrastDelta * 0.08 + saturationDelta * 0.06;
}

function shouldApplyColorHarmonization(
  faceDeltas: ScenePanoramaColorReport["faceDeltas"],
  averageBefore: number,
  averageAfter: number,
  maxBefore: number,
  maxAfter: number,
  seamBefore: { average: number; max: number },
  seamAfter: { average: number; max: number }
) {
  if (averageBefore <= colorCloseEnoughDelta) {
    return false;
  }

  return (
    averageAfter <= averageBefore - colorGateMinimumImprovement &&
    maxAfter <= maxBefore - colorGateMinimumImprovement &&
    seamAfter.average <= seamBefore.average + colorGateAllowedSeamRegression &&
    seamAfter.max <= seamBefore.max + colorGateAllowedSeamRegression * 1.5 &&
    faceDeltas.every((item) => item.afterDelta <= item.beforeDelta + colorGateAllowedFaceRegression)
  );
}

async function normalizeColorOutputFace(
  face: ScenePanoramaPostprocessImage,
  faceSize: number
): Promise<ScenePanoramaPostprocessImage> {
  if (face.contentType === "image/webp" && face.bytes.byteLength <= maxGeneratedFaceBytes) {
    return face;
  }

  const image = await decodeFaceToRgba(face.bytes, faceSize);

  return {
    ...face,
    bytes: await encodeRgbaToWebp(image.pixels, image.width, image.height),
    contentType: "image/webp",
    fileName: face.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
  };
}

function collectColorSamples(pixels: Buffer) {
  const samples: Array<{ b: number; g: number; luma: number; r: number; saturation: number }> = [];

  for (let index = 0; index < pixels.length; index += 3) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    samples.push({
      b,
      g,
      luma: 0.2126 * r + 0.7152 * g + 0.0722 * b,
      r,
      saturation: max <= 0 ? 0 : (max - min) / max
    });
  }

  return samples;
}

function getMean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function getStandardDeviation(values: number[], mean: number) {
  const variance = values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / Math.max(1, values.length);

  return Math.sqrt(Math.max(0, variance));
}

function getPercentile(sortedValues: number[], percentile: number) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const clampedPercentile = clamp(percentile, 0, 1);
  const position = (sortedValues.length - 1) * clampedPercentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lowerValue = sortedValues[lowerIndex] ?? sortedValues[0] ?? 0;
  const upperValue = sortedValues[upperIndex] ?? lowerValue;

  return lowerValue + (upperValue - lowerValue) * (position - lowerIndex);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveScenePanoramaPostprocessOptions(options: ScenePanoramaPostprocessOptions) {
  const faceSize = options.faceSize ?? defaultFaceSize;
  const innerBandQualityWidth = options.innerBandQualityWidth ?? Math.max(4, Math.round(faceSize / 32));

  return {
    faceSize,
    innerBandQualityWidth
  };
}

async function decodeFaceToRgba(bytes: Buffer, faceSize: number): Promise<RgbaImage> {
  const pixels = await sharp(bytes)
    .resize(faceSize, faceSize, { fit: "fill" })
    .toColorspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer();

  return {
    pixels,
    height: faceSize,
    width: faceSize
  };
}

async function encodeRgbaToWebp(pixels: Buffer, width: number, height: number) {
  return encodeRgbaToWebpWithLimit(pixels, width, height, maxGeneratedFaceBytes);
}

async function encodeRgbaToWebpWithLimit(pixels: Buffer, width: number, height: number, maxBytes: number) {
  let smallest: Buffer | null = null;

  for (const quality of webpQualitySteps) {
    const encoded = await createSharpRgbaInput(pixels, width, height)
      .webp({
        effort: 4,
        quality,
        smartSubsample: true
      })
      .toBuffer();

    smallest = encoded;

    if (encoded.byteLength <= maxBytes) {
      return encoded;
    }
  }

  return smallest ?? Buffer.alloc(0);
}

function createSharpRgbaInput(pixels: Buffer, width: number, height: number) {
  return sharp(pixels, {
    raw: {
      channels: 4,
      height,
      width
    }
  });
}

function readRgbPixel(pixels: Buffer, x: number, y: number, width: number): [number, number, number] {
  const index = (y * width + x) * 4;

  return [pixels[index], pixels[index + 1], pixels[index + 2]];
}

function measureRgbLuma([r, g, b]: [number, number, number]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getEdgePixelPosition(edge: ScenePanoramaPostprocessEdge, offset: number, width: number, height: number): [number, number] {
  switch (edge) {
    case "top":
      return [offset, 0];
    case "right":
      return [width - 1, offset];
    case "bottom":
      return [offset, height - 1];
    case "left":
      return [0, offset];
  }
}

function getInnerBandPixelPosition(
  edge: ScenePanoramaPostprocessEdge,
  offset: number,
  depth: number,
  width: number,
  height: number
): [number, number] {
  switch (edge) {
    case "top":
      return [offset, depth];
    case "right":
      return [width - 1 - depth, offset];
    case "bottom":
      return [offset, height - 1 - depth];
    case "left":
      return [depth, offset];
  }
}
