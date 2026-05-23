import { configureServerOutboundProxy } from "@/lib/network/proxy";
import { getItemMetadataRecord, getSceneMetadataRecord } from "./metadata";
import { MaterialTransferError } from "./errors";
import {
  scenePanoramaFaces,
  type MaterialArchiveImage,
  type MaterialArchiveItemModel,
  type ScenePanoramaFace
} from "./types";
import {
  createArchivePathSegment,
  normalizeImageContentType,
  normalizeModelContentType,
  normalizeModelFileName,
  normalizeText
} from "./validators";
import {
  getMaterialImageExtension,
  isValidMaterialImageBytes,
  isValidMaterialModelBytes
} from "@/lib/storage/material";

export async function downloadMaterialImage(previewUrl: string, origin: string) {
  await configureServerOutboundProxy();

  const url = resolveMaterialImageUrl(previewUrl, origin);
  const response = await fetch(url);

  if (!response.ok) {
    throw new MaterialTransferError("MATERIAL_IMAGE_DOWNLOAD_FAILED");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = normalizeImageContentType(response.headers.get("content-type") ?? inferImageContentType(previewUrl) ?? "");
  const extension = contentType ? getMaterialImageExtension(contentType) : null;

  if (!contentType || !extension || !isValidMaterialImageBytes(bytes, contentType)) {
    throw new MaterialTransferError("INVALID_MATERIAL_IMAGE_FILE");
  }

  return {
    bytes,
    contentType,
    extension
  };
}

export async function downloadScenePanoramaFaces(metadata: unknown, pathSlug: string, origin: string) {
  const record = getSceneMetadataRecord(metadata);
  const assets: Array<{
    blockId: string;
    bytes: Uint8Array;
    face: ScenePanoramaFace;
    image: MaterialArchiveImage;
  }> = [];

  if (!record || !Array.isArray(record.blocks)) {
    return assets;
  }

  for (const block of record.blocks) {
    if (!block || typeof block !== "object") {
      continue;
    }

    const blockRecord = block as Record<string, unknown>;
    const blockId = normalizeText(blockRecord.id, "block");
    const panorama = blockRecord.panorama;

    if (!panorama || typeof panorama !== "object") {
      continue;
    }

    const faces = (panorama as Record<string, unknown>).faces;

    if (!faces || typeof faces !== "object") {
      continue;
    }

    for (const face of scenePanoramaFaces) {
      const faceRecord = (faces as Record<string, unknown>)[face];
      const url =
        faceRecord && typeof faceRecord === "object"
          ? (faceRecord as Record<string, unknown>).url
          : null;

      if (typeof url !== "string" || !url) {
        continue;
      }

      const image = await downloadMaterialImage(url, origin);
      const fileName = `${face}.${image.extension}`;
      const path = `materials/${pathSlug}/panorama/${createArchivePathSegment(blockId)}/${fileName}`;

      assets.push({
        blockId,
        bytes: image.bytes,
        face,
        image: {
          path,
          fileName,
          contentType: image.contentType,
          byteSize: image.bytes.byteLength
        }
      });
    }
  }

  return assets;
}

export async function downloadScenePanoramaMothers(metadata: unknown, pathSlug: string, origin: string) {
  const record = getSceneMetadataRecord(metadata);
  const assets: Array<{
    blockId: string;
    bytes: Uint8Array;
    image: MaterialArchiveImage;
  }> = [];

  if (!record || !Array.isArray(record.blocks)) {
    return assets;
  }

  for (const block of record.blocks) {
    if (!block || typeof block !== "object") {
      continue;
    }

    const blockRecord = block as Record<string, unknown>;
    const blockId = normalizeText(blockRecord.id, "block");
    const panorama = blockRecord.panorama;

    if (!panorama || typeof panorama !== "object") {
      continue;
    }

    const mother = (panorama as Record<string, unknown>).mother;
    const url = mother && typeof mother === "object" ? (mother as Record<string, unknown>).url : null;

    if (typeof url !== "string" || !url) {
      continue;
    }

    const image = await downloadMaterialImage(url, origin);
    const fileName = `mother.${image.extension}`;
    const path = `materials/${pathSlug}/panorama/${createArchivePathSegment(blockId)}/${fileName}`;

    assets.push({
      blockId,
      bytes: image.bytes,
      image: {
        path,
        fileName,
        contentType: image.contentType,
        byteSize: image.bytes.byteLength
      }
    });
  }

  return assets;
}

export async function downloadItemViewImages(metadata: unknown, pathSlug: string, origin: string) {
  const record = getItemMetadataRecord(metadata);
  const assets: Array<{
    bytes: Uint8Array;
    face: ScenePanoramaFace;
    image: MaterialArchiveImage;
  }> = [];

  if (!record) {
    return assets;
  }

  const viewImages = record.viewImages;

  if (!viewImages || typeof viewImages !== "object") {
    return assets;
  }

  for (const face of scenePanoramaFaces) {
    const imageRecord = (viewImages as Record<string, unknown>)[face];
    const url = imageRecord && typeof imageRecord === "object" ? (imageRecord as Record<string, unknown>).url : null;

    if (typeof url !== "string" || !url) {
      continue;
    }

    const image = await downloadMaterialImage(url, origin);
    const fileName = `${face}.${image.extension}`;
    const path = `materials/${pathSlug}/item-views/${fileName}`;

    assets.push({
      bytes: image.bytes,
      face,
      image: {
        path,
        fileName,
        contentType: image.contentType,
        byteSize: image.bytes.byteLength
      }
    });
  }

  return assets;
}

export async function downloadItemModelInputImage(metadata: unknown, pathSlug: string, origin: string) {
  const record = getItemMetadataRecord(metadata);
  const modelInputImage = record?.modelInputImage;

  if (!modelInputImage || typeof modelInputImage !== "object") {
    return null;
  }

  const url = (modelInputImage as Record<string, unknown>).url;

  if (typeof url !== "string" || !url) {
    return null;
  }

  const image = await downloadMaterialImage(url, origin);
  const fileName = `model-input.${image.extension}`;

  return {
    bytes: image.bytes,
    image: {
      path: `materials/${pathSlug}/item-model-input/${fileName}`,
      fileName,
      contentType: image.contentType,
      byteSize: image.bytes.byteLength
    } satisfies MaterialArchiveImage
  };
}

export async function downloadItemModel(metadata: unknown, pathSlug: string, origin: string) {
  const record = getItemMetadataRecord(metadata);
  const model3d = record?.model3d;

  if (!model3d || typeof model3d !== "object") {
    return null;
  }

  const modelRecord = model3d as Record<string, unknown>;
  const url = typeof modelRecord.url === "string" ? modelRecord.url : "";

  if (!url) {
    return null;
  }

  await configureServerOutboundProxy();

  const response = await fetch(resolveMaterialImageUrl(url, origin));

  if (!response.ok) {
    throw new MaterialTransferError("MATERIAL_MODEL_DOWNLOAD_FAILED");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = normalizeModelContentType(response.headers.get("content-type") ?? String(modelRecord.contentType ?? ""));
  const fileName = normalizeModelFileName(typeof modelRecord.fileName === "string" ? modelRecord.fileName : inferFileNameFromUrl(url));

  if (!isValidMaterialModelBytes(bytes, contentType, fileName)) {
    throw new MaterialTransferError("INVALID_MATERIAL_MODEL_FILE");
  }

  return {
    bytes,
    model: {
      path: `materials/${pathSlug}/models/${fileName}`,
      fileName,
      contentType,
      byteSize: bytes.byteLength
    } satisfies MaterialArchiveItemModel
  };
}

function resolveMaterialImageUrl(previewUrl: string, origin: string) {
  if (previewUrl.startsWith("/")) {
    return new URL(previewUrl, origin).toString();
  }

  return previewUrl;
}

function inferFileNameFromUrl(url: string) {
  try {
    const name = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "item.glb";

    return name;
  } catch {
    return "item.glb";
  }
}

function inferImageContentType(path: string) {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerPath.endsWith(".png")) {
    return "image/png";
  }

  if (lowerPath.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}
