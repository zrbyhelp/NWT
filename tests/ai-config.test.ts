import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/ai/config-crypto";
import { aiProviderInputSchema, llmModelInputSchema } from "@/lib/ai/config-types";
import { chooseDefaultModel, shouldMakeSavedModelDefault } from "@/lib/ai/model-config-utils";

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

  it("coerces numeric LLM model fields", () => {
    const model = llmModelInputSchema.parse({
      providerId: "provider-1",
      displayName: "Narrative Model",
      modelId: "story-model",
      contextWindow: "128000",
      temperature: "0.8",
      enabled: true,
      isDefault: true
    });

    expect(model.contextWindow).toBe(128000);
    expect(model.temperature).toBe(0.8);
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
