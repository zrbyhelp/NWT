"use server";

import type { Locale } from "@/i18n/routing";
import type { AuthCredentialsInput, AuthPasswordInput, AuthPreferencesInput, AuthProfileInput } from "@/lib/auth-types";
import type { AiProviderInput, ImageModelInput, InstantMeshConfigInput, LlmModelInput, VoiceModelInput, VectorModelInput } from "@/lib/ai/config-types";
import type { OutboundProxySettings } from "@/lib/system-settings-types";
import {
  changeCurrentViewerPassword,
  getCurrentViewer,
  logoutCurrentViewer,
  requireAuth,
  updateCurrentViewerPreferences,
  updateCurrentViewerProfile
} from "@/lib/auth";
import { getUnifiedLoginConfig } from "@/lib/unified-login-config";
import {
  deleteAiProvider,
  deleteImageModel,
  deleteInstantMeshConfig,
  deleteLlmModel,
  deleteVoiceModel,
  deleteVectorModel,
  fetchProviderModels,
  getAiConfigSnapshot,
  saveAiProvider,
  saveImageModel,
  saveInstantMeshConfig,
  saveLlmModel,
  saveVoiceModel,
  saveVectorModel
} from "@/lib/ai/model-config";
import {
  addMaterialToLibrary,
  assistCreatureDraft,
  assistItemDraft,
  assistMaskDraft,
  assistMapDraft,
  deriveMapGraphRound,
  assistSceneDraft,
  createCreatureMaterial,
  createMapMaterial,
  createConversation,
  createItemMaterial,
  createMaskMaterial,
  createSceneMaterial,
  deleteSelfCreatedMaterial,
  deleteConversation,
  cleanupUploadedMaterialImages,
  generateCreatureBoard,
  generateItemBoard,
  generateItemModelInputImage,
  generateMaskBoard,
  generateSceneBlockPanorama,
  prepareItemAssistReferenceImages,
  prepareItemBoardReferenceImages,
  prepareSceneAssistReferenceImages,
  markDirectMessageThreadRead,
  openDirectMessageThread,
  sendConversationMessage,
  sendDirectMessage,
  setMaterialCommunitySharing,
  updateCreatureMaterial,
  updateItemMaterial,
  updateMaskMaterial,
  updateMapMaterial,
  updateSceneMaterial,
  uploadScenePanoramaFace,
  uploadScenePanoramaMother,
  type ItemMaterialCreateInput,
  type MapImageMetaInput,
  type MapMaterialCreateInput,
  type MapMaterialImageMode,
  type ItemMaterialImageMode,
  type CreatureMaterialCreateInput,
  type MaskMaterialBoardImageMode,
  type MaskMaterialCreateInput,
  type SceneMaterialCreateInput
} from "@/lib/home-workspace";
import { getAdminSystemSettings, saveAdminOutboundProxySettings } from "@/lib/system-settings";
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

export async function openHomeDirectMessageThread(recipientId: string, locale: Locale) {
  return openDirectMessageThread(recipientId, locale);
}

export async function sendHomeDirectMessage(recipientId: string, content: string, locale: Locale) {
  return sendDirectMessage(recipientId, content, locale);
}

export async function markHomeDirectMessageThreadRead(threadId: string, locale: Locale) {
  return markDirectMessageThreadRead(threadId, locale);
}

export async function assistHomeMaskDraft(input: MaskMaterialCreateInput, instruction: string, locale: Locale) {
  return assistMaskDraft(input, instruction, locale);
}

export async function generateHomeMaskBoard(input: MaskMaterialCreateInput, locale: Locale) {
  return generateMaskBoard(input, locale);
}

export async function assistHomeCreatureDraft(input: CreatureMaterialCreateInput, instruction: string, locale: Locale) {
  return assistCreatureDraft(input, instruction, locale);
}

export async function generateHomeCreatureBoard(input: CreatureMaterialCreateInput, locale: Locale) {
  return generateCreatureBoard(input, locale);
}

export async function assistHomeItemDraft(input: ItemMaterialCreateInput, instruction: string, locale: Locale) {
  return assistItemDraft(input, instruction, locale);
}

export async function assistHomeItemDraftWithImages(formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const instructionValue = formData.get("instruction");

  if (typeof draftValue !== "string") {
    throw new Error("ITEM_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as ItemMaterialCreateInput;
  const instruction = typeof instructionValue === "string" ? instructionValue : "";
  const referenceFiles = formData
    .getAll("referenceImages")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const referenceImages = await prepareItemAssistReferenceImages(referenceFiles);

  return assistItemDraft(draft, instruction, locale, referenceImages);
}

export async function generateHomeItemBoard(input: ItemMaterialCreateInput, locale: Locale) {
  return generateItemBoard(input, locale);
}

export async function generateHomeItemBoardWithImages(formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");

  if (typeof draftValue !== "string") {
    throw new Error("ITEM_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as ItemMaterialCreateInput;
  const referenceFiles = formData
    .getAll("referenceImages")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const referenceImages = await prepareItemBoardReferenceImages(referenceFiles);

  return generateItemBoard(draft, locale, referenceImages);
}

export async function generateHomeItemModelInputImage(formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const boardImageValue = formData.get("boardImage");

  if (typeof draftValue !== "string") {
    throw new Error("ITEM_DRAFT_REQUIRED");
  }

  if (!(boardImageValue instanceof File) || boardImageValue.size <= 0) {
    throw new Error("ITEM_BOARD_IMAGE_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as ItemMaterialCreateInput;

  return generateItemModelInputImage(draft, boardImageValue, locale);
}

export async function assistHomeSceneDraft(input: SceneMaterialCreateInput, instruction: string, locale: Locale) {
  return assistSceneDraft(input, instruction, locale);
}

export async function assistHomeMapDraft(input: MapMaterialCreateInput, instruction: string, locale: Locale) {
  return assistMapDraft(input, instruction, locale);
}

export async function deriveHomeMapGraphRound(
  input: MapMaterialCreateInput,
  roundIndex: number,
  maxRounds: number,
  locale: Locale
) {
  return deriveMapGraphRound(input, roundIndex, maxRounds, locale);
}

export async function assistHomeSceneDraftWithImages(formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const instructionValue = formData.get("instruction");

  if (typeof draftValue !== "string") {
    throw new Error("SCENE_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as SceneMaterialCreateInput;
  const instruction = typeof instructionValue === "string" ? instructionValue : "";
  const referenceFiles = formData
    .getAll("referenceImages")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const referenceImages = await prepareSceneAssistReferenceImages(referenceFiles);

  return assistSceneDraft(draft, instruction, locale, referenceImages);
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

  try {
    return {
      face,
      url: await uploadScenePanoramaFace(viewer.id, file, {
        allowOversize: isGeneratedScenePanoramaUploadSource(formData.get("source"))
      })
    };
  } catch (error) {
    throw normalizeScenePanoramaUploadError(error);
  }
}

export async function uploadHomeScenePanoramaMother(formData: FormData) {
  const file = formData.get("file");
  const viewer = await requireAuth();

  if (!file || !(file instanceof File)) {
    throw new Error("INVALID_SCENE_PANORAMA_MOTHER_FILE");
  }

  try {
    return {
      url: await uploadScenePanoramaMother(viewer.id, file, {
        allowOversize: isGeneratedScenePanoramaUploadSource(formData.get("source"))
      })
    };
  } catch (error) {
    throw normalizeScenePanoramaUploadError(error);
  }
}

function normalizeScenePanoramaUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("INVALID_SCENE_PANORAMA_MOTHER_FILE")) {
    return new Error("INVALID_SCENE_PANORAMA_MOTHER_FILE");
  }

  if (message.includes("INVALID_SCENE_PANORAMA_FACE_FILE") || message.includes("INVALID_MATERIAL_IMAGE_FILE")) {
    return new Error("INVALID_SCENE_PANORAMA_FACE_FILE");
  }

  return new Error("SCENE_PANORAMA_UPLOAD_FAILED");
}

function isGeneratedScenePanoramaUploadSource(value: FormDataEntryValue | null) {
  return typeof value === "string" && ["generated", "reference-repaint", "direct-cut"].includes(value);
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

export async function createHomeCreatureMaterial(formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const boardImageValue = formData.get("boardImage");

  if (typeof draftValue !== "string") {
    throw new Error("CREATURE_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as CreatureMaterialCreateInput;
  const boardImageFile = boardImageValue instanceof File && boardImageValue.size > 0 ? boardImageValue : null;

  return createCreatureMaterial(draft, boardImageFile, locale);
}

export async function createHomeItemMaterial(formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const boardImageValue = formData.get("boardImage");

  if (typeof draftValue !== "string") {
    throw new Error("ITEM_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as ItemMaterialCreateInput;
  const boardImageFile = boardImageValue instanceof File && boardImageValue.size > 0 ? boardImageValue : null;
  const modelInputImageFile = getItemModelInputImageFile(formData);

  return createItemMaterial(draft, boardImageFile, modelInputImageFile, locale);
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

export async function createHomeMapMaterial(formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const mapImageValue = formData.get("mapImage");
  const mapImageModeValue = formData.get("mapImageMode");

  if (typeof draftValue !== "string") {
    throw new Error("MAP_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as MapMaterialCreateInput;
  const mapImageFile = mapImageValue instanceof File && mapImageValue.size > 0 ? mapImageValue : null;
  const mapImageMode = isMapMaterialImageMode(mapImageModeValue) ? mapImageModeValue : mapImageFile ? "replace" : "clear";
  const mapImageMeta = getMapImageMetaInput(formData);

  return createMapMaterial(draft, locale, mapImageFile, mapImageMode, mapImageMeta);
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

export async function updateHomeCreatureMaterial(materialId: string, formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const boardImageValue = formData.get("boardImage");
  const boardImageModeValue = formData.get("boardImageMode");

  if (typeof draftValue !== "string") {
    throw new Error("CREATURE_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as CreatureMaterialCreateInput;
  const boardImageFile = boardImageValue instanceof File && boardImageValue.size > 0 ? boardImageValue : null;
  const boardImageMode = isMaskMaterialBoardImageMode(boardImageModeValue) ? boardImageModeValue : boardImageFile ? "replace" : "keep";

  return updateCreatureMaterial(materialId, draft, boardImageFile, boardImageMode, locale);
}

export async function updateHomeItemMaterial(materialId: string, formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const boardImageValue = formData.get("boardImage");
  const boardImageModeValue = formData.get("boardImageMode");
  const modelInputImageModeValue = formData.get("modelInputImageMode");

  if (typeof draftValue !== "string") {
    throw new Error("ITEM_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as ItemMaterialCreateInput;
  const boardImageFile = boardImageValue instanceof File && boardImageValue.size > 0 ? boardImageValue : null;
  const boardImageMode = isItemMaterialImageMode(boardImageModeValue) ? boardImageModeValue : boardImageFile ? "replace" : "keep";
  const modelInputImageFile = getItemModelInputImageFile(formData);
  const modelInputImageMode = isItemMaterialImageMode(modelInputImageModeValue)
    ? modelInputImageModeValue
    : modelInputImageFile
      ? "replace"
      : "keep";

  return updateItemMaterial(materialId, draft, boardImageFile, boardImageMode, modelInputImageFile, modelInputImageMode, locale);
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

export async function updateHomeMapMaterial(materialId: string, formData: FormData, locale: Locale) {
  const draftValue = formData.get("draft");
  const mapImageValue = formData.get("mapImage");
  const mapImageModeValue = formData.get("mapImageMode");

  if (typeof draftValue !== "string") {
    throw new Error("MAP_DRAFT_REQUIRED");
  }

  const draft = JSON.parse(draftValue) as MapMaterialCreateInput;
  const mapImageFile = mapImageValue instanceof File && mapImageValue.size > 0 ? mapImageValue : null;
  const mapImageMode = isMapMaterialImageMode(mapImageModeValue) ? mapImageModeValue : mapImageFile ? "replace" : "keep";
  const mapImageMeta = getMapImageMetaInput(formData);

  return updateMapMaterial(materialId, draft, locale, mapImageFile, mapImageMode, mapImageMeta);
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
  void input;
  throw new Error("UNIFIED_LOGIN_REQUIRED");
}

export async function registerHomeAccount(input: AuthCredentialsInput) {
  void input;
  throw new Error("UNIFIED_LOGIN_REQUIRED");
}

export async function logoutHomeAccount() {
  await logoutCurrentViewer();
  const { portalBaseUrl } = getUnifiedLoginConfig();

  return {
    ok: true,
    logoutUrl: portalBaseUrl ? new URL("/relogin", portalBaseUrl).toString() : null
  };
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

export async function getHomeAdminSystemSettings() {
  return getAdminSystemSettings();
}

export async function saveHomeAdminOutboundProxySettings(input: OutboundProxySettings) {
  return saveAdminOutboundProxySettings(input);
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

export async function saveHomeVoiceModel(input: VoiceModelInput) {
  const viewer = await requireAuth();
  return saveVoiceModel(viewer.id, input);
}

export async function deleteHomeVoiceModel(modelId: string) {
  const viewer = await requireAuth();
  return deleteVoiceModel(viewer.id, modelId);
}

export async function saveHomeInstantMeshConfig(input: InstantMeshConfigInput) {
  const viewer = await requireAuth();
  return saveInstantMeshConfig(viewer.id, input);
}

export async function deleteHomeInstantMeshConfig(configId: string) {
  const viewer = await requireAuth();
  return deleteInstantMeshConfig(viewer.id, configId);
}

function isMaskMaterialBoardImageMode(value: FormDataEntryValue | null): value is MaskMaterialBoardImageMode {
  return value === "keep" || value === "replace" || value === "clear";
}

function isItemMaterialImageMode(value: FormDataEntryValue | null): value is ItemMaterialImageMode {
  return value === "keep" || value === "replace" || value === "clear";
}

function isMapMaterialImageMode(value: FormDataEntryValue | null): value is MapMaterialImageMode {
  return value === "keep" || value === "replace" || value === "clear";
}

function getMapImageMetaInput(formData: FormData): MapImageMetaInput | null {
  const value = formData.get("mapImageMeta");

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return JSON.parse(value) as MapImageMetaInput;
}

function getItemModelInputImageFile(formData: FormData) {
  const file = formData.get("modelInputImage");

  return file instanceof File && file.size > 0 ? file : null;
}
