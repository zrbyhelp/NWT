import { getMaterialImageExtension } from "@/lib/storage/material";
import type { WorkspaceMaterialCategory, WorkspaceMaterialStyle } from "@/lib/home-workspace";
import { MaterialTransferError } from "./errors";
import {
  archiveFormat,
  archiveVersion,
  scenePanoramaFaces,
  type MaterialArchiveImage,
  type MaterialArchiveItem,
  type MaterialArchiveItemModel,
  type MaterialArchiveItemModelInputImage,
  type MaterialArchiveItemViewImage,
  type MaterialArchiveManifest,
  type MaterialArchiveScenePanoramaFace,
  type MaterialArchiveScenePanoramaMother,
  type ScenePanoramaFace
} from "./types";

export function validateManifest(value: unknown): MaterialArchiveManifest {
  if (!value || typeof value !== "object") {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  const record = value as Record<string, unknown>;

  if (record.format !== archiveFormat || record.version !== archiveVersion) {
    throw new MaterialTransferError("UNSUPPORTED_MATERIAL_ARCHIVE");
  }

  if (!Array.isArray(record.materials) || record.materials.length === 0) {
    throw new MaterialTransferError("MATERIAL_ARCHIVE_EMPTY");
  }

  return {
    format: archiveFormat,
    version: archiveVersion,
    exportedAt: typeof record.exportedAt === "string" ? record.exportedAt : new Date().toISOString(),
    materials: record.materials.map(validateArchiveItem)
  };
}

export function validateRequiredArchiveImage(value: unknown): MaterialArchiveImage {
  const image = validateArchiveImage(value);

  if (!image) {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  return image;
}

export function validateArchiveImage(value: unknown): MaterialArchiveImage | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!value || typeof value !== "object") {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  const record = value as Record<string, unknown>;
  const path = normalizeText(record.path, "");
  const contentType = normalizeImageContentType(typeof record.contentType === "string" ? record.contentType : "");

  if (!path || !path.startsWith("materials/")) {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  if (!contentType) {
    throw new MaterialTransferError("INVALID_MATERIAL_IMAGE_FILE");
  }

  return {
    path,
    fileName: normalizeText(record.fileName, "preview"),
    contentType,
    byteSize: typeof record.byteSize === "number" && Number.isFinite(record.byteSize) ? Math.max(0, Math.round(record.byteSize)) : 0
  };
}

export function isScenePanoramaFace(value: string): value is ScenePanoramaFace {
  return scenePanoramaFaces.includes(value as ScenePanoramaFace);
}

export function createArchivePathSegment(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || "material";
}

export function normalizeText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";

  return (text || fallback).slice(0, 120);
}

export function normalizeLongText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";

  return text || fallback;
}

export function normalizeImageContentType(contentType: string) {
  const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? "";

  return getMaterialImageExtension(normalized) ? normalized : null;
}

export function normalizeModelContentType(contentType: string): "model/gltf-binary" {
  const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? "";

  return normalized === "model/gltf-binary" || normalized === "application/octet-stream" || !normalized
    ? "model/gltf-binary"
    : "model/gltf-binary";
}

export function normalizeModelFileName(fileName: string) {
  const normalized = createArchivePathSegment(fileName.replace(/\.glb$/i, "") || "item");

  return `${normalized}.glb`;
}

function validateArchiveItem(value: unknown): MaterialArchiveItem {
  if (!value || typeof value !== "object") {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  const record = value as Record<string, unknown>;
  const category = typeof record.category === "string" ? record.category : "";
  const style = typeof record.style === "string" ? record.style : "";

  if (!isWorkspaceMaterialCategory(category) || !isWorkspaceMaterialStyle(style)) {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  return {
    slug: normalizeText(record.slug, "imported-material"),
    category,
    style,
    titleZh: normalizeText(record.titleZh, normalizeText(record.titleEn, "导入素材")),
    titleEn: normalizeText(record.titleEn, normalizeText(record.titleZh, "Imported Material")),
    descriptionZh: normalizeLongText(record.descriptionZh, ""),
    descriptionEn: normalizeLongText(record.descriptionEn, ""),
    metadata: cloneJson(record.metadata ?? null),
    image: validateArchiveImage(record.image),
    itemModelInputImage: validateArchiveItemModelInputImage(record.itemModelInputImage),
    itemViewImages: validateArchiveItemViewImages(record.itemViewImages),
    itemModel: validateArchiveItemModel(record.itemModel),
    scenePanoramaFaces: validateArchiveScenePanoramaFaces(record.scenePanoramaFaces),
    scenePanoramaMothers: validateArchiveScenePanoramaMothers(record.scenePanoramaMothers)
  };
}

function validateArchiveItemModelInputImage(value: unknown): MaterialArchiveItemModelInputImage | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!value || typeof value !== "object") {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  const record = value as Record<string, unknown>;

  return {
    image: validateRequiredArchiveImage(record.image)
  };
}

function validateArchiveItemViewImages(value: unknown): MaterialArchiveItemViewImage[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
    }

    const record = item as Record<string, unknown>;
    const face = typeof record.face === "string" && isScenePanoramaFace(record.face) ? record.face : null;

    if (!face) {
      throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
    }

    return {
      face,
      image: validateRequiredArchiveImage(record.image)
    };
  });
}

function validateArchiveItemModel(value: unknown): MaterialArchiveItemModel | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!value || typeof value !== "object") {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  const record = value as Record<string, unknown>;
  const path = normalizeText(record.path, "");
  const contentType = normalizeModelContentType(typeof record.contentType === "string" ? record.contentType : "");
  const fileName = normalizeModelFileName(typeof record.fileName === "string" ? record.fileName : "item.glb");

  if (!path || !path.startsWith("materials/") || !path.includes("/models/")) {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  return {
    path,
    fileName,
    contentType,
    byteSize: typeof record.byteSize === "number" && Number.isFinite(record.byteSize) ? Math.max(0, Math.round(record.byteSize)) : 0
  };
}

function validateArchiveScenePanoramaFaces(value: unknown): MaterialArchiveScenePanoramaFace[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
    }

    const record = item as Record<string, unknown>;
    const blockId = normalizeText(record.blockId, "");
    const face = typeof record.face === "string" && isScenePanoramaFace(record.face) ? record.face : null;

    if (!blockId || !face) {
      throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
    }

    return {
      blockId,
      face,
      image: validateRequiredArchiveImage(record.image)
    };
  });
}

function validateArchiveScenePanoramaMothers(value: unknown): MaterialArchiveScenePanoramaMother[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
    }

    const record = item as Record<string, unknown>;
    const blockId = normalizeText(record.blockId, "");

    if (!blockId) {
      throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
    }

    return {
      blockId,
      image: validateRequiredArchiveImage(record.image)
    };
  });
}

function isWorkspaceMaterialCategory(category: string): category is WorkspaceMaterialCategory {
  return ["mask", "map", "item", "creature", "scene"].includes(category);
}

function isWorkspaceMaterialStyle(style: string): style is WorkspaceMaterialStyle {
  return ["realistic", "fantasy", "sciFi", "mystery", "cyberpunk", "classical", "apocalyptic"].includes(style);
}

function cloneJson(value: unknown) {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}
