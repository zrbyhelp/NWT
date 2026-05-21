import "server-only";

import { CallbackHandler } from "@langfuse/langchain";
import { observeOpenAI, type LangfuseConfig } from "@langfuse/openai";
import { propagateAttributes, startActiveObservation, type LangfuseSpan, type LangfuseSpanAttributes } from "@langfuse/tracing";
import type { RunnableConfig } from "@langchain/core/runnables";
import OpenAI from "openai";
import { AiConfigError } from "@/lib/ai/config-types";

const defaultTag = "new-world-novel";

export type AiObservationContext = {
  conversationId?: string | null;
  feature: string;
  input?: unknown;
  locale?: string | null;
  metadata?: Record<string, unknown>;
  modelId?: string | null;
  providerName?: string | null;
  sessionId?: string | null;
  tags?: string[];
  traceName?: string;
  userId?: string | null;
};

export type ObservedOpenAIConfig = {
  apiKey: string;
  baseUrl: string;
  modelId?: string | null;
  providerName?: string | null;
  source?: string;
  temperature?: number | null;
};

export type LangfuseRuntimeConfig = {
  baseUrl?: string;
  publicKey?: string;
  secretKey?: string;
};

export function getLangfuseRuntimeConfig(): LangfuseRuntimeConfig {
  return {
    baseUrl: process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_BASEURL,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY
  };
}

export function isLangfuseConfigured() {
  const config = getLangfuseRuntimeConfig();

  return Boolean(config.publicKey && config.secretKey);
}

export function assertLangfuseConfigured() {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (!isLangfuseConfigured()) {
    throw new AiConfigError("Langfuse observability is required before calling AI services.", "missing-langfuse-config");
  }
}

export function createObservedOpenAIClient(config: ObservedOpenAIConfig, context: AiObservationContext) {
  assertLangfuseConfigured();

  return observeOpenAI(
    new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    }),
    createOpenAIObservationConfig(config, context)
  );
}

export function createLangfuseCallbackHandler(context: AiObservationContext) {
  assertLangfuseConfigured();

  return new CallbackHandler({
    sessionId: normalizeOptionalString(context.sessionId),
    tags: buildTags(context),
    traceMetadata: buildObservationMetadata(context),
    userId: normalizeOptionalString(context.userId)
  });
}

export function createLangGraphRunConfig(context: AiObservationContext, config: RunnableConfig = {}): RunnableConfig {
  const handler = createLangfuseCallbackHandler(context);

  return {
    ...config,
    callbacks: mergeCallbacks(config.callbacks, handler),
    metadata: {
      ...(config.metadata ?? {}),
      ...buildObservationMetadata(context)
    },
    tags: mergeTags(config.tags, buildTags(context))
  };
}

export async function withAiObservation<T>(
  name: string,
  context: AiObservationContext,
  fn: (span: LangfuseSpan) => Promise<T>
): Promise<T> {
  assertLangfuseConfigured();

  return startActiveObservation(
    name,
    async (span) =>
      propagateAttributes(createPropagatedAttributes(name, context), async () => {
        try {
          span.update({
            input: context.input,
            metadata: buildObservationMetadata(context)
          });

          return await fn(span);
        } catch (error) {
          span.update({
            level: "ERROR",
            metadata: buildObservationMetadata(context),
            output: serializeError(error),
            statusMessage: getErrorMessage(error)
          });
          throw error;
        }
      }),
    { asType: "span" }
  );
}

export function updateAiObservation(span: LangfuseSpan, attributes: LangfuseSpanAttributes) {
  span.update(attributes);
}

function createOpenAIObservationConfig(config: ObservedOpenAIConfig, context: AiObservationContext): LangfuseConfig {
  return {
    generationMetadata: {
      ...buildObservationMetadata(context),
      baseUrl: config.baseUrl,
      modelId: config.modelId ?? context.modelId,
      providerName: config.providerName ?? context.providerName,
      source: config.source,
      temperature: config.temperature
    },
    generationName: `${context.feature}.openai`,
    sessionId: normalizeOptionalString(context.sessionId),
    tags: buildTags(context),
    traceName: context.traceName ?? context.feature,
    userId: normalizeOptionalString(context.userId)
  };
}

function createPropagatedAttributes(name: string, context: AiObservationContext) {
  return {
    metadata: buildTraceMetadata(context),
    sessionId: normalizeOptionalString(context.sessionId),
    tags: buildTags(context),
    traceName: context.traceName ?? name,
    userId: normalizeOptionalString(context.userId)
  };
}

function buildObservationMetadata(context: AiObservationContext): Record<string, unknown> {
  return stripUndefined({
    ...(context.metadata ?? {}),
    conversationId: context.conversationId ?? undefined,
    feature: context.feature,
    locale: context.locale ?? undefined,
    modelId: context.modelId ?? undefined,
    providerName: context.providerName ?? undefined
  });
}

function buildTraceMetadata(context: AiObservationContext): Record<string, string> {
  const metadata = buildObservationMetadata(context);
  const result: Record<string, string> = {};

  Object.entries(metadata).forEach(([key, value]) => {
    const normalized = normalizeMetadataValue(value);

    if (normalized) {
      result[key] = normalized;
    }
  });

  return result;
}

function buildTags(context: AiObservationContext) {
  return mergeTags([defaultTag, context.feature], context.tags ?? []);
}

function mergeCallbacks(existing: RunnableConfig["callbacks"], handler: CallbackHandler): RunnableConfig["callbacks"] {
  if (Array.isArray(existing)) {
    return [...existing, handler];
  }

  return [handler];
}

function mergeTags(first: string[] | undefined, second: string[] | undefined) {
  return Array.from(new Set([...(first ?? []), ...(second ?? [])].filter(Boolean)));
}

function normalizeMetadataValue(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, 200);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).slice(0, 200);
  }

  return JSON.stringify(value).slice(0, 200);
}

function normalizeOptionalString(value?: string | null) {
  return value ? value.slice(0, 200) : undefined;
}

function stripUndefined<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function serializeError(error: unknown) {
  return {
    message: getErrorMessage(error),
    name: error instanceof Error ? error.name : "Error"
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
