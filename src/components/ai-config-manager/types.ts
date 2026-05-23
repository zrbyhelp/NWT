import type {
  AiProviderInput,
  ImageModelInput,
  InstantMeshConfigInput,
  LlmModelInput,
  VectorModelInput
} from "@/lib/ai/config-types";

export type AiConfigMode = "providers" | "llm" | "vectors" | "images" | "instantMesh";
export type ModelConfigMode = "llm" | "vectors" | "images";

export type ModelCatalogStatus = {
  error: boolean;
  loading: boolean;
  providerId: string;
};

export type ProviderForm = AiProviderInput & {
  id?: string;
};

export type LlmForm = LlmModelInput & {
  id?: string;
};

export type VectorForm = VectorModelInput & {
  id?: string;
};

export type ImageForm = ImageModelInput & {
  id?: string;
};

export type InstantMeshForm = InstantMeshConfigInput & {
  id?: string;
};
