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
  averageReferenceColorDelta: number;
  colorAdjusted: boolean;
  faceDeltas: Array<{
    afterDelta: number;
    beforeDelta: number;
    face: ScenePanoramaPostprocessFace;
  }>;
  maxFaceColorDelta: number;
};

export type ScenePanoramaColorHarmonizationResult = {
  faces: ScenePanoramaPostprocessImage[];
  report: ScenePanoramaColorReport;
};

export type ScenePanoramaPostprocessOptions = {
  faceSize?: number;
  innerBandQualityWidth?: number;
};

const defaultFaceSize = 4096;
const maxGeneratedFaceBytes = 9_500_000;
const webpQualitySteps = [92, 86, 80, 74, 68] as const;
const colorStatsSize = 96;
const colorMeanBlendStrength = 0.35;
const colorStdBlendStrength = 0.25;
const maxColorOffset = 18;
const maxColorGainShift = 0.1;

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
  mean: [number, number, number];
  std: [number, number, number];
};

type ColorAdjustment = {
  gain: [number, number, number, number];
  offset: [number, number, number, number];
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

  const referenceGlobalStats = averageColorStats(Array.from(referenceStatsByFace.values()));
  const harmonizedFaces: ScenePanoramaPostprocessImage[] = [];
  const faceDeltas: ScenePanoramaColorReport["faceDeltas"] = [];

  for (const face of scenePanoramaPostprocessFaces) {
    const candidate = getPostprocessFace(candidateFaces, face);
    const referenceStats = referenceStatsByFace.get(face);
    const candidateStats = candidateStatsByFace.get(face);

    if (!referenceStats || !candidateStats) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    const targetStats = blendColorStats(referenceStats, referenceGlobalStats, 0.3);
    const beforeDelta = measureColorStatsDelta(candidateStats, targetStats);
    const adjustment = buildColorAdjustment(candidateStats, targetStats);
    const adjustedBytes = await sharp(candidate.bytes)
      .resize(faceSize, faceSize, { fit: "fill" })
      .toColorspace("srgb")
      .ensureAlpha()
      .linear(adjustment.gain, adjustment.offset)
      .webp({
        effort: 4,
        quality: 92,
        smartSubsample: true
      })
      .toBuffer();
    const estimatedAfterStats = applyColorAdjustmentToStats(candidateStats, adjustment);
    const afterDelta = measureColorStatsDelta(estimatedAfterStats, targetStats);

    harmonizedFaces.push({
      ...candidate,
      bytes: adjustedBytes.byteLength <= maxGeneratedFaceBytes
        ? adjustedBytes
        : await encodeRgbaToWebp((await decodeFaceToRgba(adjustedBytes, faceSize)).pixels, faceSize, faceSize),
      contentType: "image/webp",
      fileName: candidate.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
    });
    faceDeltas.push({
      afterDelta,
      beforeDelta,
      face
    });
  }

  return {
    faces: harmonizedFaces,
    report: {
      averageReferenceColorDelta: faceDeltas.reduce((sum, item) => sum + item.afterDelta, 0) / Math.max(1, faceDeltas.length),
      colorAdjusted: faceDeltas.some((item) => item.afterDelta < item.beforeDelta - 0.5),
      faceDeltas,
      maxFaceColorDelta: Math.max(...faceDeltas.map((item) => item.afterDelta))
    }
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

async function measureFaceColorStats(bytes: Buffer, faceSize: number): Promise<ColorStats> {
  const statsWidth = Math.min(colorStatsSize, faceSize);
  const pixels = await sharp(bytes)
    .resize(statsWidth, statsWidth, { fit: "fill" })
    .toColorspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer();
  const pixelCount = Math.max(1, pixels.length / 3);
  const sums: [number, number, number] = [0, 0, 0];
  const squaredSums: [number, number, number] = [0, 0, 0];

  for (let index = 0; index < pixels.length; index += 3) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = pixels[index + channel];

      sums[channel] += value;
      squaredSums[channel] += value * value;
    }
  }

  const mean = sums.map((sum) => sum / pixelCount) as [number, number, number];
  const std = squaredSums.map((sum, channel) => Math.sqrt(Math.max(0, sum / pixelCount - mean[channel] * mean[channel]))) as [
    number,
    number,
    number
  ];

  return { mean, std };
}

function averageColorStats(stats: ColorStats[]): ColorStats {
  const count = Math.max(1, stats.length);
  const mean = [0, 0, 0] as [number, number, number];
  const std = [0, 0, 0] as [number, number, number];

  stats.forEach((item) => {
    for (let channel = 0; channel < 3; channel += 1) {
      mean[channel] += item.mean[channel] / count;
      std[channel] += item.std[channel] / count;
    }
  });

  return { mean, std };
}

function blendColorStats(first: ColorStats, second: ColorStats, secondWeight: number): ColorStats {
  const clampedWeight = Math.max(0, Math.min(1, secondWeight));
  const firstWeight = 1 - clampedWeight;

  return {
    mean: first.mean.map((value, channel) => value * firstWeight + second.mean[channel] * clampedWeight) as [
      number,
      number,
      number
    ],
    std: first.std.map((value, channel) => value * firstWeight + second.std[channel] * clampedWeight) as [
      number,
      number,
      number
    ]
  };
}

function buildColorAdjustment(candidateStats: ColorStats, targetStats: ColorStats): ColorAdjustment {
  const gain = [1, 1, 1, 1] as [number, number, number, number];
  const offset = [0, 0, 0, 0] as [number, number, number, number];

  for (let channel = 0; channel < 3; channel += 1) {
    const candidateStd = Math.max(1, candidateStats.std[channel]);
    const targetStd = Math.max(1, targetStats.std[channel]);
    const rawGain = Math.max(1 - maxColorGainShift, Math.min(1 + maxColorGainShift, targetStd / candidateStd));

    gain[channel] = 1 + (rawGain - 1) * colorStdBlendStrength;

    const desiredMean = candidateStats.mean[channel] + (targetStats.mean[channel] - candidateStats.mean[channel]) * colorMeanBlendStrength;

    offset[channel] = Math.max(-maxColorOffset, Math.min(maxColorOffset, desiredMean - gain[channel] * candidateStats.mean[channel]));
  }

  return { gain, offset };
}

function applyColorAdjustmentToStats(stats: ColorStats, adjustment: ColorAdjustment): ColorStats {
  return {
    mean: stats.mean.map((value, channel) => value * adjustment.gain[channel] + adjustment.offset[channel]) as [
      number,
      number,
      number
    ],
    std: stats.std.map((value, channel) => Math.abs(value * adjustment.gain[channel])) as [number, number, number]
  };
}

function measureColorStatsDelta(first: ColorStats, second: ColorStats) {
  let total = 0;

  for (let channel = 0; channel < 3; channel += 1) {
    total += Math.abs(first.mean[channel] - second.mean[channel]);
  }

  return total / 3;
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

    if (encoded.byteLength <= maxGeneratedFaceBytes) {
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
