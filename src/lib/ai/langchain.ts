import { ChatOpenAI } from "@langchain/openai";
import { getDefaultLlmRuntimeConfig } from "@/lib/ai/model-config";

export async function createChatModel(userId?: string | null) {
  const config = await getDefaultLlmRuntimeConfig(userId);

  return new ChatOpenAI({
    model: config.modelId,
    apiKey: config.apiKey,
    temperature: config.temperature,
    configuration: {
      baseURL: config.baseUrl
    }
  });
}
