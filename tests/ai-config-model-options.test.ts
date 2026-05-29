import { describe, expect, it } from "vitest";
import { filterProviderModelOptionsForMode } from "@/components/ai-config-manager/model-options";
import type { ProviderModelOption } from "@/lib/ai/config-types";

const models: ProviderModelOption[] = [
  { displayName: "Chat", id: "qwen-plus", kind: "llm" },
  { displayName: "Embedding", id: "text-embedding-3-small", kind: "embedding" },
  { displayName: "Image", id: "gpt-image-1", kind: "image" },
  { displayName: "Voice", id: "mimo-v2.5-tts", kind: "voice" },
  { displayName: "Unknown", id: "custom-model", kind: "unknown" }
];

describe("AI config provider model option filtering", () => {
  it("keeps voice models out of non-voice model selectors", () => {
    expect(filterProviderModelOptionsForMode("llm", models).map((model) => model.kind)).toEqual(["llm", "unknown"]);
    expect(filterProviderModelOptionsForMode("images", models).map((model) => model.kind)).toEqual(["image", "unknown"]);
    expect(filterProviderModelOptionsForMode("vectors", models).map((model) => model.kind)).toEqual(["embedding", "unknown"]);
  });

  it("shows voice and unknown models in the voice selector", () => {
    expect(filterProviderModelOptionsForMode("voices", models).map((model) => model.kind)).toEqual(["voice", "unknown"]);
  });
});
