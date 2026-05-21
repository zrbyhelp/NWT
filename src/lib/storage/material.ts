import "server-only";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getR2PublicObjectUrl, r2, r2BucketName } from "@/lib/storage/r2";
import { env } from "@/env";

export const maxMaterialImageBytes = 10 * 1024 * 1024;

export const materialImageContentTypeExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

export function isValidMaterialImageFile(file: File) {
  const contentType = file.type.toLowerCase();

  return contentType in materialImageContentTypeExtensions && file.size > 0 && file.size <= maxMaterialImageBytes;
}

export function isValidMaterialImageBytes(bytes: Uint8Array, contentType: string) {
  const normalizedContentType = normalizeMaterialImageContentType(contentType);

  return (
    Boolean(normalizedContentType) &&
    bytes.byteLength > 0 &&
    bytes.byteLength <= maxMaterialImageBytes
  );
}

export function getMaterialImageExtension(contentType: string) {
  const normalizedContentType = normalizeMaterialImageContentType(contentType);

  return normalizedContentType
    ? materialImageContentTypeExtensions[normalizedContentType as keyof typeof materialImageContentTypeExtensions]
    : null;
}

export async function uploadMaskBoardImage(userId: string, file: File) {
  const contentType = file.type.toLowerCase();

  if (!isValidMaterialImageFile(file)) {
    throw new Error("INVALID_MATERIAL_IMAGE_FILE");
  }

  return uploadMaterialImageBytes(userId, Buffer.from(await file.arrayBuffer()), contentType, "mask-boards");
}

export async function uploadScenePanoramaFaceImage(userId: string, file: File) {
  const contentType = file.type.toLowerCase();

  if (!isValidMaterialImageFile(file)) {
    throw new Error("INVALID_SCENE_PANORAMA_FACE_FILE");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(bytes).metadata();

  if (!metadata.width || !metadata.height || metadata.width !== metadata.height) {
    throw new Error("INVALID_SCENE_PANORAMA_FACE_FILE");
  }

  return uploadMaterialImageBytes(userId, bytes, contentType, "scene-panoramas");
}

export async function uploadMaterialImageBytes(userId: string, bytes: Uint8Array, contentType: string, folder = "imports") {
  const normalizedContentType = normalizeMaterialImageContentType(contentType);
  const extension = normalizedContentType ? materialImageContentTypeExtensions[normalizedContentType] : null;

  if (!normalizedContentType || !extension || !isValidMaterialImageBytes(bytes, contentType)) {
    throw new Error("INVALID_MATERIAL_IMAGE_FILE");
  }

  const key = `materials/${encodePathSegment(userId)}/${encodePathSegment(folder)}/${Date.now()}-${randomUUID()}.${extension}`;

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
    keys.map((key) =>
      r2.send(
        new DeleteObjectCommand({
          Bucket: r2BucketName,
          Key: key
        })
      )
    )
  );
}

function normalizeMaterialImageContentType(contentType: string) {
  const normalizedContentType = contentType.toLowerCase().split(";")[0]?.trim();

  return normalizedContentType && normalizedContentType in materialImageContentTypeExtensions
    ? normalizedContentType as keyof typeof materialImageContentTypeExtensions
    : null;
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
