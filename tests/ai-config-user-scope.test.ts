import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    appUser: {
      findUnique: vi.fn()
    },
    aiProvider: {
      create: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn()
    },
    llmModel: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    imageModel: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    instantMeshConfig: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    vectorModel: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));

vi.mock("@/lib/ai/config-crypto", () => ({
  decryptSecret: vi.fn(() => "decrypted-secret"),
  encryptSecret: vi.fn((value: string) => `encrypted:${value}`)
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma
}));

describe("user-scoped AI configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.aiProvider.findMany.mockResolvedValue([]);
    mocks.prisma.llmModel.findMany.mockResolvedValue([]);
    mocks.prisma.imageModel.findMany.mockResolvedValue([]);
    mocks.prisma.instantMeshConfig.findMany.mockResolvedValue([]);
    mocks.prisma.vectorModel.findMany.mockResolvedValue([]);
    mocks.prisma.appUser.findUnique.mockResolvedValue({ role: "USER" });
    mocks.prisma.llmModel.updateMany.mockResolvedValue({});
    mocks.prisma.imageModel.updateMany.mockResolvedValue({});
    mocks.prisma.instantMeshConfig.updateMany.mockResolvedValue({});
    mocks.prisma.vectorModel.updateMany.mockResolvedValue({});
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  it("reads only providers and models owned by the current user", async () => {
    const { getAiConfigSnapshot } = await import("@/lib/ai/model-config");

    await getAiConfigSnapshot("user-a");

    expect(mocks.prisma.aiProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-a" }
      })
    );
    expect(mocks.prisma.llmModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isGlobal: false, provider: { userId: "user-a" } }
      })
    );
    expect(mocks.prisma.llmModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isGlobal: true, provider: { user: { role: "ADMIN" } } }
      })
    );
    expect(mocks.prisma.vectorModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isGlobal: false, provider: { userId: "user-a" } }
      })
    );
    expect(mocks.prisma.imageModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isGlobal: false, provider: { userId: "user-a" } }
      })
    );
    expect(mocks.prisma.instantMeshConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-a" }
      })
    );
  });

  it("shows the global default as effective when personal models are not default", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    mocks.prisma.llmModel.findMany
      .mockResolvedValueOnce([
        {
          createdAt: now,
          displayName: "Personal",
          enabled: true,
          id: "personal-llm",
          isDefault: false,
          isGlobal: false,
          modelId: "personal-model",
          provider: { enabled: true, name: "Personal Provider", userId: "user-a" },
          providerId: "provider-personal",
          temperature: 0.7,
          updatedAt: now
        }
      ])
      .mockResolvedValueOnce([
        {
          createdAt: now,
          displayName: "Global",
          enabled: true,
          id: "global-llm",
          isDefault: true,
          isGlobal: true,
          modelId: "global-model",
          provider: { enabled: true, name: "Global Provider", userId: "admin-user" },
          providerId: "provider-global",
          temperature: 0.7,
          updatedAt: now
        }
      ]);

    const { getAiConfigSnapshot } = await import("@/lib/ai/model-config");
    const snapshot = await getAiConfigSnapshot("user-a");

    expect(snapshot.llmModels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "personal-llm", isDefault: false }),
        expect.objectContaining({ id: "global-llm", isDefault: true, isGlobal: true })
      ])
    );
  });

  it("creates providers under the current user", async () => {
    mocks.prisma.aiProvider.create.mockResolvedValue({});

    const { saveAiProvider } = await import("@/lib/ai/model-config");
    await saveAiProvider("user-a", {
      apiKey: "sk-test",
      baseUrl: "https://api.example.com/v1",
      clearApiKey: false,
      enabled: true,
      name: "Example",
      slug: "example"
    });

    expect(mocks.prisma.aiProvider.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        encryptedApiKey: "encrypted:sk-test",
        userId: "user-a"
      })
    });
  });

  it("loads the default LLM model from the current user's providers", async () => {
    mocks.prisma.llmModel.findFirst.mockResolvedValue({
      modelId: "story-model",
      provider: {
        baseUrl: "https://api.example.com/v1",
        encryptedApiKey: "encrypted-secret",
        name: "Example"
      },
      temperature: 0.8
    });

    const { getDefaultLlmRuntimeConfig } = await import("@/lib/ai/model-config");
    const config = await getDefaultLlmRuntimeConfig("user-a");

    expect(mocks.prisma.llmModel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isGlobal: false,
          provider: { enabled: true, userId: "user-a" }
        })
      })
    );
    expect(config).toMatchObject({
      apiKey: "decrypted-secret",
      modelId: "story-model",
      source: "database"
    });
  });

  it("falls back to the global default LLM when the user has no personal default", async () => {
    mocks.prisma.llmModel.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        modelId: "global-story-model",
        provider: {
          baseUrl: "https://global.example.com/v1",
          encryptedApiKey: "encrypted-secret",
          name: "Global Example"
        },
        temperature: 0.6
      });

    const { getDefaultLlmRuntimeConfig } = await import("@/lib/ai/model-config");
    const config = await getDefaultLlmRuntimeConfig("user-a");

    expect(mocks.prisma.llmModel.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          isGlobal: true,
          provider: { enabled: true, user: { role: "ADMIN" } }
        })
      })
    );
    expect(config).toMatchObject({
      apiKey: "decrypted-secret",
      modelId: "global-story-model",
      source: "database"
    });
  });

  it("requires a personal or global default LLM even when environment fallback exists", async () => {
    process.env.OPENAI_BASE_URL = "https://api.example.com/v1";
    process.env.OPENAI_API_KEY = "sk-env";
    process.env.OPENAI_MODEL = "env-model";
    mocks.prisma.llmModel.findFirst.mockResolvedValue(null);

    const { getDefaultLlmRuntimeConfig } = await import("@/lib/ai/model-config");

    await expect(getDefaultLlmRuntimeConfig("user-a")).rejects.toMatchObject({
      code: "missing-default-llm"
    });
  });

  it("rejects global model saves for non-admin users", async () => {
    mocks.prisma.aiProvider.findFirstOrThrow.mockResolvedValue({
      enabled: true,
      id: "provider-1",
      userId: "user-a"
    });

    const { saveLlmModel } = await import("@/lib/ai/model-config");

    await expect(
      saveLlmModel("user-a", {
        providerId: "provider-1",
        displayName: "Global Model",
        modelId: "global-model",
        temperature: 0.7,
        enabled: true,
        isDefault: true,
        isGlobal: true
      })
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
