import sharp from "sharp";

const maxOutlinePreviewWidth = 1920;
const edgePercentile = 0.86;
const minEdgeThreshold = 24;

export type MapImageOutlineResult = {
  contentType: "image/png";
  dataUrl: string;
  fileName: string;
  height: number;
  width: number;
};

export async function generateMapImageOutlinePreview(bytes: Uint8Array): Promise<MapImageOutlineResult> {
  const normalized = sharp(bytes, { limitInputPixels: false }).rotate();
  const metadata = await normalized.metadata();
  const width = metadata.width && metadata.width > maxOutlinePreviewWidth ? maxOutlinePreviewWidth : undefined;
  const { data, info } = await normalized
    .resize({ width, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const outlinePixels = renderMapImageOutlinePixels(data, info.width, info.height, info.channels);
  const outlineBytes = await sharp(outlinePixels, {
    raw: {
      channels: 4,
      height: info.height,
      width: info.width
    }
  })
    .png({ adaptiveFiltering: true, compressionLevel: 9 })
    .toBuffer();

  return {
    contentType: "image/png",
    dataUrl: `data:image/png;base64,${outlineBytes.toString("base64")}`,
    fileName: "map-outline.png",
    height: info.height,
    width: info.width
  };
}

export function renderMapImageOutlinePixels(pixels: Uint8Array, width: number, height: number, channels: number) {
  const gray = new Uint8Array(width * height);
  const magnitude = new Uint8Array(width * height);
  const histogram = new Uint32Array(256);

  for (let index = 0; index < gray.length; index += 1) {
    const pixelIndex = index * channels;
    const alpha = channels >= 4 ? pixels[pixelIndex + 3] : 255;

    gray[index] = alpha < 16
      ? 255
      : Math.round((pixels[pixelIndex] * 0.299) + (pixels[pixelIndex + 1] * 0.587) + (pixels[pixelIndex + 2] * 0.114));
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const topLeft = gray[index - width - 1];
      const top = gray[index - width];
      const topRight = gray[index - width + 1];
      const left = gray[index - 1];
      const right = gray[index + 1];
      const bottomLeft = gray[index + width - 1];
      const bottom = gray[index + width];
      const bottomRight = gray[index + width + 1];
      const gx = -topLeft - (2 * left) - bottomLeft + topRight + (2 * right) + bottomRight;
      const gy = -topLeft - (2 * top) - topRight + bottomLeft + (2 * bottom) + bottomRight;
      const value = Math.min(255, Math.round(Math.hypot(gx, gy) / 4));

      magnitude[index] = value;
      histogram[value] += 1;
    }
  }

  const threshold = Math.max(minEdgeThreshold, getHistogramPercentile(histogram, edgePercentile));
  const mask = new Uint8Array(width * height);

  for (let index = 0; index < magnitude.length; index += 1) {
    mask[index] = magnitude[index] >= threshold ? 1 : 0;
  }

  const output = Buffer.alloc(width * height * 4, 255);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;

      if (!hasNearbyEdge(mask, width, index)) {
        continue;
      }

      const outputIndex = index * 4;

      output[outputIndex] = 0;
      output[outputIndex + 1] = 0;
      output[outputIndex + 2] = 0;
      output[outputIndex + 3] = 255;
    }
  }

  return output;
}

function hasNearbyEdge(mask: Uint8Array, width: number, index: number) {
  return Boolean(
    mask[index] ||
      mask[index - 1] ||
      mask[index + 1] ||
      mask[index - width] ||
      mask[index + width]
  );
}

function getHistogramPercentile(histogram: Uint32Array, percentile: number) {
  const total = histogram.reduce((sum, count) => sum + count, 0);
  const target = Math.max(1, Math.round(total * percentile));
  let seen = 0;

  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value];

    if (seen >= target) {
      return value;
    }
  }

  return minEdgeThreshold;
}
