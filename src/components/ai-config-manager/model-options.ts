import type { ProviderModelOption } from "@/lib/ai/config-types";
import type { ModelConfigMode } from "./types";

export function filterProviderModelOptionsForMode(mode: ModelConfigMode, models: ProviderModelOption[]) {
  return models.filter((model) => {
    if (mode === "llm") {
      return model.kind !== "embedding" && model.kind !== "image" && model.kind !== "voice";
    }

    if (mode === "images") {
      return model.kind !== "llm" && model.kind !== "embedding" && model.kind !== "voice";
    }

    if (mode === "voices") {
      return model.kind !== "llm" && model.kind !== "embedding" && model.kind !== "image";
    }

    return model.kind !== "llm" && model.kind !== "image" && model.kind !== "voice";
  });
}
