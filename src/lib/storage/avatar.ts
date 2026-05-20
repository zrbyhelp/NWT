import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { getR2PublicObjectUrl, r2, r2BucketName } from "@/lib/storage/r2";

const maxAvatarBytes = 5 * 1024 * 1024;
const avatarContentTypes = new Map([
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

export async function uploadUserAvatar(userId: string, file: File) {
  const contentType = file.type.toLowerCase();
  const extension = avatarContentTypes.get(contentType);

  if (!extension || file.size <= 0 || file.size > maxAvatarBytes) {
    throw new Error("INVALID_AVATAR_FILE");
  }

  const key = `avatars/${encodePathSegment(userId)}/${Date.now()}-${randomUUID()}.${extension}`;
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
