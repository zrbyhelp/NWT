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
  edgeDeltas: Array<{
    delta: number;
    firstEdge: ScenePanoramaPostprocessEdge;
    firstFace: ScenePanoramaPostprocessFace;
    reversed: boolean;
    secondEdge: ScenePanoramaPostprocessEdge;
    secondFace: ScenePanoramaPostprocessFace;
  }>;
  faceByteSizes: Record<ScenePanoramaPostprocessFace, number>;
  largestFaceBytes: number;
  maxEdgeDelta: number;
  totalBytes: number;
};

const faceSize = 1024;
const edgeLockWidth = 96;
const edgeFeatherWidth = 128;
const maxGeneratedFaceBytes = 9_500_000;
const webpQualitySteps = [92, 86, 80, 74, 68] as const;

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

type RgbStats = {
  mean: [number, number, number];
  stddev: [number, number, number];
};

export async function stabilizeScenePanoramaFaces(
  referenceFaces: ScenePanoramaPostprocessImage[],
  candidateFaces: ScenePanoramaPostprocessImage[]
): Promise<ScenePanoramaPostprocessImage[]> {
  return Promise.all(
    scenePanoramaPostprocessFaces.map(async (face) => {
      const reference = referenceFaces.find((item) => item.face === face);
      const candidate = candidateFaces.find((item) => item.face === face);

      if (!reference || !candidate) {
        throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
      }

      const referenceImage = await decodeFaceToRgba(reference.bytes);
      const candidateImage = await decodeFaceToRgba(candidate.bytes);
      const matchedPixels = matchRgbStats(candidateImage.pixels, calculateRgbStats(candidateImage.pixels), calculateRgbStats(referenceImage.pixels));
      const lockedPixels = lockReferenceEdges(referenceImage.pixels, matchedPixels, referenceImage.width, referenceImage.height);

      return {
        ...candidate,
        bytes: await encodeRgbaToWebp(lockedPixels, referenceImage.width, referenceImage.height),
        contentType: "image/webp",
        fileName: candidate.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
      };
    })
  );
}

export async function analyzeScenePanoramaFaces(faces: ScenePanoramaPostprocessImage[]): Promise<ScenePanoramaQualityReport> {
  const faceByteSizes = scenePanoramaPostprocessFaces.reduce<Record<ScenePanoramaPostprocessFace, number>>((result, face) => {
    const image = faces.find((item) => item.face === face);

    if (!image) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    result[face] = image.bytes.byteLength;

    return result;
  }, {} as Record<ScenePanoramaPostprocessFace, number>);
  const edgeDeltas = await Promise.all(
    scenePanoramaAdjacentEdges.map(async (edge) => {
      const first = getFaceImage(faces, edge.firstFace);
      const second = getFaceImage(faces, edge.secondFace);

      return {
        ...edge,
        delta: await measureFaceEdgeDeltaBetween(first.bytes, second.bytes, edge.firstEdge, edge.secondEdge, edge.reversed)
      };
    })
  );
  const totalBytes = Object.values(faceByteSizes).reduce((sum, size) => sum + size, 0);
  const maxEdgeDelta = Math.max(...edgeDeltas.map((edge) => edge.delta));

  return {
    averageEdgeDelta: edgeDeltas.reduce((sum, edge) => sum + edge.delta, 0) / Math.max(1, edgeDeltas.length),
    edgeDeltas,
    faceByteSizes,
    largestFaceBytes: Math.max(...Object.values(faceByteSizes)),
    maxEdgeDelta,
    totalBytes
  };
}

export async function measureFaceEdgeDelta(firstBytes: Buffer, secondBytes: Buffer, edge: ScenePanoramaPostprocessEdge) {
  return measureFaceEdgeDeltaBetween(firstBytes, secondBytes, edge, edge, false);
}

async function measureFaceEdgeDeltaBetween(
  firstBytes: Buffer,
  secondBytes: Buffer,
  firstEdge: ScenePanoramaPostprocessEdge,
  secondEdge: ScenePanoramaPostprocessEdge,
  reverseSecondEdge: boolean
) {
  const first = await decodeFaceToRgba(firstBytes);
  const second = await decodeFaceToRgba(secondBytes);
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

function getFaceImage(faces: ScenePanoramaPostprocessImage[], face: ScenePanoramaPostprocessFace) {
  const image = faces.find((item) => item.face === face);

  if (!image) {
    throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
  }

  return image;
}

async function decodeFaceToRgba(bytes: Buffer): Promise<RgbaImage> {
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

function calculateRgbStats(pixels: Buffer): RgbStats {
  const sum: [number, number, number] = [0, 0, 0];
  const squareSum: [number, number, number] = [0, 0, 0];
  const pixelCount = pixels.length / 4;

  for (let index = 0; index < pixels.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = pixels[index + channel];

      sum[channel] += value;
      squareSum[channel] += value * value;
    }
  }

  return {
    mean: sum.map((value) => value / pixelCount) as [number, number, number],
    stddev: squareSum.map((value, channel) => {
      const mean = sum[channel] / pixelCount;
      const variance = Math.max(0, value / pixelCount - mean * mean);

      return Math.max(1, Math.sqrt(variance));
    }) as [number, number, number]
  };
}

function matchRgbStats(candidatePixels: Buffer, candidateStats: RgbStats, referenceStats: RgbStats) {
  const output = Buffer.alloc(candidatePixels.length);

  for (let index = 0; index < candidatePixels.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const gain = clampNumber(referenceStats.stddev[channel] / candidateStats.stddev[channel], 0.5, 2);
      const matched = (candidatePixels[index + channel] - candidateStats.mean[channel]) * gain + referenceStats.mean[channel];

      output[index + channel] = clampByte(matched);
    }

    output[index + 3] = candidatePixels[index + 3];
  }

  return output;
}

function lockReferenceEdges(referencePixels: Buffer, candidatePixels: Buffer, width: number, height: number) {
  const output = Buffer.alloc(referencePixels.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const distanceToEdge = Math.min(x, y, width - 1 - x, height - 1 - y);
      const candidateWeight = getCenterWeight(distanceToEdge);

      for (let channel = 0; channel < 3; channel += 1) {
        output[index + channel] = clampByte(
          referencePixels[index + channel] * (1 - candidateWeight) + candidatePixels[index + channel] * candidateWeight
        );
      }

      output[index + 3] = 255;
    }
  }

  return output;
}

function getCenterWeight(distanceToEdge: number) {
  if (distanceToEdge <= edgeLockWidth) {
    return 0;
  }

  if (distanceToEdge >= edgeLockWidth + edgeFeatherWidth) {
    return 1;
  }

  const progress = (distanceToEdge - edgeLockWidth) / edgeFeatherWidth;

  return progress * progress * (3 - 2 * progress);
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

function clampByte(value: number) {
  return Math.round(clampNumber(value, 0, 255));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
