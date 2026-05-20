import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/env";

export const r2 = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY
  }
});

export const r2BucketName = env.R2_BUCKET_NAME;

export function getR2PublicObjectUrl(key: string) {
  const encodedKey = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  if (env.R2_PUBLIC_BASE_URL) {
    return `${env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${encodedKey}`;
  }

  return `/api/storage/r2/${Buffer.from(key).toString("base64url")}`;
}

