import "server-only";

import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam
} from "openai/resources/chat/completions";
import type { Locale } from "@/i18n/routing";
import type { DefaultLlmRuntimeConfig } from "@/lib/ai/model-config";
import { getDefaultLlmRuntimeConfig } from "@/lib/ai/model-config";
import { estimateTokenCount } from "@/lib/home-workspace-utils";
import { configureServerOutboundProxy } from "@/lib/network/proxy";
import {
  createObservedOpenAIClient,
  type AiObservationContext,
  updateAiObservation,
  withAiObservation
} from "@/lib/observability/langfuse";

export type RuntimeChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type RuntimeChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | RuntimeChatContentPart[];
};

export type RuntimeTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  estimated: boolean;
};

const defaultReasoningEffort = "medium";
const defaultLocale: Locale = "zh-CN";

export async function createDefaultOpenAIClient(userId?: string | null, observationContext?: AiObservationContext) {
  const config = await getDefaultLlmRuntimeConfig(userId);
  await configureServerOutboundProxy();
  const context = withRuntimeModelContext(
    {
      feature: "llm.default",
      userId,
      ...observationContext
    },
    config
  );

  return {
    client: createObservedOpenAIClient(
      {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        modelId: config.modelId,
        providerName: config.providerName,
        source: config.source,
        temperature: config.temperature
      },
      context
    ),
    config
  };
}

export async function generateDefaultLlmReply(
  messages: RuntimeChatMessage[],
  userId?: string | null,
  showThinking = false,
  locale: Locale = defaultLocale,
  observationContext?: AiObservationContext
) {
  const baseContext = buildLlmObservationContext({
    feature: "llm.generate",
    input: sanitizeRuntimeMessagesForObservation(messages),
    locale,
    observationContext,
    userId
  });

  return withAiObservation(baseContext.traceName ?? baseContext.feature, baseContext, async (span) => {
    const { client, config } = await createDefaultOpenAIClient(userId, baseContext);
    const enrichedContext = withRuntimeModelContext(baseContext, config);

    updateAiObservation(span, {
      input: sanitizeRuntimeMessagesForObservation(messages),
      metadata: {
        ...enrichedContext.metadata,
        modelId: config.modelId,
        providerName: config.providerName,
        temperature: config.temperature
      }
    });

    const completion = await createNonStreamingCompletion(client, config, messages);
    const message = completion.choices[0]?.message;
    const answerContent = message?.content?.trim() ?? "";
    const reasoningContent = showThinking ? extractReasoningContent(message) : "";
    const content = formatVisibleReply({
      answerContent,
      locale,
      reasoningContent,
      showThinking
    });

    if (!content) {
      throw new Error("The default LLM returned an empty response.");
    }

    const usage = resolveCompletionUsage({
      completionTokens: completion.usage?.completion_tokens,
      content,
      messages,
      promptTokens: completion.usage?.prompt_tokens
    });

    updateAiObservation(span, {
      metadata: {
        ...enrichedContext.metadata,
        completionTokens: usage.completionTokens,
        modelId: config.modelId,
        promptTokens: usage.promptTokens,
        providerName: config.providerName,
        tokenUsageEstimated: usage.estimated
      },
      output: content
    });

    return { content, usage };
  });
}

export async function streamDefaultLlmReply(
  messages: RuntimeChatMessage[],
  onDelta: (content: string) => void,
  userId?: string | null,
  showThinking = false,
  locale: Locale = defaultLocale,
  observationContext?: AiObservationContext
) {
  const baseContext = buildLlmObservationContext({
    feature: "llm.stream",
    input: sanitizeRuntimeMessagesForObservation(messages),
    locale,
    observationContext,
    userId
  });

  return withAiObservation(baseContext.traceName ?? baseContext.feature, baseContext, async (span) => {
    const { client, config } = await createDefaultOpenAIClient(userId, baseContext);
    const enrichedContext = withRuntimeModelContext(baseContext, config);

    updateAiObservation(span, {
      input: sanitizeRuntimeMessagesForObservation(messages),
      metadata: {
        ...enrichedContext.metadata,
        modelId: config.modelId,
        providerName: config.providerName,
        temperature: config.temperature
      }
    });

    const stream = await createStreamingCompletion(client, config, messages);
    let content = "";
    let answerStarted = false;
    let reasoningStarted = false;
    let promptTokens: number | null | undefined;
    let completionTokens: number | null | undefined;

    for await (const chunk of stream) {
      const deltaRecord = chunk.choices[0]?.delta;
      const reasoningDelta = showThinking ? extractReasoningContent(deltaRecord) : "";
      const delta = chunk.choices[0]?.delta?.content;

      if (reasoningDelta) {
        const visibleDelta = reasoningStarted ? reasoningDelta : `${thinkingHeader(locale)}${reasoningDelta}`;

        reasoningStarted = true;
        content += visibleDelta;
        onDelta(visibleDelta);
      }

      if (typeof delta === "string" && delta) {
        const visibleDelta = showThinking && reasoningStarted && !answerStarted ? `${replyHeader(locale)}${delta}` : delta;

        answerStarted = true;
        content += visibleDelta;
        onDelta(visibleDelta);
      }

      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;
        completionTokens = chunk.usage.completion_tokens;
      }
    }

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      throw new Error("The default LLM returned an empty response.");
    }

    const usage = resolveCompletionUsage({
      completionTokens,
      content: trimmedContent,
      messages,
      promptTokens
    });

    updateAiObservation(span, {
      metadata: {
        ...enrichedContext.metadata,
        completionTokens: usage.completionTokens,
        modelId: config.modelId,
        promptTokens: usage.promptTokens,
        providerName: config.providerName,
        tokenUsageEstimated: usage.estimated
      },
      output: trimmedContent
    });

    return {
      content: trimmedContent,
      usage
    };
  });
}

function buildLlmObservationContext({
  feature,
  input,
  locale,
  observationContext,
  userId
}: {
  feature: string;
  input: RuntimeChatMessage[];
  locale: Locale;
  observationContext?: AiObservationContext;
  userId?: string | null;
}): AiObservationContext {
  return {
    ...observationContext,
    feature: observationContext?.feature ?? feature,
    input,
    locale,
    sessionId: observationContext?.sessionId ?? observationContext?.conversationId,
    userId: observationContext?.userId ?? userId
  };
}

function withRuntimeModelContext(context: AiObservationContext, config: DefaultLlmRuntimeConfig): AiObservationContext {
  return {
    ...context,
    metadata: {
      ...(context.metadata ?? {}),
      modelSource: config.source
    },
    modelId: config.modelId,
    providerName: config.providerName
  };
}

function buildBaseChatParams(config: DefaultLlmRuntimeConfig, messages: RuntimeChatMessage[]) {
  return {
    model: config.modelId,
    messages: messages as ChatCompletionMessageParam[],
    temperature: config.temperature
  };
}

function sanitizeRuntimeMessagesForObservation(messages: RuntimeChatMessage[]) {
  return messages.map((message) => ({
    ...message,
    content: Array.isArray(message.content)
      ? message.content.map<RuntimeChatContentPart>((part) => {
          if (part.type === "image_url") {
            return {
              type: "image_url",
              image_url: {
                url: summarizeImageUrl(part.image_url.url)
              }
            };
          }

          return part;
        })
      : message.content
  }));
}

function summarizeImageUrl(url: string) {
  if (!url.startsWith("data:")) {
    return url.slice(0, 200);
  }

  const contentType = url.match(/^data:([^;,]+)/)?.[1] ?? "image/*";

  return `[${contentType} data url omitted]`;
}

function withDefaultThinking<T extends Record<string, unknown>>(params: T): T {
  return {
    ...params,
    enable_thinking: true,
    reasoning_effort: defaultReasoningEffort
  };
}

function extractReasoningContent(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  const directReasoning = toText(record.reasoning_content) || toText(record.reasoning);

  if (directReasoning) {
    return directReasoning;
  }

  const details = record.reasoning_details;

  if (Array.isArray(details)) {
    return details.map((item) => extractReasoningContent(item)).filter(Boolean).join("");
  }

  return "";
}

function toText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;

  return toText(record.content) || toText(record.text);
}

function formatVisibleReply({
  answerContent,
  locale,
  reasoningContent,
  showThinking
}: {
  answerContent: string;
  locale: Locale;
  reasoningContent: string;
  showThinking: boolean;
}) {
  const normalizedAnswer = answerContent.trim();
  const normalizedReasoning = reasoningContent.trim();

  if (!showThinking || !normalizedReasoning) {
    return normalizedAnswer;
  }

  if (!normalizedAnswer) {
    return `${thinkingHeader(locale)}${normalizedReasoning}`;
  }

  return `${thinkingHeader(locale)}${normalizedReasoning}${replyHeader(locale)}${normalizedAnswer}`;
}

function thinkingHeader(locale: Locale) {
  return locale === "en-US" ? "Thinking\n" : "【思考】\n";
}

function replyHeader(locale: Locale) {
  return locale === "en-US" ? "\n\nReply\n" : "\n\n【回复】\n";
}

async function createNonStreamingCompletion(
  client: OpenAI,
  config: DefaultLlmRuntimeConfig,
  messages: RuntimeChatMessage[]
): Promise<ChatCompletion> {
  const baseParams = buildBaseChatParams(config, messages);

  try {
    return await client.chat.completions.create(
      withDefaultThinking({ ...baseParams, stream: false }) as unknown as ChatCompletionCreateParamsNonStreaming
    );
  } catch (error) {
    if (!isRetryableChatParamError(error)) {
      throw error;
    }

    return client.chat.completions.create({
      ...baseParams,
      stream: false
    } as ChatCompletionCreateParamsNonStreaming);
  }
}

async function createStreamingCompletion(
  client: OpenAI,
  config: DefaultLlmRuntimeConfig,
  messages: RuntimeChatMessage[]
) {
  const baseParams = buildBaseChatParams(config, messages);
  const attempts: Array<Record<string, unknown>> = [
    withDefaultThinking({
      ...baseParams,
      stream: true,
      stream_options: { include_usage: true }
    }),
    withDefaultThinking({
      ...baseParams,
      stream: true
    }),
    {
      ...baseParams,
      stream: true,
      stream_options: { include_usage: true }
    },
    {
      ...baseParams,
      stream: true
    }
  ];
  let lastError: unknown;

  for (const params of attempts) {
    try {
      return await client.chat.completions.create(params as unknown as ChatCompletionCreateParamsStreaming);
    } catch (error) {
      if (!isRetryableChatParamError(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError;
}

function isRetryableChatParamError(error: unknown) {
  if (!(error instanceof OpenAI.APIError)) {
    return false;
  }

  return error.status === 400 || error.status === 422;
}

function resolveCompletionUsage({
  completionTokens,
  content,
  messages,
  promptTokens
}: {
  completionTokens: number | null | undefined;
  content: string;
  messages: RuntimeChatMessage[];
  promptTokens: number | null | undefined;
}): RuntimeTokenUsage {
  const hasPromptTokens = typeof promptTokens === "number";
  const hasCompletionTokens = typeof completionTokens === "number";

  return {
    promptTokens: hasPromptTokens ? promptTokens : estimateTokenCount(messages.map((message) => `${message.role}: ${runtimeMessageContentToText(message.content)}`).join("\n")),
    completionTokens: hasCompletionTokens ? completionTokens : estimateTokenCount(content),
    estimated: !hasPromptTokens || !hasCompletionTokens
  };
}

function runtimeMessageContentToText(content: RuntimeChatMessage["content"]) {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => part.type === "text" ? part.text : "[image]")
    .join("\n");
}
