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

const faceSize = 1024;
const innerBandQualityWidth = 32;
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

export async function stabilizeScenePanoramaFaces(
  _referenceFaces: ScenePanoramaPostprocessImage[],
  candidateFaces: ScenePanoramaPostprocessImage[]
): Promise<ScenePanoramaPostprocessImage[]> {
  return Promise.all(
    scenePanoramaPostprocessFaces.map(async (face) => {
      const candidate = candidateFaces.find((item) => item.face === face);

      if (!candidate) {
        throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
      }

      const candidateImage = await decodeFaceToRgba(candidate.bytes);

      return {
        ...candidate,
        bytes: await encodeRgbaToWebp(candidateImage.pixels, candidateImage.width, candidateImage.height),
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
  const innerBandDeltas = await Promise.all(
    scenePanoramaAdjacentEdges.map(async (edge) => {
      const first = getFaceImage(faces, edge.firstFace);
      const second = getFaceImage(faces, edge.secondFace);

      return {
        ...edge,
        bandWidth: innerBandQualityWidth,
        delta: await measureFaceInnerBandDeltaBetween(
          first.bytes,
          second.bytes,
          edge.firstEdge,
          edge.secondEdge,
          edge.reversed,
          innerBandQualityWidth
        )
      };
    })
  );
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

async function measureFaceInnerBandDeltaBetween(
  firstBytes: Buffer,
  secondBytes: Buffer,
  firstEdge: ScenePanoramaPostprocessEdge,
  secondEdge: ScenePanoramaPostprocessEdge,
  reverseSecondEdge: boolean,
  bandWidth: number
) {
  const first = await decodeFaceToRgba(firstBytes);
  const second = await decodeFaceToRgba(secondBytes);
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
