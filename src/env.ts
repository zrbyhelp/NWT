import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    OPENAI_BASE_URL: z.string().url().optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_MODEL: z.string().min(1).optional(),
    QDRANT_URL: z.string().url(),
    NEO4J_URI: z.string().min(1),
    NEO4J_USERNAME: z.string().min(1),
    NEO4J_PASSWORD: z.string().min(1),
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET_NAME: z.string().min(1),
    AI_CONFIG_ENCRYPTION_KEY: z.string().min(16).optional(),
    LANGFUSE_PUBLIC_KEY: z.string().min(1).optional(),
    LANGFUSE_SECRET_KEY: z.string().min(1).optional(),
    LANGFUSE_BASEURL: z.string().url().optional()
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    QDRANT_URL: process.env.QDRANT_URL,
    NEO4J_URI: process.env.NEO4J_URI,
    NEO4J_USERNAME: process.env.NEO4J_USERNAME,
    NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    AI_CONFIG_ENCRYPTION_KEY: process.env.AI_CONFIG_ENCRYPTION_KEY,
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_BASEURL: process.env.LANGFUSE_BASEURL
  }
});
