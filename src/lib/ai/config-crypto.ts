import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AiConfigError } from "@/lib/ai/config-types";

const algorithm = "aes-256-gcm";
const version = "v1";

export function encryptSecret(secret: string, key = process.env.AI_CONFIG_ENCRYPTION_KEY) {
  if (!key) {
    throw new AiConfigError("AI_CONFIG_ENCRYPTION_KEY is required to save model provider secrets.", "missing-encryption-key");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, deriveKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [version, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(payload: string, key = process.env.AI_CONFIG_ENCRYPTION_KEY) {
  if (!key) {
    throw new AiConfigError("AI_CONFIG_ENCRYPTION_KEY is required to read model provider secrets.", "missing-encryption-key");
  }

  const [payloadVersion, iv, tag, encrypted] = payload.split(":");

  if (payloadVersion !== version || !iv || !tag || !encrypted) {
    throw new AiConfigError("The saved provider secret cannot be decoded.", "invalid-secret-payload");
  }

  const decipher = createDecipheriv(algorithm, deriveKey(key), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function deriveKey(key: string) {
  return createHash("sha256").update(key).digest();
}
