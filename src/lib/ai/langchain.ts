import { ChatOpenAI } from "@langchain/openai";
import { getDefaultLlmRuntimeConfig } from "@/lib/ai/model-config";
import { configureServerOutboundProxy } from "@/lib/network/proxy";
import { type AiObservationContext, createLangGraphRunConfig } from "@/lib/observability/langfuse";

export async function createChatModel(userId?: string | null, observationContext?: AiObservationContext) {
  await configureServerOutboundProxy();

  const config = await getDefaultLlmRuntimeConfig(userId);
  const runConfig = createLangGraphRunConfig({
    ...observationContext,
    feature: observationContext?.feature ?? "langchain.chat",
    metadata: {
      ...(observationContext?.metadata ?? {}),
      modelSource: config.source
    },
    modelId: config.modelId,
    providerName: config.providerName,
    userId: observationContext?.userId ?? userId
  });

  return new ChatOpenAI({
    callbacks: runConfig.callbacks,
    metadata: runConfig.metadata,
    model: config.modelId,
    apiKey: config.apiKey,
    tags: runConfig.tags,
    temperature: config.temperature,
    configuration: {
      baseURL: config.baseUrl
    }
  });
}
