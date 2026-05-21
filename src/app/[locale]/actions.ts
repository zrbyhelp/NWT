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
import {
  addMaterialToLibrary,
  assistMaskDraft,
  assistSceneDraft,
  createConversation,
  createMaskMaterial,
  createSceneMaterial,
  deleteSelfCreatedMaterial,
  deleteConversation,
  cleanupUploadedMaterialImages,
  generateMaskBoard,
  generateSceneBlockPanorama,
  sendConversationMessage,
  setMaterialCommunitySharing,
  updateMaskMaterial,
  updateSceneMaterial,
  uploadScenePanoramaFace,
  type MaskMaterialBoardImageMode,
  type MaskMaterialCreateInput,
  type SceneMaterialCreateInput
} from "@/lib/home-workspace";
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

export async function joinHomeMaterial(materialId: string, locale: Locale) {
  return addMaterialToLibrary(materialId, locale);
}

export async function assistHomeMaskDraft(input: MaskMaterialCreateInput, instruction: string, locale: Locale) {
  return assistMaskDraft(input, instruction, locale);
}

export async function generateHomeMaskBoard(input: MaskMaterialCreateInput, locale: Locale) {
  return generateMaskBoard(input, locale);
}

export async function assistHomeSceneDraft(input: SceneMaterialCreateInput, instruction: string, locale: Locale) {
  return assistSceneDraft(input, instruction, locale);
}

export async function generateHomeSceneBlockPanorama(input: SceneMaterialCreateInput, blockId: string, locale: Locale) {
  return generateSceneBlockPanorama(input, blockId, locale);
}

export async function uploadHomeScenePanoramaFace(formData: FormData) {
  const face = formData.get("face");
  const file = formData.get("file");
  const viewer = await requireAuth();

  if (typeof face !== "string" || !file || !(file instanceof File)) {
    throw new Error("INVALID_SCENE_PANORAMA_FACE_FILE");
  }

  return {
    face,
    url: await uploadScenePanoramaFace(viewer.id, file)
  };
}

export async function createHomeMaskMaterial(formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const boardImageValue = formData.get("boardImage");

  if (typeof draftValue !== "string") {
    throw new Error("MASK_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as MaskMaterialCreateInput;
  const boardImageFile = boardImageValue instanceof File && boardImageValue.size > 0 ? boardImageValue : null;

  return createMaskMaterial(draft, boardImageFile, locale);
}

export async function createHomeSceneMaterial(formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const uploadedFaceUrlsValue = formData.get("uploadedFaceUrls");

  if (typeof draftValue !== "string") {
    throw new Error("SCENE_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as SceneMaterialCreateInput;
  const uploadedFaceUrls = typeof uploadedFaceUrlsValue === "string" ? JSON.parse(uploadedFaceUrlsValue) as string[] : [];

  return createSceneMaterial(draft, uploadedFaceUrls, locale);
}

export async function updateHomeMaskMaterial(materialId: string, formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const boardImageValue = formData.get("boardImage");
  const boardImageModeValue = formData.get("boardImageMode");

  if (typeof draftValue !== "string") {
    throw new Error("MASK_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as MaskMaterialCreateInput;
  const boardImageFile = boardImageValue instanceof File && boardImageValue.size > 0 ? boardImageValue : null;
  const boardImageMode = isMaskMaterialBoardImageMode(boardImageModeValue) ? boardImageModeValue : boardImageFile ? "replace" : "keep";

  return updateMaskMaterial(materialId, draft, boardImageFile, boardImageMode, locale);
}

export async function updateHomeSceneMaterial(materialId: string, formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const uploadedFaceUrlsValue = formData.get("uploadedFaceUrls");

  if (typeof draftValue !== "string") {
    throw new Error("SCENE_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as SceneMaterialCreateInput;
  const uploadedFaceUrls = typeof uploadedFaceUrlsValue === "string" ? JSON.parse(uploadedFaceUrlsValue) as string[] : [];

  return updateSceneMaterial(materialId, draft, uploadedFaceUrls, locale);
}

export async function cleanupHomeUploadedMaterialImages(urls: string[]) {
  return cleanupUploadedMaterialImages(urls);
}

export async function deleteHomeMaterial(materialId: string, locale: Locale) {
  return deleteSelfCreatedMaterial(materialId, locale);
}

export async function setHomeMaterialCommunitySharing(materialId: string, shared: boolean, locale: Locale) {
  return setMaterialCommunitySharing(materialId, shared, locale);
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

function isMaskMaterialBoardImageMode(value: FormDataEntryValue | null): value is MaskMaterialBoardImageMode {
  return value === "keep" || value === "replace" || value === "clear";
}
