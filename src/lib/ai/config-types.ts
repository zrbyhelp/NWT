import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);

export const aiProviderInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
  baseUrl: z.string().trim().url(),
  apiKey: z.string().optional(),
  clearApiKey: z.boolean().default(false),
  enabled: z.boolean().default(true)
});

export const llmModelInputSchema = z.object({
  id: z.string().optional(),
  providerId: z.string().min(1),
  displayName: z.string().trim().min(1).max(100),
  modelId: z.string().trim().min(1).max(120),
  temperature: z.coerce.number().min(0).max(2),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  isGlobal: z.boolean().default(false)
});

export const vectorModelInputSchema = z.object({
  id: z.string().optional(),
  providerId: z.string().min(1),
  displayName: z.string().trim().min(1).max(100),
  modelId: z.string().trim().min(1).max(120),
  dimensions: z.coerce.number().int().min(1).max(100000),
  maxInputTokens: z.coerce.number().int().min(1).max(4000000),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  isGlobal: z.boolean().default(false)
});

export const imageModelInputSchema = z.object({
  id: z.string().optional(),
  providerId: z.string().min(1),
  displayName: z.string().trim().min(1).max(100),
  modelId: z.string().trim().min(1).max(120),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  isGlobal: z.boolean().default(false)
});

export const instantMeshConfigInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  baseUrl: z.string().trim().url(),
  apiKey: z.string().optional(),
  clearApiKey: z.boolean().default(false),
  submitPath: z.string().trim().min(1).max(160).default("/api/instantmesh/tasks"),
  statusPathTemplate: z.string().trim().min(1).max(200).default("/api/instantmesh/tasks/{taskId}"),
  pollIntervalMs: z.coerce.number().int().min(500).max(30000).default(1500),
  timeoutSeconds: z.coerce.number().int().min(30).max(3600).default(900),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false)
});

export type AiProviderInput = z.infer<typeof aiProviderInputSchema>;
export type ImageModelInput = z.infer<typeof imageModelInputSchema>;
export type InstantMeshConfigInput = z.infer<typeof instantMeshConfigInputSchema>;
export type LlmModelInput = z.infer<typeof llmModelInputSchema>;
export type VectorModelInput = z.infer<typeof vectorModelInputSchema>;

export type ProviderModelKind = "llm" | "embedding" | "image" | "unknown";

export type ProviderModelOption = {
  id: string;
  displayName: string;
  ownedBy?: string;
  kind: ProviderModelKind;
};

export type AiProviderView = {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  hasApiKey: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  modelCount: number;
};

export type LlmModelView = {
  id: string;
  providerId: string;
  providerUserId: string;
  providerName: string;
  providerEnabled: boolean;
  displayName: string;
  modelId: string;
  temperature: number;
  enabled: boolean;
  isDefault: boolean;
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VectorModelView = {
  id: string;
  providerId: string;
  providerUserId: string;
  providerName: string;
  providerEnabled: boolean;
  displayName: string;
  modelId: string;
  dimensions: number;
  maxInputTokens: number;
  enabled: boolean;
  isDefault: boolean;
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ImageModelView = {
  id: string;
  providerId: string;
  providerUserId: string;
  providerName: string;
  providerEnabled: boolean;
  displayName: string;
  modelId: string;
  enabled: boolean;
  isDefault: boolean;
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InstantMeshConfigView = {
  id: string;
  name: string;
  baseUrl: string;
  hasApiKey: boolean;
  submitPath: string;
  statusPathTemplate: string;
  pollIntervalMs: number;
  timeoutSeconds: number;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AiConfigSnapshot = {
  providers: AiProviderView[];
  imageModels: ImageModelView[];
  instantMeshConfigs: InstantMeshConfigView[];
  llmModels: LlmModelView[];
  vectorModels: VectorModelView[];
};

export class AiConfigError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "AiConfigError";
  }
}
