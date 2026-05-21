import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { getR2PublicObjectUrl, r2, r2BucketName } from "@/lib/storage/r2";

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

export async function uploadMaskBoardImage(userId: string, file: File) {
  const contentType = file.type.toLowerCase();
  const extension = materialImageContentTypeExtensions[contentType as keyof typeof materialImageContentTypeExtensions];

  if (!extension || !isValidMaterialImageFile(file)) {
    throw new Error("INVALID_MATERIAL_IMAGE_FILE");
  }

  const key = `materials/${encodePathSegment(userId)}/mask-boards/${Date.now()}-${randomUUID()}.${extension}`;
  const body = Buffer.from(await file.arrayBuffer());

  await r2.send(
    new PutObjectCommand({
      Body: body,
      Bucket: r2BucketName,
      CacheControl: "public, max-age=31536000, immutable",
      ContentType: contentType,
      Key: key
    })
  );

  return getR2PublicObjectUrl(key);
}

function encodePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
