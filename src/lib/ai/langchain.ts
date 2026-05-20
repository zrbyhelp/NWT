import { ChatOpenAI } from "@langchain/openai";
import { env } from "@/env";

export function createChatModel() {
  return new ChatOpenAI({
    model: env.OPENAI_MODEL,
    apiKey: env.OPENAI_API_KEY,
    configuration: {
      baseURL: env.OPENAI_BASE_URL
    }
  });
}

