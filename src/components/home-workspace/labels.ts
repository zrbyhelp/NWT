import { authRequiredCode } from "@/lib/auth-types";
import type {
  ItemDraftPatch,
  ItemMaterialCreateInput,
  SceneDraftPatch,
  SceneMaterialCreateInput,
  WorkspaceItemMaterialMetadata,
  WorkspaceMaterial,
  WorkspaceMaterialCategory,
  WorkspaceMaterialMetadata,
  WorkspaceMaterialStyle,
  WorkspaceSceneMaterialMetadata,
  WorkspaceSceneScalePreset,
  WorkspaceScript
} from "@/lib/home-workspace";
import {
  defaultScenePanoramaView,
  defaultSceneScalePreset,
  defaultScenePanoramaMaxRedrawAttempts,
  itemTagFields,
  maskBoardAcceptedTypes,
  maskBoardDrawingStyles,
  maskBodyFields,
  maskColorFields,
  maskPersonalityGroups,
  maskVoiceFields,
  materialIcons,
  materialStyles,
  materialTypes,
  maxMaskBoardImageBytes,
  maxScenePanoramaFaceBytes,
  maxScenePanoramaMaxRedrawAttempts,
  maxSceneReferenceImages,
  minScenePanoramaMaxRedrawAttempts,
  scenePanoramaAcceptedTypes,
  scenePanoramaFaces,
  scenePanoramaThreeFaceOrder,
  sceneScalePresets,
  scriptCategories,
  scriptPickerPageSize,
  clampScenePanoramaView,
  loadSceneEquirectangularTexture,
  loadScenePanoramaCubeTexture,
  scheduleScenePanoramaWebglStart,
  type ItemCreateDraft,
  type ItemModelDraft,
  type ItemModelProgress,
  type ItemModelStreamEvent,
  type ItemTagFieldId,
  type ItemViewFace,
  type ItemViewImageDraft,
  type MaskAiMessage,
  type MaskBoardDrawingStyle,
  type MaskBoardImageSource,
  type MaskBodyFieldId,
  type MaskColorFieldId,
  type MaskCreateDraft,
  type MaskDraftPatch,
  type MaskPersonalityFieldId,
  type MaskVoiceFieldId,
  type MessageStreamEvent,
  type SceneAiMessage,
  type SceneBlockDraft,
  type SceneCreateDraft,
  type ScenePanoramaDraft,
  type ScenePanoramaDrawingStyle,
  type ScenePanoramaFace,
  type ScenePanoramaFaceDraft,
  type ScenePanoramaGenerationDraft,
  type ScenePanoramaMotherDraft,
  type ScenePanoramaStreamDoneEvent,
  type ScenePanoramaStreamEvent,
  type ScenePanoramaStreamFaceImage,
  type ScenePanoramaStreamImage,
  type ScenePanoramaView,
  type ScenePanoramaWebglLoadMode,
  type SceneReferenceImageDraft,
  type ViewMode,
  type ScriptManagerView,
  type MaterialManagerView,
  type StreamingReply
} from "./shared";

export {
  getMaterialAccent,
  getMaskBodyOptionLabel,
  getMaskVoiceValueLabel,
  getRangeLevelIndex,
  getScriptAccent,
  getScriptChats,
  getScriptRank,
  getScriptRating,
  resolveCreatureAiError,
  resolveCreatureBoardError,
  resolveCreatureSaveError,
  resolveItemAiError,
  resolveItemBoardError,
  resolveItemModelError,
  resolveItemSaveError,
  resolveItemModelInputImageError,
  resolveMaskAiError,
  resolveMaskBoardError,
  resolveMaskSaveError,
  resolveMapAiError,
  resolveMapDeriveError,
  resolveMapSaveError,
  resolveMaterialExportError,
  resolveMaterialImportError,
  resolveSceneAiError,
  resolveScenePanoramaError,
  resolveSceneSaveError
};

function resolveMaskAiError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-llm")) {
    return t("maskForm.aiMissingDefaultLlm");
  }

  if (message.includes("missing-provider-secret")) {
    return t("maskForm.missingProviderSecret");
  }

  return t("maskForm.aiFailed");
}

function resolveMaskBoardError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-image")) {
    return t("maskForm.boardMissingDefaultImage");
  }

  if (message.includes("missing-provider-secret")) {
    return t("maskForm.missingProviderSecret");
  }

  return t("maskForm.boardGenerateFailed");
}

function resolveMaskSaveError(error: unknown, t: (key: string) => string, isEditing = false) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("INVALID_MATERIAL_IMAGE_FILE")) {
    return t("maskForm.invalidBoardImage");
  }

  return t(isEditing ? "maskForm.updateFailed" : "maskForm.saveFailed");
}

function resolveCreatureAiError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-llm")) {
    return t("creatureForm.aiMissingDefaultLlm");
  }

  if (message.includes("missing-provider-secret")) {
    return t("creatureForm.missingProviderSecret");
  }

  return t("creatureForm.aiFailed");
}

function resolveCreatureBoardError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-image")) {
    return t("creatureForm.boardMissingDefaultImage");
  }

  if (message.includes("missing-provider-secret")) {
    return t("creatureForm.missingProviderSecret");
  }

  return t("creatureForm.boardGenerateFailed");
}

function resolveCreatureSaveError(error: unknown, t: (key: string) => string, isEditing = false) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("INVALID_MATERIAL_IMAGE_FILE")) {
    return t("creatureForm.invalidBoardImage");
  }

  if (message.includes("CREATURE_NAME_REQUIRED")) {
    return t("creatureForm.errors.nameRequired");
  }

  return t(isEditing ? "creatureForm.updateFailed" : "creatureForm.saveFailed");
}

function resolveItemAiError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-llm")) {
    return t("itemForm.aiMissingDefaultLlm");
  }

  if (message.includes("missing-provider-secret")) {
    return t("itemForm.missingProviderSecret");
  }

  if (message.includes("ITEM_ASSIST_REFERENCE_IMAGE_UNSUPPORTED")) {
    return t("itemForm.aiReferenceUnsupported");
  }

  if (message.includes("INVALID_ITEM_REFERENCE_IMAGE_FILE")) {
    return t("itemForm.invalidReferenceImage");
  }

  return t("itemForm.aiFailed");
}

function resolveItemBoardError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-image")) {
    return t("itemForm.boardMissingDefaultImage");
  }

  if (message.includes("missing-provider-secret")) {
    return t("itemForm.missingProviderSecret");
  }

  if (message.includes("ITEM_BOARD_REFERENCE_IMAGE_UNSUPPORTED")) {
    return t("itemForm.boardReferenceUnsupported");
  }

  if (message.includes("INVALID_ITEM_REFERENCE_IMAGE_FILE")) {
    return t("itemForm.invalidReferenceImage");
  }

  return t("itemForm.boardGenerateFailed");
}

function resolveItemModelInputImageError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-image")) {
    return t("itemForm.boardMissingDefaultImage");
  }

  if (message.includes("missing-provider-secret")) {
    return t("itemForm.missingProviderSecret");
  }

  if (message.includes("INVALID_MATERIAL_IMAGE_FILE") || message.includes("INVALID_ITEM_MODEL_INPUT_IMAGE_FILE")) {
    return t("itemForm.invalidModelInputImage");
  }

  if (message.includes("ITEM_IMAGE_FETCH_FAILED")) {
    return t("itemForm.boardRequiredForModelInput");
  }

  return t("itemForm.modelInputGenerateFailed");
}

function resolveItemModelError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-instantmesh")) {
    return t("itemForm.modelMissingDefaultInstantMesh");
  }

  if (message.includes("missing-instantmesh-secret")) {
    return t("itemForm.modelMissingApiKey");
  }

  if (message.includes("ITEM_MODEL_INPUT_IMAGE_REQUIRED") || message.includes("INVALID_ITEM_MODEL_INPUT_IMAGE_FILE")) {
    return t("itemForm.modelInputRequiredForModel");
  }

  if (message.includes("INSTANTMESH_TASK_TIMEOUT")) {
    return t("itemForm.modelTimeout");
  }

  if (message.includes("INSTANTMESH_GLB_URL_MISSING")) {
    return t("itemForm.modelMissingUrl");
  }

  if (message.includes("INVALID_ITEM_MODEL_FILE")) {
    return t("itemForm.modelInvalidFile");
  }

  if (message.includes("INSTANTMESH_TASK_FAILED")) {
    return t("itemForm.modelTaskFailed");
  }

  return t("itemForm.modelGenerateFailed");
}

function resolveItemSaveError(error: unknown, t: (key: string) => string, isEditing = false) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("INVALID_ITEM_MODEL_INPUT_IMAGE_FILE")) {
    return t("itemForm.invalidModelInputImage");
  }

  if (message.includes("INVALID_MATERIAL_IMAGE_FILE")) {
    return t("itemForm.invalidBoardImage");
  }

  if (message.includes("ITEM_NAME_REQUIRED")) {
    return t("itemForm.errors.nameRequired");
  }

  if (message.includes("ITEM_MATERIAL_UPLOAD_FAILED")) {
    return t("itemForm.imageUploadFailed");
  }

  if (message.includes("ITEM_MATERIAL_METADATA_TOO_LARGE")) {
    return t("itemForm.metadataTooLarge");
  }

  if (message.includes("ITEM_MATERIAL_DATABASE_FAILED") || message.includes("ITEM_MATERIAL_PERSISTENCE_FAILED")) {
    return t("itemForm.recordSaveFailed");
  }

  return t(isEditing ? "itemForm.updateFailed" : "itemForm.saveFailed");
}

function resolveSceneAiError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-llm")) {
    return t("sceneForm.aiMissingDefaultLlm");
  }

  if (message.includes("missing-provider-secret")) {
    return t("sceneForm.missingProviderSecret");
  }

  if (message.includes("SCENE_ASSIST_REFERENCE_IMAGE_UNSUPPORTED")) {
    return t("sceneForm.aiReferenceUnsupported");
  }

  if (message.includes("INVALID_SCENE_REFERENCE_IMAGE_FILE")) {
    return t("sceneForm.invalidReferenceImage");
  }

  return t("sceneForm.aiFailed");
}

function resolveMapAiError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("MAP_ASSIST_EMPTY_INSTRUCTION")) {
    return t("mapForm.aiEmptyInstruction");
  }

  if (message.includes("missing-default-llm")) {
    return t("mapForm.aiMissingDefaultLlm");
  }

  if (message.includes("missing-provider-secret")) {
    return t("mapForm.missingProviderSecret");
  }

  return t("mapForm.aiFailed");
}

function resolveMapDeriveError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("MAP_DERIVE_EMPTY_GRAPH")) {
    return t("mapForm.deriveNodeRequired");
  }

  if (message.includes("MAP_DERIVE_EMPTY_RESULT")) {
    return t("mapForm.deriveNoResult");
  }

  if (message.includes("missing-default-llm")) {
    return t("mapForm.aiMissingDefaultLlm");
  }

  if (message.includes("missing-provider-secret")) {
    return t("mapForm.missingProviderSecret");
  }

  return t("mapForm.deriveFailed");
}

function resolveScenePanoramaError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-image")) {
    return t("sceneForm.panoramaMissingDefaultImage");
  }

  if (message.includes("missing-provider-secret")) {
    return t("sceneForm.missingProviderSecret");
  }

  if (message.includes("INVALID_SCENE_PANORAMA_FACE_FILE")) {
    return t("sceneForm.invalidPanoramaFace");
  }

  if (message.includes("INVALID_SCENE_PANORAMA_MOTHER_FILE")) {
    return t("sceneForm.invalidPanoramaMother");
  }

  if (message.includes("SCENE_PANORAMA_MOTHER_REQUIRED")) {
    return t("sceneForm.panoramaMotherRequired");
  }

  if (message.includes("SCENE_PANORAMA_MOTHER_QUALITY_FAILED")) {
    return t("sceneForm.panoramaMotherQualityFailed");
  }

  if (message.includes("INVALID_SCENE_REFERENCE_IMAGE_FILE")) {
    return t("sceneForm.invalidReferenceImage");
  }

  if (message.includes("SCENE_PANORAMA_QUALITY_FAILED")) {
    return t("sceneForm.panoramaQualityFailed");
  }

  if (message.includes("SCENE_PANORAMA_REFERENCE_EDIT_UNSUPPORTED")) {
    return t("sceneForm.panoramaReferenceEditUnsupported");
  }

  return t("sceneForm.panoramaGenerateFailed");
}

function resolveSceneSaveError(error: unknown, t: (key: string) => string, isEditing = false) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("INVALID_SCENE_PANORAMA_FACE_FILE") || message.includes("INVALID_MATERIAL_IMAGE_FILE")) {
    return t("sceneForm.invalidPanoramaFace");
  }

  if (message.includes("INVALID_SCENE_PANORAMA_MOTHER_FILE")) {
    return t("sceneForm.invalidPanoramaMother");
  }

  if (
    message.includes("Body exceeded") ||
    message.includes("request body") ||
    message.includes("Payload Too Large") ||
    message.includes("413")
  ) {
    return t("sceneForm.panoramaUploadTooLarge");
  }

  if (message.includes("SCENE_PANORAMA_UPLOAD_FAILED")) {
    return t("sceneForm.panoramaUploadFailed");
  }

  if (message.includes("R2") || message.includes("S3") || message.includes("AccessDenied") || message.includes("NoSuchBucket")) {
    return t("sceneForm.panoramaUploadFailed");
  }

  if (message.includes("SCENE_MATERIAL_CATEGORY_MIGRATION_REQUIRED")) {
    return t("sceneForm.migrationRequired");
  }

  if (message.includes("SCENE_MATERIAL_METADATA_TOO_LARGE")) {
    return t("sceneForm.metadataTooLarge");
  }

  if (message.includes("SCENE_MATERIAL_DATABASE_FAILED") || message.includes("SCENE_MATERIAL_PERSISTENCE_FAILED")) {
    return t("sceneForm.recordSaveFailed");
  }

  if (message.includes("SCENE_NAME_REQUIRED")) {
    return t("sceneForm.errors.nameRequired");
  }

  if (message.includes("SCENE_DESCRIPTION_REQUIRED")) {
    return t("sceneForm.errors.descriptionRequired");
  }

  if (message.includes("SCENE_BLOCK_REQUIRED")) {
    return t("sceneForm.errors.blockRequired");
  }

  if (message.includes("SCENE_BLOCK_NAME_REQUIRED")) {
    return t("sceneForm.errors.blockNameRequired");
  }

  if (message.includes("SCENE_BLOCK_DESCRIPTION_REQUIRED")) {
    return t("sceneForm.errors.blockDescriptionRequired");
  }

  if (message.includes("SCENE_PANORAMA_FACE_REQUIRED") || message.includes("SCENE_PANORAMA_INCOMPLETE")) {
    return t("sceneForm.errors.panoramaIncomplete");
  }

  return t(isEditing ? "sceneForm.updateFailed" : "sceneForm.saveFailed");
}

function resolveMapSaveError(error: unknown, t: (key: string) => string, isEditing = false) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("MAP_NAME_REQUIRED")) {
    return t("mapForm.errors.nameRequired");
  }

  if (message.includes("MAP_DESCRIPTION_REQUIRED")) {
    return t("mapForm.errors.descriptionRequired");
  }

  if (message.includes("MAP_NODE_REQUIRED")) {
    return t("mapForm.errors.nodeRequired");
  }

  if (message.includes("MAP_NODE_NAME_REQUIRED")) {
    return t("mapForm.errors.nodeNameRequired");
  }

  if (message.includes("MAP_NODE_TYPE_INVALID")) {
    return t("mapForm.errors.nodeTypeInvalid");
  }

  if (message.includes("MAP_NODE_DUPLICATE")) {
    return t("mapForm.errors.nodeDuplicate");
  }

  if (message.includes("MAP_EDGE_RELATION_INVALID")) {
    return t("mapForm.errors.edgeRelationInvalid");
  }

  if (message.includes("MAP_EDGE_DUPLICATE")) {
    return t("mapForm.errors.edgeDuplicate");
  }

  if (message.includes("MAP_EDGE_INVALID")) {
    return t("mapForm.errors.edgeInvalid");
  }

  if (message.includes("MAP_GRAPH_SYNC_FAILED")) {
    return t("mapForm.graphSyncFailed");
  }

  if (message.includes("MAP_MATERIAL_METADATA_TOO_LARGE")) {
    return t("mapForm.metadataTooLarge");
  }

  if (message.includes("MATERIAL_NOT_EDITABLE")) {
    return t("mapForm.notEditable");
  }

  if (message.includes("MAP_MATERIAL_DATABASE_FAILED") || message.includes("MAP_MATERIAL_PERSISTENCE_FAILED")) {
    return t(isEditing ? "mapForm.updateFailed" : "mapForm.saveFailed");
  }

  return t(isEditing ? "mapForm.updateFailed" : "mapForm.saveFailed");
}

function resolveMaterialImportError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("INVALID_MATERIAL_ZIP")) {
    return t("invalidImportFile");
  }

  return t("importFailed");
}

function resolveMaterialExportError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("NO_SELF_CREATED_MATERIALS")) {
    return t("exportEmpty");
  }

  return t("exportFailed");
}

function getMaskBodyOptionLabel(
  fieldId: MaskBodyFieldId,
  option: string,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return t(`maskForm.bodyOptions.${fieldId}.${option}`);
}

function getMaskVoiceValueLabel(
  fieldId: MaskVoiceFieldId,
  value: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  if (fieldId === "speechSpeed") {
    return t("maskForm.speechSpeedValue", { value });
  }

  return t("maskForm.scoreValue", { value });
}

function getRangeLevelIndex(value: number, min: number, max: number) {
  const ratio = (value - min) / (max - min);

  return Math.min(4, Math.max(0, Math.round(ratio * 4)));
}

function getScriptAccent(slug: string) {
  if (slug.includes("world")) {
    return "bg-emerald-500";
  }

  if (slug.includes("roleplay")) {
    return "bg-sky-500";
  }

  if (slug.includes("mystery")) {
    return "bg-amber-500";
  }

  if (slug.includes("writing")) {
    return "bg-rose-500";
  }

  if (slug.includes("analyst")) {
    return "bg-violet-500";
  }

  return "bg-primary";
}

function getMaterialAccent(category: WorkspaceMaterialCategory) {
  if (category === "mask") {
    return "bg-rose-500";
  }

  if (category === "map") {
    return "bg-cyan-600";
  }

  if (category === "creature") {
    return "bg-emerald-600";
  }

  return "bg-amber-500";
}

function getScriptRating(slug: string) {
  return slug === "base-ai-script" ? "4.9" : "4.8";
}

function getScriptRank(slug: string) {
  const ranks: Record<string, string> = {
    "base-ai-script": "#1",
    "world-architect": "#2",
    "character-roleplay": "#3",
    "mystery-case": "#4",
    "serial-writing": "#5",
    "lore-analyst": "#6"
  };

  return ranks[slug] ?? "#9";
}

function getScriptChats(slug: string) {
  const chats: Record<string, string> = {
    "base-ai-script": "1.2K+",
    "world-architect": "900+",
    "character-roleplay": "860+",
    "mystery-case": "720+",
    "serial-writing": "680+",
    "lore-analyst": "540+"
  };

  return chats[slug] ?? "100+";
}
