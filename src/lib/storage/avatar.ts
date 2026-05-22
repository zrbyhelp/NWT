import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { getR2Client, getR2PublicObjectUrl, r2BucketName } from "@/lib/storage/r2";
import { avatarContentTypeExtensions, isValidAvatarFile } from "@/lib/storage/avatar-constraints";

export async function uploadUserAvatar(userId: string, file: File) {
  const contentType = file.type.toLowerCase();
  const extension = avatarContentTypeExtensions[contentType as keyof typeof avatarContentTypeExtensions];

  if (!extension || !isValidAvatarFile(file)) {
    throw new Error("INVALID_AVATAR_FILE");
  }

  const key = `avatars/${encodePathSegment(userId)}/${Date.now()}-${randomUUID()}.${extension}`;
  const body = Buffer.from(await file.arrayBuffer());
  const r2 = await getR2Client();

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
