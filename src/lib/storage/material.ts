import "server-only";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getR2Client, getR2PublicObjectUrl, r2BucketName } from "@/lib/storage/r2";
import { env } from "@/env";

export const maxMaterialImageBytes = 10 * 1024 * 1024;
export const maxMaterialModelBytes = 100 * 1024 * 1024;

export const materialImageContentTypeExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

type MaterialImageValidationOptions = {
  allowOversize?: boolean;
};

export function isValidMaterialImageFile(file: File, options: MaterialImageValidationOptions = {}) {
  const contentType = file.type.toLowerCase();

  return (
    contentType in materialImageContentTypeExtensions &&
    file.size > 0 &&
    (options.allowOversize || file.size <= maxMaterialImageBytes)
  );
}

export function isValidMaterialImageBytes(bytes: Uint8Array, contentType: string, options: MaterialImageValidationOptions = {}) {
  const normalizedContentType = normalizeMaterialImageContentType(contentType);

  return (
    Boolean(normalizedContentType) &&
    bytes.byteLength > 0 &&
    (options.allowOversize || bytes.byteLength <= maxMaterialImageBytes)
  );
}

export function isValidScenePanoramaImageBytes(bytes: Uint8Array, contentType: string) {
  const normalizedContentType = normalizeMaterialImageContentType(contentType);

  return Boolean(normalizedContentType) && bytes.byteLength > 0;
}

export function isValidScenePanoramaImageFile(file: File, options: { allowOversize?: boolean } = {}) {
  const contentType = file.type.toLowerCase();

  return (
    contentType in materialImageContentTypeExtensions &&
    file.size > 0 &&
    (options.allowOversize || file.size <= maxMaterialImageBytes)
  );
}

export function isValidMaterialModelBytes(bytes: Uint8Array, contentType: string, fileName = "") {
  const normalizedContentType = normalizeMaterialModelContentType(contentType);
  const normalizedFileName = fileName.toLowerCase();

  return (
    Boolean(normalizedContentType) &&
    (normalizedContentType === "model/gltf-binary" || normalizedFileName.endsWith(".glb")) &&
    bytes.byteLength > 0 &&
    bytes.byteLength <= maxMaterialModelBytes
  );
}

export function getMaterialImageExtension(contentType: string) {
  const normalizedContentType = normalizeMaterialImageContentType(contentType);

  return normalizedContentType
    ? materialImageContentTypeExtensions[normalizedContentType as keyof typeof materialImageContentTypeExtensions]
    : null;
}

export async function uploadMaskBoardImage(userId: string, file: File, options: MaterialImageValidationOptions = {}) {
  const contentType = file.type.toLowerCase();

  if (!isValidMaterialImageFile(file, options)) {
    throw new Error("INVALID_MATERIAL_IMAGE_FILE");
  }

  return uploadMaterialImageBytes(userId, Buffer.from(await file.arrayBuffer()), contentType, "mask-boards", options);
}

export async function uploadCreatureBoardImage(userId: string, file: File, options: MaterialImageValidationOptions = {}) {
  const contentType = file.type.toLowerCase();

  if (!isValidMaterialImageFile(file, options)) {
    throw new Error("INVALID_MATERIAL_IMAGE_FILE");
  }

  return uploadMaterialImageBytes(userId, Buffer.from(await file.arrayBuffer()), contentType, "creature-boards", options);
}

export async function uploadScenePanoramaFaceImage(userId: string, file: File, options: { allowOversize?: boolean } = {}) {
  const contentType = file.type.toLowerCase();

  if (!isValidScenePanoramaImageFile(file, options)) {
    throw new Error("INVALID_SCENE_PANORAMA_FACE_FILE");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(bytes).metadata();

  if (!metadata.width || !metadata.height || metadata.width !== metadata.height) {
    throw new Error("INVALID_SCENE_PANORAMA_FACE_FILE");
  }

  return uploadMaterialImageBytes(userId, bytes, contentType, "scene-panoramas", {
    allowOversizeScenePanorama: options.allowOversize
  });
}

export async function uploadScenePanoramaMotherImage(userId: string, file: File, options: { allowOversize?: boolean } = {}) {
  const contentType = file.type.toLowerCase();

  if (!isValidScenePanoramaImageFile(file, options)) {
    throw new Error("INVALID_SCENE_PANORAMA_MOTHER_FILE");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(bytes).metadata();

  if (!metadata.width || !metadata.height || Math.abs(metadata.width / metadata.height - 2) > 0.03) {
    throw new Error("INVALID_SCENE_PANORAMA_MOTHER_FILE");
  }

  return uploadMaterialImageBytes(userId, bytes, contentType, "scene-panoramas", {
    allowOversizeScenePanorama: options.allowOversize
  });
}

export async function uploadItemBoardImage(userId: string, file: File, options: MaterialImageValidationOptions = {}) {
  const contentType = file.type.toLowerCase();

  if (!isValidMaterialImageFile(file, options)) {
    throw new Error("INVALID_MATERIAL_IMAGE_FILE");
  }

  return uploadMaterialImageBytes(userId, Buffer.from(await file.arrayBuffer()), contentType, "item-boards", options);
}

export async function uploadItemViewImage(userId: string, file: File) {
  const contentType = file.type.toLowerCase();

  if (!isValidMaterialImageFile(file)) {
    throw new Error("INVALID_ITEM_VIEW_IMAGE_FILE");
  }

  return uploadMaterialImageBytes(userId, Buffer.from(await file.arrayBuffer()), contentType, "item-views");
}

export async function uploadItemModelInputImage(userId: string, file: File, options: MaterialImageValidationOptions = {}) {
  const contentType = file.type.toLowerCase();

  if (!isValidMaterialImageFile(file, options)) {
    throw new Error("INVALID_ITEM_MODEL_INPUT_IMAGE_FILE");
  }

  return uploadMaterialImageBytes(userId, Buffer.from(await file.arrayBuffer()), contentType, "item-model-inputs", options);
}

export async function uploadMapImage(userId: string, file: File, options: MaterialImageValidationOptions = {}) {
  const contentType = file.type.toLowerCase();

  if (!isValidMaterialImageFile(file, options)) {
    throw new Error("INVALID_MAP_IMAGE_FILE");
  }

  return uploadMaterialImageBytes(userId, Buffer.from(await file.arrayBuffer()), contentType, "map-images", options);
}

export async function uploadItemModelBytes(userId: string, bytes: Uint8Array, contentType: string, fileName = "item-model.glb") {
  const normalizedContentType = normalizeMaterialModelContentType(contentType);

  if (!normalizedContentType || !isValidMaterialModelBytes(bytes, normalizedContentType, fileName)) {
    throw new Error("INVALID_ITEM_MODEL_FILE");
  }

  const key = `materials/${encodePathSegment(userId)}/item-models/${Date.now()}-${randomUUID()}.glb`;
  const r2 = await getR2Client();

  await r2.send(
    new PutObjectCommand({
      Body: Buffer.from(bytes),
      Bucket: r2BucketName,
      CacheControl: "public, max-age=31536000, immutable",
      ContentType: normalizedContentType,
      Key: key
    })
  );

  return getR2PublicObjectUrl(key);
}

export async function uploadMaterialImageBytes(
  userId: string,
  bytes: Uint8Array,
  contentType: string,
  folder = "imports",
  options: MaterialImageValidationOptions & { allowOversizeScenePanorama?: boolean } = {}
) {
  const normalizedContentType = normalizeMaterialImageContentType(contentType);
  const extension = normalizedContentType ? materialImageContentTypeExtensions[normalizedContentType] : null;
  const validBytes = options.allowOversizeScenePanorama || options.allowOversize
    ? isValidScenePanoramaImageBytes(bytes, contentType)
    : isValidMaterialImageBytes(bytes, contentType);

  if (!normalizedContentType || !extension || !validBytes) {
    throw new Error("INVALID_MATERIAL_IMAGE_FILE");
  }

  const key = `materials/${encodePathSegment(userId)}/${encodePathSegment(folder)}/${Date.now()}-${randomUUID()}.${extension}`;
  const r2 = await getR2Client();

  await r2.send(
    new PutObjectCommand({
      Body: Buffer.from(bytes),
      Bucket: r2BucketName,
      CacheControl: "public, max-age=31536000, immutable",
      ContentType: normalizedContentType,
      Key: key
    })
  );

  return getR2PublicObjectUrl(key);
}

export async function deleteMaterialImagesByUrls(urls: string[]) {
  const keys = Array.from(new Set(urls))
    .map((url) => getR2ObjectKeyFromPublicUrl(url))
    .filter((key): key is string => typeof key === "string" && key.startsWith("materials/"));

  await Promise.allSettled(
    keys.map(async (key) => {
      const r2 = await getR2Client();

      return r2.send(
        new DeleteObjectCommand({
          Bucket: r2BucketName,
          Key: key
        })
      );
    })
  );
}

function normalizeMaterialImageContentType(contentType: string) {
  const normalizedContentType = contentType.toLowerCase().split(";")[0]?.trim();

  return normalizedContentType && normalizedContentType in materialImageContentTypeExtensions
    ? normalizedContentType as keyof typeof materialImageContentTypeExtensions
    : null;
}

function normalizeMaterialModelContentType(contentType: string) {
  const normalizedContentType = contentType.toLowerCase().split(";")[0]?.trim();

  if (!normalizedContentType || normalizedContentType === "application/octet-stream") {
    return "model/gltf-binary";
  }

  return normalizedContentType === "model/gltf-binary" ? normalizedContentType : null;
}

function encodePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getR2ObjectKeyFromPublicUrl(url: string) {
  if (url.startsWith("/api/storage/r2/")) {
    const encodedKey = url.slice("/api/storage/r2/".length);

    try {
      return Buffer.from(encodedKey, "base64url").toString("utf8");
    } catch {
      return null;
    }
  }

  if (env.R2_PUBLIC_BASE_URL) {
    const baseUrl = env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "");

    if (url.startsWith(`${baseUrl}/`)) {
      return url
        .slice(baseUrl.length + 1)
        .split("/")
        .map((part) => decodeURIComponent(part))
        .join("/");
    }
  }

  return null;
}
