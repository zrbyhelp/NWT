import {
  uploadHomeScenePanoramaFace,
  uploadHomeScenePanoramaMother
} from "@/app/[locale]/actions";
import type {
  ItemDraftPatch,
  ItemMaterialCreateInput,
  CreatureDraftPatch,
  CreatureMaterialCreateInput,
  WorkspaceCreatureMaterialMetadata,
  MapCreateDraft,
  MapDraftPatch,
  MapMaterialCreateInput,
  SceneDraftPatch,
  SceneMaterialCreateInput,
  WorkspaceItemMaterialMetadata,
  WorkspaceMapMaterialEdge,
  WorkspaceMapMaterialMetadata,
  WorkspaceMapMaterialNode,
  WorkspaceMapMaterialNodeType,
  WorkspaceMapMaterialRelationType,
  WorkspaceMaterial,
  WorkspaceMaterialCategory,
  WorkspaceMaterialMetadata,
  WorkspaceMaterialStyle,
  WorkspaceSceneMaterialMetadata,
  WorkspaceSceneScalePreset,
  WorkspaceScript
} from "@/lib/home-workspace";
import {
  applyPatchToMapDraft,
  buildMapMaterialMetadata,
  createDefaultMapDraft,
  createMapEdge,
  createMapDraftFromMaterial,
  createMapNode,
  getMapMaterialMetadata,
  isMapNodeType,
  isMapRelationType,
  mapNodeTypes,
  mapRelationTypes,
  normalizeMapMaterialInput,
  serializeMapDraft,
  validateMapDraftForGraphSave,
  validateMapDraftForSave,
  validateMapMaterialInput
} from "@/lib/home-workspace/map";
import {
  defaultScenePanoramaView,
  defaultSceneScalePreset,
  defaultScenePanoramaMaxRedrawAttempts,
  creatureAbilityFields,
  creatureBehaviorGroups,
  creatureColorFields,
  creatureEcologyFields,
  creatureMorphologyFields,
  creatureSenseFields,
  creatureTaxonomyFields,
  creatureVocalizationFields,
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
  type ItemModelInputImageDraft,
  type ItemModelDraft,
  type ItemModelProgress,
  type ItemModelStreamEvent,
  type ItemTagFieldId,
  type ItemViewFace,
  type ItemViewImageDraft,
  type CreatureAbilityFieldId,
  type CreatureBehaviorFieldId,
  type CreatureColorFieldId,
  type CreatureCreateDraft,
  type CreatureEcologyFieldId,
  type CreatureMorphologyFieldId,
  type CreatureSenseFieldId,
  type CreatureTaxonomyFieldId,
  type CreatureVocalizationFieldId,
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
  applyPatchToCreatureDraft,
  applyPatchToItemDraft,
  applyPatchToMaskDraft,
  applyPatchToSceneDraft,
  buildItemMaterialFormData,
  buildMapMaterialFormData,
  createClientId,
  createDefaultCreatureDraft,
  createDefaultItemDraft,
  createDefaultMaskDraft,
  createDefaultMapDraft,
  createDefaultSceneBlock,
  createDefaultSceneDraft,
  createInitialScenePanoramaGenerationDraft,
  createCreatureDraftFromMaterial,
  createItemDraftFromMaterial,
  createMapDraftFromMaterial,
  createMapEdge,
  createMapNode,
  createMaskDraftFromMaterial,
  createPreviewUrl,
  createSceneDraftFromMaterial,
  createSceneReferenceImageDrafts,
  dataUrlToFile,
  downloadMaterialArchive,
  getArchiveFileName,
  getCompleteScenePanoramaFaceUrls,
  readItemModelStream,
  normalizeSceneScalePreset,
  getCreatureBoardImageMode,
  getCreatureMaterialMetadata,
  getItemBoardFileForGeneration,
  getItemModelInputFileForModel,
  getItemBoardImageMode,
  getItemImageStoredUrl,
  getItemMaterialMetadata,
  getMapMaterialMetadata,
  getItemModelInputImageMode,
  getMaskBoardImageMode,
  getMaskMaterialMetadata,
  getNestedRecord,
  getSceneMaterialMetadata,
  getScenePanoramaGenerationFaceUrls,
  hasItemModelInputImageDraft,
  hasAnyScenePanoramaFaceDraft,
  isCompleteItemModelInputImageDraft,
  isCompleteScenePanoramaFaceUrls,
  isValidGeneratedMaterialImage,
  isValidMaskBoardImage,
  isValidGeneratedScenePanoramaImage,
  isValidScenePanoramaFace,
  isValidScenePanoramaMother,
  isValidSceneReferenceImage,
  isZipArchiveFile,
  normalizeSceneFaceSource,
  normalizeMapMaterialInput,
  normalizeScenePanoramaMaxRedrawAttempts,
  readTransferErrorCode,
  revokeItemBoardPreview,
  revokeCreatureBoardPreview,
  revokeItemDraftPreviews,
  revokeItemModelInputImagePreview,
  revokeItemViewPreview,
  revokeMaskBoardPreview,
  revokeSceneBlockPreviews,
  revokeSceneDraftPreviews,
  revokeSceneFacePreview,
  revokeScenePanoramaMotherPreview,
  revokeSceneReferenceImagePreview,
  sanitizeItemTags,
  serializeCreatureDraft,
  serializeItemDraft,
  serializeMaskDraft,
  serializeMapDraft,
  serializeSceneTextDraft,
  applyPatchToMapDraft,
  buildMapMaterialMetadata,
  isMapNodeType,
  isMapRelationType,
  mapNodeTypes,
  mapRelationTypes,
  uploadSceneDraftPanoramaFaces,
  validateMapDraftForGraphSave,
  validateMapDraftForSave,
  validateMapMaterialInput,
  validateSceneBlockGeneration,
  validateSceneDraftForSave
};

function createDefaultMaskDraft(): MaskCreateDraft {
  return {
    name: "",
    intro: "",
    features: "",
    communityVisible: true,
    style: "realistic",
    body: {
      hairStyle: "",
      browShape: "",
      faceShape: "",
      eyeShape: "",
      noseType: "",
      mouthShape: "",
      earShape: "",
      height: "170",
      weight: "60",
      gender: "",
      ageStage: "",
      bodyType: ""
    },
    colors: {
      hairColor: "#1F1A17",
      eyeColor: "#3D6EA8",
      browColor: "#5C4033",
      skinColor: "#D8AA78"
    },
    voice: {
      pitch: 50,
      speechSpeed: 150,
      volume: 50,
      intonation: 50,
      emotionExposure: 50,
      nasalResonance: 50,
      breathiness: 50
    },
    personality: {
      extroversion: 50,
      dominance: 50,
      rationality: 50,
      emotionalStability: 50,
      confidence: 50,
      affinity: 50,
      sharingDesire: 50,
      humor: 50,
      aggression: 50,
      politeness: 50,
      coquetry: 50,
      sensitivity: 50,
      possessiveness: 50,
      dependency: 50,
      proactiveCare: 50,
      boundaries: 50,
      loyalty: 50,
      action: 50,
      curiosity: 50,
      performative: 50
    },
    boardDrawingStyle: "realistic",
    boardImagePreviewUrl: "",
    boardImageFile: null,
    boardImageSource: null,
    aiMessages: []
  };
}

function createDefaultCreatureDraft(): CreatureCreateDraft {
  return {
    name: "",
    description: "",
    communityVisible: true,
    style: "fantasy",
    taxonomy: {
      creatureType: ""
    },
    morphology: {
      sizeClass: "",
      length: "",
      weight: "",
      limbStructure: "",
      bodyCovering: "",
      headFeature: "",
      tailAppendage: "",
      movement: "",
      specialOrgans: ""
    },
    colors: {
      primaryColor: "#2F5D46",
      secondaryColor: "#6E7F45",
      markingColor: "#FACC15",
      glowColor: "#67E8F9"
    },
    vocalization: {
      frequency: 50,
      rhythm: 50,
      volume: 50,
      emotionReadability: 50,
      mimicry: 20
    },
    senses: {
      sensoryAcuity: 55
    },
    ecology: {
      habitat: "",
      diet: "",
      activityCycle: "",
      socialStructure: "",
      reproduction: ""
    },
    abilities: {
      powers: [],
      weaknesses: [],
      resourceNeeds: [],
      interactionUses: [],
      dangerNotes: [],
      keywords: []
    },
    behaviorLogic: "",
    behavior: {
      aggression: 45,
      sociability: 45,
      territoriality: 55,
      curiosity: 50,
      alertness: 60,
      stealth: 35,
      persistence: 55,
      adaptability: 50,
      tameability: 30,
      bonding: 35,
      threatResponse: 55,
      resourceGuarding: 50
    },
    boardDrawingStyle: "realistic",
    boardImagePreviewUrl: "",
    boardImageFile: null,
    boardImageSource: null,
    aiMessages: []
  };
}

function createDefaultItemDraft(): ItemCreateDraft {
  return {
    name: "",
    itemCategory: "",
    description: "",
    communityVisible: true,
    traits: [],
    uses: [],
    functions: [],
    materials: [],
    colors: [],
    styles: [],
    brand: "",
    model: "",
    keywords: [],
    scaleHint: "",
    style: "realistic",
    boardDrawingStyle: "realistic",
    boardImagePreviewUrl: "",
    boardImageFile: null,
    boardImageSource: null,
    modelInputImage: null,
    viewImages: {},
    model3d: null,
    modelExtraParams: "",
    aiMessages: []
  };
}

function createDefaultSceneDraft(): SceneCreateDraft {
  const firstBlock = createDefaultSceneBlock();

  return {
    name: "",
    description: "",
    communityVisible: true,
    style: "realistic",
    panoramaDrawingStyle: "realistic",
    blocks: [firstBlock]
  };
}

function createDefaultSceneBlock(): SceneBlockDraft {
  return {
    id: createClientId("scene-block"),
    name: "",
    description: "",
    referenceImages: [],
    scalePreset: defaultSceneScalePreset,
    panorama: null
  };
}

function createMaskDraftFromMaterial(material: WorkspaceMaterial): MaskCreateDraft {
  const draft = createDefaultMaskDraft();
  const metadata = getMaskMaterialMetadata(material.metadata);
  const bodyRecord = getNestedRecord(metadata?.body) as Partial<Record<MaskBodyFieldId, string>> | null;
  const colorRecord = getNestedRecord(metadata?.colors) as Partial<Record<MaskColorFieldId, string>> | null;
  const voiceRecord = getNestedRecord(metadata?.voice) as Partial<Record<MaskVoiceFieldId, number>> | null;
  const personalityRecord = getNestedRecord(metadata?.personality) as Partial<Record<MaskPersonalityFieldId, number>> | null;
  const body = pickKnownStringPatch(bodyRecord ?? {}, maskBodyFields.map((field) => field.id));
  const colors = pickKnownColorPatch(colorRecord ?? {}, maskColorFields.map((field) => field.id));
  const voice = pickKnownNumberPatch(voiceRecord ?? {}, maskVoiceFields);
  const personality = pickKnownNumberPatch(
    personalityRecord ?? {},
    maskPersonalityGroups.flatMap((group) => group.fields).map((id) => ({ id, min: 0, max: 100 }))
  );
  const boardImage = getNestedRecord(metadata?.boardImage);
  const boardImagePreviewUrl =
    typeof boardImage?.url === "string" && boardImage.url ? boardImage.url : material.previewUrl ?? "";
  const boardImageSource = boardImage?.source;

  return {
    ...draft,
    name: typeof metadata?.name === "string" && metadata.name.trim() ? metadata.name : material.title,
    intro: typeof metadata?.intro === "string" ? metadata.intro : material.description,
    features: typeof metadata?.features === "string" ? metadata.features : "",
    communityVisible: true,
    style: typeof metadata?.style === "string" && isWorkspaceMaterialStyle(metadata.style) ? metadata.style : material.style,
    body: body ? { ...draft.body, ...body } : draft.body,
    colors: colors ? { ...draft.colors, ...colors } : draft.colors,
    voice: voice ? { ...draft.voice, ...voice } : draft.voice,
    personality: personality ? { ...draft.personality, ...personality } : draft.personality,
    boardDrawingStyle:
      typeof metadata?.boardDrawingStyle === "string" && isMaskBoardDrawingStyle(metadata.boardDrawingStyle)
        ? metadata.boardDrawingStyle
        : draft.boardDrawingStyle,
    boardImagePreviewUrl,
    boardImageFile: null,
    boardImageSource:
      boardImageSource === "generated" || boardImageSource === "uploaded"
        ? boardImageSource
        : boardImagePreviewUrl
          ? "uploaded"
          : null,
    aiMessages: []
  };
}

function createCreatureDraftFromMaterial(material: WorkspaceMaterial): CreatureCreateDraft {
  const draft = createDefaultCreatureDraft();
  const metadata = getCreatureMaterialMetadata(material.metadata);

  if (!metadata || metadata.kind !== "creature") {
    return {
      ...draft,
      name: material.title,
      description: material.description,
      style: material.style
    };
  }

  const taxonomy = pickKnownStringPatch(getNestedRecord(metadata.taxonomy) ?? {}, creatureTaxonomyFields.map((field) => field.id));
  const morphology = pickKnownStringPatch(getNestedRecord(metadata.morphology) ?? {}, creatureMorphologyFields.map((field) => field.id));
  const colors = pickKnownColorPatch(getNestedRecord(metadata.colors) ?? {}, creatureColorFields.map((field) => field.id));
  const vocalization = pickKnownNumberPatch(getNestedRecord(metadata.vocalization) ?? {}, creatureVocalizationFields);
  const senses = pickKnownNumberPatch(getNestedRecord(metadata.senses) ?? {}, creatureSenseFields);
  const ecology = pickKnownStringPatch(getNestedRecord(metadata.ecology) ?? {}, creatureEcologyFields.map((field) => field.id));
  const behavior = pickKnownNumberPatch(
    getNestedRecord(metadata.behavior) ?? {},
    creatureBehaviorGroups.flatMap((group) => group.fields).map((id) => ({ id, min: 0, max: 100 }))
  );
  const boardImage = getNestedRecord(metadata.boardImage);
  const boardImagePreviewUrl =
    typeof boardImage?.url === "string" && boardImage.url ? boardImage.url : material.previewUrl ?? "";
  const boardImageSource = boardImage?.source;

  return {
    ...draft,
    name: metadata.name || material.title,
    description: metadata.description || material.description,
    communityVisible: true,
    style: typeof metadata.style === "string" && isWorkspaceMaterialStyle(metadata.style) ? metadata.style : material.style,
    taxonomy: taxonomy ? { ...draft.taxonomy, ...taxonomy } : draft.taxonomy,
    morphology: morphology ? { ...draft.morphology, ...morphology } : draft.morphology,
    colors: colors ? { ...draft.colors, ...colors } : draft.colors,
    vocalization: vocalization ? { ...draft.vocalization, ...vocalization } : draft.vocalization,
    senses: senses ? { ...draft.senses, ...senses } : draft.senses,
    ecology: ecology ? { ...draft.ecology, ...ecology } : draft.ecology,
    abilities: creatureAbilityFields.reduce<CreatureCreateDraft["abilities"]>((result, field) => {
      result[field] = sanitizeItemTags(metadata.abilities?.[field]);

      return result;
    }, { ...draft.abilities }),
    behaviorLogic: metadata.behaviorLogic || "",
    behavior: behavior ? { ...draft.behavior, ...behavior } : draft.behavior,
    boardDrawingStyle:
      typeof metadata.boardDrawingStyle === "string" && isMaskBoardDrawingStyle(metadata.boardDrawingStyle)
        ? metadata.boardDrawingStyle
        : draft.boardDrawingStyle,
    boardImagePreviewUrl,
    boardImageFile: null,
    boardImageSource:
      boardImageSource === "generated" || boardImageSource === "uploaded"
        ? boardImageSource
        : boardImagePreviewUrl
          ? "uploaded"
          : null,
    aiMessages: []
  };
}

function createItemDraftFromMaterial(material: WorkspaceMaterial): ItemCreateDraft {
  const draft = createDefaultItemDraft();
  const metadata = getItemMaterialMetadata(material.metadata);

  if (!metadata || metadata.kind !== "item") {
    return {
      ...draft,
      name: material.title,
      description: material.description,
      style: material.style
    };
  }

  const viewImages = scenePanoramaFaces.reduce<ItemCreateDraft["viewImages"]>((result, face) => {
    const image = metadata.viewImages?.[face];

    if (image?.url) {
      result[face] = {
        file: null,
        previewUrl: image.url,
        source: image.source ?? "existing",
        storedUrl: image.url
      };
    }

    return result;
  }, {});
  const modelInputImage = metadata.modelInputImage?.url
    ? {
        file: null,
        previewUrl: metadata.modelInputImage.url,
        source: metadata.modelInputImage.source ?? "existing",
        storedUrl: metadata.modelInputImage.url
      } satisfies ItemModelInputImageDraft
    : null;

  return {
    ...draft,
    name: metadata.name || material.title,
    itemCategory: metadata.itemCategory,
    description: metadata.description || material.description,
    communityVisible: true,
    traits: sanitizeItemTags(metadata.traits),
    uses: sanitizeItemTags(metadata.uses),
    functions: sanitizeItemTags(metadata.functions),
    materials: sanitizeItemTags(metadata.materials),
    colors: sanitizeItemTags(metadata.colors),
    styles: sanitizeItemTags(metadata.styles),
    brand: metadata.brand,
    model: metadata.model,
    keywords: sanitizeItemTags(metadata.keywords),
    scaleHint: metadata.scaleHint,
    style: typeof metadata.style === "string" && isWorkspaceMaterialStyle(metadata.style) ? metadata.style : material.style,
    boardDrawingStyle:
      typeof metadata.boardDrawingStyle === "string" && isMaskBoardDrawingStyle(metadata.boardDrawingStyle)
        ? metadata.boardDrawingStyle
        : draft.boardDrawingStyle,
    boardImagePreviewUrl: metadata.boardImage?.url ?? "",
    boardImageFile: null,
    boardImageSource: metadata.boardImage?.source ?? (metadata.boardImage?.url ? "uploaded" : null),
    modelInputImage,
    viewImages,
    model3d: metadata.model3d?.url ? metadata.model3d : null,
    modelExtraParams: "",
    aiMessages: []
  };
}

function createSceneDraftFromMaterial(material: WorkspaceMaterial): SceneCreateDraft {
  const metadata = getSceneMaterialMetadata(material.metadata);

  if (!metadata || metadata.kind !== "scene") {
    return {
      ...createDefaultSceneDraft(),
      name: material.title,
      description: material.description,
      style: material.style
    };
  }

  const blocks = metadata.blocks.length > 0 ? metadata.blocks.map((block) => ({
    id: block.id,
    name: block.name,
    description: block.description,
    referenceImages: [],
    scalePreset: normalizeSceneScalePreset(block.scalePreset),
    panorama: block.panorama
      ? {
          faceSource: block.panorama.faceSource,
          faces: scenePanoramaFaces.reduce<Partial<Record<ScenePanoramaFace, ScenePanoramaFaceDraft>>>((faces, face) => {
            const url = block.panorama?.faces?.[face]?.url ?? "";

            if (url) {
              faces[face] = {
                file: null,
                previewUrl: url,
                source: "existing",
                storedUrl: url
              };
            }

            return faces;
          }, {}),
          mother: block.panorama.mother?.url
            ? {
                file: null,
                previewUrl: block.panorama.mother.url,
                source: "existing" as const,
                storedUrl: block.panorama.mother.url
              }
            : null
        }
      : null
  })) : [createDefaultSceneBlock()];

  return {
    name: metadata.name || material.title,
    description: metadata.description || material.description,
    communityVisible: true,
    style: typeof metadata.style === "string" && isWorkspaceMaterialStyle(metadata.style) ? metadata.style : material.style,
    panoramaDrawingStyle:
      typeof metadata.panoramaDrawingStyle === "string" && isScenePanoramaDrawingStyle(metadata.panoramaDrawingStyle)
        ? metadata.panoramaDrawingStyle
        : "realistic",
    blocks
  };
}

function serializeMaskDraft(draft: MaskCreateDraft) {
  return {
    name: draft.name,
    intro: draft.intro,
    features: draft.features,
    communityVisible: true,
    style: draft.style,
    body: draft.body,
    colors: draft.colors,
    voice: draft.voice,
    personality: draft.personality,
    boardDrawingStyle: draft.boardDrawingStyle,
    boardImageSource: draft.boardImageSource
  };
}

function serializeCreatureDraft(draft: CreatureCreateDraft): CreatureMaterialCreateInput {
  return {
    name: draft.name,
    description: draft.description,
    communityVisible: true,
    style: draft.style,
    taxonomy: draft.taxonomy,
    morphology: draft.morphology,
    colors: draft.colors,
    vocalization: draft.vocalization,
    senses: draft.senses,
    ecology: draft.ecology,
    abilities: creatureAbilityFields.reduce<CreatureMaterialCreateInput["abilities"]>((result, field) => {
      result[field] = sanitizeItemTags(draft.abilities[field]);

      return result;
    }, {} as CreatureMaterialCreateInput["abilities"]),
    behaviorLogic: draft.behaviorLogic,
    behavior: draft.behavior,
    boardDrawingStyle: draft.boardDrawingStyle,
    boardImageSource: draft.boardImageSource
  };
}

function serializeItemDraft(draft: ItemCreateDraft): ItemMaterialCreateInput {
  return {
    name: draft.name,
    itemCategory: draft.itemCategory,
    description: draft.description,
    communityVisible: true,
    traits: draft.traits,
    uses: draft.uses,
    functions: draft.functions,
    materials: draft.materials,
    colors: draft.colors,
    styles: draft.styles,
    brand: draft.brand,
    model: draft.model,
    keywords: draft.keywords,
    scaleHint: draft.scaleHint,
    style: draft.style,
    boardDrawingStyle: draft.boardDrawingStyle,
    boardImageSource: draft.boardImageSource,
    modelInputImage: draft.modelInputImage
      ? {
          source: draft.modelInputImage.source === "uploaded" ? "uploaded" : "generated",
          url: getItemImageStoredUrl(draft.modelInputImage)
        }
      : null,
    viewImages: scenePanoramaFaces.reduce<NonNullable<ItemMaterialCreateInput["viewImages"]>>((result, face) => {
      const image = draft.viewImages[face];
      const storedUrl = getItemImageStoredUrl(image);

      if (image && storedUrl) {
        result[face] = {
          source: image.source === "uploaded" ? "uploaded" : "generated",
          url: storedUrl
        };
      }

      return result;
    }, {}),
    model3d: draft.model3d
  };
}

function serializeSceneTextDraft(draft: SceneCreateDraft): SceneMaterialCreateInput {
  return {
    name: draft.name,
    description: draft.description,
    communityVisible: true,
    style: draft.style,
    panoramaDrawingStyle: draft.panoramaDrawingStyle,
    blocks: draft.blocks.map((block) => ({
      id: block.id,
      name: block.name,
      description: block.description,
      scalePreset: block.scalePreset,
      panorama: null
    }))
  };
}

function getMaskBoardImageMode(draft: MaskCreateDraft): "keep" | "replace" | "clear" {
  if (draft.boardImageFile) {
    return "replace";
  }

  if (draft.boardImagePreviewUrl) {
    return "keep";
  }

  return "clear";
}

function getCreatureBoardImageMode(draft: CreatureCreateDraft): "keep" | "replace" | "clear" {
  if (draft.boardImageFile) {
    return "replace";
  }

  if (draft.boardImagePreviewUrl) {
    return "keep";
  }

  return "clear";
}

function applyPatchToSceneDraft(draft: SceneCreateDraft, patch: SceneDraftPatch): SceneCreateDraft {
  const removeIds = new Set(patch.removeBlockIds ?? []);
  const updatedBlocks = draft.blocks
    .filter((block) => !removeIds.has(block.id))
    .map((block) => {
      const update = patch.updateBlocks?.find((item) => item.id === block.id);

      return update
        ? {
            ...block,
            ...(typeof update.name === "string" ? { name: update.name } : {}),
            ...(typeof update.description === "string" ? { description: update.description } : {}),
            ...(update.scalePreset ? { scalePreset: normalizeSceneScalePreset(update.scalePreset) } : {})
          }
        : block;
    });
  const addedBlocks = (patch.addBlocks ?? []).map((block) => ({
    id: block.id || createClientId("scene-block"),
    name: block.name,
    description: block.description,
    referenceImages: [],
    scalePreset: normalizeSceneScalePreset(block.scalePreset),
    panorama: null
  }));
  const blocks = [...updatedBlocks, ...addedBlocks];

  return {
    ...draft,
    ...(typeof patch.name === "string" ? { name: patch.name } : {}),
    ...(typeof patch.description === "string" ? { description: patch.description } : {}),
    ...(patch.style ? { style: patch.style } : {}),
    blocks: blocks.length > 0 ? blocks : [createDefaultSceneBlock()]
  };
}

function applyPatchToMaskDraft(draft: MaskCreateDraft, patch: MaskDraftPatch): MaskCreateDraft {
  return {
    ...draft,
    ...(typeof patch.name === "string" ? { name: patch.name } : {}),
    ...(typeof patch.intro === "string" ? { intro: patch.intro } : {}),
    ...(typeof patch.features === "string" ? { features: patch.features } : {}),
    ...(patch.style ? { style: patch.style } : {}),
    body: patch.body ? { ...draft.body, ...pickKnownStringPatch(patch.body, maskBodyFields.map((field) => field.id)) } : draft.body,
    colors: patch.colors ? { ...draft.colors, ...pickKnownColorPatch(patch.colors, maskColorFields.map((field) => field.id)) } : draft.colors,
    voice: patch.voice ? { ...draft.voice, ...pickKnownNumberPatch(patch.voice, maskVoiceFields) } : draft.voice,
    personality: patch.personality
      ? { ...draft.personality, ...pickKnownNumberPatch(patch.personality, maskPersonalityGroups.flatMap((group) => group.fields).map((id) => ({ id, min: 0, max: 100 }))) }
      : draft.personality
  };
}

function applyPatchToCreatureDraft(draft: CreatureCreateDraft, patch: CreatureDraftPatch): CreatureCreateDraft {
  return {
    ...draft,
    ...(typeof patch.name === "string" ? { name: patch.name } : {}),
    ...(typeof patch.description === "string" ? { description: patch.description } : {}),
    ...(patch.style ? { style: patch.style } : {}),
    taxonomy: patch.taxonomy
      ? { ...draft.taxonomy, ...pickKnownStringPatch(patch.taxonomy, creatureTaxonomyFields.map((field) => field.id)) }
      : draft.taxonomy,
    morphology: patch.morphology
      ? { ...draft.morphology, ...pickKnownStringPatch(patch.morphology, creatureMorphologyFields.map((field) => field.id)) }
      : draft.morphology,
    colors: patch.colors
      ? { ...draft.colors, ...pickKnownColorPatch(patch.colors, creatureColorFields.map((field) => field.id)) }
      : draft.colors,
    vocalization: patch.vocalization
      ? { ...draft.vocalization, ...pickKnownNumberPatch(patch.vocalization, creatureVocalizationFields) }
      : draft.vocalization,
    senses: patch.senses
      ? { ...draft.senses, ...pickKnownNumberPatch(patch.senses, creatureSenseFields) }
      : draft.senses,
    ecology: patch.ecology
      ? { ...draft.ecology, ...pickKnownStringPatch(patch.ecology, creatureEcologyFields.map((field) => field.id)) }
      : draft.ecology,
    abilities: patch.abilities
      ? {
          ...draft.abilities,
          ...creatureAbilityFields.reduce<Partial<CreatureCreateDraft["abilities"]>>((result, field) => {
            if (Array.isArray(patch.abilities?.[field])) {
              result[field] = sanitizeItemTags(patch.abilities[field]);
            }

            return result;
          }, {})
        }
      : draft.abilities,
    ...(typeof patch.behaviorLogic === "string" ? { behaviorLogic: patch.behaviorLogic } : {}),
    behavior: patch.behavior
      ? {
          ...draft.behavior,
          ...pickKnownNumberPatch(
            patch.behavior,
            creatureBehaviorGroups.flatMap((group) => group.fields).map((id) => ({ id, min: 0, max: 100 }))
          )
        }
      : draft.behavior
  };
}

function applyPatchToItemDraft(draft: ItemCreateDraft, patch: ItemDraftPatch): ItemCreateDraft {
  return {
    ...draft,
    ...(typeof patch.name === "string" ? { name: patch.name } : {}),
    ...(typeof patch.itemCategory === "string" ? { itemCategory: patch.itemCategory } : {}),
    ...(typeof patch.description === "string" ? { description: patch.description } : {}),
    ...(typeof patch.brand === "string" ? { brand: patch.brand } : {}),
    ...(typeof patch.model === "string" ? { model: patch.model } : {}),
    ...(typeof patch.scaleHint === "string" ? { scaleHint: patch.scaleHint } : {}),
    ...(patch.style ? { style: patch.style } : {}),
    ...itemTagFields.reduce<Partial<Pick<ItemCreateDraft, ItemTagFieldId>>>((result, field) => {
      const values = patch[field];

      if (Array.isArray(values)) {
        result[field] = sanitizeItemTags(values);
      }

      return result;
    }, {})
  };
}

function pickKnownStringPatch<T extends string>(patch: Partial<Record<T, string>>, keys: readonly T[]) {
  return keys.reduce<Partial<Record<T, string>>>((result, key) => {
    if (typeof patch[key] === "string") {
      result[key] = patch[key];
    }

    return result;
  }, {});
}

function pickKnownColorPatch<T extends string>(patch: Partial<Record<T, string>>, keys: readonly T[]) {
  return keys.reduce<Partial<Record<T, string>>>((result, key) => {
    const value = patch[key];

    if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) {
      result[key] = value.toUpperCase();
    }

    return result;
  }, {});
}

function pickKnownNumberPatch<T extends string>(
  patch: Partial<Record<T, number>>,
  fields: readonly { id: T; min: number; max: number }[]
) {
  return fields.reduce<Partial<Record<T, number>>>((result, field) => {
    const value = patch[field.id];

    if (typeof value === "number" && Number.isFinite(value)) {
      result[field.id] = Math.min(field.max, Math.max(field.min, Math.round(value)));
    }

    return result;
  }, {});
}

function getMaskMaterialMetadata(metadata: WorkspaceMaterialMetadata | undefined | null) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  return metadata as Record<string, unknown>;
}

function getCreatureMaterialMetadata(metadata: WorkspaceMaterialMetadata | undefined | null): WorkspaceCreatureMaterialMetadata | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Partial<WorkspaceCreatureMaterialMetadata>;

  return record.kind === "creature" ? record as WorkspaceCreatureMaterialMetadata : null;
}

function getSceneMaterialMetadata(metadata: WorkspaceMaterialMetadata | undefined | null): WorkspaceSceneMaterialMetadata | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Partial<WorkspaceSceneMaterialMetadata>;

  return record.kind === "scene" && Array.isArray(record.blocks) ? record as WorkspaceSceneMaterialMetadata : null;
}

function getItemMaterialMetadata(metadata: WorkspaceMaterialMetadata | undefined | null): WorkspaceItemMaterialMetadata | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Partial<WorkspaceItemMaterialMetadata>;

  return record.kind === "item" ? record as WorkspaceItemMaterialMetadata : null;
}

function getNestedRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function isWorkspaceMaterialStyle(style: string): style is WorkspaceMaterialStyle {
  return materialStyles.includes(style as WorkspaceMaterialStyle);
}

function isMaskBoardDrawingStyle(style: string): style is MaskBoardDrawingStyle {
  return maskBoardDrawingStyles.includes(style as MaskBoardDrawingStyle);
}

function isScenePanoramaDrawingStyle(style: string): style is ScenePanoramaDrawingStyle {
  return maskBoardDrawingStyles.includes(style as ScenePanoramaDrawingStyle);
}

function normalizeSceneScalePreset(value: unknown): WorkspaceSceneScalePreset {
  return typeof value === "string" && sceneScalePresets.some((preset) => preset.id === value)
    ? value as WorkspaceSceneScalePreset
    : defaultSceneScalePreset;
}

function isValidMaskBoardImage(file: File, options: { allowOversize?: boolean } = {}) {
  return (
    maskBoardAcceptedTypes.includes(file.type.toLowerCase()) &&
    file.size > 0 &&
    (options.allowOversize || file.size <= maxMaskBoardImageBytes)
  );
}

function isValidGeneratedMaterialImage(file: File) {
  return maskBoardAcceptedTypes.includes(file.type.toLowerCase()) && file.size > 0;
}

function isValidScenePanoramaFace(file: File) {
  return scenePanoramaAcceptedTypes.includes(file.type.toLowerCase()) && file.size > 0 && file.size <= maxScenePanoramaFaceBytes;
}

function isValidScenePanoramaMother(file: File) {
  return scenePanoramaAcceptedTypes.includes(file.type.toLowerCase()) && file.size > 0 && file.size <= maxScenePanoramaFaceBytes;
}

function isValidGeneratedScenePanoramaImage(file: File) {
  return scenePanoramaAcceptedTypes.includes(file.type.toLowerCase()) && file.size > 0;
}

function isValidSceneReferenceImage(file: File) {
  return scenePanoramaAcceptedTypes.includes(file.type.toLowerCase()) && file.size > 0 && file.size <= maxScenePanoramaFaceBytes;
}

function isCompleteItemModelInputImageDraft(image: ItemCreateDraft["modelInputImage"]) {
  return hasItemModelInputImageDraft(image);
}

function hasItemModelInputImageDraft(image: ItemCreateDraft["modelInputImage"]) {
  return Boolean(image?.previewUrl || image?.storedUrl || image?.file);
}

function getItemImageStoredUrl(image: ItemViewImageDraft | ItemModelInputImageDraft | null | undefined) {
  if (!image) {
    return "";
  }

  if (image.storedUrl) {
    return image.storedUrl;
  }

  return image.previewUrl && !image.previewUrl.startsWith("blob:") && !image.previewUrl.startsWith("data:") ? image.previewUrl : "";
}

function sanitizeItemTags(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.slice(0, 80))))
    .slice(0, 30);
}

function getItemBoardImageMode(draft: ItemCreateDraft): "keep" | "replace" | "clear" {
  if (draft.boardImageFile) {
    return "replace";
  }

  if (draft.boardImagePreviewUrl) {
    return "keep";
  }

  return "clear";
}

function getItemModelInputImageMode(draft: ItemCreateDraft): "keep" | "replace" | "clear" {
  if (draft.modelInputImage?.file) {
    return "replace";
  }

  if (hasItemModelInputImageDraft(draft.modelInputImage)) {
    return "keep";
  }

  return "clear";
}

function buildItemMaterialFormData(draft: ItemCreateDraft, isEditing: boolean) {
  const formData = new FormData();

  formData.append("draft", JSON.stringify(serializeItemDraft(draft)));

  if (draft.boardImageFile) {
    if (!isValidMaskBoardImage(draft.boardImageFile, { allowOversize: draft.boardImageSource === "generated" })) {
      throw new Error("INVALID_MATERIAL_IMAGE_FILE");
    }

    formData.append("boardImage", draft.boardImageFile);
  }

  if (draft.modelInputImage?.file) {
    if (!isValidMaskBoardImage(draft.modelInputImage.file, { allowOversize: draft.modelInputImage.source !== "uploaded" })) {
      throw new Error("INVALID_ITEM_MODEL_INPUT_IMAGE_FILE");
    }

    formData.append("modelInputImage", draft.modelInputImage.file);
  }

  if (isEditing) {
    formData.append("boardImageMode", getItemBoardImageMode(draft));
    formData.append("modelInputImageMode", getItemModelInputImageMode(draft));
  }

  return formData;
}

function buildMapMaterialFormData(draft: MapCreateDraft) {
  const formData = new FormData();

  formData.append("draft", JSON.stringify(serializeMapDraft(draft)));

  return formData;
}

function normalizeScenePanoramaMaxRedrawAttempts(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;

  if (!Number.isFinite(parsed)) {
    return defaultScenePanoramaMaxRedrawAttempts;
  }

  return Math.min(maxScenePanoramaMaxRedrawAttempts, Math.max(minScenePanoramaMaxRedrawAttempts, Math.round(parsed)));
}

function createInitialScenePanoramaGenerationDraft(): ScenePanoramaGenerationDraft {
  return {
    completed: false,
    error: null,
    faces: {},
    finalFaces: {},
    iteratingFaces: [],
    messageKey: "sceneForm.panoramaProgressQueued",
    motherImage: null,
    progress: 4,
    stage: "queued"
  };
}

function normalizeSceneFaceSource(source: ScenePanoramaFaceDraft["source"]): ScenePanoramaDraft["faceSource"] {
  if (source === "existing") {
    return "uploaded";
  }

  return source;
}

function isCompleteScenePanoramaFaceUrls(
  faces: Partial<Record<ScenePanoramaFace, string>>
): faces is Record<ScenePanoramaFace, string> {
  return scenePanoramaFaces.every((face) => Boolean(faces[face]));
}

function hasAnyScenePanoramaFaceDraft(faces: ScenePanoramaDraft["faces"]) {
  return scenePanoramaFaces.some((face) => {
    const image = faces[face];

    return Boolean(image?.previewUrl || image?.storedUrl || image?.file);
  });
}

function getCompleteScenePanoramaFaceUrls(panorama: ScenePanoramaDraft | null) {
  if (!panorama) {
    return null;
  }

  const faces = scenePanoramaFaces.reduce<Record<ScenePanoramaFace, string>>((result, face) => {
    const image = panorama.faces[face];

    result[face] = image?.previewUrl ?? image?.storedUrl ?? "";

    return result;
  }, {} as Record<ScenePanoramaFace, string>);

  return isCompleteScenePanoramaFaceUrls(faces) ? faces : null;
}

function getScenePanoramaGenerationFaceUrls(facesByFace: Partial<Record<ScenePanoramaFace, ScenePanoramaStreamFaceImage>>) {
  const faces = scenePanoramaFaces.reduce<Partial<Record<ScenePanoramaFace, string>>>((result, face) => {
    const image = facesByFace[face];

    if (image?.dataUrl) {
      result[face] = image.dataUrl;
    }

    return result;
  }, {});

  return Object.keys(faces).length > 0 ? faces : null;
}

function validateSceneBlockGeneration(draft: SceneCreateDraft, blockId: string) {
  const block = draft.blocks.find((item) => item.id === blockId);

  if (!draft.name.trim()) {
    return "sceneForm.errors.nameRequired";
  }

  if (!draft.description.trim()) {
    return "sceneForm.errors.descriptionRequired";
  }

  if (!block?.name.trim()) {
    return "sceneForm.errors.blockNameRequired";
  }

  if (!block.description.trim()) {
    return "sceneForm.errors.blockDescriptionRequired";
  }

  return "";
}

function validateSceneDraftForSave(draft: SceneCreateDraft) {
  if (!draft.name.trim()) {
    return "sceneForm.errors.nameRequired";
  }

  if (!draft.description.trim()) {
    return "sceneForm.errors.descriptionRequired";
  }

  if (draft.blocks.length === 0) {
    return "sceneForm.errors.blockRequired";
  }

  for (const block of draft.blocks) {
    if (!block.name.trim()) {
      return "sceneForm.errors.blockNameRequired";
    }

    if (!block.description.trim()) {
      return "sceneForm.errors.blockDescriptionRequired";
    }

    if (block.panorama && hasAnyScenePanoramaFaceDraft(block.panorama.faces)) {
      const completeFaces = getCompleteScenePanoramaFaceUrls(block.panorama);

      if (!completeFaces) {
        return "sceneForm.errors.panoramaIncomplete";
      }
    }
  }

  return "";
}

async function uploadSceneDraftPanoramaFaces(draft: SceneCreateDraft, uploadedFaceUrls: string[]): Promise<SceneMaterialCreateInput> {
  const blocks: SceneMaterialCreateInput["blocks"] = [];

  for (const block of draft.blocks) {
    if (!block.panorama) {
      blocks.push({
        id: block.id,
        name: block.name,
        description: block.description,
        scalePreset: block.scalePreset,
        panorama: null
      });
      continue;
    }

    let mother: { source: "generated" | "uploaded"; url: string } | null = null;

    if (block.panorama.mother) {
      const motherDraft = block.panorama.mother;

      if (motherDraft.storedUrl && !motherDraft.file) {
        mother = {
          source: motherDraft.source === "existing" ? "generated" : motherDraft.source,
          url: motherDraft.storedUrl
        };
      } else if (motherDraft.file) {
        const formData = new FormData();

        formData.append("file", motherDraft.file);
        formData.append("source", motherDraft.source);

        const result = await uploadHomeScenePanoramaMother(formData);

        uploadedFaceUrls.push(result.url);
        mother = {
          source: motherDraft.source === "uploaded" ? "uploaded" : "generated",
          url: result.url
        };
      }
    }

    if (!hasAnyScenePanoramaFaceDraft(block.panorama.faces)) {
      blocks.push({
        id: block.id,
        name: block.name,
        description: block.description,
        scalePreset: block.scalePreset,
        panorama: mother
          ? {
              faceSource: block.panorama.faceSource,
              faces: {},
              mother
            }
          : null
      });
      continue;
    }

    const settled = await Promise.allSettled(
      scenePanoramaFaces.map(async (face) => {
        const image = block.panorama?.faces[face];

        if (!image) {
          throw new Error("SCENE_PANORAMA_INCOMPLETE");
        }

        if (image.storedUrl && !image.file) {
          return [face, image.storedUrl] as const;
        }

        if (!image.file) {
          throw new Error("SCENE_PANORAMA_INCOMPLETE");
        }

        const formData = new FormData();

        formData.append("face", face);
        formData.append("file", image.file);
        formData.append("source", image.source);

        const result = await uploadHomeScenePanoramaFace(formData);

        uploadedFaceUrls.push(result.url);

        return [face, result.url] as const;
      })
    );
    const failed = settled.find((result) => result.status === "rejected");

    if (failed) {
      throw failed.reason;
    }

    const faces = settled.reduce<Record<ScenePanoramaFace, string>>((result, item) => {
      if (item.status === "fulfilled") {
        const [face, url] = item.value;

        result[face] = url;
      }

      return result;
    }, {} as Record<ScenePanoramaFace, string>);

    blocks.push({
      id: block.id,
      name: block.name,
      description: block.description,
      scalePreset: block.scalePreset,
      panorama: {
        faceSource: block.panorama.faceSource,
        faces,
        mother
      }
    });
  }

  return {
    name: draft.name,
    description: draft.description,
    style: draft.style,
    panoramaDrawingStyle: draft.panoramaDrawingStyle,
    blocks
  };
}

async function getItemBoardFileForGeneration(draft: ItemCreateDraft) {
  if (draft.boardImageFile) {
    return draft.boardImageFile;
  }

  if (!draft.boardImagePreviewUrl) {
    return null;
  }

  return fetchUrlAsFile(draft.boardImagePreviewUrl, "item-board.png", "image/png");
}

async function getItemModelInputFileForModel(draft: ItemCreateDraft): Promise<File | null> {
  const image = draft.modelInputImage;

  if (!image) {
    return null;
  }

  const file = image.file ?? (image.previewUrl ? await fetchUrlAsFile(image.previewUrl, "item-model-input.png", "image/png") : null);

  if (!file || !isValidMaskBoardImage(file, { allowOversize: image.source !== "uploaded" })) {
    return null;
  }

  return file;
}

async function fetchUrlAsFile(url: string, fileName: string, fallbackType: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("ITEM_IMAGE_FETCH_FAILED");
  }

  const blob = await response.blob();
  const contentType = blob.type || fallbackType;

  return new File([blob], fileName, { type: contentType });
}

async function readItemModelStream(response: Response, onEvent: (event: ItemModelStreamEvent) => void) {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("INSTANTMESH_STREAM_UNAVAILABLE");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const data = rawEvent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");

      if (!data) {
        continue;
      }

      onEvent(JSON.parse(data) as ItemModelStreamEvent);
    }

    if (done) {
      break;
    }
  }
}

function isZipArchiveFile(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  return name.endsWith(".zip") || type === "application/zip" || type === "application/x-zip-compressed";
}

function createPreviewUrl(file: File) {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(file);
  }

  return "";
}

function createSceneReferenceImageDrafts(files: File[]) {
  let invalidCount = 0;
  const images = files.reduce<SceneReferenceImageDraft[]>((result, file) => {
    if (!isValidSceneReferenceImage(file)) {
      invalidCount += 1;

      return result;
    }

    result.push({
      id: createClientId("scene-reference"),
      file,
      previewUrl: createPreviewUrl(file)
    });

    return result;
  }, []);

  return { images, invalidCount };
}

async function downloadMaterialArchive(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(await readTransferErrorCode(response));
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = getArchiveFileName(response.headers.get("content-disposition"));
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function readTransferErrorCode(response: Response) {
  try {
    const payload = await response.json() as { error?: string };

    return payload.error ?? "MATERIAL_TRANSFER_FAILED";
  } catch {
    return "MATERIAL_TRANSFER_FAILED";
  }
}

function getArchiveFileName(contentDisposition: string | null) {
  const encodedFileName = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainFileName = contentDisposition?.match(/filename="([^"]+)"/i)?.[1];

  if (encodedFileName) {
    return decodeURIComponent(encodedFileName);
  }

  return plainFileName ?? "nwt-materials.zip";
}

function revokeMaskBoardPreview(url: string) {
  if (url.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

function revokeCreatureBoardPreview(url: string) {
  revokeMaskBoardPreview(url);
}

function revokeItemDraftPreviews(draft: ItemCreateDraft) {
  revokeItemBoardPreview(draft.boardImagePreviewUrl);
  revokeItemModelInputImagePreview(draft.modelInputImage);
  Object.values(draft.viewImages).forEach(revokeItemViewPreview);
}

function revokeItemBoardPreview(url: string) {
  revokeMaskBoardPreview(url);
}

function revokeItemViewPreview(image: ItemViewImageDraft | undefined) {
  if (image?.previewUrl.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(image.previewUrl);
  }
}

function revokeItemModelInputImagePreview(image: ItemModelInputImageDraft | null | undefined) {
  if (image?.previewUrl.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(image.previewUrl);
  }
}

function revokeSceneDraftPreviews(draft: SceneCreateDraft) {
  draft.blocks.forEach(revokeSceneBlockPreviews);
}

function revokeSceneBlockPreviews(block: SceneBlockDraft) {
  revokeScenePanoramaMotherPreview(block.panorama?.mother);
  Object.values(block.panorama?.faces ?? {}).forEach(revokeSceneFacePreview);
  block.referenceImages.forEach(revokeSceneReferenceImagePreview);
}

function revokeScenePanoramaMotherPreview(mother: ScenePanoramaMotherDraft | null | undefined) {
  if (mother?.previewUrl.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(mother.previewUrl);
  }
}

function revokeSceneFacePreview(face: ScenePanoramaFaceDraft) {
  if (face.previewUrl.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(face.previewUrl);
  }
}

function revokeSceneReferenceImagePreview(image: SceneReferenceImageDraft) {
  if (image.previewUrl.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(image.previewUrl);
  }
}

async function dataUrlToFile(dataUrl: string, fileName: string, contentType: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);

  if (!match) {
    throw new Error("SCENE_PANORAMA_IMAGE_DATA_URL_INVALID");
  }

  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: contentType || match[1] || "image/png" });

  return new File([blob], fileName, { type: contentType });
}

function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
