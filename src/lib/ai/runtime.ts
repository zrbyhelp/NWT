import "server-only";

import OpenAI from "openai";
import { getDefaultLlmRuntimeConfig } from "@/lib/ai/model-config";
import { estimateTokenCount } from "@/lib/home-workspace-utils";

export type RuntimeChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type RuntimeTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  estimated: boolean;
};

export async function createDefaultOpenAIClient() {
  const config = await getDefaultLlmRuntimeConfig();

  return {
    client: new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    }),
    config
  };
}

export async function generateDefaultLlmReply(messages: RuntimeChatMessage[]) {
  const { client, config } = await createDefaultOpenAIClient();
  const completion = await client.chat.completions.create({
    model: config.modelId,
    messages,
    temperature: config.temperature
  });
  const content = completion.choices[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("The default LLM returned an empty response.");
  }

  const usage = resolveCompletionUsage({
    completionTokens: completion.usage?.completion_tokens,
    content,
    messages,
    promptTokens: completion.usage?.prompt_tokens
  });

  return { content, usage };
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
    promptTokens: hasPromptTokens ? promptTokens : estimateTokenCount(messages.map((message) => `${message.role}: ${message.content}`).join("\n")),
    completionTokens: hasCompletionTokens ? completionTokens : estimateTokenCount(content),
    estimated: !hasPromptTokens || !hasCompletionTokens
  };
}
