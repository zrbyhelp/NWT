import type {
  ImageForm,
  InstantMeshForm,
  LlmForm,
  ProviderForm,
  VectorForm
} from "./types";

export const emptyProviderForm: ProviderForm = {
  name: "",
  slug: "",
  baseUrl: "",
  apiKey: "",
  clearApiKey: false,
  enabled: true
};

export const emptyLlmForm: LlmForm = {
  providerId: "",
  displayName: "",
  modelId: "",
  temperature: 0.7,
  enabled: true,
  isDefault: false
};

export const emptyVectorForm: VectorForm = {
  providerId: "",
  displayName: "",
  modelId: "",
  dimensions: 1536,
  maxInputTokens: 8192,
  enabled: true,
  isDefault: false
};

export const emptyImageForm: ImageForm = {
  providerId: "",
  displayName: "",
  modelId: "",
  enabled: true,
  isDefault: false
};

export const emptyInstantMeshForm: InstantMeshForm = {
  name: "本地 InstantMesh Adapter",
  baseUrl: "http://localhost:3002",
  apiKey: "local-dev",
  clearApiKey: false,
  submitPath: "/api/instantmesh/tasks",
  statusPathTemplate: "/api/instantmesh/tasks/{taskId}",
  pollIntervalMs: 1500,
  timeoutSeconds: 900,
  enabled: true,
  isDefault: true
};
