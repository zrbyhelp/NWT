import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/ai/config-crypto";
import {
  AiConfigError,
  aiProviderInputSchema,
  llmModelInputSchema,
  type AiConfigSnapshot,
  type AiProviderInput,
  type LlmModelInput,
  type VectorModelInput,
  vectorModelInputSchema
} from "@/lib/ai/config-types";
import { chooseDefaultModel } from "@/lib/ai/model-config-utils";
import { prisma } from "@/lib/prisma";

export type DefaultLlmRuntimeConfig = {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  temperature: number;
  contextWindow: number;
  source: "database" | "environment";
};

export async function getAiConfigSnapshot(): Promise<AiConfigSnapshot> {
  const [providers, llmModels, vectorModels] = await Promise.all([
    prisma.aiProvider.findMany({
      include: { _count: { select: { llmModels: true, vectorModels: true } } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.llmModel.findMany({
      include: { provider: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.vectorModel.findMany({
      include: { provider: true },
      orderBy: { createdAt: "asc" }
    })
  ]);

  return {
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      baseUrl: provider.baseUrl,
      hasApiKey: Boolean(provider.encryptedApiKey),
      enabled: provider.enabled,
      createdAt: provider.createdAt.toISOString(),
      updatedAt: provider.updatedAt.toISOString(),
      modelCount: provider._count.llmModels + provider._count.vectorModels
    })),
    llmModels: llmModels.map((model) => ({
      id: model.id,
      providerId: model.providerId,
      providerName: model.provider.name,
      providerEnabled: model.provider.enabled,
      displayName: model.displayName,
      modelId: model.modelId,
      contextWindow: model.contextWindow,
      temperature: model.temperature,
      enabled: model.enabled,
      isDefault: model.isDefault,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    })),
    vectorModels: vectorModels.map((model) => ({
      id: model.id,
      providerId: model.providerId,
      providerName: model.provider.name,
      providerEnabled: model.provider.enabled,
      displayName: model.displayName,
      modelId: model.modelId,
      dimensions: model.dimensions,
      maxInputTokens: model.maxInputTokens,
      enabled: model.enabled,
      isDefault: model.isDefault,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    }))
  };
}

export async function saveAiProvider(input: AiProviderInput) {
  const parsed = aiProviderInputSchema.parse(input);
  const apiKey = parsed.apiKey?.trim();
  const encryptedApiKey = apiKey ? encryptSecret(apiKey) : undefined;

  if (parsed.id) {
    const existingProvider = await prisma.aiProvider.findUniqueOrThrow({ where: { id: parsed.id } });

    await prisma.aiProvider.update({
      where: { id: parsed.id },
      data: {
        name: parsed.name,
        slug: parsed.slug,
        baseUrl: parsed.baseUrl,
        enabled: parsed.enabled,
        encryptedApiKey: encryptedApiKey ?? (parsed.clearApiKey ? null : existingProvider.encryptedApiKey)
      }
    });
  } else {
    await prisma.aiProvider.create({
      data: {
        name: parsed.name,
        slug: parsed.slug,
        baseUrl: parsed.baseUrl,
        enabled: parsed.enabled,
        encryptedApiKey: encryptedApiKey ?? null
      }
    });
  }

  if (!parsed.enabled && parsed.id) {
    await Promise.all([
      prisma.llmModel.updateMany({ where: { providerId: parsed.id, isDefault: true }, data: { isDefault: false } }),
      prisma.vectorModel.updateMany({ where: { providerId: parsed.id, isDefault: true }, data: { isDefault: false } })
    ]);
  }

  await ensureAllDefaults();
  return getAiConfigSnapshot();
}

export async function deleteAiProvider(providerId: string) {
  const provider = await prisma.aiProvider.findUniqueOrThrow({
    where: { id: providerId },
    include: { _count: { select: { llmModels: true, vectorModels: true } } }
  });

  if (provider._count.llmModels + provider._count.vectorModels > 0) {
    throw new AiConfigError("Delete related models before deleting this provider.", "provider-has-models");
  }

  await prisma.aiProvider.delete({ where: { id: providerId } });
  await ensureAllDefaults();
  return getAiConfigSnapshot();
}

export async function saveLlmModel(input: LlmModelInput) {
  const parsed = llmModelInputSchema.parse(input);
  const provider = await prisma.aiProvider.findUniqueOrThrow({ where: { id: parsed.providerId } });
  const canBeDefault = parsed.enabled && provider.enabled && parsed.isDefault;

  const model = parsed.id
    ? await prisma.llmModel.update({
        where: { id: parsed.id },
        data: {
          providerId: parsed.providerId,
          displayName: parsed.displayName,
          modelId: parsed.modelId,
          contextWindow: parsed.contextWindow,
          temperature: parsed.temperature,
          enabled: parsed.enabled,
          isDefault: false
        }
      })
    : await prisma.llmModel.create({
        data: {
          providerId: parsed.providerId,
          displayName: parsed.displayName,
          modelId: parsed.modelId,
          contextWindow: parsed.contextWindow,
          temperature: parsed.temperature,
          enabled: parsed.enabled,
          isDefault: false
        }
      });

  if (canBeDefault) {
    await prisma.llmModel.updateMany({ where: { id: { not: model.id } }, data: { isDefault: false } });
    await prisma.llmModel.update({ where: { id: model.id }, data: { isDefault: true } });
  }

  await ensureLlmDefault();
  return getAiConfigSnapshot();
}

export async function deleteLlmModel(modelId: string) {
  await prisma.llmModel.delete({ where: { id: modelId } });
  await ensureLlmDefault();
  return getAiConfigSnapshot();
}

export async function saveVectorModel(input: VectorModelInput) {
  const parsed = vectorModelInputSchema.parse(input);
  const provider = await prisma.aiProvider.findUniqueOrThrow({ where: { id: parsed.providerId } });
  const canBeDefault = parsed.enabled && provider.enabled && parsed.isDefault;

  const model = parsed.id
    ? await prisma.vectorModel.update({
        where: { id: parsed.id },
        data: {
          providerId: parsed.providerId,
          displayName: parsed.displayName,
          modelId: parsed.modelId,
          dimensions: parsed.dimensions,
          maxInputTokens: parsed.maxInputTokens,
          enabled: parsed.enabled,
          isDefault: false
        }
      })
    : await prisma.vectorModel.create({
        data: {
          providerId: parsed.providerId,
          displayName: parsed.displayName,
          modelId: parsed.modelId,
          dimensions: parsed.dimensions,
          maxInputTokens: parsed.maxInputTokens,
          enabled: parsed.enabled,
          isDefault: false
        }
      });

  if (canBeDefault) {
    await prisma.vectorModel.updateMany({ where: { id: { not: model.id } }, data: { isDefault: false } });
    await prisma.vectorModel.update({ where: { id: model.id }, data: { isDefault: true } });
  }

  await ensureVectorDefault();
  return getAiConfigSnapshot();
}

export async function deleteVectorModel(modelId: string) {
  await prisma.vectorModel.delete({ where: { id: modelId } });
  await ensureVectorDefault();
  return getAiConfigSnapshot();
}

export async function getDefaultLlmRuntimeConfig(): Promise<DefaultLlmRuntimeConfig> {
  const { env } = await import("@/env");
  const defaultModel = await prisma.llmModel.findFirst({
    where: {
      enabled: true,
      isDefault: true,
      provider: { enabled: true }
    },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });

  if (!defaultModel) {
    if (!env.OPENAI_BASE_URL || !env.OPENAI_API_KEY || !env.OPENAI_MODEL) {
      throw new AiConfigError("No default LLM model is configured.", "missing-default-llm");
    }

    return {
      providerName: "Environment",
      baseUrl: env.OPENAI_BASE_URL,
      apiKey: env.OPENAI_API_KEY,
      modelId: env.OPENAI_MODEL,
      temperature: 0.7,
      contextWindow: 128000,
      source: "environment"
    };
  }

  if (!defaultModel.provider.encryptedApiKey) {
    throw new AiConfigError("The default model provider has no API key.", "missing-provider-secret");
  }

  return {
    providerName: defaultModel.provider.name,
    baseUrl: defaultModel.provider.baseUrl,
    apiKey: decryptSecret(defaultModel.provider.encryptedApiKey),
    modelId: defaultModel.modelId,
    temperature: defaultModel.temperature,
    contextWindow: defaultModel.contextWindow,
    source: "database"
  };
}

export async function getDefaultVectorModel() {
  return prisma.vectorModel.findFirst({
    where: {
      enabled: true,
      isDefault: true,
      provider: { enabled: true }
    },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
}

async function ensureAllDefaults() {
  await Promise.all([ensureLlmDefault(), ensureVectorDefault()]);
}

async function ensureLlmDefault() {
  const models = await prisma.llmModel.findMany({
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
  const selected = chooseDefaultModel(
    models.map((model) => ({
      id: model.id,
      enabled: model.enabled,
      isDefault: model.isDefault,
      providerEnabled: model.provider.enabled,
      createdAt: model.createdAt
    }))
  );

  if (!selected) {
    await prisma.llmModel.updateMany({ data: { isDefault: false } });
    return;
  }

  await prisma.llmModel.updateMany({ where: { id: { not: selected.id } }, data: { isDefault: false } });
  await prisma.llmModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}

async function ensureVectorDefault() {
  const models = await prisma.vectorModel.findMany({
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
  const selected = chooseDefaultModel(
    models.map((model) => ({
      id: model.id,
      enabled: model.enabled,
      isDefault: model.isDefault,
      providerEnabled: model.provider.enabled,
      createdAt: model.createdAt
    }))
  );

  if (!selected) {
    await prisma.vectorModel.updateMany({ data: { isDefault: false } });
    return;
  }

  await prisma.vectorModel.updateMany({ where: { id: { not: selected.id } }, data: { isDefault: false } });
  await prisma.vectorModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}
