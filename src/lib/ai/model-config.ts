import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/ai/config-crypto";
import {
  AiConfigError,
  aiProviderInputSchema,
  imageModelInputSchema,
  llmModelInputSchema,
  type AiConfigSnapshot,
  type AiProviderInput,
  type ImageModelInput,
  type LlmModelInput,
  type ProviderModelOption,
  type VectorModelInput,
  vectorModelInputSchema
} from "@/lib/ai/config-types";
import { chooseDefaultModel } from "@/lib/ai/model-config-utils";
import { normalizeProviderModels } from "@/lib/ai/provider-model-utils";
import { configureServerOutboundProxy } from "@/lib/network/proxy";
import { updateAiObservation, withAiObservation } from "@/lib/observability/langfuse";
import { prisma } from "@/lib/prisma";

export type DefaultLlmRuntimeConfig = {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  temperature: number;
  source: "database" | "environment";
};

export type DefaultImageRuntimeConfig = {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
};

export async function getAiConfigSnapshot(userId: string): Promise<AiConfigSnapshot> {
  const [providers, llmModels, vectorModels, imageModels] = await Promise.all([
    prisma.aiProvider.findMany({
      where: { userId },
      include: { _count: { select: { imageModels: true, llmModels: true, vectorModels: true } } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.llmModel.findMany({
      where: { provider: { userId } },
      include: { provider: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.vectorModel.findMany({
      where: { provider: { userId } },
      include: { provider: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.imageModel.findMany({
      where: { provider: { userId } },
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
      modelCount: provider._count.llmModels + provider._count.vectorModels + provider._count.imageModels
    })),
    llmModels: llmModels.map((model) => ({
      id: model.id,
      providerId: model.providerId,
      providerName: model.provider.name,
      providerEnabled: model.provider.enabled,
      displayName: model.displayName,
      modelId: model.modelId,
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
    })),
    imageModels: imageModels.map((model) => ({
      id: model.id,
      providerId: model.providerId,
      providerName: model.provider.name,
      providerEnabled: model.provider.enabled,
      displayName: model.displayName,
      modelId: model.modelId,
      enabled: model.enabled,
      isDefault: model.isDefault,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    }))
  };
}

export async function saveAiProvider(userId: string, input: AiProviderInput) {
  const parsed = aiProviderInputSchema.parse(input);
  const apiKey = parsed.apiKey?.trim();
  const encryptedApiKey = apiKey ? encryptSecret(apiKey) : undefined;

  if (parsed.id) {
    const existingProvider = await findUserProviderOrThrow(userId, parsed.id);

    await prisma.aiProvider.update({
      where: { id: existingProvider.id },
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
        userId,
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
      prisma.llmModel.updateMany({
        where: { provider: { userId }, providerId: parsed.id, isDefault: true },
        data: { isDefault: false }
      }),
      prisma.vectorModel.updateMany({
        where: { provider: { userId }, providerId: parsed.id, isDefault: true },
        data: { isDefault: false }
      }),
      prisma.imageModel.updateMany({
        where: { provider: { userId }, providerId: parsed.id, isDefault: true },
        data: { isDefault: false }
      })
    ]);
  }

  await ensureAllDefaults(userId);
  return getAiConfigSnapshot(userId);
}

export async function deleteAiProvider(userId: string, providerId: string) {
  const provider = await prisma.aiProvider.findFirstOrThrow({
    where: { id: providerId, userId },
    include: { _count: { select: { imageModels: true, llmModels: true, vectorModels: true } } }
  });

  if (provider._count.llmModels + provider._count.vectorModels + provider._count.imageModels > 0) {
    throw new AiConfigError("Delete related models before deleting this provider.", "provider-has-models");
  }

  await prisma.aiProvider.delete({ where: { id: providerId } });
  await ensureAllDefaults(userId);
  return getAiConfigSnapshot(userId);
}

export async function fetchProviderModels(userId: string, providerId: string): Promise<ProviderModelOption[]> {
  await configureServerOutboundProxy();

  const provider = await findUserProviderOrThrow(userId, providerId);

  if (!provider.encryptedApiKey) {
    throw new AiConfigError("The selected provider has no API key.", "missing-provider-secret");
  }

  const apiKey = decryptSecret(provider.encryptedApiKey);

  return withAiObservation(
    "provider.models.fetch",
    {
      feature: "provider.models.fetch",
      input: {
        baseUrl: provider.baseUrl,
        providerId: provider.id
      },
      metadata: {
        providerId: provider.id,
        providerSlug: provider.slug
      },
      providerName: provider.name,
      userId
    },
    async (span) => {
      const response = await fetch(`${provider.baseUrl.replace(/\/+$/, "")}/models`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        updateAiObservation(span, {
          level: "ERROR",
          metadata: {
            providerId: provider.id,
            providerSlug: provider.slug,
            status: response.status
          },
          statusMessage: `Failed to fetch provider models: ${response.status}`
        });
        throw new AiConfigError(`Failed to fetch provider models: ${response.status}`, "provider-model-fetch-failed");
      }

      const models = normalizeProviderModels(await response.json());

      updateAiObservation(span, {
        metadata: {
          modelCount: models.length,
          providerId: provider.id,
          providerSlug: provider.slug
        },
        output: {
          count: models.length,
          models: models.map((model) => ({ id: model.id, kind: model.kind, ownedBy: model.ownedBy }))
        }
      });

      return models;
    }
  );
}

export async function saveLlmModel(userId: string, input: LlmModelInput) {
  const parsed = llmModelInputSchema.parse(input);
  const provider = await findUserProviderOrThrow(userId, parsed.providerId);
  const canBeDefault = parsed.enabled && provider.enabled && parsed.isDefault;

  if (parsed.id) {
    await findUserLlmModelOrThrow(userId, parsed.id);
  }

  const model = parsed.id
    ? await prisma.llmModel.update({
        where: { id: parsed.id },
        data: {
          providerId: parsed.providerId,
          displayName: parsed.displayName,
          modelId: parsed.modelId,
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
          temperature: parsed.temperature,
          enabled: parsed.enabled,
          isDefault: false
        }
      });

  if (canBeDefault) {
    await prisma.llmModel.updateMany({
      where: { id: { not: model.id }, provider: { userId } },
      data: { isDefault: false }
    });
    await prisma.llmModel.update({ where: { id: model.id }, data: { isDefault: true } });
  }

  await ensureLlmDefault(userId);
  return getAiConfigSnapshot(userId);
}

export async function deleteLlmModel(userId: string, modelId: string) {
  await findUserLlmModelOrThrow(userId, modelId);
  await prisma.llmModel.delete({ where: { id: modelId } });
  await ensureLlmDefault(userId);
  return getAiConfigSnapshot(userId);
}

export async function saveVectorModel(userId: string, input: VectorModelInput) {
  const parsed = vectorModelInputSchema.parse(input);
  const provider = await findUserProviderOrThrow(userId, parsed.providerId);
  const canBeDefault = parsed.enabled && provider.enabled && parsed.isDefault;

  if (parsed.id) {
    await findUserVectorModelOrThrow(userId, parsed.id);
  }

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
    await prisma.vectorModel.updateMany({
      where: { id: { not: model.id }, provider: { userId } },
      data: { isDefault: false }
    });
    await prisma.vectorModel.update({ where: { id: model.id }, data: { isDefault: true } });
  }

  await ensureVectorDefault(userId);
  return getAiConfigSnapshot(userId);
}

export async function deleteVectorModel(userId: string, modelId: string) {
  await findUserVectorModelOrThrow(userId, modelId);
  await prisma.vectorModel.delete({ where: { id: modelId } });
  await ensureVectorDefault(userId);
  return getAiConfigSnapshot(userId);
}

export async function saveImageModel(userId: string, input: ImageModelInput) {
  const parsed = imageModelInputSchema.parse(input);
  const provider = await findUserProviderOrThrow(userId, parsed.providerId);
  const canBeDefault = parsed.enabled && provider.enabled && parsed.isDefault;

  if (parsed.id) {
    await findUserImageModelOrThrow(userId, parsed.id);
  }

  const model = parsed.id
    ? await prisma.imageModel.update({
        where: { id: parsed.id },
        data: {
          providerId: parsed.providerId,
          displayName: parsed.displayName,
          modelId: parsed.modelId,
          enabled: parsed.enabled,
          isDefault: false
        }
      })
    : await prisma.imageModel.create({
        data: {
          providerId: parsed.providerId,
          displayName: parsed.displayName,
          modelId: parsed.modelId,
          enabled: parsed.enabled,
          isDefault: false
        }
      });

  if (canBeDefault) {
    await prisma.imageModel.updateMany({
      where: { id: { not: model.id }, provider: { userId } },
      data: { isDefault: false }
    });
    await prisma.imageModel.update({ where: { id: model.id }, data: { isDefault: true } });
  }

  await ensureImageDefault(userId);
  return getAiConfigSnapshot(userId);
}

export async function deleteImageModel(userId: string, modelId: string) {
  await findUserImageModelOrThrow(userId, modelId);
  await prisma.imageModel.delete({ where: { id: modelId } });
  await ensureImageDefault(userId);
  return getAiConfigSnapshot(userId);
}

export async function getDefaultLlmRuntimeConfig(userId?: string | null): Promise<DefaultLlmRuntimeConfig> {
  const defaultModel = userId
    ? await prisma.llmModel.findFirst({
        where: {
          enabled: true,
          isDefault: true,
          provider: { enabled: true, userId }
        },
        include: { provider: true },
        orderBy: { createdAt: "asc" }
      })
    : null;

  if (!defaultModel) {
    if (userId) {
      throw new AiConfigError("No default LLM model is configured for this user.", "missing-default-llm");
    }

    const { env } = await import("@/env");

    if (!env.OPENAI_BASE_URL || !env.OPENAI_API_KEY || !env.OPENAI_MODEL) {
      throw new AiConfigError("No default LLM model is configured.", "missing-default-llm");
    }

    return {
      providerName: "Environment",
      baseUrl: env.OPENAI_BASE_URL,
      apiKey: env.OPENAI_API_KEY,
      modelId: env.OPENAI_MODEL,
      temperature: 0.7,
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
    source: "database"
  };
}

export async function getDefaultImageRuntimeConfig(userId?: string | null): Promise<DefaultImageRuntimeConfig> {
  const defaultModel = await getDefaultImageModel(userId);

  if (!defaultModel) {
    throw new AiConfigError("No default image model is configured for this user.", "missing-default-image");
  }

  if (!defaultModel.provider.encryptedApiKey) {
    throw new AiConfigError("The default image model provider has no API key.", "missing-provider-secret");
  }

  return {
    providerName: defaultModel.provider.name,
    baseUrl: defaultModel.provider.baseUrl,
    apiKey: decryptSecret(defaultModel.provider.encryptedApiKey),
    modelId: defaultModel.modelId
  };
}

export async function getDefaultVectorModel(userId?: string | null) {
  if (!userId) {
    return null;
  }

  return prisma.vectorModel.findFirst({
    where: {
      enabled: true,
      isDefault: true,
      provider: { enabled: true, userId }
    },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
}

export async function getDefaultImageModel(userId?: string | null) {
  if (!userId) {
    return null;
  }

  return prisma.imageModel.findFirst({
    where: {
      enabled: true,
      isDefault: true,
      provider: { enabled: true, userId }
    },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
}

async function ensureAllDefaults(userId: string) {
  await Promise.all([ensureLlmDefault(userId), ensureVectorDefault(userId), ensureImageDefault(userId)]);
}

async function ensureLlmDefault(userId: string) {
  const models = await prisma.llmModel.findMany({
    where: { provider: { userId } },
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
    await prisma.llmModel.updateMany({ where: { provider: { userId } }, data: { isDefault: false } });
    return;
  }

  await prisma.llmModel.updateMany({ where: { id: { not: selected.id }, provider: { userId } }, data: { isDefault: false } });
  await prisma.llmModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}

async function ensureVectorDefault(userId: string) {
  const models = await prisma.vectorModel.findMany({
    where: { provider: { userId } },
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
    await prisma.vectorModel.updateMany({ where: { provider: { userId } }, data: { isDefault: false } });
    return;
  }

  await prisma.vectorModel.updateMany({ where: { id: { not: selected.id }, provider: { userId } }, data: { isDefault: false } });
  await prisma.vectorModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}

async function ensureImageDefault(userId: string) {
  const models = await prisma.imageModel.findMany({
    where: { provider: { userId } },
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
    await prisma.imageModel.updateMany({ where: { provider: { userId } }, data: { isDefault: false } });
    return;
  }

  await prisma.imageModel.updateMany({ where: { id: { not: selected.id }, provider: { userId } }, data: { isDefault: false } });
  await prisma.imageModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}

async function findUserProviderOrThrow(userId: string, providerId: string) {
  return prisma.aiProvider.findFirstOrThrow({ where: { id: providerId, userId } });
}

async function findUserLlmModelOrThrow(userId: string, modelId: string) {
  return prisma.llmModel.findFirstOrThrow({
    where: {
      id: modelId,
      provider: { userId }
    }
  });
}

async function findUserVectorModelOrThrow(userId: string, modelId: string) {
  return prisma.vectorModel.findFirstOrThrow({
    where: {
      id: modelId,
      provider: { userId }
    }
  });
}

async function findUserImageModelOrThrow(userId: string, modelId: string) {
  return prisma.imageModel.findFirstOrThrow({
    where: {
      id: modelId,
      provider: { userId }
    }
  });
}
