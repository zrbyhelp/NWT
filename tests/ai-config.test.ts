import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/ai/config-crypto";
import { aiProviderInputSchema, imageModelInputSchema, llmModelInputSchema } from "@/lib/ai/config-types";
import { chooseDefaultModel, shouldMakeSavedModelDefault } from "@/lib/ai/model-config-utils";
import { classifyProviderModelId, normalizeProviderModels } from "@/lib/ai/provider-model-utils";

describe("AI configuration schemas", () => {
  it("validates OpenAI-compatible providers", () => {
    expect(
      aiProviderInputSchema.parse({
        name: "OpenAI Compatible",
        slug: "openai-compatible",
        baseUrl: "https://api.example.com/v1",
        enabled: true
      })
    ).toMatchObject({ slug: "openai-compatible" });
    expect(() =>
      aiProviderInputSchema.parse({
        name: "Bad Provider",
        slug: "Bad Provider",
        baseUrl: "not-a-url",
        enabled: true
      })
    ).toThrow();
  });

  it("coerces numeric LLM model fields without requiring context window input", () => {
    const model = llmModelInputSchema.parse({
      providerId: "provider-1",
      displayName: "Narrative Model",
      modelId: "story-model",
      temperature: "0.8",
      enabled: true,
      isDefault: true
    });

    expect(model.temperature).toBe(0.8);
  });

  it("validates image model fields", () => {
    expect(
      imageModelInputSchema.parse({
        providerId: "provider-1",
        displayName: "Cover Image Model",
        modelId: "gpt-image-1",
        enabled: true,
        isDefault: true
      })
    ).toMatchObject({ modelId: "gpt-image-1" });
  });
});

describe("AI provider secret encryption", () => {
  it("encrypts secrets without storing plaintext and decrypts them with the same key", () => {
    const encrypted = encryptSecret("sk-test-secret", "local-test-encryption-key");

    expect(encrypted).not.toContain("sk-test-secret");
    expect(decryptSecret(encrypted, "local-test-encryption-key")).toBe("sk-test-secret");
  });

  it("requires an encryption key", () => {
    expect(() => encryptSecret("sk-test-secret", undefined)).toThrow("AI_CONFIG_ENCRYPTION_KEY");
  });
});

describe("provider model catalog helpers", () => {
  it("normalizes OpenAI-compatible model lists", () => {
    expect(
      normalizeProviderModels({
        data: [
          { id: "gpt-4.1-mini", owned_by: "openai" },
          { id: "gpt-image-1", owned_by: "openai" },
          { id: "text-embedding-3-small", owned_by: "openai" },
          { id: "gpt-4.1-mini", owned_by: "duplicate" },
          { id: "" }
        ]
      })
    ).toEqual([
      { displayName: "gpt-4.1-mini", id: "gpt-4.1-mini", kind: "llm", ownedBy: "openai" },
      { displayName: "gpt-image-1", id: "gpt-image-1", kind: "image", ownedBy: "openai" },
      { displayName: "text-embedding-3-small", id: "text-embedding-3-small", kind: "embedding", ownedBy: "openai" }
    ]);
  });

  it("classifies common chat and embedding model ids", () => {
    expect(classifyProviderModelId("qwen-plus")).toBe("llm");
    expect(classifyProviderModelId("bge-large-zh-v1.5")).toBe("embedding");
    expect(classifyProviderModelId("flux-pro")).toBe("image");
    expect(classifyProviderModelId("custom-model")).toBe("unknown");
  });
});

describe("default model selection", () => {
  it("keeps one usable default and ignores disabled providers", () => {
    const selected = chooseDefaultModel([
      { id: "disabled-provider", enabled: true, providerEnabled: false, isDefault: true, createdAt: "2026-01-01" },
      { id: "first-usable", enabled: true, providerEnabled: true, isDefault: false, createdAt: "2026-01-02" },
      { id: "current-default", enabled: true, providerEnabled: true, isDefault: true, createdAt: "2026-01-03" }
    ]);

    expect(selected?.id).toBe("current-default");
  });

  it("promotes the earliest usable model when no usable default exists", () => {
    const selected = chooseDefaultModel([
      { id: "disabled", enabled: false, providerEnabled: true, isDefault: true, createdAt: "2026-01-01" },
      { id: "earliest", enabled: true, providerEnabled: true, isDefault: false, createdAt: "2026-01-02" },
      { id: "later", enabled: true, providerEnabled: true, isDefault: false, createdAt: "2026-01-03" }
    ]);

    expect(selected?.id).toBe("earliest");
  });

  it("makes a saved model default only when both model and provider are enabled", () => {
    expect(
      shouldMakeSavedModelDefault({
        enabled: true,
        providerEnabled: true,
        requestedDefault: false,
        hasUsableDefault: false
      })
    ).toBe(true);
    expect(
      shouldMakeSavedModelDefault({
        enabled: true,
        providerEnabled: false,
        requestedDefault: true,
        hasUsableDefault: false
      })
    ).toBe(false);
  });
});
