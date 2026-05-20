import type { ProviderModelKind, ProviderModelOption } from "@/lib/ai/config-types";

type OpenAIModelLike = {
  id?: unknown;
  owned_by?: unknown;
};

export function normalizeProviderModels(payload: unknown): ProviderModelOption[] {
  const data = resolveModelData(payload);
  const models = new Map<string, ProviderModelOption>();

  for (const item of data) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const model = item as OpenAIModelLike;
    const id = typeof model.id === "string" ? model.id.trim() : "";

    if (!id || models.has(id)) {
      continue;
    }

    models.set(id, {
      id,
      displayName: id,
      ownedBy: typeof model.owned_by === "string" ? model.owned_by : undefined,
      kind: classifyProviderModelId(id)
    });
  }

  return [...models.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function classifyProviderModelId(modelId: string): ProviderModelKind {
  const normalized = modelId.toLowerCase();

  if (/(^|[-_:/])(embed|embedding|embeddings)([-_:/]|$)/.test(normalized)) {
    return "embedding";
  }

  if (/(^|[-_:/])(bge|e5|gte|jina-embeddings?|text-embedding)([-_:/]|$)/.test(normalized)) {
    return "embedding";
  }

  if (/(gpt-image|dall-?e|imagen|image|flux|stable-diffusion|sdxl|midjourney|ideogram|dreamshaper|playground|qwen-image)/.test(normalized)) {
    return "image";
  }

  if (/(gpt|chat|claude|gemini|qwen|deepseek|llama|mistral|mixtral|glm|moonshot|kimi|doubao|ernie|hunyuan|spark|command|grok|baichuan|internlm|minimax|abab|phi)/.test(normalized)) {
    return "llm";
  }

  if (/^o[0-9]/.test(normalized)) {
    return "llm";
  }

  return "unknown";
}

function resolveModelData(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: unknown[] }).data;
  }

  return [];
}
