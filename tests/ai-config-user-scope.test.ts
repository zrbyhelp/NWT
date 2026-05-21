import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
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
    mocks.prisma.vectorModel.findMany.mockResolvedValue([]);
    mocks.prisma.llmModel.updateMany.mockResolvedValue({});
    mocks.prisma.imageModel.updateMany.mockResolvedValue({});
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
        where: { provider: { userId: "user-a" } }
      })
    );
    expect(mocks.prisma.vectorModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: { userId: "user-a" } }
      })
    );
    expect(mocks.prisma.imageModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: { userId: "user-a" } }
      })
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

  it("requires a user-scoped default LLM even when environment fallback exists", async () => {
    process.env.OPENAI_BASE_URL = "https://api.example.com/v1";
    process.env.OPENAI_API_KEY = "sk-env";
    process.env.OPENAI_MODEL = "env-model";
    mocks.prisma.llmModel.findFirst.mockResolvedValue(null);

    const { getDefaultLlmRuntimeConfig } = await import("@/lib/ai/model-config");

    await expect(getDefaultLlmRuntimeConfig("user-a")).rejects.toMatchObject({
      code: "missing-default-llm"
    });
  });
});
