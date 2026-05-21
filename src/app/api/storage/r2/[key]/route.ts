import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { r2, r2BucketName } from "@/lib/storage/r2";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const objectKey = decodeStorageKey(key);

  if (!objectKey || (!objectKey.startsWith("avatars/") && !objectKey.startsWith("materials/"))) {
    return new Response(null, { status: 404 });
  }

  const object = await r2.send(
    new GetObjectCommand({
      Bucket: r2BucketName,
      Key: objectKey
    })
  );

  if (!object.Body) {
    return new Response(null, { status: 404 });
  }

  return new Response(toWebStream(object.Body), {
    headers: {
      "Cache-Control": object.CacheControl ?? "public, max-age=31536000, immutable",
      "Content-Type": object.ContentType ?? "application/octet-stream"
    }
  });
}

function decodeStorageKey(key: string) {
  try {
    return Buffer.from(key, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function toWebStream(body: unknown) {
  if (body && typeof body === "object" && "transformToWebStream" in body) {
    return (body as { transformToWebStream: () => ReadableStream }).transformToWebStream();
  }

  return Readable.toWeb(body as Readable) as ReadableStream;
}
