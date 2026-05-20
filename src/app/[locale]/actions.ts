"use server";

import type { Locale } from "@/i18n/routing";
import type { AiProviderInput, LlmModelInput, VectorModelInput } from "@/lib/ai/config-types";
import {
  deleteAiProvider,
  deleteLlmModel,
  deleteVectorModel,
  getAiConfigSnapshot,
  saveAiProvider,
  saveLlmModel,
  saveVectorModel
} from "@/lib/ai/model-config";
import { createConversation, deleteConversation, sendConversationMessage } from "@/lib/home-workspace";

export async function createHomeConversation(scriptId: string, locale: Locale) {
  return createConversation(scriptId, locale);
}

export async function sendHomeMessage(conversationId: string, content: string, locale: Locale) {
  return sendConversationMessage(conversationId, content, locale);
}

export async function deleteHomeConversation(conversationId: string, locale: Locale) {
  return deleteConversation(conversationId, locale);
}

export async function getHomeAiConfig() {
  return getAiConfigSnapshot();
}

export async function saveHomeAiProvider(input: AiProviderInput) {
  return saveAiProvider(input);
}

export async function deleteHomeAiProvider(providerId: string) {
  return deleteAiProvider(providerId);
}

export async function saveHomeLlmModel(input: LlmModelInput) {
  return saveLlmModel(input);
}

export async function deleteHomeLlmModel(modelId: string) {
  return deleteLlmModel(modelId);
}

export async function saveHomeVectorModel(input: VectorModelInput) {
  return saveVectorModel(input);
}

export async function deleteHomeVectorModel(modelId: string) {
  return deleteVectorModel(modelId);
}
