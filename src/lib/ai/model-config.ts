import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/ai/config-crypto";
import {
  AiConfigError,
  aiProviderInputSchema,
  imageModelInputSchema,
  instantMeshConfigInputSchema,
  llmModelInputSchema,
  voiceModelInputSchema,
  type AiConfigSnapshot,
  type AiProviderInput,
  type ImageModelInput,
  type InstantMeshConfigInput,
  type LlmModelInput,
  type ProviderModelOption,
  type VoiceModelInput,
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

export type DefaultInstantMeshRuntimeConfig = {
  name: string;
  baseUrl: string;
  apiKey: string;
  submitPath: string;
  statusPathTemplate: string;
  pollIntervalMs: number;
  timeoutSeconds: number;
};

type InstantMeshConfigRecord = {
  id: string;
  userId: string;
  name: string;
  baseUrl: string;
  encryptedApiKey: string | null;
  submitPath: string;
  statusPathTemplate: string;
  pollIntervalMs: number;
  timeoutSeconds: number;
  enabled: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function instantMeshDelegate() {
  return (prisma as unknown as {
    instantMeshConfig: {
      create: (args: unknown) => Promise<InstantMeshConfigRecord>;
      delete: (args: unknown) => Promise<InstantMeshConfigRecord>;
      findFirst: (args: unknown) => Promise<InstantMeshConfigRecord | null>;
      findFirstOrThrow: (args: unknown) => Promise<InstantMeshConfigRecord>;
      findMany: (args: unknown) => Promise<InstantMeshConfigRecord[]>;
      update: (args: unknown) => Promise<InstantMeshConfigRecord>;
      updateMany: (args: unknown) => Promise<unknown>;
    };
  }).instantMeshConfig;
}

function pickEffectiveDefaultId<
  T extends { id: string; enabled: boolean; isDefault: boolean; createdAt: Date; provider: { enabled: boolean } }
>(personalModels: T[], globalModels: T[]) {
  const personalDefault = chooseMarkedDefaultModel(
    personalModels.map((model) => ({
      id: model.id,
      enabled: model.enabled,
      isDefault: model.isDefault,
      providerEnabled: model.provider.enabled,
      createdAt: model.createdAt
    }))
  );

  if (personalDefault) {
    return personalDefault.id;
  }

  return chooseMarkedDefaultModel(
    globalModels.map((model) => ({
      id: model.id,
      enabled: model.enabled,
      isDefault: model.isDefault,
      providerEnabled: model.provider.enabled,
      createdAt: model.createdAt
    }))
  )?.id ?? null;
}

function chooseMarkedDefaultModel<T extends { enabled: boolean; isDefault: boolean; providerEnabled: boolean; createdAt: Date | string }>(models: T[]) {
  return models
    .filter((model) => model.enabled && model.providerEnabled && model.isDefault)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())[0] ?? null;
}

export async function getAiConfigSnapshot(userId: string): Promise<AiConfigSnapshot> {
  const [providers, llmModels, globalLlmModels, vectorModels, globalVectorModels, imageModels, globalImageModels, voiceModels, globalVoiceModels, instantMeshConfigs] = await Promise.all([
    prisma.aiProvider.findMany({
      where: { userId },
      include: { _count: { select: { imageModels: true, llmModels: true, vectorModels: true, voiceModels: true } } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.llmModel.findMany({
      where: { isGlobal: false, provider: { userId } },
      include: { provider: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.llmModel.findMany({
      where: { isGlobal: true, provider: { user: { role: "ADMIN" } } },
      include: { provider: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.vectorModel.findMany({
      where: { isGlobal: false, provider: { userId } },
      include: { provider: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.vectorModel.findMany({
      where: { isGlobal: true, provider: { user: { role: "ADMIN" } } },
      include: { provider: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.imageModel.findMany({
      where: { isGlobal: false, provider: { userId } },
      include: { provider: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.imageModel.findMany({
      where: { isGlobal: true, provider: { user: { role: "ADMIN" } } },
      include: { provider: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.voiceModel.findMany({
      where: { isGlobal: false, provider: { userId } },
      include: { provider: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.voiceModel.findMany({
      where: { isGlobal: true, provider: { user: { role: "ADMIN" } } },
      include: { provider: true },
      orderBy: { createdAt: "asc" }
    }),
    instantMeshDelegate().findMany({
      where: { userId },
      orderBy: { createdAt: "asc" }
    })
  ]);

  const effectiveLlmDefaultId = pickEffectiveDefaultId(llmModels, globalLlmModels);
  const effectiveVectorDefaultId = pickEffectiveDefaultId(vectorModels, globalVectorModels);
  const effectiveImageDefaultId = pickEffectiveDefaultId(imageModels, globalImageModels);
  const effectiveVoiceDefaultId = pickEffectiveDefaultId(voiceModels, globalVoiceModels);

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
      modelCount: provider._count.llmModels + provider._count.vectorModels + provider._count.imageModels + provider._count.voiceModels
    })),
    llmModels: [...llmModels, ...globalLlmModels].map((model) => ({
      id: model.id,
      providerId: model.providerId,
      providerUserId: model.provider.userId,
      providerName: model.provider.name,
      providerEnabled: model.provider.enabled,
      displayName: model.displayName,
      modelId: model.modelId,
      temperature: model.temperature,
      enabled: model.enabled,
      isDefault: model.id === effectiveLlmDefaultId,
      isGlobal: model.isGlobal,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    })),
    vectorModels: [...vectorModels, ...globalVectorModels].map((model) => ({
      id: model.id,
      providerId: model.providerId,
      providerUserId: model.provider.userId,
      providerName: model.provider.name,
      providerEnabled: model.provider.enabled,
      displayName: model.displayName,
      modelId: model.modelId,
      dimensions: model.dimensions,
      maxInputTokens: model.maxInputTokens,
      enabled: model.enabled,
      isDefault: model.id === effectiveVectorDefaultId,
      isGlobal: model.isGlobal,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    })),
    imageModels: [...imageModels, ...globalImageModels].map((model) => ({
      id: model.id,
      providerId: model.providerId,
      providerUserId: model.provider.userId,
      providerName: model.provider.name,
      providerEnabled: model.provider.enabled,
      displayName: model.displayName,
      modelId: model.modelId,
      enabled: model.enabled,
      isDefault: model.id === effectiveImageDefaultId,
      isGlobal: model.isGlobal,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    })),
    voiceModels: [...voiceModels, ...globalVoiceModels].map((model) => ({
      id: model.id,
      providerId: model.providerId,
      providerUserId: model.provider.userId,
      providerName: model.provider.name,
      providerEnabled: model.provider.enabled,
      displayName: model.displayName,
      modelId: model.modelId,
      enabled: model.enabled,
      isDefault: model.id === effectiveVoiceDefaultId,
      isGlobal: model.isGlobal,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    })),
    instantMeshConfigs: instantMeshConfigs.map((config) => ({
      id: config.id,
      name: config.name,
      baseUrl: config.baseUrl,
      hasApiKey: Boolean(config.encryptedApiKey),
      submitPath: config.submitPath,
      statusPathTemplate: config.statusPathTemplate,
      pollIntervalMs: config.pollIntervalMs,
      timeoutSeconds: config.timeoutSeconds,
      enabled: config.enabled,
      isDefault: config.isDefault,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString()
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
      }),
      prisma.voiceModel.updateMany({
        where: { provider: { userId }, providerId: parsed.id, isDefault: true },
        data: { isDefault: false }
      })
    ]);
  }

  await ensureAllDefaults(userId);
  if (await isAdminUserId(userId)) {
    await ensureGlobalDefaults();
  }
  return getAiConfigSnapshot(userId);
}

export async function deleteAiProvider(userId: string, providerId: string) {
  const provider = await prisma.aiProvider.findFirstOrThrow({
    where: { id: providerId, userId },
    include: { _count: { select: { imageModels: true, llmModels: true, vectorModels: true, voiceModels: true } } }
  });

  if (provider._count.llmModels + provider._count.vectorModels + provider._count.imageModels + provider._count.voiceModels > 0) {
    throw new AiConfigError("Delete related models before deleting this provider.", "provider-has-models");
  }

  await prisma.aiProvider.delete({ where: { id: providerId } });
  await ensureAllDefaults(userId);
  if (await isAdminUserId(userId)) {
    await ensureGlobalDefaults();
  }
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
  const isAdmin = await isAdminUserId(userId);

  if (parsed.isGlobal && !isAdmin) {
    throw new AiConfigError("Only admins can mark models as global.", "forbidden");
  }

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
          isDefault: false,
          isGlobal: parsed.isGlobal && isAdmin
        }
      })
    : await prisma.llmModel.create({
        data: {
          providerId: parsed.providerId,
          displayName: parsed.displayName,
          modelId: parsed.modelId,
          temperature: parsed.temperature,
          enabled: parsed.enabled,
          isDefault: false,
          isGlobal: parsed.isGlobal && isAdmin
        }
      });

  if (canBeDefault) {
    if (parsed.isGlobal) {
      await prisma.llmModel.updateMany({ where: { id: { not: model.id }, isGlobal: true, provider: { user: { role: "ADMIN" } } }, data: { isDefault: false } });
    } else {
      await prisma.llmModel.updateMany({ where: { id: { not: model.id }, provider: { userId }, isGlobal: false }, data: { isDefault: false } });
    }
    await prisma.llmModel.update({ where: { id: model.id }, data: { isDefault: true } });
  }

  await ensureLlmDefault(userId);
  if (isAdmin) {
    await ensureGlobalDefaults();
  }
  return getAiConfigSnapshot(userId);
}

export async function deleteLlmModel(userId: string, modelId: string) {
  const model = await findUserLlmModelOrThrow(userId, modelId);
  await prisma.llmModel.delete({ where: { id: modelId } });
  await ensureLlmDefault(userId);
  if (model.isGlobal && await isAdminUserId(userId)) {
    await ensureGlobalDefaults();
  }
  return getAiConfigSnapshot(userId);
}

export async function saveVectorModel(userId: string, input: VectorModelInput) {
  const parsed = vectorModelInputSchema.parse(input);
  const provider = await findUserProviderOrThrow(userId, parsed.providerId);
  const isAdmin = await isAdminUserId(userId);

  if (parsed.isGlobal && !isAdmin) {
    throw new AiConfigError("Only admins can mark models as global.", "forbidden");
  }

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
          isDefault: false,
          isGlobal: parsed.isGlobal && isAdmin
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
          isDefault: false,
          isGlobal: parsed.isGlobal && isAdmin
        }
      });

  if (canBeDefault) {
    if (parsed.isGlobal) {
      await prisma.vectorModel.updateMany({ where: { id: { not: model.id }, isGlobal: true, provider: { user: { role: "ADMIN" } } }, data: { isDefault: false } });
    } else {
      await prisma.vectorModel.updateMany({ where: { id: { not: model.id }, provider: { userId }, isGlobal: false }, data: { isDefault: false } });
    }
    await prisma.vectorModel.update({ where: { id: model.id }, data: { isDefault: true } });
  }

  await ensureVectorDefault(userId);
  if (isAdmin) {
    await ensureGlobalDefaults();
  }
  return getAiConfigSnapshot(userId);
}

export async function deleteVectorModel(userId: string, modelId: string) {
  const model = await findUserVectorModelOrThrow(userId, modelId);
  await prisma.vectorModel.delete({ where: { id: modelId } });
  await ensureVectorDefault(userId);
  if (model.isGlobal && await isAdminUserId(userId)) {
    await ensureGlobalDefaults();
  }
  return getAiConfigSnapshot(userId);
}

export async function saveImageModel(userId: string, input: ImageModelInput) {
  const parsed = imageModelInputSchema.parse(input);
  const provider = await findUserProviderOrThrow(userId, parsed.providerId);
  const isAdmin = await isAdminUserId(userId);

  if (parsed.isGlobal && !isAdmin) {
    throw new AiConfigError("Only admins can mark models as global.", "forbidden");
  }

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
          isDefault: false,
          isGlobal: parsed.isGlobal && isAdmin
        }
      })
    : await prisma.imageModel.create({
        data: {
          providerId: parsed.providerId,
          displayName: parsed.displayName,
          modelId: parsed.modelId,
          enabled: parsed.enabled,
          isDefault: false,
          isGlobal: parsed.isGlobal && isAdmin
        }
      });

  if (canBeDefault) {
    if (parsed.isGlobal) {
      await prisma.imageModel.updateMany({ where: { id: { not: model.id }, isGlobal: true, provider: { user: { role: "ADMIN" } } }, data: { isDefault: false } });
    } else {
      await prisma.imageModel.updateMany({ where: { id: { not: model.id }, provider: { userId }, isGlobal: false }, data: { isDefault: false } });
    }
    await prisma.imageModel.update({ where: { id: model.id }, data: { isDefault: true } });
  }

  await ensureImageDefault(userId);
  if (isAdmin) {
    await ensureGlobalDefaults();
  }
  return getAiConfigSnapshot(userId);
}

export async function deleteImageModel(userId: string, modelId: string) {
  const model = await findUserImageModelOrThrow(userId, modelId);
  await prisma.imageModel.delete({ where: { id: modelId } });
  await ensureImageDefault(userId);
  if (model.isGlobal && await isAdminUserId(userId)) {
    await ensureGlobalDefaults();
  }
  return getAiConfigSnapshot(userId);
}

export async function saveVoiceModel(userId: string, input: VoiceModelInput) {
  const parsed = voiceModelInputSchema.parse(input);
  const provider = await findUserProviderOrThrow(userId, parsed.providerId);
  const isAdmin = await isAdminUserId(userId);

  if (parsed.isGlobal && !isAdmin) {
    throw new AiConfigError("Only admins can mark models as global.", "forbidden");
  }

  const canBeDefault = parsed.enabled && provider.enabled && parsed.isDefault;

  if (parsed.id) {
    await findUserVoiceModelOrThrow(userId, parsed.id);
  }

  const model = parsed.id
    ? await prisma.voiceModel.update({
        where: { id: parsed.id },
        data: {
          providerId: parsed.providerId,
          displayName: parsed.displayName,
          modelId: parsed.modelId,
          enabled: parsed.enabled,
          isDefault: false,
          isGlobal: parsed.isGlobal && isAdmin
        }
      })
    : await prisma.voiceModel.create({
        data: {
          providerId: parsed.providerId,
          displayName: parsed.displayName,
          modelId: parsed.modelId,
          enabled: parsed.enabled,
          isDefault: false,
          isGlobal: parsed.isGlobal && isAdmin
        }
      });

  if (canBeDefault) {
    if (parsed.isGlobal) {
      await prisma.voiceModel.updateMany({ where: { id: { not: model.id }, isGlobal: true, provider: { user: { role: "ADMIN" } } }, data: { isDefault: false } });
    } else {
      await prisma.voiceModel.updateMany({ where: { id: { not: model.id }, provider: { userId }, isGlobal: false }, data: { isDefault: false } });
    }
    await prisma.voiceModel.update({ where: { id: model.id }, data: { isDefault: true } });
  }

  await ensureVoiceDefault(userId);
  if (isAdmin) {
    await ensureGlobalDefaults();
  }
  return getAiConfigSnapshot(userId);
}

export async function deleteVoiceModel(userId: string, modelId: string) {
  const model = await findUserVoiceModelOrThrow(userId, modelId);
  await prisma.voiceModel.delete({ where: { id: modelId } });
  await ensureVoiceDefault(userId);
  if (model.isGlobal && await isAdminUserId(userId)) {
    await ensureGlobalDefaults();
  }
  return getAiConfigSnapshot(userId);
}

export async function saveInstantMeshConfig(userId: string, input: InstantMeshConfigInput) {
  const parsed = instantMeshConfigInputSchema.parse(input);
  const apiKey = parsed.apiKey?.trim();
  const encryptedApiKey = apiKey ? encryptSecret(apiKey) : undefined;
  const canBeDefault = parsed.enabled && parsed.isDefault;
  const delegate = instantMeshDelegate();

  if (parsed.id) {
    await findUserInstantMeshConfigOrThrow(userId, parsed.id);
  }

  const config = parsed.id
    ? await delegate.update({
        where: { id: parsed.id },
        data: {
          name: parsed.name,
          baseUrl: parsed.baseUrl,
          ...(encryptedApiKey ? { encryptedApiKey } : {}),
          ...(parsed.clearApiKey ? { encryptedApiKey: null } : {}),
          submitPath: parsed.submitPath,
          statusPathTemplate: parsed.statusPathTemplate,
          pollIntervalMs: parsed.pollIntervalMs,
          timeoutSeconds: parsed.timeoutSeconds,
          enabled: parsed.enabled,
          isDefault: false
        }
      })
    : await delegate.create({
        data: {
          userId,
          name: parsed.name,
          baseUrl: parsed.baseUrl,
          encryptedApiKey: encryptedApiKey ?? null,
          submitPath: parsed.submitPath,
          statusPathTemplate: parsed.statusPathTemplate,
          pollIntervalMs: parsed.pollIntervalMs,
          timeoutSeconds: parsed.timeoutSeconds,
          enabled: parsed.enabled,
          isDefault: false
        }
      });

  if (canBeDefault) {
    await delegate.updateMany({
      where: { id: { not: config.id }, userId },
      data: { isDefault: false }
    });
    await delegate.update({ where: { id: config.id }, data: { isDefault: true } });
  }

  await ensureInstantMeshDefault(userId);
  return getAiConfigSnapshot(userId);
}

export async function deleteInstantMeshConfig(userId: string, configId: string) {
  await findUserInstantMeshConfigOrThrow(userId, configId);
  await instantMeshDelegate().delete({ where: { id: configId } });
  await ensureInstantMeshDefault(userId);
  return getAiConfigSnapshot(userId);
}

export async function getDefaultLlmRuntimeConfig(userId?: string | null): Promise<DefaultLlmRuntimeConfig> {
  const personalDefaultModel = userId
    ? await prisma.llmModel.findFirst({
        where: {
          enabled: true,
          isDefault: true,
          isGlobal: false,
          provider: { enabled: true, userId }
        },
        include: { provider: true },
        orderBy: { createdAt: "asc" }
      })
    : null;
  const defaultModel = personalDefaultModel ?? (userId ? await getGlobalDefaultLlmModel() : null);

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

export async function getDefaultInstantMeshRuntimeConfig(userId?: string | null): Promise<DefaultInstantMeshRuntimeConfig> {
  if (!userId) {
    throw new AiConfigError("No default InstantMesh API is configured.", "missing-default-instantmesh");
  }

  const config = await getDefaultInstantMeshConfig(userId);

  if (!config) {
    throw new AiConfigError("No default InstantMesh API is configured for this user.", "missing-default-instantmesh");
  }

  if (!config.encryptedApiKey) {
    throw new AiConfigError("The default InstantMesh API has no API key.", "missing-instantmesh-secret");
  }

  return {
    name: config.name,
    baseUrl: config.baseUrl,
    apiKey: decryptSecret(config.encryptedApiKey),
    submitPath: config.submitPath,
    statusPathTemplate: config.statusPathTemplate,
    pollIntervalMs: config.pollIntervalMs,
    timeoutSeconds: config.timeoutSeconds
  };
}

export async function getDefaultVectorModel(userId?: string | null) {
  if (!userId) {
    return null;
  }

  return (await prisma.vectorModel.findFirst({
    where: {
      enabled: true,
      isDefault: true,
      isGlobal: false,
      provider: { enabled: true, userId }
    },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  })) ?? getGlobalDefaultVectorModel();
}

export async function getDefaultImageModel(userId?: string | null) {
  if (!userId) {
    return null;
  }

  return (await prisma.imageModel.findFirst({
    where: {
      enabled: true,
      isDefault: true,
      isGlobal: false,
      provider: { enabled: true, userId }
    },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  })) ?? getGlobalDefaultImageModel();
}

export async function getDefaultVoiceModel(userId?: string | null) {
  if (!userId) {
    return null;
  }

  return (await prisma.voiceModel.findFirst({
    where: {
      enabled: true,
      isDefault: true,
      isGlobal: false,
      provider: { enabled: true, userId }
    },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  })) ?? getGlobalDefaultVoiceModel();
}

export async function getDefaultInstantMeshConfig(userId?: string | null) {
  if (!userId) {
    return null;
  }

  return instantMeshDelegate().findFirst({
    where: {
      enabled: true,
      isDefault: true,
      userId
    },
    orderBy: { createdAt: "asc" }
  });
}

async function ensureAllDefaults(userId: string) {
  await Promise.all([ensureLlmDefault(userId), ensureVectorDefault(userId), ensureImageDefault(userId), ensureVoiceDefault(userId), ensureInstantMeshDefault(userId)]);
}

async function ensureLlmDefault(userId: string) {
  const models = await prisma.llmModel.findMany({
    where: { isGlobal: false, provider: { userId } },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
  const selected = chooseMarkedDefaultModel(
    models.map((model) => ({
      id: model.id,
      enabled: model.enabled,
      isDefault: model.isDefault,
      providerEnabled: model.provider.enabled,
      createdAt: model.createdAt
    }))
  );

  if (!selected) {
    await prisma.llmModel.updateMany({ where: { isGlobal: false, provider: { userId } }, data: { isDefault: false } });
    return;
  }

  await prisma.llmModel.updateMany({ where: { id: { not: selected.id }, provider: { userId }, isGlobal: false }, data: { isDefault: false } });
  await prisma.llmModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}

async function ensureVectorDefault(userId: string) {
  const models = await prisma.vectorModel.findMany({
    where: { isGlobal: false, provider: { userId } },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
  const selected = chooseMarkedDefaultModel(
    models.map((model) => ({
      id: model.id,
      enabled: model.enabled,
      isDefault: model.isDefault,
      providerEnabled: model.provider.enabled,
      createdAt: model.createdAt
    }))
  );

  if (!selected) {
    await prisma.vectorModel.updateMany({ where: { isGlobal: false, provider: { userId } }, data: { isDefault: false } });
    return;
  }

  await prisma.vectorModel.updateMany({ where: { id: { not: selected.id }, provider: { userId }, isGlobal: false }, data: { isDefault: false } });
  await prisma.vectorModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}

async function ensureImageDefault(userId: string) {
  const models = await prisma.imageModel.findMany({
    where: { isGlobal: false, provider: { userId } },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
  const selected = chooseMarkedDefaultModel(
    models.map((model) => ({
      id: model.id,
      enabled: model.enabled,
      isDefault: model.isDefault,
      providerEnabled: model.provider.enabled,
      createdAt: model.createdAt
    }))
  );

  if (!selected) {
    await prisma.imageModel.updateMany({ where: { isGlobal: false, provider: { userId } }, data: { isDefault: false } });
    return;
  }

  await prisma.imageModel.updateMany({ where: { id: { not: selected.id }, provider: { userId }, isGlobal: false }, data: { isDefault: false } });
  await prisma.imageModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}

async function ensureVoiceDefault(userId: string) {
  const models = await prisma.voiceModel.findMany({
    where: { isGlobal: false, provider: { userId } },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
  const selected = chooseMarkedDefaultModel(
    models.map((model) => ({
      id: model.id,
      enabled: model.enabled,
      isDefault: model.isDefault,
      providerEnabled: model.provider.enabled,
      createdAt: model.createdAt
    }))
  );

  if (!selected) {
    await prisma.voiceModel.updateMany({ where: { isGlobal: false, provider: { userId } }, data: { isDefault: false } });
    return;
  }

  await prisma.voiceModel.updateMany({ where: { id: { not: selected.id }, provider: { userId }, isGlobal: false }, data: { isDefault: false } });
  await prisma.voiceModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}

async function ensureInstantMeshDefault(userId: string) {
  const delegate = instantMeshDelegate();
  const configs = await delegate.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" }
  });
  const selected = chooseDefaultModel(
    configs.map((config) => ({
      id: config.id,
      enabled: config.enabled,
      isDefault: config.isDefault,
      providerEnabled: true,
      createdAt: config.createdAt
    }))
  );

  if (!selected) {
    await delegate.updateMany({ where: { userId }, data: { isDefault: false } });
    return;
  }

  await delegate.updateMany({ where: { id: { not: selected.id }, userId }, data: { isDefault: false } });
  await delegate.update({ where: { id: selected.id }, data: { isDefault: true } });
}

async function ensureGlobalDefaults() {
  await Promise.all([ensureGlobalLlmDefault(), ensureGlobalVectorDefault(), ensureGlobalImageDefault(), ensureGlobalVoiceDefault()]);
}

async function ensureGlobalLlmDefault() {
  const models = await prisma.llmModel.findMany({
    where: { isGlobal: true, provider: { user: { role: "ADMIN" } } },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
  const selected = chooseMarkedDefaultModel(
    models.map((model) => ({
      id: model.id,
      enabled: model.enabled,
      isDefault: model.isDefault,
      providerEnabled: model.provider.enabled,
      createdAt: model.createdAt
    }))
  );

  if (!selected) {
    await prisma.llmModel.updateMany({ where: { isGlobal: true, provider: { user: { role: "ADMIN" } } }, data: { isDefault: false } });
    return;
  }

  await prisma.llmModel.updateMany({ where: { id: { not: selected.id }, isGlobal: true, provider: { user: { role: "ADMIN" } } }, data: { isDefault: false } });
  await prisma.llmModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}

async function ensureGlobalVectorDefault() {
  const models = await prisma.vectorModel.findMany({
    where: { isGlobal: true, provider: { user: { role: "ADMIN" } } },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
  const selected = chooseMarkedDefaultModel(
    models.map((model) => ({
      id: model.id,
      enabled: model.enabled,
      isDefault: model.isDefault,
      providerEnabled: model.provider.enabled,
      createdAt: model.createdAt
    }))
  );

  if (!selected) {
    await prisma.vectorModel.updateMany({ where: { isGlobal: true, provider: { user: { role: "ADMIN" } } }, data: { isDefault: false } });
    return;
  }

  await prisma.vectorModel.updateMany({ where: { id: { not: selected.id }, isGlobal: true, provider: { user: { role: "ADMIN" } } }, data: { isDefault: false } });
  await prisma.vectorModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}

async function ensureGlobalImageDefault() {
  const models = await prisma.imageModel.findMany({
    where: { isGlobal: true, provider: { user: { role: "ADMIN" } } },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
  const selected = chooseMarkedDefaultModel(
    models.map((model) => ({
      id: model.id,
      enabled: model.enabled,
      isDefault: model.isDefault,
      providerEnabled: model.provider.enabled,
      createdAt: model.createdAt
    }))
  );

  if (!selected) {
    await prisma.imageModel.updateMany({ where: { isGlobal: true, provider: { user: { role: "ADMIN" } } }, data: { isDefault: false } });
    return;
  }

  await prisma.imageModel.updateMany({ where: { id: { not: selected.id }, isGlobal: true, provider: { user: { role: "ADMIN" } } }, data: { isDefault: false } });
  await prisma.imageModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}

async function ensureGlobalVoiceDefault() {
  const models = await prisma.voiceModel.findMany({
    where: { isGlobal: true, provider: { user: { role: "ADMIN" } } },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
  const selected = chooseMarkedDefaultModel(
    models.map((model) => ({
      id: model.id,
      enabled: model.enabled,
      isDefault: model.isDefault,
      providerEnabled: model.provider.enabled,
      createdAt: model.createdAt
    }))
  );

  if (!selected) {
    await prisma.voiceModel.updateMany({ where: { isGlobal: true, provider: { user: { role: "ADMIN" } } }, data: { isDefault: false } });
    return;
  }

  await prisma.voiceModel.updateMany({ where: { id: { not: selected.id }, isGlobal: true, provider: { user: { role: "ADMIN" } } }, data: { isDefault: false } });
  await prisma.voiceModel.update({ where: { id: selected.id }, data: { isDefault: true } });
}

function getGlobalDefaultLlmModel() {
  return prisma.llmModel.findFirst({
    where: {
      enabled: true,
      isDefault: true,
      isGlobal: true,
      provider: { enabled: true, user: { role: "ADMIN" } }
    },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
}

function getGlobalDefaultVectorModel() {
  return prisma.vectorModel.findFirst({
    where: {
      enabled: true,
      isDefault: true,
      isGlobal: true,
      provider: { enabled: true, user: { role: "ADMIN" } }
    },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
}

function getGlobalDefaultImageModel() {
  return prisma.imageModel.findFirst({
    where: {
      enabled: true,
      isDefault: true,
      isGlobal: true,
      provider: { enabled: true, user: { role: "ADMIN" } }
    },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
}

function getGlobalDefaultVoiceModel() {
  return prisma.voiceModel.findFirst({
    where: {
      enabled: true,
      isDefault: true,
      isGlobal: true,
      provider: { enabled: true, user: { role: "ADMIN" } }
    },
    include: { provider: true },
    orderBy: { createdAt: "asc" }
  });
}

async function isAdminUserId(userId: string) {
  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  return user?.role === "ADMIN";
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

async function findUserVoiceModelOrThrow(userId: string, modelId: string) {
  return prisma.voiceModel.findFirstOrThrow({
    where: {
      id: modelId,
      provider: { userId }
    }
  });
}

async function findUserInstantMeshConfigOrThrow(userId: string, configId: string) {
  return instantMeshDelegate().findFirstOrThrow({
    where: {
      id: configId,
      userId
    }
  });
}
