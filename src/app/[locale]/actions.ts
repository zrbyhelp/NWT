"use server";

import type { Locale } from "@/i18n/routing";
import type { AuthCredentialsInput, AuthPasswordInput, AuthPreferencesInput, AuthProfileInput } from "@/lib/auth-types";
import type { AiProviderInput, ImageModelInput, LlmModelInput, VectorModelInput } from "@/lib/ai/config-types";
import {
  changeCurrentViewerPassword,
  getCurrentViewer,
  loginWithPassword,
  logoutCurrentViewer,
  registerWithPassword,
  requireAuth,
  updateCurrentViewerPreferences,
  updateCurrentViewerProfile
} from "@/lib/auth";
import {
  deleteAiProvider,
  deleteImageModel,
  deleteLlmModel,
  deleteVectorModel,
  fetchProviderModels,
  getAiConfigSnapshot,
  saveAiProvider,
  saveImageModel,
  saveLlmModel,
  saveVectorModel
} from "@/lib/ai/model-config";
import { createConversation, deleteConversation, sendConversationMessage } from "@/lib/home-workspace";
import { uploadUserAvatar } from "@/lib/storage/avatar";

export async function createHomeConversation(scriptId: string, locale: Locale) {
  return createConversation(scriptId, locale);
}

export async function sendHomeMessage(conversationId: string, content: string, locale: Locale) {
  return sendConversationMessage(conversationId, content, locale);
}

export async function deleteHomeConversation(conversationId: string, locale: Locale) {
  return deleteConversation(conversationId, locale);
}

export async function loginHomeAccount(input: AuthCredentialsInput) {
  return loginWithPassword(input);
}

export async function registerHomeAccount(input: AuthCredentialsInput) {
  return registerWithPassword(input);
}

export async function logoutHomeAccount() {
  await logoutCurrentViewer();
  return { ok: true };
}

export async function getHomeViewer() {
  return getCurrentViewer();
}

export async function updateHomeProfile(input: AuthProfileInput) {
  return updateCurrentViewerProfile(input);
}

export async function uploadHomeAvatar(formData: FormData) {
  const viewer = await requireAuth();
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    throw new Error("INVALID_AVATAR_FILE");
  }

  const avatarUrl = await uploadUserAvatar(viewer.id, file);

  return updateCurrentViewerProfile({
    avatarUrl,
    displayName: viewer.displayName
  });
}

export async function changeHomePassword(input: AuthPasswordInput) {
  return changeCurrentViewerPassword(input);
}

export async function updateHomePreferences(input: AuthPreferencesInput) {
  return updateCurrentViewerPreferences(input);
}

export async function getHomeAiConfig() {
  const viewer = await requireAuth();
  return getAiConfigSnapshot(viewer.id);
}

export async function saveHomeAiProvider(input: AiProviderInput) {
  const viewer = await requireAuth();
  return saveAiProvider(viewer.id, input);
}

export async function deleteHomeAiProvider(providerId: string) {
  const viewer = await requireAuth();
  return deleteAiProvider(viewer.id, providerId);
}

export async function fetchHomeProviderModels(providerId: string) {
  const viewer = await requireAuth();
  return fetchProviderModels(viewer.id, providerId);
}

export async function saveHomeLlmModel(input: LlmModelInput) {
  const viewer = await requireAuth();
  return saveLlmModel(viewer.id, input);
}

export async function deleteHomeLlmModel(modelId: string) {
  const viewer = await requireAuth();
  return deleteLlmModel(viewer.id, modelId);
}

export async function saveHomeVectorModel(input: VectorModelInput) {
  const viewer = await requireAuth();
  return saveVectorModel(viewer.id, input);
}

export async function deleteHomeVectorModel(modelId: string) {
  const viewer = await requireAuth();
  return deleteVectorModel(viewer.id, modelId);
}

export async function saveHomeImageModel(input: ImageModelInput) {
  const viewer = await requireAuth();
  return saveImageModel(viewer.id, input);
}

export async function deleteHomeImageModel(modelId: string) {
  const viewer = await requireAuth();
  return deleteImageModel(viewer.id, modelId);
}
