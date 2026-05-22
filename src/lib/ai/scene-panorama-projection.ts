import sharp from "sharp";

export const scenePanoramaProjectionFaces = ["front", "back", "left", "right", "top", "bottom"] as const;

export type ScenePanoramaProjectionFace = (typeof scenePanoramaProjectionFaces)[number];

export type ScenePanoramaProjectedFace = {
  bytes: Buffer;
  contentType: string;
  face: ScenePanoramaProjectionFace;
  fileName: string;
};

export type ScenePanoramaProjectionOptions = {
  faceSize?: number;
  normalizedHeight?: number;
  normalizedWidth?: number;
};

export const cubemapYawOffsetRadians = Math.PI / 4;

const defaultNormalizedPanoramaWidth = 4096;
const defaultNormalizedPanoramaHeight = 2048;
const defaultPanoramaFaceSize = 4096;

export async function splitEquirectangularToCubemap(bytes: Buffer, options: ScenePanoramaProjectionOptions = {}) {
  const normalizedWidth = options.normalizedWidth ?? defaultNormalizedPanoramaWidth;
  const normalizedHeight = options.normalizedHeight ?? defaultNormalizedPanoramaHeight;
  const faceSize = options.faceSize ?? defaultPanoramaFaceSize;
  const normalized = await sharp(bytes)
    .resize(normalizedWidth, normalizedHeight, { fit: "fill" })
    .toColorspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer();

  return Promise.all(
    scenePanoramaProjectionFaces.map(async (face) => ({
      bytes: await renderCubemapFace(normalized, face, {
        faceSize,
        normalizedHeight,
        normalizedWidth
      }),
      contentType: "image/png",
      face,
      fileName: `scene-panorama-${face}.png`
    }))
  );
}

export function getScenePanoramaFaceSourceCoordinate(
  face: ScenePanoramaProjectionFace,
  a: number,
  b: number,
  options: Required<Pick<ScenePanoramaProjectionOptions, "normalizedHeight" | "normalizedWidth">> = {
    normalizedHeight: defaultNormalizedPanoramaHeight,
    normalizedWidth: defaultNormalizedPanoramaWidth
  }
) {
  const [dx, dy, dz] = getFaceDirection(face, a, b);
  const length = Math.hypot(dx, dy, dz);
  const nx = dx / length;
  const ny = dy / length;
  const nz = dz / length;
  const longitude = normalizeLongitude(Math.atan2(nx, nz) + cubemapYawOffsetRadians);
  const latitude = Math.asin(ny);

  return {
    latitude,
    longitude,
    sourceX: wrapCoordinate((longitude / (2 * Math.PI) + 0.5) * options.normalizedWidth, options.normalizedWidth),
    sourceY: clampCoordinate((0.5 - latitude / Math.PI) * options.normalizedHeight, options.normalizedHeight)
  };
}

async function renderCubemapFace(
  sourcePixels: Buffer,
  face: ScenePanoramaProjectionFace,
  {
    faceSize,
    normalizedHeight,
    normalizedWidth
  }: {
    faceSize: number;
    normalizedHeight: number;
    normalizedWidth: number;
  }
) {
  const output = Buffer.alloc(faceSize * faceSize * 4);

  for (let y = 0; y < faceSize; y += 1) {
    for (let x = 0; x < faceSize; x += 1) {
      const a = (2 * (x + 0.5)) / faceSize - 1;
      const b = (2 * (y + 0.5)) / faceSize - 1;
      const { sourceX, sourceY } = getScenePanoramaFaceSourceCoordinate(face, a, b, {
        normalizedHeight,
        normalizedWidth
      });
      const color = sampleBilinear(sourcePixels, sourceX, sourceY, normalizedWidth, normalizedHeight);
      const targetIndex = (y * faceSize + x) * 4;

      output[targetIndex] = color[0];
      output[targetIndex + 1] = color[1];
      output[targetIndex + 2] = color[2];
      output[targetIndex + 3] = color[3];
    }
  }

  return sharp(output, {
    raw: {
      channels: 4,
      height: faceSize,
      width: faceSize
    }
  }).png().toBuffer();
}

function getFaceDirection(face: ScenePanoramaProjectionFace, a: number, b: number): [number, number, number] {
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

function sampleBilinear(
  pixels: Buffer,
  x: number,
  y: number,
  normalizedWidth: number,
  normalizedHeight: number
): [number, number, number, number] {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = (x0 + 1) % normalizedWidth;
  const y1 = Math.min(normalizedHeight - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const c00 = readPixel(pixels, x0, y0, normalizedWidth);
  const c10 = readPixel(pixels, x1, y0, normalizedWidth);
  const c01 = readPixel(pixels, x0, y1, normalizedWidth);
  const c11 = readPixel(pixels, x1, y1, normalizedWidth);

  return [0, 1, 2, 3].map((index) =>
    Math.round(
      c00[index] * (1 - tx) * (1 - ty) +
        c10[index] * tx * (1 - ty) +
        c01[index] * (1 - tx) * ty +
        c11[index] * tx * ty
    )
  ) as [number, number, number, number];
}

function readPixel(pixels: Buffer, x: number, y: number, normalizedWidth: number): [number, number, number, number] {
  const index = (y * normalizedWidth + x) * 4;

  return [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
}

function normalizeLongitude(value: number) {
  if (value > Math.PI) {
    return value - 2 * Math.PI;
  }

  if (value <= -Math.PI) {
    return value + 2 * Math.PI;
  }

  return value;
}

function wrapCoordinate(value: number, max: number) {
  return ((value % max) + max) % max;
}

function clampCoordinate(value: number, max: number) {
  return Math.max(0, Math.min(max - 1, value));
}
