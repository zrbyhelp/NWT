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
  contextWindow: z.coerce.number().int().min(1).max(4000000),
  temperature: z.coerce.number().min(0).max(2),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false)
});

export const vectorModelInputSchema = z.object({
  id: z.string().optional(),
  providerId: z.string().min(1),
  displayName: z.string().trim().min(1).max(100),
  modelId: z.string().trim().min(1).max(120),
  dimensions: z.coerce.number().int().min(1).max(100000),
  maxInputTokens: z.coerce.number().int().min(1).max(4000000),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false)
});

export type AiProviderInput = z.infer<typeof aiProviderInputSchema>;
export type LlmModelInput = z.infer<typeof llmModelInputSchema>;
export type VectorModelInput = z.infer<typeof vectorModelInputSchema>;

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
  providerName: string;
  providerEnabled: boolean;
  displayName: string;
  modelId: string;
  contextWindow: number;
  temperature: number;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VectorModelView = {
  id: string;
  providerId: string;
  providerName: string;
  providerEnabled: boolean;
  displayName: string;
  modelId: string;
  dimensions: number;
  maxInputTokens: number;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AiConfigSnapshot = {
  providers: AiProviderView[];
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
