import "server-only";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { StoryMaterialStyle as PrismaStoryMaterialStyle } from "@prisma/client";
import type { Locale } from "@/i18n/routing";
import {
  generateDefaultItemBoardImage,
  generateDefaultItemModelInputImage,
  generateDefaultMapImage,
  generateDefaultMaskBoardImage,
  generateDefaultScenePanorama,
  generateDefaultScenePanoramaMother,
  normalizeScenePanoramaMaxRedrawAttempts,
  scenePanoramaFaces,
  streamDefaultScenePanorama,
  streamDefaultScenePanoramaMother,
  type ScenePanoramaFace,
  type ScenePanoramaGenerationOptions,
  type ScenePanoramaGenerationResult,
  type ScenePanoramaMotherGenerationResult,
  type ScenePanoramaReferenceImage,
  type ScenePanoramaStreamCallback
} from "@/lib/ai/image-runtime";
import {
  generateDefaultLlmReply,
  streamDefaultLlmReply,
  type RuntimeChatContentPart,
  type RuntimeChatMessage,
  type RuntimeTokenUsage
} from "@/lib/ai/runtime";
import { ensureConfiguredAdminUser, getCurrentViewer, requireAuth } from "@/lib/auth";
import type { AuthViewer } from "@/lib/auth-types";
import { configureServerOutboundProxy } from "@/lib/network/proxy";
import {
  buildNarrativeLlmMessages,
  createConversationTitle,
  emptyTokenUsage,
  summarizeConversationTokenUsage
} from "@/lib/home-workspace-utils";
import { prisma } from "@/lib/prisma";
import {
  deleteMaterialImagesByUrls,
  isValidMaterialImageFile,
  isValidScenePanoramaImageBytes,
  isValidScenePanoramaImageFile,
  uploadCreatureBoardImage,
  uploadMaskBoardImage,
  uploadMapImage,
  uploadItemBoardImage,
  uploadItemModelInputImage,
  uploadScenePanoramaFaceImage,
  uploadScenePanoramaMotherImage
} from "@/lib/storage/material";
import { syncMapMaterialProjection } from "@/lib/graph/map-material";
import {
  buildMapGraphSignature,
  buildMapImageNodeBatches,
  buildMapMaterialMetadata,
  getMapMaterialMetadata,
  isMapNodeType,
  isMapRelationType,
  normalizeMapImageNodeBatchSize
} from "./map";

export type {
  WorkspaceScript,
  WorkspaceScriptLibrarySource,
  WorkspaceMaterialCategory,
  WorkspaceMaterialStyle,
  WorkspaceMaterialLibrarySource,
  WorkspaceMaterial,
  MaskDraftPatch,
  MaskAiAssistResult,
  MaskBoardGenerationResult,
  CreatureDraftPatch,
  CreatureAiAssistResult,
  CreatureBoardGenerationResult,
  ItemViewFace,
  ItemViewImageResult,
  ItemBoardGenerationResult,
  ItemModelInputImageGenerationResult,
  ItemModelInputImageResult,
  ItemViewsGenerationResult,
  MaskMaterialCreateInput,
  CreatureMaterialCreateInput,
  SceneMaterialCreateInput,
  ItemMaterialCreateInput,
  MapMaterialCreateInput,
  MapAiAssistResult,
  MapDraftPatch,
  MapCreateDraft,
  WorkspaceMapMaterialNodeType,
  WorkspaceMapMaterialRelationType,
  WorkspaceMapMaterialNode,
  WorkspaceMapMaterialEdge,
  WorkspaceMapMaterialImage,
  WorkspaceMapMaterialImageSource,
  ItemDraftPatch,
  ItemAiAssistResult,
  SceneMaterialBlockInput,
  SceneMaterialPanoramaInput,
  SceneDraftPatch,
  SceneAiAssistResult,
  SceneAssistReferenceImage,
  ScenePanoramaGenerationState,
  ScenePanoramaMotherGenerationState,
  ScenePanoramaStreamHandler,
  WorkspaceMaskBoardDrawingStyle,
  WorkspaceScenePanoramaDrawingStyle,
  WorkspaceSceneScalePreset,
  WorkspaceMaskBodyFieldId,
  WorkspaceMaskColorFieldId,
  WorkspaceMaskBoardImageSource,
  WorkspaceMaskVoiceFieldId,
  WorkspaceMaskPersonalityFieldId,
  WorkspaceCreatureTaxonomyFieldId,
  WorkspaceCreatureMorphologyFieldId,
  WorkspaceCreatureColorFieldId,
  WorkspaceCreatureVocalizationFieldId,
  WorkspaceCreatureSenseFieldId,
  WorkspaceCreatureEcologyFieldId,
  WorkspaceCreatureAbilityFieldId,
  WorkspaceCreatureBehaviorFieldId,
  WorkspaceMaskMaterialMetadata,
  WorkspaceCreatureMaterialMetadata,
  WorkspaceItemMaterialMetadata,
  WorkspaceSceneMaterialMetadata,
  WorkspaceMapMaterialMetadata,
  MapImageMetaInput,
  MapImageStreamImage,
  MapImageStreamDoneEvent,
  MapImageStreamEvent,
  MapImageStreamHandler,
  MapMaterialImageMode,
  WorkspaceMaterialMetadata,
  MaskMaterialBoardImageMode,
  ItemMaterialImageMode,
  WorkspaceMessage,
  WorkspaceTokenUsage,
  WorkspaceConversation,
  WorkspaceData
} from "./types";
import type {
  WorkspaceScript,
  WorkspaceScriptLibrarySource,
  WorkspaceMaterialCategory,
  WorkspaceMaterialStyle,
  WorkspaceMaterialLibrarySource,
  WorkspaceMaterial,
  MaskDraftPatch,
  MaskAiAssistResult,
  MaskBoardGenerationResult,
  CreatureDraftPatch,
  CreatureAiAssistResult,
  CreatureBoardGenerationResult,
  ItemViewFace,
  ItemViewImageResult,
  ItemBoardGenerationResult,
  ItemModelInputImageGenerationResult,
  ItemModelInputImageResult,
  ItemViewsGenerationResult,
  MaskMaterialCreateInput,
  CreatureMaterialCreateInput,
  SceneMaterialCreateInput,
  ItemMaterialCreateInput,
  MapMaterialCreateInput,
  MapAiAssistResult,
  MapDraftPatch,
  MapCreateDraft,
  WorkspaceMapMaterialNodeType,
  WorkspaceMapMaterialRelationType,
  WorkspaceMapMaterialNode,
  WorkspaceMapMaterialEdge,
  WorkspaceMapMaterialImage,
  WorkspaceMapMaterialImageSource,
  ItemDraftPatch,
  ItemAiAssistResult,
  SceneMaterialBlockInput,
  SceneMaterialPanoramaInput,
  SceneDraftPatch,
  SceneAiAssistResult,
  SceneAssistReferenceImage,
  ScenePanoramaGenerationState,
  ScenePanoramaMotherGenerationState,
  ScenePanoramaStreamHandler,
  WorkspaceMaskBoardDrawingStyle,
  WorkspaceScenePanoramaDrawingStyle,
  WorkspaceSceneScalePreset,
  WorkspaceMaskBodyFieldId,
  WorkspaceMaskColorFieldId,
  WorkspaceMaskBoardImageSource,
  WorkspaceMaskVoiceFieldId,
  WorkspaceMaskPersonalityFieldId,
  WorkspaceCreatureTaxonomyFieldId,
  WorkspaceCreatureMorphologyFieldId,
  WorkspaceCreatureColorFieldId,
  WorkspaceCreatureVocalizationFieldId,
  WorkspaceCreatureSenseFieldId,
  WorkspaceCreatureEcologyFieldId,
  WorkspaceCreatureAbilityFieldId,
  WorkspaceCreatureBehaviorFieldId,
  WorkspaceMaskMaterialMetadata,
  WorkspaceCreatureMaterialMetadata,
  WorkspaceItemMaterialMetadata,
  WorkspaceSceneMaterialMetadata,
  WorkspaceMapMaterialMetadata,
  MapImageMetaInput,
  MapImageStreamImage,
  MapImageStreamDoneEvent,
  MapImageStreamEvent,
  MapImageStreamHandler,
  WorkspaceMaterialMetadata,
  MaskMaterialBoardImageMode,
  ItemMaterialImageMode,
  MapMaterialImageMode,
  WorkspaceMessage,
  WorkspaceTokenUsage,
  WorkspaceConversation,
  WorkspaceData
} from "./types";
import {
  baseScriptSlug,
  defaultUserId,
  defaultUserSlug,
  assistantRole,
  userRole,
  communityAddedSource,
  defaultSceneScalePreset,
  sceneScalePresetMeters,
  defaultMaterialSlugs,
  builtInScripts,
  builtInMaterials
} from "./defaults";

export async function getHomeWorkspaceData(locale: Locale): Promise<WorkspaceData> {
  try {
    const viewer = await getCurrentViewer();
    const workspaceUserId = viewer?.id ?? defaultUserId;

    await ensureHomeWorkspaceDefaults(workspaceUserId);

    const [communityScripts, libraryEntries, communityMaterials, materialLibraryEntries, conversations] = await Promise.all([
      prisma.storyScript.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.storyScriptLibraryEntry.findMany({
        where: { userId: workspaceUserId },
        include: { script: true },
        orderBy: { createdAt: "asc" }
      }),
      prisma.storyMaterial.findMany({
        where: { communityVisible: true },
        orderBy: { createdAt: "asc" }
      }),
      prisma.storyMaterialLibraryEntry.findMany({
        where: { userId: workspaceUserId },
        include: { material: true },
        orderBy: { createdAt: "asc" }
      }),
      viewer
        ? prisma.conversation.findMany({
            where: { userId: viewer.id },
            include: {
              script: true,
              messages: { orderBy: { createdAt: "asc" } }
            },
            orderBy: { updatedAt: "desc" }
          })
        : Promise.resolve([])
    ]);
    const librarySourceByScriptId = new Map(
      libraryEntries.map((entry) => [entry.scriptId, entry.source as WorkspaceScriptLibrarySource])
    );
    const librarySourceByMaterialId = new Map(
      materialLibraryEntries.map((entry) => [entry.materialId, entry.source as WorkspaceMaterialLibrarySource])
    );

    return {
      viewer,
      myScripts: libraryEntries.map((entry) =>
        mapScript(entry.script, locale, {
          inLibrary: true,
          librarySource: entry.source as WorkspaceScriptLibrarySource
        })
      ),
      communityScripts: communityScripts.map((script) =>
        mapScript(script, locale, {
          inLibrary: librarySourceByScriptId.has(script.id),
          librarySource: librarySourceByScriptId.get(script.id)
        })
      ),
      myMaterials: materialLibraryEntries.map((entry) =>
        mapMaterial(entry.material, locale, {
          inLibrary: true,
          librarySource: entry.source as WorkspaceMaterialLibrarySource
        })
      ),
      communityMaterials: communityMaterials.map((material) =>
        mapMaterial(material, locale, {
          inLibrary: librarySourceByMaterialId.has(material.id),
          librarySource: librarySourceByMaterialId.get(material.id)
        })
      ),
      conversations: conversations.map((conversation) => {
        const messages = conversation.messages.map(mapMessage);
        const lastMessage = messages.at(-1)?.content ?? mapScript(conversation.script, locale).welcome;

        return {
          id: conversation.id,
          title: conversation.title,
          scriptTitle: mapScript(conversation.script, locale).title,
          scriptWelcome: mapScript(conversation.script, locale).welcome,
          updatedAt: conversation.updatedAt.toISOString(),
          lastMessage,
          tokenUsage: summarizeConversationTokenUsage(messages),
          messages
        };
      }),
      persistenceAvailable: true
    };
  } catch {
    return getFallbackWorkspaceData(locale);
  }
}

export async function createConversation(scriptId: string, locale: Locale) {
  const viewer = await requireAuth();
  const script = await prisma.storyScript.findUniqueOrThrow({ where: { id: scriptId } });
  const title = mapScript(script, locale).title;

  await ensureHomeWorkspaceDefaults(viewer.id);

  const conversation = await prisma.conversation.create({
    data: {
      title,
      userId: viewer.id,
      scriptId
    },
    include: {
      script: true,
      messages: { orderBy: { createdAt: "asc" } }
    }
  });

  revalidatePath(`/${locale}`);

  return {
    id: conversation.id,
    title: conversation.title,
    scriptTitle: mapScript(conversation.script, locale).title,
    scriptWelcome: mapScript(conversation.script, locale).welcome,
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessage: mapScript(conversation.script, locale).welcome,
    tokenUsage: emptyTokenUsage(),
    messages: conversation.messages.map(mapMessage)
  } satisfies WorkspaceConversation;
}

export async function sendConversationMessage(conversationId: string, content: string, locale: Locale) {
  return createConversationReply(conversationId, content, locale, (messages, viewer) =>
    generateDefaultLlmReply(messages, viewer.id, viewer.showAiThinking, locale, {
      conversationId,
      feature: "conversation.reply",
      sessionId: conversationId
    })
  );
}

export async function streamConversationMessage(
  conversationId: string,
  content: string,
  locale: Locale,
  onDelta: (content: string) => void
) {
  return createConversationReply(conversationId, content, locale, (messages, viewer) =>
    streamDefaultLlmReply(messages, onDelta, viewer.id, viewer.showAiThinking, locale, {
      conversationId,
      feature: "conversation.stream",
      sessionId: conversationId
    })
  );
}

async function createConversationReply(
  conversationId: string,
  content: string,
  locale: Locale,
  createReply: (messages: RuntimeChatMessage[], viewer: AuthViewer) => Promise<{ content: string; usage: RuntimeTokenUsage }>
) {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw new Error("Message content is required.");
  }

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      script: true,
      messages: { orderBy: { createdAt: "asc" } }
    }
  });
  const viewer = await requireAuth();

  if (conversation.userId !== viewer.id) {
    throw new Error("Conversation not found.");
  }

  const script = mapScript(conversation.script, locale);
  const reply = await createReply(
    buildNarrativeLlmMessages({
      existingMessages: conversation.messages.map(mapMessage),
      locale,
      showThinking: viewer.showAiThinking,
      scriptTitle: script.title,
      scriptWelcome: script.welcome,
      userContent: normalizedContent
    }),
    viewer
  );
  const shouldRetitle = conversation.messages.length === 0;

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        conversationId,
        role: userRole,
        content: normalizedContent
      }
    }),
    prisma.chatMessage.create({
      data: {
        conversationId,
        role: assistantRole,
        content: reply.content,
        promptTokens: reply.usage.promptTokens,
        completionTokens: reply.usage.completionTokens,
        tokenUsageEstimated: reply.usage.estimated
      }
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        title: shouldRetitle ? createConversationTitle(normalizedContent) : conversation.title
      }
    })
  ]);

  const updatedConversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      script: true,
      messages: { orderBy: { createdAt: "asc" } }
    }
  });

  revalidatePath(`/${locale}`);

  const messages = updatedConversation.messages.map(mapMessage);

  return {
    id: updatedConversation.id,
    title: updatedConversation.title,
    scriptTitle: mapScript(updatedConversation.script, locale).title,
    scriptWelcome: mapScript(updatedConversation.script, locale).welcome,
    updatedAt: updatedConversation.updatedAt.toISOString(),
    lastMessage: messages.at(-1)?.content ?? mapScript(updatedConversation.script, locale).welcome,
    tokenUsage: summarizeConversationTokenUsage(messages),
    messages
  } satisfies WorkspaceConversation;
}

export async function deleteConversation(conversationId: string, locale: Locale) {
  if (!conversationId) {
    throw new Error("Conversation id is required.");
  }

  const viewer = await requireAuth();

  await prisma.conversation.deleteMany({
    where: { id: conversationId, userId: viewer.id }
  });

  revalidatePath(`/${locale}`);

  return { id: conversationId };
}

export async function addMaterialToLibrary(materialId: string, locale: Locale) {
  if (!materialId) {
    throw new Error("Material id is required.");
  }

  const viewer = await requireAuth();

  await ensureHomeWorkspaceDefaults(viewer.id);

  const entry = await prisma.storyMaterialLibraryEntry.upsert({
    where: {
      userId_materialId: {
        userId: viewer.id,
        materialId
      }
    },
    update: {},
    create: {
      userId: viewer.id,
      materialId,
      source: communityAddedSource
    },
    include: {
      material: true
    }
  });

  revalidatePath(`/${locale}`);

  return mapMaterial(entry.material, locale, {
    inLibrary: true,
    librarySource: entry.source as WorkspaceMaterialLibrarySource
  });
}

export async function createMaskMaterial(input: MaskMaterialCreateInput, boardImageFile: File | null, locale: Locale) {
  const viewer = await requireAuth();
  const name = input.name.trim();
  const intro = input.intro.trim();

  if (!name) {
    throw new Error("MASK_NAME_REQUIRED");
  }

  await ensureHomeWorkspaceDefaults(viewer.id);

  const previewUrl = boardImageFile && boardImageFile.size > 0
    ? input.boardImageSource === "generated"
      ? await uploadMaskBoardImage(viewer.id, boardImageFile, { allowOversize: true })
      : await uploadMaskBoardImage(viewer.id, boardImageFile)
    : null;
  const material = await prisma.storyMaterial.create({
    data: {
      slug: createUserMaterialSlug("mask", name),
      category: "MASK",
      style: toStoryMaterialStyle(input.style),
      titleZh: name,
      titleEn: name,
      descriptionZh: intro || name,
      descriptionEn: intro || name,
      previewUrl,
      metadata: buildMaskMaterialMetadata(input, previewUrl, input.boardImageSource),
      communityVisible: true,
      libraryEntries: {
        create: {
          userId: viewer.id,
          source: "SELF_CREATED"
        }
      }
    }
  });

  revalidatePath(`/${locale}`);

  return mapMaterial(material, locale, {
    inLibrary: true,
    librarySource: "SELF_CREATED"
  });
}

export async function updateMaskMaterial(
  materialId: string,
  input: MaskMaterialCreateInput,
  boardImageFile: File | null,
  boardImageMode: MaskMaterialBoardImageMode,
  locale: Locale
) {
  const viewer = await requireAuth();
  const name = input.name.trim();
  const intro = input.intro.trim();

  if (!name) {
    throw new Error("MASK_NAME_REQUIRED");
  }

  const entry = await prisma.storyMaterialLibraryEntry.findFirst({
    where: {
      userId: viewer.id,
      materialId,
      source: "SELF_CREATED"
    },
    include: {
      material: true
    }
  });

  if (!entry || normalizeMaterialCategory(entry.material.category) !== "mask") {
    throw new Error("MATERIAL_NOT_EDITABLE");
  }

  let previewUrl = entry.material.previewUrl ?? null;
  let boardImageSource = getExistingMaskBoardImageSource(entry.material.metadata) ?? input.boardImageSource ?? null;

  if (boardImageMode === "replace") {
    if (!boardImageFile || boardImageFile.size <= 0) {
      throw new Error("INVALID_MATERIAL_IMAGE_FILE");
    }

    previewUrl = input.boardImageSource === "generated"
      ? await uploadMaskBoardImage(viewer.id, boardImageFile, { allowOversize: true })
      : await uploadMaskBoardImage(viewer.id, boardImageFile);
    boardImageSource = input.boardImageSource ?? "uploaded";
  } else if (boardImageMode === "clear") {
    previewUrl = null;
    boardImageSource = null;
  } else if (previewUrl && !boardImageSource) {
    boardImageSource = "uploaded";
  }

  const material = await prisma.storyMaterial.update({
    where: {
      id: entry.material.id
    },
      data: {
        category: "MASK",
        style: toStoryMaterialStyle(input.style),
        titleZh: name,
        titleEn: name,
        descriptionZh: intro || name,
        descriptionEn: intro || name,
        previewUrl,
        metadata: buildMaskMaterialMetadata(
          input,
          previewUrl,
          boardImageSource ?? input.boardImageSource ?? null
        ),
        communityVisible: true
      }
    });

  revalidatePath(`/${locale}`);

  return mapMaterial(material, locale, {
    inLibrary: true,
    librarySource: "SELF_CREATED"
  });
}

export async function createCreatureMaterial(input: CreatureMaterialCreateInput, boardImageFile: File | null, locale: Locale) {
  const viewer = await requireAuth();
  const name = input.name.trim();
  const description = input.description.trim();

  if (!name) {
    throw new Error("CREATURE_NAME_REQUIRED");
  }

  await ensureHomeWorkspaceDefaults(viewer.id);

  const previewUrl = boardImageFile && boardImageFile.size > 0
    ? input.boardImageSource === "generated"
      ? await uploadCreatureBoardImage(viewer.id, boardImageFile, { allowOversize: true })
      : await uploadCreatureBoardImage(viewer.id, boardImageFile)
    : null;
  const material = await prisma.storyMaterial.create({
    data: {
      slug: createUserMaterialSlug("creature", name),
      category: "CREATURE",
      style: toStoryMaterialStyle(input.style),
      titleZh: name,
      titleEn: name,
      descriptionZh: description || name,
      descriptionEn: description || name,
      previewUrl,
      metadata: buildCreatureMaterialMetadata(input, previewUrl, input.boardImageSource),
      communityVisible: true,
      libraryEntries: {
        create: {
          userId: viewer.id,
          source: "SELF_CREATED"
        }
      }
    }
  });

  revalidatePath(`/${locale}`);

  return mapMaterial(material, locale, {
    inLibrary: true,
    librarySource: "SELF_CREATED"
  });
}

export async function updateCreatureMaterial(
  materialId: string,
  input: CreatureMaterialCreateInput,
  boardImageFile: File | null,
  boardImageMode: MaskMaterialBoardImageMode,
  locale: Locale
) {
  const viewer = await requireAuth();
  const name = input.name.trim();
  const description = input.description.trim();

  if (!name) {
    throw new Error("CREATURE_NAME_REQUIRED");
  }

  const entry = await prisma.storyMaterialLibraryEntry.findFirst({
    where: {
      userId: viewer.id,
      materialId,
      source: "SELF_CREATED"
    },
    include: {
      material: true
    }
  });

  if (!entry || normalizeMaterialCategory(entry.material.category) !== "creature") {
    throw new Error("MATERIAL_NOT_EDITABLE");
  }

  let previewUrl = entry.material.previewUrl ?? null;
  let boardImageSource = getExistingMaskBoardImageSource(entry.material.metadata) ?? input.boardImageSource ?? null;

  if (boardImageMode === "replace") {
    if (!boardImageFile || boardImageFile.size <= 0) {
      throw new Error("INVALID_MATERIAL_IMAGE_FILE");
    }

    previewUrl = input.boardImageSource === "generated"
      ? await uploadCreatureBoardImage(viewer.id, boardImageFile, { allowOversize: true })
      : await uploadCreatureBoardImage(viewer.id, boardImageFile);
    boardImageSource = input.boardImageSource ?? "uploaded";
  } else if (boardImageMode === "clear") {
    previewUrl = null;
    boardImageSource = null;
  } else if (previewUrl && !boardImageSource) {
    boardImageSource = "uploaded";
  }

  const material = await prisma.storyMaterial.update({
    where: {
      id: entry.material.id
    },
      data: {
        category: "CREATURE",
        style: toStoryMaterialStyle(input.style),
        titleZh: name,
        titleEn: name,
        descriptionZh: description || name,
        descriptionEn: description || name,
        previewUrl,
        metadata: buildCreatureMaterialMetadata(
          input,
          previewUrl,
          boardImageSource ?? input.boardImageSource ?? null
        ),
        communityVisible: true
      }
    });

  revalidatePath(`/${locale}`);

  return mapMaterial(material, locale, {
    inLibrary: true,
    librarySource: "SELF_CREATED"
  });
}

export async function createItemMaterial(
  input: ItemMaterialCreateInput,
  boardImageFile: File | null,
  modelInputImageFile: File | null,
  locale: Locale
) {
  const viewer = await requireAuth();
  const uploadedUrls: string[] = [];
  let persistenceStage: ItemMaterialPersistenceStage = "prepare";

  try {
    const name = input.name.trim();
    const description = input.description.trim();

    if (!name) {
      throw new Error("ITEM_NAME_REQUIRED");
    }

    await ensureHomeWorkspaceDefaults(viewer.id);

    persistenceStage = "upload";
    const boardUrl = boardImageFile && boardImageFile.size > 0
      ? input.boardImageSource === "generated"
        ? await uploadItemBoardImage(viewer.id, boardImageFile, { allowOversize: true })
        : await uploadItemBoardImage(viewer.id, boardImageFile)
      : null;

    if (boardUrl) {
      uploadedUrls.push(boardUrl);
    }

    const modelInputImageUrl = modelInputImageFile && modelInputImageFile.size > 0
      ? (input.modelInputImage?.source ?? "generated") === "generated"
        ? await uploadItemModelInputImage(viewer.id, modelInputImageFile, { allowOversize: true })
        : await uploadItemModelInputImage(viewer.id, modelInputImageFile)
      : input.modelInputImage?.url || null;

    if (modelInputImageFile && modelInputImageFile.size > 0 && modelInputImageUrl) {
      uploadedUrls.push(modelInputImageUrl);
    }

    persistenceStage = "record";
    const previewUrl = boardUrl ?? modelInputImageUrl ?? null;
    const material = await prisma.storyMaterial.create({
      data: {
        slug: createUserMaterialSlug("item", name),
        category: "ITEM",
        style: toStoryMaterialStyle(input.style),
        titleZh: name,
        titleEn: name,
        descriptionZh: description || name,
        descriptionEn: description || name,
        previewUrl,
        metadata: buildItemMaterialMetadata(input, boardUrl, input.boardImageSource, modelInputImageUrl, getExistingItemViewImageUrlsFromInput(input)),
        communityVisible: true,
        libraryEntries: {
          create: {
            userId: viewer.id,
            source: "SELF_CREATED"
          }
        }
      }
    });

    revalidatePath(`/${locale}`);

    return mapMaterial(material, locale, {
      inLibrary: true,
      librarySource: "SELF_CREATED"
    });
  } catch (error) {
    await cleanupUploadedItemMaterialImages(uploadedUrls);
    throw normalizeItemMaterialPersistenceError(error, persistenceStage);
  }
}

export async function updateItemMaterial(
  materialId: string,
  input: ItemMaterialCreateInput,
  boardImageFile: File | null,
  boardImageMode: ItemMaterialImageMode,
  modelInputImageFile: File | null,
  modelInputImageMode: ItemMaterialImageMode,
  locale: Locale
) {
  const viewer = await requireAuth();
  const uploadedUrls: string[] = [];
  let persistenceStage: ItemMaterialPersistenceStage = "prepare";

  try {
    const name = input.name.trim();
    const description = input.description.trim();

    if (!name) {
      throw new Error("ITEM_NAME_REQUIRED");
    }

    persistenceStage = "record";
    const entry = await prisma.storyMaterialLibraryEntry.findFirst({
      where: {
        userId: viewer.id,
        materialId,
        source: "SELF_CREATED"
      },
      include: {
        material: true
      }
    });

    if (!entry || normalizeMaterialCategory(entry.material.category) !== "item") {
      throw new Error("MATERIAL_NOT_EDITABLE");
    }

    const existingMetadata = getItemMaterialMetadata(entry.material.metadata);
    let boardUrl = existingMetadata?.boardImage?.url ?? entry.material.previewUrl ?? null;
    let boardImageSource: WorkspaceMaskBoardImageSource | null = existingMetadata?.boardImage?.source ?? input.boardImageSource ?? null;
    let modelInputImageUrl = (existingMetadata?.modelInputImage?.url ?? input.modelInputImage?.url) || null;
    let viewImageUrls = getExistingItemViewImageUrls(existingMetadata);

    if (boardImageMode === "replace") {
      if (!boardImageFile || boardImageFile.size <= 0) {
        throw new Error("INVALID_MATERIAL_IMAGE_FILE");
      }

      persistenceStage = "upload";
      boardUrl = input.boardImageSource === "generated"
        ? await uploadItemBoardImage(viewer.id, boardImageFile, { allowOversize: true })
        : await uploadItemBoardImage(viewer.id, boardImageFile);
      uploadedUrls.push(boardUrl);
      boardImageSource = input.boardImageSource ?? "uploaded";
    } else if (boardImageMode === "clear") {
      boardUrl = null;
      boardImageSource = null;
    }

    if (modelInputImageMode === "replace") {
      if (!modelInputImageFile || modelInputImageFile.size <= 0) {
        throw new Error("INVALID_ITEM_MODEL_INPUT_IMAGE_FILE");
      }

      persistenceStage = "upload";
      modelInputImageUrl = (input.modelInputImage?.source ?? "generated") === "generated"
        ? await uploadItemModelInputImage(viewer.id, modelInputImageFile, { allowOversize: true })
        : await uploadItemModelInputImage(viewer.id, modelInputImageFile);
      uploadedUrls.push(modelInputImageUrl);
    } else if (modelInputImageMode === "clear") {
      modelInputImageUrl = null;
    }

    persistenceStage = "record";
    const previewUrl = boardUrl ?? modelInputImageUrl ?? viewImageUrls.front ?? null;
    const material = await prisma.storyMaterial.update({
      where: {
        id: entry.material.id
      },
      data: {
        category: "ITEM",
        style: toStoryMaterialStyle(input.style),
        titleZh: name,
        titleEn: name,
        descriptionZh: description || name,
        descriptionEn: description || name,
        previewUrl,
        metadata: buildItemMaterialMetadata(input, boardUrl, boardImageSource, modelInputImageUrl, viewImageUrls),
        communityVisible: true
      }
    });

    revalidatePath(`/${locale}`);

    return mapMaterial(material, locale, {
      inLibrary: true,
      librarySource: "SELF_CREATED"
    });
  } catch (error) {
    await cleanupUploadedItemMaterialImages(uploadedUrls);
    throw normalizeItemMaterialPersistenceError(error, persistenceStage);
  }
}

type ItemMaterialPersistenceStage = "prepare" | "upload" | "record";

function normalizeItemMaterialPersistenceError(error: unknown, stage: ItemMaterialPersistenceStage) {
  const message = error instanceof Error ? error.message : String(error);
  const code = getErrorCode(error);

  if (
    message.includes("ITEM_NAME_REQUIRED") ||
    message.includes("INVALID_MATERIAL_IMAGE_FILE") ||
    message.includes("INVALID_ITEM_MODEL_INPUT_IMAGE_FILE") ||
    message.includes("MATERIAL_NOT_EDITABLE")
  ) {
    return error instanceof Error ? error : new Error(message);
  }

  if (
    code === "P2000" ||
    message.includes("Data too long") ||
    message.includes("max_allowed_packet") ||
    message.includes("Packet for query is too large") ||
    message.includes("request entity too large")
  ) {
    return new Error("ITEM_MATERIAL_METADATA_TOO_LARGE");
  }

  if (stage === "upload" || (
    message.includes("R2") ||
    message.includes("S3") ||
    message.includes("AccessDenied") ||
    message.includes("NoSuchBucket") ||
    message.includes("SignatureDoesNotMatch") ||
    message.includes("CredentialsProviderError")
  )) {
    return new Error("ITEM_MATERIAL_UPLOAD_FAILED");
  }

  if (code?.startsWith("P")) {
    return new Error("ITEM_MATERIAL_DATABASE_FAILED");
  }

  return new Error("ITEM_MATERIAL_PERSISTENCE_FAILED");
}

async function cleanupUploadedItemMaterialImages(urls: string[]) {
  if (urls.length === 0) {
    return;
  }

  try {
    await deleteMaterialImagesByUrls(urls);
  } catch {
    // Best-effort cleanup: preserve the original persistence failure for the UI.
  }
}

export async function createSceneMaterial(input: SceneMaterialCreateInput, uploadedFaceUrls: string[], locale: Locale) {
  const viewer = await requireAuth();

  try {
    const name = input.name.trim();
    const description = input.description.trim();

    if (!name) {
      throw new Error("SCENE_NAME_REQUIRED");
    }

    if (!description) {
      throw new Error("SCENE_DESCRIPTION_REQUIRED");
    }

    validateSceneDraftBlocks(input.blocks);
    await ensureHomeWorkspaceDefaults(viewer.id);

    const material = await prisma.storyMaterial.create({
      data: {
        slug: createUserMaterialSlug("scene", name),
        category: "SCENE",
        style: toStoryMaterialStyle(input.style),
        titleZh: name,
        titleEn: name,
        descriptionZh: description,
        descriptionEn: description,
        previewUrl: getScenePreviewUrl(input.blocks),
        metadata: buildSceneMaterialMetadata(input),
        communityVisible: true,
        libraryEntries: {
          create: {
            userId: viewer.id,
            source: "SELF_CREATED"
          }
        }
      }
    });

    revalidatePath(`/${locale}`);

    return mapMaterial(material, locale, {
      inLibrary: true,
      librarySource: "SELF_CREATED"
    });
  } catch (error) {
    await cleanupUploadedScenePanoramaFaces(uploadedFaceUrls);
    throw normalizeSceneMaterialPersistenceError(error);
  }
}

function normalizeSceneMaterialPersistenceError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code = getErrorCode(error);

  if (
    message.includes("SCENE_NAME_REQUIRED") ||
    message.includes("SCENE_DESCRIPTION_REQUIRED") ||
    message.includes("SCENE_BLOCK_REQUIRED") ||
    message.includes("SCENE_BLOCK_NAME_REQUIRED") ||
    message.includes("SCENE_BLOCK_DESCRIPTION_REQUIRED") ||
    message.includes("SCENE_PANORAMA_FACE_REQUIRED") ||
    message.includes("MATERIAL_NOT_EDITABLE")
  ) {
    return error instanceof Error ? error : new Error(message);
  }

  if (
    code === "P2021" ||
    code === "P2022" ||
    message.includes("Data truncated") ||
    message.includes("Incorrect enum") ||
    message.includes("Invalid value for enum") ||
    message.includes("StoryMaterialCategory") ||
    message.includes("Value \"SCENE\"") ||
    message.includes("invalid input value") ||
    (message.includes("SCENE") && message.includes("category"))
  ) {
    return new Error("SCENE_MATERIAL_CATEGORY_MIGRATION_REQUIRED");
  }

  if (
    code === "P2000" ||
    message.includes("Data too long") ||
    message.includes("max_allowed_packet") ||
    message.includes("Packet for query is too large") ||
    message.includes("request entity too large")
  ) {
    return new Error("SCENE_MATERIAL_METADATA_TOO_LARGE");
  }

  if (
    message.includes("R2") ||
    message.includes("S3") ||
    message.includes("AccessDenied") ||
    message.includes("NoSuchBucket") ||
    message.includes("SignatureDoesNotMatch") ||
    message.includes("CredentialsProviderError")
  ) {
    return new Error("SCENE_PANORAMA_UPLOAD_FAILED");
  }

  if (code?.startsWith("P")) {
    return new Error("SCENE_MATERIAL_DATABASE_FAILED");
  }

  return new Error("SCENE_MATERIAL_PERSISTENCE_FAILED");
}

async function cleanupUploadedScenePanoramaFaces(urls: string[]) {
  try {
    await deleteMaterialImagesByUrls(urls);
  } catch {
    // Best-effort cleanup: preserve the original persistence failure for the UI.
  }
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : null;
}

export async function updateSceneMaterial(
  materialId: string,
  input: SceneMaterialCreateInput,
  uploadedFaceUrls: string[],
  locale: Locale
) {
  const viewer = await requireAuth();

  try {
    const name = input.name.trim();
    const description = input.description.trim();

    if (!name) {
      throw new Error("SCENE_NAME_REQUIRED");
    }

    if (!description) {
      throw new Error("SCENE_DESCRIPTION_REQUIRED");
    }

    validateSceneDraftBlocks(input.blocks);

    const entry = await prisma.storyMaterialLibraryEntry.findFirst({
      where: {
        userId: viewer.id,
        materialId,
        source: "SELF_CREATED"
      },
      include: {
        material: true
      }
    });

    if (!entry || normalizeMaterialCategory(entry.material.category) !== "scene") {
      throw new Error("MATERIAL_NOT_EDITABLE");
    }

    const material = await prisma.storyMaterial.update({
      where: {
        id: entry.material.id
      },
      data: {
        category: "SCENE",
        style: toStoryMaterialStyle(input.style),
        titleZh: name,
        titleEn: name,
        descriptionZh: description,
        descriptionEn: description,
        previewUrl: getScenePreviewUrl(input.blocks),
        metadata: buildSceneMaterialMetadata(input),
        communityVisible: true
      }
    });

    revalidatePath(`/${locale}`);

    return mapMaterial(material, locale, {
      inLibrary: true,
      librarySource: "SELF_CREATED"
    });
  } catch (error) {
    await cleanupUploadedScenePanoramaFaces(uploadedFaceUrls);
    throw normalizeSceneMaterialPersistenceError(error);
  }
}

export async function createMapMaterial(
  input: MapMaterialCreateInput,
  locale: Locale,
  mapImageFile: File | null = null,
  mapImageMode: MapMaterialImageMode = "clear",
  mapImageMeta: MapImageMetaInput | null = null
) {
  const viewer = await requireAuth();
  let persistenceStage: MapMaterialPersistenceStage = "prepare";
  const uploadedUrls: string[] = [];

  try {
    const graphSignature = buildMapGraphSignature(input);
    const normalizedImageMeta = resolveMapMaterialImageMeta(mapImageMeta, graphSignature);
    const mapImage = await resolveMapMaterialImageForSave(
      viewer.id,
      mapImageFile,
      mapImageMode,
      normalizedImageMeta,
      null,
      uploadedUrls
    );
    const metadata = buildMapMaterialMetadata(input, mapImage);
    const name = metadata.name;
    const description = metadata.description;

    await ensureHomeWorkspaceDefaults(viewer.id);

    persistenceStage = "record";
    const material = await prisma.$transaction(async (tx) => {
      const createdMaterial = await tx.storyMaterial.create({
        data: {
          slug: createUserMaterialSlug("map", name),
          category: "MAP",
          style: toStoryMaterialStyle(metadata.style),
          titleZh: name,
          titleEn: name,
          descriptionZh: description,
          descriptionEn: description,
          previewUrl: mapImage?.url ?? null,
          metadata,
          communityVisible: true,
          libraryEntries: {
            create: {
              userId: viewer.id,
              source: "SELF_CREATED"
            }
          }
        }
      });

      persistenceStage = "graph";
      await syncMapMaterialProjection(createdMaterial.id, metadata);
      persistenceStage = "record";

      return createdMaterial;
    });

    revalidatePath(`/${locale}`);

    return mapMaterial(material, locale, {
      inLibrary: true,
      librarySource: "SELF_CREATED"
    });
  } catch (error) {
    await cleanupUploadedMapImages(uploadedUrls);
    throw normalizeMapMaterialPersistenceError(error, persistenceStage);
  }
}

export async function updateMapMaterial(
  materialId: string,
  input: MapMaterialCreateInput,
  locale: Locale,
  mapImageFile: File | null = null,
  mapImageMode: MapMaterialImageMode = "keep",
  mapImageMeta: MapImageMetaInput | null = null
) {
  const viewer = await requireAuth();
  let persistenceStage: MapMaterialPersistenceStage = "prepare";
  const uploadedUrls: string[] = [];

  try {
    const graphSignature = buildMapGraphSignature(input);

    persistenceStage = "record";
    const material = await prisma.$transaction(async (tx) => {
      const entry = await tx.storyMaterialLibraryEntry.findFirst({
        where: {
          userId: viewer.id,
          materialId,
          source: "SELF_CREATED"
        },
        include: {
          material: true
        }
      });

      if (!entry || normalizeMaterialCategory(entry.material.category) !== "map") {
        throw new Error("MATERIAL_NOT_EDITABLE");
      }

      const existingMetadata = getMapMaterialMetadata(entry.material.metadata);
      const normalizedImageMeta = resolveMapMaterialImageMeta(mapImageMeta, graphSignature);
      const mapImage = await resolveMapMaterialImageForSave(
        viewer.id,
        mapImageFile,
        mapImageMode,
        normalizedImageMeta,
        existingMetadata?.image ?? null,
        uploadedUrls
      );
      const metadata = buildMapMaterialMetadata(input, mapImage);
      const name = metadata.name;
      const description = metadata.description;

      const updatedMaterial = await tx.storyMaterial.update({
        where: {
          id: entry.material.id
        },
        data: {
          category: "MAP",
          style: toStoryMaterialStyle(metadata.style),
          titleZh: name,
          titleEn: name,
          descriptionZh: description,
          descriptionEn: description,
          previewUrl: mapImage?.url ?? null,
          metadata,
          communityVisible: true
        }
      });

      persistenceStage = "graph";
      await syncMapMaterialProjection(updatedMaterial.id, metadata);
      persistenceStage = "record";

      return updatedMaterial;
    });

    revalidatePath(`/${locale}`);

    return mapMaterial(material, locale, {
      inLibrary: true,
      librarySource: "SELF_CREATED"
    });
  } catch (error) {
    await cleanupUploadedMapImages(uploadedUrls);
    throw normalizeMapMaterialPersistenceError(error, persistenceStage);
  }
}

async function resolveMapMaterialImageForSave(
  userId: string,
  mapImageFile: File | null,
  mapImageMode: MapMaterialImageMode,
  mapImageMeta: Partial<WorkspaceMapMaterialImage>,
  existingImage: WorkspaceMapMaterialImage | null,
  uploadedUrls: string[]
) {
  if (mapImageMode === "clear") {
    return null;
  }

  if (mapImageMode === "keep") {
    if (!existingImage) {
      return null;
    }

    if (
      mapImageMeta.graphSignature &&
      existingImage.graphSignature &&
      mapImageMeta.graphSignature !== existingImage.graphSignature
    ) {
      return null;
    }

    return existingImage;
  }

  if (!mapImageFile || mapImageFile.size <= 0) {
    throw new Error("INVALID_MAP_IMAGE_FILE");
  }

  const source = mapImageMeta.source === "generated" ? "generated" : "uploaded";
  const url = await uploadMapImage(userId, mapImageFile, { allowOversize: source === "generated" });

  uploadedUrls.push(url);

  return {
    edgeCount: mapImageMeta.edgeCount,
    generatedAt: mapImageMeta.generatedAt ?? new Date().toISOString(),
    graphSignature: mapImageMeta.graphSignature,
    iterationCount: mapImageMeta.iterationCount,
    nodeBatchSize: normalizeMapImageNodeBatchSize(mapImageMeta.nodeBatchSize),
    nodeCount: mapImageMeta.nodeCount,
    referencePrompt: mapImageMeta.referencePrompt,
    source,
    url
  } satisfies WorkspaceMapMaterialImage;
}

function resolveMapMaterialImageMeta(meta: MapImageMetaInput | null, graphSignature: string): Partial<WorkspaceMapMaterialImage> {
  if (!meta) {
    return {
      generatedAt: new Date().toISOString(),
      graphSignature,
      nodeBatchSize: normalizeMapImageNodeBatchSize(undefined),
      source: "uploaded"
    };
  }

  return {
    edgeCount: normalizeMapMaterialImageCount(meta.edgeCount),
    generatedAt: typeof meta.generatedAt === "string" && meta.generatedAt.trim() ? meta.generatedAt.trim() : new Date().toISOString(),
    graphSignature: typeof meta.graphSignature === "string" && meta.graphSignature.trim() ? meta.graphSignature.trim() : graphSignature,
    iterationCount: normalizeMapMaterialImageCount(meta.iterationCount),
    nodeBatchSize: normalizeMapImageNodeBatchSize(meta.nodeBatchSize),
    nodeCount: normalizeMapMaterialImageCount(meta.nodeCount),
    referencePrompt: typeof meta.referencePrompt === "string" ? meta.referencePrompt.trim().slice(0, 2000) : "",
    source: meta.source === "generated" ? "generated" : "uploaded"
  };
}

function normalizeMapMaterialImageCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.round(value));
}

async function cleanupUploadedMapImages(urls: string[]) {
  if (urls.length === 0) {
    return;
  }

  try {
    await deleteMaterialImagesByUrls(urls);
  } catch {
    // Best-effort cleanup: preserve the original persistence failure for the UI.
  }
}

type MapMaterialPersistenceStage = "prepare" | "record" | "graph";

function normalizeMapMaterialPersistenceError(error: unknown, stage: MapMaterialPersistenceStage) {
  const message = error instanceof Error ? error.message : String(error);
  const code = getErrorCode(error);

  if (
    message.includes("MAP_NAME_REQUIRED") ||
    message.includes("MAP_DESCRIPTION_REQUIRED") ||
    message.includes("MAP_NODE_REQUIRED") ||
    message.includes("MAP_NODE_NAME_REQUIRED") ||
    message.includes("MAP_NODE_TYPE_INVALID") ||
    message.includes("MAP_NODE_DUPLICATE") ||
    message.includes("MAP_EDGE_INVALID") ||
    message.includes("MAP_EDGE_RELATION_INVALID") ||
    message.includes("MAP_EDGE_DUPLICATE") ||
    message.includes("INVALID_MAP_IMAGE_FILE") ||
    message.includes("MATERIAL_NOT_EDITABLE")
  ) {
    return error instanceof Error ? error : new Error(message);
  }

  if (
    code === "P2000" ||
    message.includes("Data too long") ||
    message.includes("max_allowed_packet") ||
    message.includes("Packet for query is too large") ||
    message.includes("request entity too large")
  ) {
    return new Error("MAP_MATERIAL_METADATA_TOO_LARGE");
  }

  if (stage === "graph") {
    return new Error("MAP_GRAPH_SYNC_FAILED");
  }

  if (code?.startsWith("P")) {
    return new Error("MAP_MATERIAL_DATABASE_FAILED");
  }

  return new Error("MAP_MATERIAL_PERSISTENCE_FAILED");
}

export async function assistSceneDraft(
  input: SceneMaterialCreateInput,
  instruction: string,
  locale: Locale,
  referenceImages: SceneAssistReferenceImage[] = []
): Promise<SceneAiAssistResult> {
  const viewer = await requireAuth();
  const normalizedInstruction = instruction.trim() || (referenceImages.length > 0
    ? (locale === "en-US"
        ? "Sync the scene draft from the uploaded reference images."
        : "请根据上传的参考图片同步完善当前场景草稿。")
    : "");

  if (!normalizedInstruction) {
    throw new Error("SCENE_ASSIST_EMPTY_INSTRUCTION");
  }

  let reply: Awaited<ReturnType<typeof generateDefaultLlmReply>>;

  try {
    reply = await generateDefaultLlmReply(
      buildSceneAssistMessages(input, normalizedInstruction, locale, referenceImages),
      viewer.id,
      false,
      locale,
      {
        feature: "scene.assist",
        input: {
          currentDraft: input,
          instruction: normalizedInstruction,
          referenceImages: summarizeSceneAssistReferenceImages(referenceImages)
        }
      }
    );
  } catch (error) {
    if (referenceImages.length > 0 && isLikelyLlmVisionUnsupportedError(error)) {
      throw new Error("SCENE_ASSIST_REFERENCE_IMAGE_UNSUPPORTED");
    }

    throw error;
  }
  const parsed = parseJsonObject(reply.content);
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const message = typeof record.message === "string" && record.message.trim() ? record.message.trim() : reply.content.trim();

  return {
    message,
    patch: sanitizeSceneDraftPatch(record.patch)
  };
}

export async function assistMapDraft(input: MapMaterialCreateInput, instruction: string, locale: Locale): Promise<MapAiAssistResult> {
  const viewer = await requireAuth();
  const normalizedInstruction = instruction.trim();

  if (!normalizedInstruction) {
    throw new Error("MAP_ASSIST_EMPTY_INSTRUCTION");
  }

  const reply = await generateDefaultLlmReply(
    buildMapAssistMessages(input, normalizedInstruction, locale),
    viewer.id,
    false,
    locale,
    {
      feature: "map.assist",
      input: {
        currentDraft: input,
        instruction: normalizedInstruction
      }
    }
  );
  const parsed = parseJsonObject(reply.content);
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const message = typeof record.message === "string" && record.message.trim() ? record.message.trim() : reply.content.trim();

  return {
    message,
    patch: sanitizeMapDraftPatch(record.patch)
  };
}

export async function deriveMapGraphRound(
  input: MapMaterialCreateInput,
  roundIndex: number,
  maxRounds: number,
  locale: Locale
): Promise<MapAiAssistResult> {
  const viewer = await requireAuth();
  const normalizedRoundIndex = normalizeMapDeriveRound(roundIndex, 1);
  const normalizedMaxRounds = normalizeMapDeriveRound(maxRounds, 3);

  if (input.nodes.length === 0) {
    throw new Error("MAP_DERIVE_EMPTY_GRAPH");
  }

  const reply = await generateDefaultLlmReply(
    buildMapDeriveRoundMessages(input, normalizedRoundIndex, normalizedMaxRounds, locale),
    viewer.id,
    false,
    locale,
    {
      feature: "map.derive",
      input: {
        currentDraft: input,
        maxRounds: normalizedMaxRounds,
        roundIndex: normalizedRoundIndex,
        graphNodeCount: input.nodes.length,
        graphEdgeCount: input.edges.length
      }
    }
  );
  const parsed = parseJsonObject(reply.content);
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const message = typeof record.message === "string" && record.message.trim() ? record.message.trim() : reply.content.trim();
  const patch = sanitizeMapDeriveRoundPatch(record.patch ?? record, input);

  if (!patch.addNodes?.length || !patch.addEdges?.length) {
    throw new Error("MAP_DERIVE_EMPTY_RESULT");
  }

  return {
    message,
    patch
  };
}

export async function streamMapImage(
  input: MapMaterialCreateInput,
  locale: Locale,
  onEvent: MapImageStreamHandler,
  options: {
    completedNodeIds?: string[];
    nodeBatchSize?: unknown;
    previousImage?: ScenePanoramaReferenceImage | null;
    referenceImages?: ScenePanoramaReferenceImage[];
    referencePrompt?: string;
    resumeRound?: unknown;
  } = {}
) {
  const viewer = await requireAuth();
  const normalizedInput = buildMapMaterialMetadata(input);
  const nodeBatchSize = normalizeMapImageNodeBatchSize(options.nodeBatchSize);
  const batches = buildMapImageNodeBatches(normalizedInput, nodeBatchSize);
  const totalRounds = batches.length;
  const completedNodeIds = new Set((options.completedNodeIds ?? []).filter(Boolean));
  const referenceImages = options.referenceImages ?? [];
  const referencePrompt = typeof options.referencePrompt === "string" ? options.referencePrompt.trim().slice(0, 2000) : "";
  const graphSignature = buildMapGraphSignature(normalizedInput);
  let previousImage = options.previousImage ?? null;
  let currentImage = previousImage ? mapImageReferenceToStreamImage(previousImage) : null;

  if (normalizedInput.nodes.length === 0) {
    throw new Error("MAP_IMAGE_NODE_REQUIRED");
  }

  const pendingIndex = getMapImagePendingBatchIndex(batches, completedNodeIds, options.resumeRound);

  if (pendingIndex === -1) {
    if (!currentImage) {
      throw new Error("MAP_IMAGE_EMPTY");
    }

    const doneEvent = buildMapImageDoneEvent(currentImage, normalizedInput, graphSignature, nodeBatchSize, totalRounds, referencePrompt);
    await onEvent(doneEvent);

    return doneEvent;
  }

  for (let batchIndex = pendingIndex; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    const round = batch.index + 1;
    const currentNodeIds = new Set(batch.nodes.map((node) => node.id));
    const previousNodeIds = new Set(batch.completedNodeIds.filter((nodeId) => !currentNodeIds.has(nodeId)));
    const relationSummary = buildMapImageRelationSummary(normalizedInput, batch, previousNodeIds, locale);
    const prompt = buildMapImageRoundPrompt(
      normalizedInput,
      batch,
      round,
      totalRounds,
      relationSummary,
      referencePrompt,
      Boolean(previousImage),
      locale
    );
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await onEvent({
        type: "progress",
        attempt,
        messageKey: attempt === 1 ? "mapForm.imageProgressGenerating" : "mapForm.imageProgressRetrying",
        progress: getMapImageRoundProgress(batchIndex, totalRounds, attempt),
        relationSummary,
        round,
        stage: attempt === 1 ? "generating" : "retrying",
        totalRounds
      });

      try {
        const image = await generateDefaultMapImage(
          prompt,
          viewer.id,
          {
            feature: "map.image.generate",
            input: {
              batchIndex,
              currentNodeIds: batch.nodes.map((node) => node.id),
              draft: normalizedInput,
              locale,
              nodeBatchSize,
              referenceImageCount: referenceImages.length,
              referencePrompt,
              round,
              totalRounds
            },
            locale
          },
          {
            referenceImages: previousImage ? [previousImage, ...referenceImages] : referenceImages
          }
        );

        currentImage = image;
        previousImage = mapImageStreamImageToReference(image);
        batch.nodes.forEach((node) => completedNodeIds.add(node.id));

        await onEvent({
          type: "image",
          completedNodeIds: Array.from(completedNodeIds),
          image,
          progress: getMapImageCompletedProgress(batchIndex, totalRounds),
          relationSummary,
          round,
          totalRounds
        });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      const pausedEvent: Extract<MapImageStreamEvent, { type: "paused" }> = {
        type: "paused",
        completedNodeIds: Array.from(completedNodeIds),
        failedRound: round,
        image: currentImage ?? undefined,
        message: getErrorMessage(lastError),
        progress: getMapImageRoundProgress(batchIndex, totalRounds, 3),
        relationSummary,
        round,
        totalRounds
      };

      await onEvent(pausedEvent);

      return pausedEvent;
    }
  }

  if (!currentImage) {
    throw new Error("MAP_IMAGE_EMPTY");
  }

  const doneEvent = buildMapImageDoneEvent(currentImage, normalizedInput, graphSignature, nodeBatchSize, totalRounds, referencePrompt);
  await onEvent(doneEvent);

  return doneEvent;
}

export async function prepareMapImageReferenceImages(files: File[]): Promise<ScenePanoramaReferenceImage[]> {
  if (files.length > 3) {
    throw new Error("INVALID_MAP_REFERENCE_IMAGE_FILE");
  }

  return Promise.all(
    files.map(async (file) => {
      if (!isValidMaterialImageFile(file)) {
        throw new Error("INVALID_MAP_REFERENCE_IMAGE_FILE");
      }

      return {
        bytes: Buffer.from(await file.arrayBuffer()),
        contentType: file.type.toLowerCase(),
        fileName: file.name || "map-reference.png"
      };
    })
  );
}

export async function prepareMapImagePreviousImage(
  file: File | null,
  url: string | null,
  origin: string,
  options: { allowOversizeFile?: boolean } = {}
): Promise<ScenePanoramaReferenceImage | null> {
  if (file && file.size > 0) {
    if (!isValidMaterialImageFile(file, { allowOversize: options.allowOversizeFile })) {
      throw new Error("INVALID_MAP_IMAGE_FILE");
    }

    return {
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: file.type.toLowerCase(),
      fileName: file.name || "map-image.png"
    };
  }

  if (!url) {
    return null;
  }

  await configureServerOutboundProxy();
  const response = await fetch(resolveMaterialImageUrl(url, origin));

  if (!response.ok) {
    throw new Error("MAP_IMAGE_DOWNLOAD_FAILED");
  }

  const contentType = response.headers.get("content-type")?.toLowerCase().split(";")[0]?.trim() ?? "";
  const bytes = Buffer.from(await response.arrayBuffer());

  if (!contentType || !isValidMaterialImageBytesForPanorama(bytes, contentType)) {
    throw new Error("INVALID_MAP_IMAGE_FILE");
  }

  return {
    bytes,
    contentType,
    fileName: "map-image.png"
  };
}

function getMapImagePendingBatchIndex(
  batches: ReturnType<typeof buildMapImageNodeBatches>,
  completedNodeIds: Set<string>,
  resumeRound: unknown
) {
  const firstIncompleteIndex = batches.findIndex((batch) => batch.nodes.some((node) => !completedNodeIds.has(node.id)));

  if (firstIncompleteIndex === -1) {
    return -1;
  }

  const parsedResumeRound = typeof resumeRound === "number"
    ? resumeRound
    : typeof resumeRound === "string"
      ? Number.parseInt(resumeRound, 10)
      : NaN;

  if (Number.isFinite(parsedResumeRound)) {
    return Math.max(firstIncompleteIndex, Math.min(batches.length - 1, Math.max(0, Math.round(parsedResumeRound) - 1)));
  }

  return firstIncompleteIndex;
}

function buildMapImageDoneEvent(
  image: MapImageStreamImage,
  input: MapMaterialCreateInput,
  graphSignature: string,
  nodeBatchSize: number,
  iterationCount: number,
  referencePrompt: string
): Extract<MapImageStreamEvent, { type: "done" }> {
  return {
    type: "done",
    edgeCount: input.edges.length,
    graphSignature,
    image,
    iterationCount,
    nodeBatchSize,
    nodeCount: input.nodes.length,
    referencePrompt
  };
}

function getMapImageRoundProgress(batchIndex: number, totalRounds: number, attempt: number) {
  if (totalRounds <= 0) {
    return 4;
  }

  const base = 4 + (batchIndex / totalRounds) * 90;
  const attemptProgress = Math.min(6, Math.max(0, attempt - 1) * 2);

  return Math.min(97, Math.round(base + attemptProgress));
}

function getMapImageCompletedProgress(batchIndex: number, totalRounds: number) {
  if (totalRounds <= 0) {
    return 100;
  }

  return Math.min(99, Math.round(4 + ((batchIndex + 1) / totalRounds) * 94));
}

function mapImageStreamImageToReference(image: MapImageStreamImage): ScenePanoramaReferenceImage {
  const match = image.dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);

  if (!match) {
    throw new Error("MAP_IMAGE_DATA_URL_INVALID");
  }

  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  const binary = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));

  return {
    bytes: binary,
    contentType: image.contentType || match[1] || "image/png",
    fileName: image.fileName || "map-image.png"
  };
}

function mapImageReferenceToStreamImage(image: ScenePanoramaReferenceImage): MapImageStreamImage {
  return {
    contentType: image.contentType,
    dataUrl: `data:${image.contentType};base64,${image.bytes.toString("base64")}`,
    fileName: image.fileName || "map-image.png"
  };
}

function buildMapImageRoundPrompt(
  input: MapMaterialCreateInput,
  batch: ReturnType<typeof buildMapImageNodeBatches>[number],
  round: number,
  totalRounds: number,
  relationSummary: string,
  referencePrompt: string,
  hasPreviousImage: boolean,
  locale: Locale
) {
  const isEnglish = locale === "en-US";
  const currentNodeIds = new Set(batch.nodes.map((node) => node.id));
  const previousNodeIds = new Set(batch.completedNodeIds.filter((nodeId) => !currentNodeIds.has(nodeId)));
  const previousInstruction = hasPreviousImage
    ? isEnglish
      ? "Use the previous round image as the main layout reference. Preserve its geography, coastline/terrain logic, style, labels, and composition, then add only the new nodes and relations from this round."
      : "以上一轮成功图片作为主要布局参考。保留上一张图的地理结构、海岸/地形逻辑、风格、标签和构图，只增补本轮新增节点与关系。"
    : isEnglish
      ? "This is the first round. Establish the base map layout from the current batch."
      : "这是第 1 轮，请根据本轮节点建立地图底图。";
  const referenceInstruction = referencePrompt
    ? isEnglish
      ? `Reference image notes: ${referencePrompt}`
      : `参考图片说明词：${referencePrompt}`
    : isEnglish
      ? "If reference images are provided, borrow their mood, palette, landform language, and map rendering style without copying UI, frames, watermarks, or unrelated artifacts."
      : "如果提供了参考图，请参考其氛围、色彩、地貌语言和地图绘制风格，不要复制 UI、边框、水印或无关杂物。";

  if (isEnglish) {
    return [
      `Create round ${round}/${totalRounds} of an iterative world map illustration for an interactive world graph.`,
      previousInstruction,
      referenceInstruction,
      "The image must stay readable as a map, not as a dashboard or graph UI. Draw geography, regions, routes, landmarks, and settlement symbols.",
      "Keep node names as concise cartographic labels when useful, and show relation types through geography: containment, adjacency, routes, directional placement, and through-paths.",
      "Do not add a progress ring, UI buttons, node graph circles, debug text, watermark, or generation notes into the image.",
      `Map name: ${input.name || "Untitled map"}.`,
      `Map description: ${input.description || "Unspecified"}.`,
      `Visual style: ${getMapImageStylePrompt(input.style, locale)}.`,
      `Round relation to previous image: ${relationSummary}`,
      `Current batch nodes:\n${formatMapImageNodes(batch.nodes, locale)}`,
      `Current batch relations:\n${formatMapImageEdges(batch.edges, input.nodes, locale)}`,
      `Previously placed node ids: ${Array.from(previousNodeIds).join(", ") || "none"}.`
    ].join("\n");
  }

  return [
    `为交互世界图谱生成第 ${round}/${totalRounds} 轮世界地图插画。`,
    previousInstruction,
    referenceInstruction,
    "画面必须像地图，而不是后台仪表盘或节点图 UI。请绘制地理、区域、路线、地标和聚落符号。",
    "需要时可以把节点名称做成简短地图标签，并用地理方式表达包含、相邻、连通、方位和穿过等关系。",
    "不要把进度环、UI 按钮、节点图圆点、调试文字、水印或生成说明画进图片。",
    `地图名称：${input.name || "未命名地图"}。`,
    `地图说明：${input.description || "未指定"}。`,
    `视觉风格：${getMapImageStylePrompt(input.style, locale)}。`,
    `本轮与上一张图的关系：${relationSummary}`,
    `本轮节点：\n${formatMapImageNodes(batch.nodes, locale)}`,
    `本轮关系：\n${formatMapImageEdges(batch.edges, input.nodes, locale)}`,
    `上一轮已放入的节点 ID：${Array.from(previousNodeIds).join("、") || "无"}。`
  ].join("\n");
}

function buildMapImageRelationSummary(
  input: MapMaterialCreateInput,
  batch: ReturnType<typeof buildMapImageNodeBatches>[number],
  previousNodeIds: Set<string>,
  locale: Locale
) {
  const isEnglish = locale === "en-US";
  const nodeNameById = new Map(input.nodes.map((node) => [node.id, node.name || node.id]));
  const currentNodeIds = new Set(batch.nodes.map((node) => node.id));
  const bridgeEdges = batch.edges.filter((edge) =>
    (currentNodeIds.has(edge.source) && previousNodeIds.has(edge.target)) ||
    (currentNodeIds.has(edge.target) && previousNodeIds.has(edge.source))
  );

  if (bridgeEdges.length > 0) {
    return bridgeEdges
      .slice(0, 12)
      .map((edge) => {
        const source = nodeNameById.get(edge.source) ?? edge.source;
        const target = nodeNameById.get(edge.target) ?? edge.target;
        const relation = getMapImageRelationLabel(edge.relation, locale);
        const note = edge.description ? (isEnglish ? `, note: ${edge.description}` : `，说明：${edge.description}`) : "";

        return isEnglish
          ? `${source} ${relation} ${target}${note}`
          : `${source} ${relation} ${target}${note}`;
      })
      .join(isEnglish ? "; " : "；");
  }

  const nodeNames = batch.nodes.map((node) => node.name || node.id).join(isEnglish ? ", " : "、");

  return isEnglish
    ? `Add ${nodeNames || "this batch"} as a coherent new map area around the previous image while preserving the existing geography and visual language.`
    : `将${nodeNames || "本轮节点"}作为上一张图周边或内部的连贯新增区域加入，并保持已有地理结构与视觉语言。`;
}

function formatMapImageNodes(nodes: WorkspaceMapMaterialNode[], locale: Locale) {
  return nodes.length > 0
    ? nodes.map((node) => {
        const type = getMapImageNodeTypeLabel(node.type, locale);
        const description = node.description ? ` - ${node.description}` : "";

        return `- ${node.name || node.id} (${type}, id: ${node.id}, x: ${node.x}, y: ${node.y})${description}`;
      }).join("\n")
    : "- none";
}

function formatMapImageEdges(edges: WorkspaceMapMaterialEdge[], nodes: WorkspaceMapMaterialNode[], locale: Locale) {
  const nodeNameById = new Map(nodes.map((node) => [node.id, node.name || node.id]));

  return edges.length > 0
    ? edges.map((edge) => {
        const relation = getMapImageRelationLabel(edge.relation, locale);
        const description = edge.description ? ` - ${edge.description}` : "";

        return `- ${nodeNameById.get(edge.source) ?? edge.source} ${relation} ${nodeNameById.get(edge.target) ?? edge.target}${description}`;
      }).join("\n")
    : "- none";
}

function getMapImageNodeTypeLabel(type: WorkspaceMapMaterialNodeType, locale: Locale) {
  const labels: Record<WorkspaceMapMaterialNodeType, { en: string; zh: string }> = {
    city: { en: "city", zh: "城市" },
    country: { en: "country", zh: "国家" },
    landmark: { en: "landmark", zh: "地标" },
    path: { en: "path or route", zh: "路径" },
    region: { en: "region", zh: "区域" },
    village: { en: "village", zh: "村落" }
  };

  return locale === "en-US" ? labels[type].en : labels[type].zh;
}

function getMapImageRelationLabel(relation: WorkspaceMapMaterialRelationType, locale: Locale) {
  const labels: Record<WorkspaceMapMaterialRelationType, { en: string; zh: string }> = {
    adjacent: { en: "is adjacent to", zh: "相邻" },
    belongs_to: { en: "belongs to", zh: "归属" },
    connects: { en: "connects to", zh: "连通" },
    contains: { en: "contains", zh: "包含" },
    east_of: { en: "is east of", zh: "在东侧" },
    north_of: { en: "is north of", zh: "在北侧" },
    south_of: { en: "is south of", zh: "在南侧" },
    through: { en: "passes through", zh: "穿过" },
    west_of: { en: "is west of", zh: "在西侧" }
  };

  return locale === "en-US" ? labels[relation].en : labels[relation].zh;
}

function getMapImageStylePrompt(style: WorkspaceMaterialStyle, locale: Locale) {
  const labels: Record<WorkspaceMaterialStyle, { en: string; zh: string }> = {
    apocalyptic: { en: "apocalyptic survival map, scarred terrain and weathered markings", zh: "末世废土地图，破败地貌与风化标记" },
    classical: { en: "classical atlas engraving, restrained ink and parchment texture", zh: "古典地图雕版风，克制墨线与纸张质感" },
    cyberpunk: { en: "cyberpunk cartography, neon infrastructure and dense urban zones", zh: "赛博朋克地图，霓虹基础设施与密集都市区" },
    fantasy: { en: "fantasy atlas illustration with readable terrain and landmarks", zh: "奇幻地图册插画，地形与地标清晰可读" },
    mystery: { en: "mysterious investigative map, subtle symbols and atmospheric terrain", zh: "神秘调查地图，符号克制、氛围地形明显" },
    realistic: { en: "realistic illustrated atlas with plausible terrain", zh: "写实插画地图，地形可信" },
    sciFi: { en: "sci-fi atlas, layered districts and technical routes", zh: "科幻地图册，分层区域与技术路线清晰" }
  };

  return locale === "en-US" ? labels[style].en : labels[style].zh;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function generateSceneBlockPanorama(
  input: SceneMaterialCreateInput,
  blockId: string,
  locale: Locale,
  options?: ScenePanoramaGenerationOptions
): Promise<ScenePanoramaGenerationState> {
  return runSceneBlockPanoramaGeneration(input, blockId, locale, undefined, options);
}

export async function generateSceneBlockPanoramaMother(
  input: SceneMaterialCreateInput,
  blockId: string,
  locale: Locale,
  options?: Pick<ScenePanoramaGenerationOptions, "maxRedrawAttempts" | "referenceImages">
): Promise<ScenePanoramaMotherGenerationState> {
  return runSceneBlockPanoramaMotherGeneration(input, blockId, locale, undefined, options);
}

export async function streamSceneBlockPanoramaMother(
  input: SceneMaterialCreateInput,
  blockId: string,
  locale: Locale,
  onEvent: ScenePanoramaStreamHandler,
  options?: Pick<ScenePanoramaGenerationOptions, "maxRedrawAttempts" | "referenceImages">
): Promise<ScenePanoramaMotherGenerationState> {
  return runSceneBlockPanoramaMotherGeneration(input, blockId, locale, onEvent, options);
}

export async function streamSceneBlockPanorama(
  input: SceneMaterialCreateInput,
  blockId: string,
  locale: Locale,
  onEvent: ScenePanoramaStreamHandler,
  options?: ScenePanoramaGenerationOptions
): Promise<ScenePanoramaGenerationState> {
  return runSceneBlockPanoramaGeneration(input, blockId, locale, onEvent, options);
}

async function runSceneBlockPanoramaMotherGeneration(
  input: SceneMaterialCreateInput,
  blockId: string,
  locale: Locale,
  onEvent?: ScenePanoramaStreamHandler,
  options?: Pick<ScenePanoramaGenerationOptions, "maxRedrawAttempts" | "referenceImages">
): Promise<ScenePanoramaMotherGenerationState> {
  const viewer = await requireAuth();
  const block = validateScenePanoramaGenerationInput(input, blockId);
  const generationInput = buildScenePanoramaGenerationInput(input, block, locale);
  const observationContext = {
    feature: "scene.block.panorama.mother.generate",
    input: {
      currentDraft: input,
      blockId,
      locale,
      maxRedrawAttempts: options?.maxRedrawAttempts,
      referenceImageCount: options?.referenceImages?.length ?? 0
    },
    locale
  };
  const generationOptions = {
    maxRedrawAttempts: normalizeScenePanoramaMaxRedrawAttempts(options?.maxRedrawAttempts),
    referenceImages: options?.referenceImages
  };

  if (onEvent) {
    return streamDefaultScenePanoramaMother(generationInput, viewer.id, onEvent, observationContext, generationOptions);
  }

  return generateDefaultScenePanoramaMother(generationInput, viewer.id, observationContext, generationOptions);
}

async function runSceneBlockPanoramaGeneration(
  input: SceneMaterialCreateInput,
  blockId: string,
  locale: Locale,
  onEvent?: ScenePanoramaStreamHandler,
  options?: ScenePanoramaGenerationOptions
): Promise<ScenePanoramaGenerationState> {
  const viewer = await requireAuth();
  const block = validateScenePanoramaGenerationInput(input, blockId);
  const maxRedrawAttempts = normalizeScenePanoramaMaxRedrawAttempts(options?.maxRedrawAttempts);

  if (!options?.motherImage) {
    throw new Error("SCENE_PANORAMA_MOTHER_REQUIRED");
  }

  const generationInput = buildScenePanoramaGenerationInput(input, block, locale);
  const observationContext = {
    feature: "scene.block.panorama.generate",
    input: {
      currentDraft: input,
      blockId,
      locale,
      maxRedrawAttempts,
      hasMotherImage: true
    },
    locale
  };
  const generationOptions = { maxRedrawAttempts, motherImage: options.motherImage };

  if (onEvent) {
    return streamDefaultScenePanorama(generationInput, viewer.id, onEvent, observationContext, generationOptions);
  }

  return generateDefaultScenePanorama(generationInput, viewer.id, observationContext, generationOptions);
}

function validateScenePanoramaGenerationInput(input: SceneMaterialCreateInput, blockId: string) {
  const block = input.blocks.find((item) => item.id === blockId);

  if (!input.name.trim() || !input.description.trim()) {
    throw new Error("SCENE_DESCRIPTION_REQUIRED");
  }

  if (!block) {
    throw new Error("SCENE_BLOCK_NOT_FOUND");
  }

  if (!block.name.trim() || !block.description.trim()) {
    throw new Error("SCENE_BLOCK_DESCRIPTION_REQUIRED");
  }

  return block;
}

function buildScenePanoramaGenerationInput(
  input: SceneMaterialCreateInput,
  block: SceneMaterialBlockInput,
  locale: Locale
) {
  return {
    sceneName: input.name.trim(),
    sceneDescription: input.description.trim(),
    blockName: block.name.trim(),
    blockDescription: block.description.trim(),
    blockScaleMeters: sceneScalePresetMeters[normalizeSceneScalePreset(block.scalePreset)],
    blockScalePreset: normalizeSceneScalePreset(block.scalePreset),
    panoramaDrawingStyle: normalizeScenePanoramaDrawingStyle(input.panoramaDrawingStyle),
    style: input.style,
    locale
  };
}

export async function deleteSelfCreatedMaterial(materialId: string, locale: Locale) {
  const viewer = await requireAuth();
  const entry = await prisma.storyMaterialLibraryEntry.findFirst({
    where: {
      userId: viewer.id,
      materialId,
      source: "SELF_CREATED"
    },
    include: {
      material: true
    }
  });

  if (!entry) {
    throw new Error("MATERIAL_NOT_EDITABLE");
  }

  await prisma.storyMaterial.delete({
    where: {
      id: entry.material.id
    }
  });

  revalidatePath(`/${locale}`);

  return { id: entry.material.id };
}

export async function setMaterialCommunitySharing(materialId: string, _shared: boolean, locale: Locale) {
  const viewer = await requireAuth();
  const entry = await prisma.storyMaterialLibraryEntry.findFirst({
    where: {
      userId: viewer.id,
      materialId,
      source: "SELF_CREATED"
    },
    include: {
      material: true
    }
  });

  if (!entry) {
    throw new Error("MATERIAL_NOT_EDITABLE");
  }

  const material = await prisma.storyMaterial.update({
    where: {
      id: entry.material.id
    },
    data: {
      communityVisible: true
    }
  });

  revalidatePath(`/${locale}`);

  return mapMaterial(material, locale, {
    inLibrary: true,
    librarySource: "SELF_CREATED"
  });
}

export async function assistMaskDraft(input: MaskMaterialCreateInput, instruction: string, locale: Locale): Promise<MaskAiAssistResult> {
  const viewer = await requireAuth();
  const normalizedInstruction = instruction.trim();

  if (!normalizedInstruction) {
    throw new Error("MASK_ASSIST_EMPTY_INSTRUCTION");
  }

  const reply = await generateDefaultLlmReply(
    buildMaskAssistMessages(input, normalizedInstruction, locale),
    viewer.id,
    false,
    locale,
    {
      feature: "mask.assist",
      input: {
        currentDraft: input,
        instruction: normalizedInstruction
      }
    }
  );
  const parsed = parseJsonObject(reply.content);
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const message = typeof record.message === "string" && record.message.trim() ? record.message.trim() : reply.content.trim();

  return {
    message,
    patch: sanitizeMaskDraftPatch(record.patch)
  };
}

export async function generateMaskBoard(input: MaskMaterialCreateInput, locale: Locale): Promise<MaskBoardGenerationResult> {
  const viewer = await requireAuth();

  return generateDefaultMaskBoardImage(buildMaskBoardPrompt(input, locale), viewer.id, {
    feature: "mask.board.generate",
    input: {
      draft: input,
      locale
    },
    locale
  });
}

export async function assistCreatureDraft(input: CreatureMaterialCreateInput, instruction: string, locale: Locale): Promise<CreatureAiAssistResult> {
  const viewer = await requireAuth();
  const normalizedInstruction = instruction.trim();

  if (!normalizedInstruction) {
    throw new Error("CREATURE_ASSIST_EMPTY_INSTRUCTION");
  }

  const reply = await generateDefaultLlmReply(
    buildCreatureAssistMessages(input, normalizedInstruction, locale),
    viewer.id,
    false,
    locale,
    {
      feature: "creature.assist",
      input: {
        currentDraft: input,
        instruction: normalizedInstruction
      }
    }
  );
  const parsed = parseJsonObject(reply.content);
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const message = typeof record.message === "string" && record.message.trim() ? record.message.trim() : reply.content.trim();

  return {
    message,
    patch: sanitizeCreatureDraftPatch(record.patch)
  };
}

export async function generateCreatureBoard(input: CreatureMaterialCreateInput, locale: Locale): Promise<CreatureBoardGenerationResult> {
  const viewer = await requireAuth();

  return generateDefaultMaskBoardImage(buildCreatureBoardPrompt(input, locale), viewer.id, {
    feature: "creature.board.generate",
    input: {
      draft: input,
      locale
    },
    locale
  });
}

export async function assistItemDraft(
  input: ItemMaterialCreateInput,
  instruction: string,
  locale: Locale,
  referenceImages: SceneAssistReferenceImage[] = []
): Promise<ItemAiAssistResult> {
  const viewer = await requireAuth();
  const normalizedInstruction = instruction.trim() || (referenceImages.length > 0
    ? (locale === "en-US"
        ? "Sync the item draft from the uploaded reference images."
        : "请根据上传的参考图片同步完善当前物品草稿。")
    : "");

  if (!normalizedInstruction) {
    throw new Error("ITEM_ASSIST_EMPTY_INSTRUCTION");
  }

  let reply: Awaited<ReturnType<typeof generateDefaultLlmReply>>;

  try {
    reply = await generateDefaultLlmReply(
      buildItemAssistMessages(input, normalizedInstruction, locale, referenceImages),
      viewer.id,
      false,
      locale,
      {
        feature: "item.assist",
        input: {
          currentDraft: input,
          instruction: normalizedInstruction,
          referenceImages: summarizeSceneAssistReferenceImages(referenceImages)
        }
      }
    );
  } catch (error) {
    if (referenceImages.length > 0 && isLikelyLlmVisionUnsupportedError(error)) {
      throw new Error("ITEM_ASSIST_REFERENCE_IMAGE_UNSUPPORTED");
    }

    throw error;
  }
  const parsed = parseJsonObject(reply.content);
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const message = typeof record.message === "string" && record.message.trim() ? record.message.trim() : reply.content.trim();

  return {
    message,
    patch: sanitizeItemDraftPatch(record.patch)
  };
}

export async function generateItemBoard(
  input: ItemMaterialCreateInput,
  locale: Locale,
  referenceImages: ScenePanoramaReferenceImage[] = []
): Promise<ItemBoardGenerationResult> {
  const viewer = await requireAuth();

  try {
    return await generateDefaultItemBoardImage(
      buildItemBoardPrompt(input, locale),
      viewer.id,
      {
        feature: "item.board.generate",
        input: {
          draft: input,
          locale,
          referenceImageCount: referenceImages.length
        },
        locale
      },
      { referenceImages }
    );
  } catch (error) {
    if (referenceImages.length > 0 && isLikelyImageReferenceUnsupportedError(error)) {
      throw new Error("ITEM_BOARD_REFERENCE_IMAGE_UNSUPPORTED");
    }

    throw error;
  }
}

export async function generateItemModelInputImage(
  input: ItemMaterialCreateInput,
  boardImageFile: File,
  locale: Locale
): Promise<ItemModelInputImageGenerationResult> {
  const viewer = await requireAuth();

  if (!isValidMaterialImageFile(boardImageFile, { allowOversize: input.boardImageSource === "generated" })) {
    throw new Error("INVALID_MATERIAL_IMAGE_FILE");
  }

  const referenceImage: ScenePanoramaReferenceImage = {
    bytes: Buffer.from(await boardImageFile.arrayBuffer()),
    contentType: boardImageFile.type,
    fileName: boardImageFile.name || "item-board.png"
  };
  const image = await generateDefaultItemModelInputImage({
    prompt: buildItemModelInputImagePrompt(input, locale),
    referenceImage,
    userId: viewer.id,
    observationContext: {
      feature: "item.model-input.generate",
      input: {
        draft: input,
        locale
      },
      locale
    }
  });

  return { image };
}

async function ensureHomeWorkspaceDefaults(userId = defaultUserId) {
  await ensureConfiguredAdminUser();

  const [scripts, materials] = await Promise.all([
    Promise.all(
      builtInScripts.map((script) =>
        prisma.storyScript.upsert({
          where: { slug: script.slug },
          update: {},
          create: script
        })
      )
    ),
    Promise.all(
      builtInMaterials.map((material) =>
        prisma.storyMaterial.upsert({
          where: { slug: material.slug },
          update: { communityVisible: true, style: material.style },
          create: material
        })
      )
    ),
    prisma.appUser.upsert({
      where: { slug: defaultUserSlug },
      update: {},
      create: {
        id: defaultUserId,
        slug: defaultUserSlug,
        displayName: "本地默认用户"
      }
    })
  ]);
  const baseScript = scripts.find((script) => script.slug === baseScriptSlug);

  if (!baseScript) {
    throw new Error("Base script initialization failed.");
  }

  await prisma.storyScriptLibraryEntry.upsert({
    where: {
      userId_scriptId: {
        userId: defaultUserId,
        scriptId: baseScript.id
      }
    },
    update: {},
    create: {
      userId: defaultUserId,
      scriptId: baseScript.id,
      source: communityAddedSource
    }
  });

  if (userId !== defaultUserId) {
    await prisma.storyScriptLibraryEntry.upsert({
      where: {
        userId_scriptId: {
          userId,
          scriptId: baseScript.id
        }
      },
      update: {},
      create: {
        userId,
        scriptId: baseScript.id,
        source: communityAddedSource
      }
    });
  }

  const sharedMaterials = materials.filter((material) => defaultMaterialSlugs.includes(material.slug));

  await Promise.all(
    sharedMaterials.map((material) =>
      prisma.storyMaterialLibraryEntry.upsert({
        where: {
          userId_materialId: {
            userId: defaultUserId,
            materialId: material.id
          }
        },
        update: {},
        create: {
          userId: defaultUserId,
          materialId: material.id,
          source: communityAddedSource
        }
      })
    )
  );

  if (userId !== defaultUserId) {
    await Promise.all(
      sharedMaterials.map((material) =>
        prisma.storyMaterialLibraryEntry.upsert({
          where: {
            userId_materialId: {
              userId,
              materialId: material.id
            }
          },
          update: {},
          create: {
            userId,
            materialId: material.id,
            source: communityAddedSource
          }
        })
      )
    );
  }
}

function mapScript(
  script: {
    id: string;
    slug: string;
    titleZh: string;
    titleEn: string;
    descriptionZh: string;
    descriptionEn: string;
    welcomeZh: string;
    welcomeEn: string;
  },
  locale: Locale,
  library?: {
    inLibrary?: boolean;
    librarySource?: WorkspaceScriptLibrarySource;
  }
): WorkspaceScript {
  const isEnglish = locale === "en-US";
  const librarySource = library?.librarySource;

  return {
    id: script.id,
    slug: script.slug,
    category: getScriptCategory(script.slug),
    title: isEnglish ? script.titleEn : script.titleZh,
    description: isEnglish ? script.descriptionEn : script.descriptionZh,
    welcome: isEnglish ? script.welcomeEn : script.welcomeZh,
    inLibrary: library?.inLibrary ?? false,
    ...(librarySource ? { librarySource } : {})
  };
}

function mapMaterial(
  material: {
    id: string;
    slug: string;
    category: string;
    style?: string | null;
    titleZh: string;
    titleEn: string;
    descriptionZh: string;
    descriptionEn: string;
    previewUrl?: string | null;
    metadata?: unknown;
    communityVisible?: boolean | null;
  },
  locale: Locale,
  library?: {
    inLibrary?: boolean;
    librarySource?: WorkspaceMaterialLibrarySource;
  }
): WorkspaceMaterial {
  const isEnglish = locale === "en-US";
  const librarySource = library?.librarySource;

  return {
    id: material.id,
    slug: material.slug,
    category: normalizeMaterialCategory(material.category),
    style: normalizeMaterialStyle(material.style),
    title: isEnglish ? material.titleEn : material.titleZh,
    description: isEnglish ? material.descriptionEn : material.descriptionZh,
    previewUrl: material.previewUrl ?? null,
    metadata: (material.metadata as WorkspaceMaterialMetadata | null | undefined) ?? null,
    communityVisible:
      typeof material.communityVisible === "boolean"
        ? material.communityVisible
        : true,
    inLibrary: library?.inLibrary ?? false,
    ...(librarySource ? { librarySource } : {})
  };
}

function buildMaskMaterialMetadata(
  input: MaskMaterialCreateInput,
  previewUrl: string | null,
  boardImageSource?: WorkspaceMaskBoardImageSource | null
): WorkspaceMaskMaterialMetadata {
  const name = input.name.trim();
  const intro = input.intro.trim();
  const features = (input.features ?? "").trim();

  return {
    kind: "mask",
    version: 1,
    name,
    intro,
    features,
    style: input.style,
    body: input.body,
    colors: input.colors,
    voice: input.voice,
    personality: input.personality,
    boardDrawingStyle: normalizeMaskBoardDrawingStyle(input.boardDrawingStyle),
    boardImage: previewUrl
      ? {
          source: boardImageSource ?? input.boardImageSource ?? "uploaded",
          url: previewUrl
        }
      : null
  };
}

function buildCreatureMaterialMetadata(
  input: CreatureMaterialCreateInput,
  previewUrl: string | null,
  boardImageSource?: WorkspaceMaskBoardImageSource | null
): WorkspaceCreatureMaterialMetadata {
  return {
    kind: "creature",
    version: 1,
    subject: "species",
    name: input.name.trim(),
    description: input.description.trim(),
    style: input.style,
    taxonomy: input.taxonomy,
    morphology: input.morphology,
    colors: input.colors,
    vocalization: input.vocalization,
    senses: input.senses,
    ecology: input.ecology,
    abilities: {
      powers: sanitizeStringList(input.abilities.powers),
      weaknesses: sanitizeStringList(input.abilities.weaknesses),
      resourceNeeds: sanitizeStringList(input.abilities.resourceNeeds),
      interactionUses: sanitizeStringList(input.abilities.interactionUses),
      dangerNotes: sanitizeStringList(input.abilities.dangerNotes),
      keywords: sanitizeStringList(input.abilities.keywords)
    },
    behaviorLogic: input.behaviorLogic.trim(),
    behavior: input.behavior,
    boardDrawingStyle: normalizeMaskBoardDrawingStyle(input.boardDrawingStyle),
    boardImage: previewUrl
      ? {
          source: boardImageSource ?? input.boardImageSource ?? "uploaded",
          url: previewUrl
        }
      : null
  };
}

function buildItemMaterialMetadata(
  input: ItemMaterialCreateInput,
  boardUrl: string | null,
  boardImageSource: WorkspaceMaskBoardImageSource | null | undefined,
  modelInputImageUrl: string | null,
  viewImageUrls: Partial<Record<ItemViewFace, string>>
): WorkspaceItemMaterialMetadata {
  const viewImages = scenePanoramaFaces.reduce<NonNullable<WorkspaceItemMaterialMetadata["viewImages"]>>((result, face) => {
    const url = viewImageUrls[face] ?? input.viewImages?.[face]?.url ?? "";

    if (url) {
      result[face] = {
        source: input.viewImages?.[face]?.source ?? "generated",
        url
      };
    }

    return result;
  }, {});

  return {
    kind: "item",
    version: 2,
    name: input.name.trim(),
    itemCategory: input.itemCategory.trim(),
    description: input.description.trim(),
    traits: sanitizeStringList(input.traits),
    uses: sanitizeStringList(input.uses),
    functions: sanitizeStringList(input.functions),
    materials: sanitizeStringList(input.materials),
    colors: sanitizeStringList(input.colors),
    styles: sanitizeStringList(input.styles),
    brand: input.brand.trim(),
    model: input.model.trim(),
    keywords: sanitizeStringList(input.keywords),
    scaleHint: input.scaleHint.trim(),
    style: input.style,
    boardDrawingStyle: normalizeMaskBoardDrawingStyle(input.boardDrawingStyle),
    boardImage: boardUrl
      ? {
          source: boardImageSource ?? input.boardImageSource ?? "uploaded",
          url: boardUrl
        }
      : null,
    modelInputImage: modelInputImageUrl
      ? {
          source: input.modelInputImage?.source ?? "generated",
          url: modelInputImageUrl
        }
      : null,
    viewImages,
    model3d: input.model3d?.url
      ? {
          ...(input.model3d.byteSize ? { byteSize: input.model3d.byteSize } : {}),
          ...(input.model3d.contentType ? { contentType: input.model3d.contentType } : {}),
          ...(input.model3d.fileName ? { fileName: input.model3d.fileName } : {}),
          source: input.model3d.source,
          url: input.model3d.url
        }
      : null
  };
}

function sanitizeStringList(values: unknown) {
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

function buildSceneMaterialMetadata(input: SceneMaterialCreateInput): WorkspaceSceneMaterialMetadata {
  return {
    kind: "scene",
    version: 2,
    name: input.name.trim(),
    description: input.description.trim(),
    style: input.style,
    panoramaDrawingStyle: normalizeScenePanoramaDrawingStyle(input.panoramaDrawingStyle),
    blocks: input.blocks.map((block) => ({
      id: normalizeSceneBlockId(block.id),
      name: block.name.trim(),
      description: block.description.trim(),
      scaleMeters: sceneScalePresetMeters[normalizeSceneScalePreset(block.scalePreset)],
      scalePreset: normalizeSceneScalePreset(block.scalePreset),
      panorama: block.panorama
        ? {
            faceSource: block.panorama.faceSource,
            faces: buildScenePanoramaMetadataFaces(block.panorama),
            mother: block.panorama.mother?.url
              ? {
                  source: block.panorama.mother.source,
                  url: block.panorama.mother.url
                }
              : null
          }
        : null
    }))
  };
}

function buildScenePanoramaMetadataFaces(panorama: SceneMaterialPanoramaInput) {
  if (!hasAnyScenePanoramaFace(panorama.faces)) {
    return {};
  }

  return scenePanoramaFaces.reduce<Record<ScenePanoramaFace, { url: string }>>((faces, face) => {
    const url = panorama.faces?.[face]?.trim() ?? "";

    if (!url) {
      throw new Error(`SCENE_PANORAMA_FACE_REQUIRED_${face}`);
    }

    faces[face] = { url };

    return faces;
  }, {} as Record<ScenePanoramaFace, { url: string }>);
}

function validateSceneDraftBlocks(blocks: SceneMaterialBlockInput[]) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    throw new Error("SCENE_BLOCK_REQUIRED");
  }

  blocks.forEach((block) => {
    if (!block.name.trim()) {
      throw new Error("SCENE_BLOCK_NAME_REQUIRED");
    }

    if (!block.description.trim()) {
      throw new Error("SCENE_BLOCK_DESCRIPTION_REQUIRED");
    }

    if (block.panorama && hasAnyScenePanoramaFace(block.panorama.faces)) {
      scenePanoramaFaces.forEach((face) => {
        if (!block.panorama?.faces?.[face]?.trim()) {
          throw new Error(`SCENE_PANORAMA_FACE_REQUIRED_${face}`);
        }
      });
    }
  });
}

function getScenePreviewUrl(blocks: SceneMaterialBlockInput[]) {
  const firstBlockPanorama = blocks[0]?.panorama;
  const mother = firstBlockPanorama?.mother?.url.trim();
  const front = firstBlockPanorama?.faces?.front?.trim();

  return mother || front || null;
}

function hasAnyScenePanoramaFace(faces: SceneMaterialPanoramaInput["faces"] | undefined) {
  return scenePanoramaFaces.some((face) => Boolean(faces?.[face]?.trim()));
}

export async function uploadScenePanoramaFace(userId: string, file: File, options: { allowOversize?: boolean } = {}) {
  return uploadScenePanoramaFaceImage(userId, file, options);
}

export async function uploadScenePanoramaMother(userId: string, file: File, options: { allowOversize?: boolean } = {}) {
  return uploadScenePanoramaMotherImage(userId, file, options);
}

export async function prepareScenePanoramaMotherImage(
  file: File | null,
  url: string | null,
  origin: string,
  options: { allowOversizeFile?: boolean } = {}
): Promise<ScenePanoramaReferenceImage> {
  if (file && file.size > 0) {
    if (!isValidScenePanoramaImageFile(file, { allowOversize: options.allowOversizeFile })) {
      throw new Error("INVALID_SCENE_PANORAMA_MOTHER_FILE");
    }

    return {
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: file.type.toLowerCase(),
      fileName: file.name || "scene-panorama-mother.png"
    };
  }

  if (!url) {
    throw new Error("SCENE_PANORAMA_MOTHER_REQUIRED");
  }

  await configureServerOutboundProxy();
  const response = await fetch(resolveMaterialImageUrl(url, origin));

  if (!response.ok) {
    throw new Error("SCENE_PANORAMA_MOTHER_DOWNLOAD_FAILED");
  }

  const contentType = response.headers.get("content-type")?.toLowerCase().split(";")[0]?.trim() ?? "";
  const bytes = Buffer.from(await response.arrayBuffer());

  if (!contentType || !isValidMaterialImageBytesForPanorama(bytes, contentType)) {
    throw new Error("INVALID_SCENE_PANORAMA_MOTHER_FILE");
  }

  return {
    bytes,
    contentType,
    fileName: "scene-panorama-mother.png"
  };
}

export async function prepareScenePanoramaReferenceImages(files: File[]): Promise<ScenePanoramaReferenceImage[]> {
  return Promise.all(
    files.slice(0, 3).map(async (file) => {
      if (!isValidMaterialImageFile(file)) {
        throw new Error("INVALID_SCENE_REFERENCE_IMAGE_FILE");
      }

      return {
        bytes: Buffer.from(await file.arrayBuffer()),
        contentType: file.type.toLowerCase(),
        fileName: file.name || "scene-reference.png"
      };
    })
  );
}

export async function prepareSceneAssistReferenceImages(files: File[]): Promise<SceneAssistReferenceImage[]> {
  return Promise.all(
    files.slice(0, 3).map(async (file) => {
      if (!isValidMaterialImageFile(file)) {
        throw new Error("INVALID_SCENE_REFERENCE_IMAGE_FILE");
      }

      const contentType = file.type.toLowerCase();
      const bytes = Buffer.from(await file.arrayBuffer());

      return {
        byteSize: bytes.byteLength,
        contentType,
        dataUrl: `data:${contentType};base64,${bytes.toString("base64")}`,
        fileName: file.name || "scene-reference.png"
      };
    })
  );
}

export async function prepareItemBoardReferenceImages(files: File[]): Promise<ScenePanoramaReferenceImage[]> {
  return Promise.all(
    files.slice(0, 3).map(async (file) => {
      if (!isValidMaterialImageFile(file)) {
        throw new Error("INVALID_ITEM_REFERENCE_IMAGE_FILE");
      }

      return {
        bytes: Buffer.from(await file.arrayBuffer()),
        contentType: file.type.toLowerCase(),
        fileName: file.name || "item-reference.png"
      };
    })
  );
}

export async function prepareItemAssistReferenceImages(files: File[]): Promise<SceneAssistReferenceImage[]> {
  return Promise.all(
    files.slice(0, 3).map(async (file) => {
      if (!isValidMaterialImageFile(file)) {
        throw new Error("INVALID_ITEM_REFERENCE_IMAGE_FILE");
      }

      const contentType = file.type.toLowerCase();
      const bytes = Buffer.from(await file.arrayBuffer());

      return {
        byteSize: bytes.byteLength,
        contentType,
        dataUrl: `data:${contentType};base64,${bytes.toString("base64")}`,
        fileName: file.name || "item-reference.png"
      };
    })
  );
}

export async function cleanupUploadedMaterialImages(urls: string[]) {
  await deleteMaterialImagesByUrls(urls);
}

function resolveMaterialImageUrl(url: string, origin: string) {
  if (url.startsWith("/")) {
    return new URL(url, origin).toString();
  }

  return url;
}

function isValidMaterialImageBytesForPanorama(bytes: Uint8Array, contentType: string) {
  return isValidScenePanoramaImageBytes(bytes, contentType);
}

function getExistingMaskBoardImageSource(metadata: unknown): WorkspaceMaskBoardImageSource | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const boardImage = (metadata as Record<string, unknown>).boardImage;

  if (!boardImage || typeof boardImage !== "object") {
    return null;
  }

  const source = (boardImage as Record<string, unknown>).source;

  return source === "generated" || source === "uploaded" ? source : null;
}

function getItemMaterialMetadata(metadata: unknown): WorkspaceItemMaterialMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  return record.kind === "item" ? record as WorkspaceItemMaterialMetadata : null;
}

function getExistingItemViewImageUrls(metadata: WorkspaceItemMaterialMetadata | null) {
  const viewImages = metadata?.viewImages;

  if (!viewImages || typeof viewImages !== "object") {
    return {};
  }

  return scenePanoramaFaces.reduce<Partial<Record<ItemViewFace, string>>>((result, face) => {
    const image = viewImages[face];

    if (image?.url) {
      result[face] = image.url;
    }

    return result;
  }, {});
}

function getExistingItemViewImageUrlsFromInput(input: ItemMaterialCreateInput) {
  const viewImages = input.viewImages;

  if (!viewImages || typeof viewImages !== "object") {
    return {};
  }

  return scenePanoramaFaces.reduce<Partial<Record<ItemViewFace, string>>>((result, face) => {
    const url = viewImages[face]?.url ?? "";

    if (url) {
      result[face] = url;
    }

    return result;
  }, {});
}

function createUserMaterialSlug(category: WorkspaceMaterialCategory, name: string) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);

  return `${category}-${normalized || "custom"}-${randomUUID().slice(0, 8)}`;
}

function normalizeSceneBlockId(id: string) {
  const normalized = id
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || `scene-block-${randomUUID().slice(0, 8)}`;
}

function toStoryMaterialStyle(style: WorkspaceMaterialStyle): PrismaStoryMaterialStyle {
  const styles: Record<WorkspaceMaterialStyle, PrismaStoryMaterialStyle> = {
    apocalyptic: "APOCALYPTIC",
    classical: "CLASSICAL",
    cyberpunk: "CYBERPUNK",
    fantasy: "FANTASY",
    mystery: "MYSTERY",
    realistic: "REALISTIC",
    sciFi: "SCI_FI"
  };

  return styles[style] ?? "REALISTIC";
}

function normalizeMaskBoardDrawingStyle(style?: string | null): WorkspaceMaskBoardDrawingStyle {
  if (["photo", "anime", "painterly", "cel", "guofeng", "comic", "concept"].includes(style ?? "")) {
    return style as WorkspaceMaskBoardDrawingStyle;
  }

  return "realistic";
}

function normalizeScenePanoramaDrawingStyle(style?: string | null): WorkspaceScenePanoramaDrawingStyle {
  return normalizeMaskBoardDrawingStyle(style);
}

function normalizeSceneScalePreset(preset?: string | null): WorkspaceSceneScalePreset {
  return preset && preset in sceneScalePresetMeters ? preset as WorkspaceSceneScalePreset : defaultSceneScalePreset;
}

function getMaskBoardDrawingStylePrompt(style: WorkspaceMaskBoardDrawingStyle, locale: Locale) {
  const zh: Record<WorkspaceMaskBoardDrawingStyle, string> = {
    anime: "二次元插画，干净线条，角色辨识度高",
    cel: "赛璐璐动画风，清晰色块，边缘利落",
    comic: "漫画分镜设定风，线稿明确，视觉张力强",
    concept: "概念设定稿，设计感强，适合角色设定板",
    guofeng: "国风插画，东方审美，服饰与气质细节克制精致",
    painterly: "厚涂插画，笔触丰富，光影和材质表现更强",
    photo: "真人拍摄质感，真实摄影光线，自然镜头感与可信皮肤细节",
    realistic: "写实角色设计，比例自然，质感可信"
  };
  const en: Record<WorkspaceMaskBoardDrawingStyle, string> = {
    anime: "anime illustration, clean linework, high character readability",
    cel: "cel-shaded animation style, crisp color blocks, clean edges",
    comic: "comic character sheet style, clear ink lines, strong visual energy",
    concept: "concept art character sheet, design-forward and production-ready",
    guofeng: "Chinese-inspired illustration, refined eastern aesthetics and restrained costume details",
    painterly: "painterly illustration, rich brushwork, stronger lighting and material rendering",
    photo: "live-action photographic look, natural camera lighting, realistic skin detail and lens feel",
    realistic: "realistic character design, natural proportions, believable texture"
  };

  return locale === "en-US" ? en[style] : zh[style];
}

function buildMaskAssistMessages(input: MaskMaterialCreateInput, instruction: string, locale: Locale): RuntimeChatMessage[] {
  const isEnglish = locale === "en-US";
  const languageRule = isEnglish ? "Respond in English." : "请使用中文回复。";

  return [
    {
      role: "system",
      content: [
        "You are an assistant for editing a facade material in an interactive creation workspace.",
        "A facade only includes outward presentation: appearance, personality expression, speech style, voice traits, and habits.",
        "Never create backstory, life history, origin, family history, plot events, or world relationships.",
        "Return strict JSON only: {\"message\":\"short explanation\",\"patch\":{...}}.",
        "Patch may only include: name, intro, features, style, body, colors, voice, personality.",
        "features is a multiline outward-trait note, such as signature gestures, recurring expressions, speech habits, and visual motifs.",
        "style must be one of realistic, fantasy, sciFi, mystery, cyberpunk, classical, apocalyptic.",
        "voice and personality values must be numbers from 0 to 100, except speechSpeed from 80 to 220.",
        languageRule
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        currentDraft: input,
        instruction
      })
    }
  ];
}

function buildCreatureAssistMessages(input: CreatureMaterialCreateInput, instruction: string, locale: Locale): RuntimeChatMessage[] {
  const isEnglish = locale === "en-US";
  const languageRule = isEnglish ? "Respond in English." : "请使用中文回复。";

  return [
    {
      role: "system",
      content: [
        "You are an assistant for editing a creature material in an interactive creation workspace.",
        "A creature material defines a reusable species or population for an interactive experience, not a human facade and not a single character biography.",
        "You may define morphology, ecology, vocalization, senses, abilities, limitations, behavior logic, and interaction rules.",
        "Do not turn the creature into a human character with personal backstory, family history, plot events, or world relationships.",
        "Return strict JSON only: {\"message\":\"short explanation\",\"patch\":{...}}.",
        "Patch may only include: name, description, style, taxonomy, morphology, colors, vocalization, senses, ecology, abilities, behaviorLogic, behavior.",
        "abilities fields must be arrays of concise strings.",
        "style must be one of realistic, fantasy, sciFi, mystery, cyberpunk, classical, apocalyptic.",
        "vocalization, senses, and behavior values must be numbers from 0 to 100.",
        languageRule
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        currentDraft: input,
        instruction
      })
    }
  ];
}

function buildSceneAssistMessages(
  input: SceneMaterialCreateInput,
  instruction: string,
  locale: Locale,
  referenceImages: SceneAssistReferenceImage[] = []
): RuntimeChatMessage[] {
  const isEnglish = locale === "en-US";
  const languageRule = isEnglish ? "Respond in English." : "请使用中文回复。";
  const textContent = JSON.stringify({
    currentDraft: input,
    instruction,
    referenceImages: summarizeSceneAssistReferenceImages(referenceImages)
  });
  const userContent: RuntimeChatContentPart[] = [
    {
      type: "text",
      text: textContent
    },
    ...referenceImages.map((image) => ({
      type: "image_url" as const,
      image_url: { url: image.dataUrl }
    }))
  ];

  return [
    {
      role: "system",
      content: [
        "You are an assistant for editing a scene material in an interactive creation workspace.",
        "A scene material describes an interactive place and its sub-areas.",
        "Scene description and every block description must be non-empty.",
        "You may update scene name, scene description, style, block names, block descriptions, block scale presets, add blocks, or remove blocks.",
        "When reference images are attached, inspect them and use visible spatial layout, scale, materials, lighting, and mood to update the text draft.",
        "Never modify panorama image data or URLs.",
        "Return strict JSON only: {\"message\":\"short explanation\",\"patch\":{...}}.",
        "Patch may include name, description, style, addBlocks, updateBlocks, removeBlockIds.",
        "style must be one of realistic, fantasy, sciFi, mystery, cyberpunk, classical, apocalyptic.",
        "scalePreset must be one of closeUp, near, mid, wide, aerial.",
        "addBlocks is an array of {name, description, scalePreset?}. updateBlocks is an array of {id, name?, description?, scalePreset?}. removeBlockIds is an array of existing block ids.",
        languageRule
      ].join("\n")
    },
    {
      role: "user",
      content: referenceImages.length > 0 ? userContent : textContent
    }
  ];
}

export function buildMapAssistMessages(input: MapMaterialCreateInput, instruction: string, locale: Locale): RuntimeChatMessage[] {
  const isEnglish = locale === "en-US";
  const languageRule = isEnglish ? "Respond in English." : "请使用中文回复。";

  return [
    {
      role: "system",
      content: [
        "You are an assistant for editing a map material in an interactive creation workspace.",
        "A map material organizes geography, settlements, landmarks, routes, and directional relationships in a story world.",
        "You may update map name, description, style, add nodes, update nodes, remove nodes, add edges, update edges, or remove edges.",
        "Node types must be one of country, region, city, village, landmark, path.",
        "Relation types must be one of contains, belongs_to, adjacent, connects, through, north_of, south_of, east_of, west_of.",
        "Prefer not to change coordinates unless you need a layout hint. Coordinates are generated automatically in the app and can be adjusted by dragging later.",
        "If you add nodes and edges in the same patch, give the new nodes stable ids so the new edges can reference them.",
        "Return strict JSON only: {\"message\":\"short explanation\",\"patch\":{...}}.",
        "Patch may include name, description, style, addNodes, updateNodes, removeNodeIds, addEdges, updateEdges, removeEdgeIds.",
        "addNodes entries may include id, type, name, description, x, y.",
        "updateNodes entries may include id, type, name, description, x, y.",
        "addEdges entries may include id, relation, source, target, description.",
        "updateEdges entries may include id, relation, source, target, description.",
        "Edge endpoints must reference existing node ids or node ids introduced in the same patch.",
        languageRule
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        currentDraft: input,
        instruction
      })
    }
  ];
}

export function buildMapDeriveRoundMessages(
  input: MapMaterialCreateInput,
  roundIndex: number,
  maxRounds: number,
  locale: Locale
): RuntimeChatMessage[] {
  const isEnglish = locale === "en-US";
  const languageRule = isEnglish ? "Respond in English." : "请使用中文回复。";

  return [
    {
      role: "system",
      content: [
        "You are an assistant for growing a map material graph in an interactive creation workspace.",
        "This task is one derivation round. Inspect the whole current map graph and choose the best growth direction yourself.",
        "You may extend an existing cluster or start a new branch, but the result must stay coherent with the whole current map graph.",
        "Only add new nodes and new edges. Do not update, delete, rename, or move existing nodes, edges, map name, map description, or style.",
        "Node types must be one of country, region, city, village, landmark, path.",
        "Relation types must be one of contains, belongs_to, adjacent, connects, through, north_of, south_of, east_of, west_of.",
        "You may freely decide how many new nodes and edges to add in this round.",
        "Every new node must have a legal type, a non-empty name, and a description.",
        "At least one new edge must connect a newly added node back to an existing node.",
        "Do not reuse existing node ids or edge ids. If you are unsure, create stable ids prefixed with derive-node or derive-edge.",
        "Coordinates are optional and should usually be omitted because the app will generate layout positions.",
        "Return strict JSON only: {\"message\":\"short explanation\",\"patch\":{\"addNodes\":[...],\"addEdges\":[...]}}.",
        "Patch must include only addNodes and addEdges. addNodes entries may include id, type, name, description. addEdges entries may include id, relation, source, target, description.",
        "Edge endpoints must reference existing node ids or node ids introduced in the same patch.",
        languageRule
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        currentDraft: input,
        maxRounds,
        roundIndex
      })
    }
  ];
}

function buildItemAssistMessages(
  input: ItemMaterialCreateInput,
  instruction: string,
  locale: Locale,
  referenceImages: SceneAssistReferenceImage[] = []
): RuntimeChatMessage[] {
  const isEnglish = locale === "en-US";
  const languageRule = isEnglish ? "Respond in English." : "请使用中文回复。";
  const textContent = JSON.stringify({
    currentDraft: input,
    instruction,
    referenceImages: summarizeSceneAssistReferenceImages(referenceImages)
  });
  const userContent: RuntimeChatContentPart[] = [
    {
      type: "text",
      text: textContent
    },
    ...referenceImages.map((image) => ({
      type: "image_url" as const,
      image_url: { url: image.dataUrl }
    }))
  ];

  return [
    {
      role: "system",
      content: [
        "You are an assistant for editing an item material in an interactive creation workspace.",
        "An item material describes a visible, usable object for an interactive experience.",
        "Keep the result focused on inspectable object properties, usage, function, materials, colors, style, brand, model, keywords, and scale.",
        "When reference images are attached, inspect only visible object information: silhouette, components, material, color, style, affordances, and approximate scale.",
        "Do not copy image text, watermarks, UI, background clutter, unrelated scene context, people, hands, or brand marks unless the user explicitly asks to keep a visible brand.",
        "Do not create long plot backstory or unrelated world lore.",
        "Return strict JSON only: {\"message\":\"short explanation\",\"patch\":{...}}.",
        "Patch may only include: name, itemCategory, description, traits, uses, functions, materials, colors, styles, brand, model, keywords, scaleHint, style.",
        "Array fields must be arrays of concise strings.",
        "style must be one of realistic, fantasy, sciFi, mystery, cyberpunk, classical, apocalyptic.",
        languageRule
      ].join("\n")
    },
    {
      role: "user",
      content: referenceImages.length > 0 ? userContent : textContent
    }
  ];
}

function summarizeSceneAssistReferenceImages(images: SceneAssistReferenceImage[]) {
  return images.map((image) => ({
    byteSize: image.byteSize,
    contentType: image.contentType,
    fileName: image.fileName
  }));
}

function isLikelyLlmVisionUnsupportedError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const status = typeof error === "object" && error ? (error as Record<string, unknown>).status : null;

  return (
    status === 400 ||
    message.includes("image") ||
    message.includes("vision") ||
    message.includes("multimodal") ||
    message.includes("content part") ||
    message.includes("unsupported")
  ) && (
    message.includes("image") ||
    message.includes("vision") ||
    message.includes("multimodal") ||
    message.includes("content part")
  );
}

function isLikelyImageReferenceUnsupportedError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const status = typeof error === "object" && error ? (error as Record<string, unknown>).status : null;

  return (
    status === 400 ||
    status === 404 ||
    message.includes("image") ||
    message.includes("reference") ||
    message.includes("unsupported") ||
    message.includes("not support") ||
    message.includes("unknown parameter") ||
    message.includes("unexpected parameter") ||
    message.includes("invalid parameter")
  ) && (
    message.includes("image") ||
    message.includes("reference") ||
    message.includes("input")
  );
}

function buildMaskBoardPrompt(input: MaskMaterialCreateInput, locale: Locale) {
  const isEnglish = locale === "en-US";
  const drawingStyle = getMaskBoardDrawingStylePrompt(normalizeMaskBoardDrawingStyle(input.boardDrawingStyle), locale);
  const body = Object.entries(input.body)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
  const colors = Object.entries(input.colors)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  if (isEnglish) {
    return [
      "Create a 16:9 horizontal character setting board for an interactive facade asset.",
      "Focus only on outward presentation: appearance, expression, posture, clothing mood, speaking aura, and visual temperament.",
      "Do not depict backstory scenes, family history, plot events, or world relationships.",
      `Name: ${input.name || "Untitled facade"}.`,
      `Introduction: ${input.intro || "No introduction yet"}.`,
      `Traits: ${input.features || "unspecified"}.`,
      `Drawing style: ${drawingStyle}.`,
      `Body details: ${body || "unspecified"}.`,
      `Colors: ${colors}.`,
      "Composition: clean character design sheet, half-body character view, subtle annotation zones, refined UI-like setting board."
    ].join("\n");
  }

  return [
    "生成一张 16:9 横版角色设定板，用于交互创作的假面素材。",
    "只表现外显内容：外观、神态、姿态、服饰氛围、说话气质和视觉性格。",
    "不要画人物背景故事、身世经历、剧情事件、家族关系或世界关系。",
    `名称：${input.name || "未命名假面"}。`,
    `介绍：${input.intro || "暂无介绍"}。`,
    `特征：${input.features || "未指定"}。`,
    `绘制风格：${drawingStyle}。`,
    `身体信息：${body || "未指定"}。`,
    `颜色：${colors}。`,
    "构图：干净的角色设计稿、半身角色、轻量标注区域、精致的设定板界面感。"
  ].join("\n");
}

function buildCreatureBoardPrompt(input: CreatureMaterialCreateInput, locale: Locale) {
  const isEnglish = locale === "en-US";
  const drawingStyle = getMaskBoardDrawingStylePrompt(normalizeMaskBoardDrawingStyle(input.boardDrawingStyle), locale);
  const creatureData = summarizeCreaturePromptData(input, locale);

  if (isEnglish) {
    return [
      "Create a 16:9 horizontal creature design board for an interactive species material.",
      "Define the creature as a reusable species or population, not a single human-like character portrait.",
      "Show one clear main creature, morphology/anatomy callouts, scale reference, habitat hint, and small behavior-logic vignettes.",
      "Avoid personal biography scenes, family history, plot events, human costumes as the focus, UI screenshots, and watermarks.",
      `Drawing style: ${drawingStyle}.`,
      creatureData,
      "Composition: production-ready creature sheet, readable silhouette, full body visible, safe margins, concise visual annotations."
    ].join("\n");
  }

  return [
    "生成一张 16:9 横版生物设定板，用于交互创作的物种/族群素材。",
    "把它定义为可复用的生物物种或族群，不是单个人类角色肖像。",
    "画面包含一个清晰的主体生物、形态/解剖标注、比例参考、栖息地提示和少量行为逻辑小图示。",
    "不要画个人传记场景、家族史、剧情事件、以人类服装为中心的设计、UI 截图或水印。",
    `绘制风格：${drawingStyle}。`,
    creatureData,
    "构图：可用于生产的生物设定稿，轮廓清晰，全身可见，四周留安全边距，标注简洁可读。"
  ].join("\n");
}

function buildItemBoardPrompt(input: ItemMaterialCreateInput, locale: Locale) {
  const isEnglish = locale === "en-US";
  const drawingStyle = getMaskBoardDrawingStylePrompt(normalizeMaskBoardDrawingStyle(input.boardDrawingStyle), locale);
  const itemData = summarizeItemPromptData(input, locale);

  if (isEnglish) {
    return [
      "Create a 16:9 horizontal item design board for an interactive material.",
      "The board should make the item easy to inspect and later reconstruct as a 3D asset.",
      "If reference images are provided, use them for the item's silhouette, materials, color zones, relative proportions, interaction affordances, and style direction; do not copy watermarks, text, UI, people, hands, or unrelated backgrounds.",
      `Drawing style: ${drawingStyle}.`,
      itemData,
      "Composition: one clear hero view of the object, small material/color/use callouts, and a readable scale ruler.",
      "Treat the item as a designed static prop or asset reference. No characters holding or using it, no injury, blood, threat, attack scene, busy scene background, or watermark."
    ].join("\n");
  }

  return [
    "生成一张 16:9 横版物品设定板，用于交互创作素材。",
    "设定板要便于查看物品外观，并能作为后续 3D 重建的参考。",
    "如果提供了参考图，请参考物品轮廓、材质、颜色分区、相对比例、可交互部件和风格方向；不要复制水印、文字、UI、人物、手部或无关背景。",
    `绘制风格：${drawingStyle}。`,
    itemData,
    "构图：一个清晰的物品主视觉，少量材质/颜色/用途标注，并包含可读比例尺。",
    "仅作为原创静态道具或资产参考；不要人物手持或使用，不要真实伤害、血迹、威胁或攻击场景，不要复杂场景背景，不要水印。"
  ].join("\n");
}

function buildItemModelInputImagePrompt(input: ItemMaterialCreateInput, locale: Locale) {
  const itemData = summarizeItemPromptData(input, locale);

  if (locale === "en-US") {
    return [
      "Create one clean model input image for a single item so InstantMesh can reconstruct a GLB model from one image.",
      "Keep the image consistent with the reference design board and the structured item data.",
      itemData
    ].join("\n");
  }

  return [
    "为单个物品生成一张干净的模型输入图，用于传给 InstantMesh 从单图重建 GLB 模型。",
    "画面必须与参考设定板和结构化物品数据保持一致。",
    itemData
  ].join("\n");
}

function summarizeCreaturePromptData(input: CreatureMaterialCreateInput, locale: Locale) {
  const isEnglish = locale === "en-US";
  const labels = isEnglish
    ? {
        abilities: "Abilities",
        behavior: "Behavior Logic",
        behaviorSliders: "Behavior Tendencies",
        colors: "Colors",
        description: "Definition",
        ecology: "Ecology",
        morphology: "Morphology",
        name: "Name",
        senses: "Senses",
        taxonomy: "Taxonomy",
        vocalization: "Vocalization"
      }
    : {
        abilities: "能力与限制",
        behavior: "行为逻辑",
        behaviorSliders: "行为倾向",
        colors: "颜色标记",
        description: "完整定义",
        ecology: "生态",
        morphology: "形态结构",
        name: "名称",
        senses: "感知",
        taxonomy: "分类",
        vocalization: "发声"
      };

  return [
    `${labels.name}: ${input.name || (isEnglish ? "Untitled creature" : "未命名生物")}`,
    `${labels.description}: ${input.description || (isEnglish ? "unspecified" : "未指定")}`,
    `${labels.taxonomy}: ${formatPromptRecord(input.taxonomy)}`,
    `${labels.morphology}: ${formatPromptRecord(input.morphology)}`,
    `${labels.colors}: ${formatPromptRecord(input.colors)}`,
    `${labels.vocalization}: ${formatPromptRecord(input.vocalization)}`,
    `${labels.senses}: ${formatPromptRecord(input.senses)}`,
    `${labels.ecology}: ${formatPromptRecord(input.ecology)}`,
    `${labels.abilities}: ${formatPromptRecord(input.abilities)}`,
    `${labels.behavior}: ${input.behaviorLogic || (isEnglish ? "unspecified" : "未指定")}`,
    `${labels.behaviorSliders}: ${formatPromptRecord(input.behavior)}`
  ].join("\n");
}

function formatPromptRecord(record: Record<string, unknown>) {
  const text = Object.entries(record)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value ?? "")}`)
    .filter((entry) => !entry.endsWith(": "))
    .join(", ");

  return text || "unspecified";
}

function summarizeItemPromptData(input: ItemMaterialCreateInput, locale: Locale) {
  const isEnglish = locale === "en-US";
  const labels = isEnglish
    ? {
        brand: "Brand",
        category: "Category",
        colors: "Colors",
        description: "Description",
        functions: "Functions",
        keywords: "Keywords",
        materials: "Materials",
        model: "Model",
        name: "Name",
        scale: "Scale",
        styles: "Styles",
        traits: "Traits",
        uses: "Uses"
      }
    : {
        brand: "品牌",
        category: "类别",
        colors: "颜色",
        description: "描述",
        functions: "功能",
        keywords: "关键词",
        materials: "材质",
        model: "型号",
        name: "名称",
        scale: "尺寸/比例尺",
        styles: "风格",
        traits: "特点",
        uses: "用途"
      };

  return [
    `${labels.name}: ${input.name || (isEnglish ? "Untitled item" : "未命名物品")}`,
    `${labels.category}: ${input.itemCategory || (isEnglish ? "unspecified" : "未指定")}`,
    `${labels.description}: ${input.description || (isEnglish ? "unspecified" : "未指定")}`,
    `${labels.traits}: ${input.traits.join(", ") || (isEnglish ? "unspecified" : "未指定")}`,
    `${labels.uses}: ${input.uses.join(", ") || (isEnglish ? "unspecified" : "未指定")}`,
    `${labels.functions}: ${input.functions.join(", ") || (isEnglish ? "unspecified" : "未指定")}`,
    `${labels.materials}: ${input.materials.join(", ") || (isEnglish ? "unspecified" : "未指定")}`,
    `${labels.colors}: ${input.colors.join(", ") || (isEnglish ? "unspecified" : "未指定")}`,
    `${labels.styles}: ${input.styles.join(", ") || (isEnglish ? "unspecified" : "未指定")}`,
    `${labels.brand}: ${input.brand || (isEnglish ? "none" : "无")}`,
    `${labels.model}: ${input.model || (isEnglish ? "none" : "无")}`,
    `${labels.keywords}: ${input.keywords.join(", ") || (isEnglish ? "unspecified" : "未指定")}`,
    `${labels.scale}: ${input.scaleHint || (isEnglish ? "reference ruler only" : "仅参考比例尺")}`
  ].join("\n");
}

function parseJsonObject(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function sanitizeMaskDraftPatch(value: unknown): MaskDraftPatch {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const patch: MaskDraftPatch = {};

  if (typeof record.name === "string") {
    patch.name = record.name.slice(0, 120);
  }

  if (typeof record.intro === "string") {
    patch.intro = record.intro.slice(0, 1200);
  }

  if (typeof record.features === "string") {
    patch.features = record.features.slice(0, 2000);
  }

  if (typeof record.style === "string" && isWorkspaceMaterialStyle(record.style)) {
    patch.style = record.style;
  }

  patch.body = pickStringRecord(record.body, maskBodyFieldIds);
  patch.colors = pickColorRecord(record.colors, maskColorFieldIds);
  patch.voice = pickNumberRecord(record.voice, maskVoiceFieldIds, { speechSpeed: [80, 220] });
  patch.personality = pickNumberRecord(record.personality, maskPersonalityFieldIds);

  return patch;
}

function sanitizeCreatureDraftPatch(value: unknown): CreatureDraftPatch {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const patch: CreatureDraftPatch = {};

  if (typeof record.name === "string") {
    patch.name = record.name.slice(0, 120);
  }

  if (typeof record.description === "string") {
    patch.description = record.description.slice(0, 2000);
  }

  if (typeof record.style === "string" && isWorkspaceMaterialStyle(record.style)) {
    patch.style = record.style;
  }

  patch.taxonomy = pickStringRecord(record.taxonomy, creatureTaxonomyFieldIds);
  patch.morphology = pickStringRecord(record.morphology, creatureMorphologyFieldIds);
  patch.colors = pickColorRecord(record.colors, creatureColorFieldIds);
  patch.vocalization = pickNumberRecord(record.vocalization, creatureVocalizationFieldIds);
  patch.senses = pickNumberRecord(record.senses, creatureSenseFieldIds);
  patch.ecology = pickStringRecord(record.ecology, creatureEcologyFieldIds);

  if (record.abilities && typeof record.abilities === "object") {
    const abilitiesRecord = record.abilities as Record<string, unknown>;
    const abilities = creatureAbilityFieldIds.reduce<NonNullable<CreatureDraftPatch["abilities"]>>((result, field) => {
      const values = sanitizeStringList(abilitiesRecord[field]);

      if (values.length > 0) {
        result[field] = values;
      }

      return result;
    }, {});

    if (Object.keys(abilities).length > 0) {
      patch.abilities = abilities;
    }
  }

  if (typeof record.behaviorLogic === "string") {
    patch.behaviorLogic = record.behaviorLogic.slice(0, 2400);
  }

  patch.behavior = pickNumberRecord(record.behavior, creatureBehaviorFieldIds);

  return patch;
}

function sanitizeItemDraftPatch(value: unknown): ItemDraftPatch {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const patch: ItemDraftPatch = {};

  if (typeof record.name === "string") {
    patch.name = record.name.slice(0, 120);
  }

  if (typeof record.itemCategory === "string") {
    patch.itemCategory = record.itemCategory.slice(0, 80);
  }

  if (typeof record.description === "string") {
    patch.description = record.description.slice(0, 1600);
  }

  if (typeof record.brand === "string") {
    patch.brand = record.brand.slice(0, 120);
  }

  if (typeof record.model === "string") {
    patch.model = record.model.slice(0, 120);
  }

  if (typeof record.scaleHint === "string") {
    patch.scaleHint = record.scaleHint.slice(0, 160);
  }

  if (typeof record.style === "string" && isWorkspaceMaterialStyle(record.style)) {
    patch.style = record.style;
  }

  (["traits", "uses", "functions", "materials", "colors", "styles", "keywords"] as const).forEach((key) => {
    const values = sanitizeStringList(record[key]);

    if (values.length > 0) {
      patch[key] = values;
    }
  });

  return patch;
}

function sanitizeSceneDraftPatch(value: unknown): SceneDraftPatch {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const patch: SceneDraftPatch = {};

  if (typeof record.name === "string") {
    patch.name = record.name.slice(0, 120);
  }

  if (typeof record.description === "string") {
    patch.description = record.description.slice(0, 2000);
  }

  if (typeof record.style === "string" && isWorkspaceMaterialStyle(record.style)) {
    patch.style = record.style;
  }

  if (Array.isArray(record.addBlocks)) {
    patch.addBlocks = record.addBlocks
      .filter((block): block is Record<string, unknown> => Boolean(block) && typeof block === "object")
      .map((block) => ({
        ...(typeof block.id === "string" ? { id: normalizeSceneBlockId(block.id) } : {}),
        description: typeof block.description === "string" ? block.description.slice(0, 2000) : "",
        name: typeof block.name === "string" ? block.name.slice(0, 120) : "",
        scalePreset: normalizeSceneScalePreset(typeof block.scalePreset === "string" ? block.scalePreset : null)
      }))
      .filter((block) => block.name.trim() && block.description.trim())
      .slice(0, 8);
  }

  if (Array.isArray(record.updateBlocks)) {
    patch.updateBlocks = record.updateBlocks
      .filter((block): block is Record<string, unknown> => Boolean(block) && typeof block === "object")
      .map((block) => ({
        id: typeof block.id === "string" ? normalizeSceneBlockId(block.id) : "",
        ...(typeof block.name === "string" ? { name: block.name.slice(0, 120) } : {}),
        ...(typeof block.description === "string" ? { description: block.description.slice(0, 2000) } : {}),
        ...(typeof block.scalePreset === "string" ? { scalePreset: normalizeSceneScalePreset(block.scalePreset) } : {})
      }))
      .filter((block) => block.id)
      .slice(0, 16);
  }

  if (Array.isArray(record.removeBlockIds)) {
    patch.removeBlockIds = record.removeBlockIds
      .filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
      .map(normalizeSceneBlockId)
      .slice(0, 16);
  }

  return patch;
}

export function sanitizeMapDraftPatch(value: unknown): MapDraftPatch {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const patch: MapDraftPatch = {};

  if (typeof record.name === "string") {
    patch.name = record.name.slice(0, 120);
  }

  if (typeof record.description === "string") {
    patch.description = record.description.slice(0, 2000);
  }

  if (typeof record.style === "string" && isWorkspaceMaterialStyle(record.style)) {
    patch.style = record.style;
  }

  if (Array.isArray(record.addNodes)) {
    patch.addNodes = record.addNodes
      .filter((node): node is Record<string, unknown> => Boolean(node) && typeof node === "object")
      .map((node) => {
        const name = typeof node.name === "string" ? node.name.trim().slice(0, 120) : "";
        const entry: NonNullable<MapDraftPatch["addNodes"]>[number] = {
          description: typeof node.description === "string" ? node.description.slice(0, 2000) : "",
          name,
          ...(typeof node.id === "string" && normalizeMapAssistId(node.id) ? { id: normalizeMapAssistId(node.id) } : {}),
          type: typeof node.type === "string" && isMapNodeType(node.type) ? node.type : "landmark",
          ...(typeof node.x === "number" && Number.isFinite(node.x) ? { x: node.x } : {}),
          ...(typeof node.y === "number" && Number.isFinite(node.y) ? { y: node.y } : {})
        };

        return entry;
      })
      .filter((node) => node.name.trim())
      .slice(0, 12);
  }

  if (Array.isArray(record.updateNodes)) {
    patch.updateNodes = record.updateNodes
      .filter((node): node is Record<string, unknown> => Boolean(node) && typeof node === "object")
      .map((node) => {
        const entry: NonNullable<MapDraftPatch["updateNodes"]>[number] = {
          id: normalizeMapAssistId(node.id),
          ...(typeof node.name === "string" && node.name.trim() ? { name: node.name.trim().slice(0, 120) } : {}),
          ...(typeof node.description === "string" ? { description: node.description.slice(0, 2000) } : {}),
          type: typeof node.type === "string" && isMapNodeType(node.type) ? node.type : "landmark",
          ...(typeof node.x === "number" && Number.isFinite(node.x) ? { x: node.x } : {}),
          ...(typeof node.y === "number" && Number.isFinite(node.y) ? { y: node.y } : {})
        };

        return entry;
      })
      .filter((node) => node.id)
      .slice(0, 20);
  }

  if (Array.isArray(record.removeNodeIds)) {
    patch.removeNodeIds = record.removeNodeIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => normalizeMapAssistId(id))
      .filter(Boolean)
      .slice(0, 20);
  }

  if (Array.isArray(record.addEdges)) {
    patch.addEdges = record.addEdges
      .filter((edge): edge is Record<string, unknown> => Boolean(edge) && typeof edge === "object")
      .map((edge) => {
        const source = typeof edge.source === "string" ? normalizeMapAssistId(edge.source) : "";
        const target = typeof edge.target === "string" ? normalizeMapAssistId(edge.target) : "";

        return {
          ...(typeof edge.id === "string" && normalizeMapAssistId(edge.id) ? { id: normalizeMapAssistId(edge.id) } : {}),
          description: typeof edge.description === "string" ? edge.description.slice(0, 2000) : "",
          relation: typeof edge.relation === "string" && isMapRelationType(edge.relation) ? edge.relation : "connects",
          source,
          target
        };
      })
      .filter((edge) => edge.source && edge.target && edge.source !== edge.target)
      .slice(0, 20);
  }

  if (Array.isArray(record.updateEdges)) {
    patch.updateEdges = record.updateEdges
      .filter((edge): edge is Record<string, unknown> => Boolean(edge) && typeof edge === "object")
      .map((edge) => {
        const entry: NonNullable<MapDraftPatch["updateEdges"]>[number] = {
          id: normalizeMapAssistId(edge.id),
          ...(typeof edge.relation === "string" && isMapRelationType(edge.relation) ? { relation: edge.relation } : {}),
          ...(typeof edge.source === "string" && normalizeMapAssistId(edge.source) ? { source: normalizeMapAssistId(edge.source) } : {}),
          ...(typeof edge.target === "string" && normalizeMapAssistId(edge.target) ? { target: normalizeMapAssistId(edge.target) } : {}),
          ...(typeof edge.description === "string" ? { description: edge.description.slice(0, 2000) } : {})
        };

        return entry;
      })
      .filter((edge) => edge.id)
      .slice(0, 20);
  }

  if (Array.isArray(record.removeEdgeIds)) {
    patch.removeEdgeIds = record.removeEdgeIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => normalizeMapAssistId(id))
      .filter(Boolean)
      .slice(0, 20);
  }

  return patch;
}

export function sanitizeMapDeriveRoundPatch(value: unknown, currentDraft: MapMaterialCreateInput): MapDraftPatch {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const existingNodeIds = new Set(currentDraft.nodes.map((node) => normalizeMapAssistId(node.id)).filter(Boolean));
  const existingEdgeIds = new Set(currentDraft.edges.map((edge) => normalizeMapAssistId(edge.id)).filter(Boolean));
  const usedNodeIds = new Set<string>();
  const usedEdgeIds = new Set<string>();
  const nodeIdRemap = new Map<string, string>();
  const addNodes: NonNullable<MapDraftPatch["addNodes"]> = [];

  if (Array.isArray(record.addNodes)) {
    for (const node of record.addNodes) {
      if (!node || typeof node !== "object") {
        continue;
      }

      const nodeRecord = node as Record<string, unknown>;
      const name = typeof nodeRecord.name === "string" ? nodeRecord.name.trim().slice(0, 120) : "";
      const type = typeof nodeRecord.type === "string" && isMapNodeType(nodeRecord.type) ? nodeRecord.type : null;

      if (!name || !type) {
        continue;
      }

      const requestedId = normalizeMapAssistId(nodeRecord.id) || createMapDeriveId("map-node");
      const id = getAvailableMapDeriveId(requestedId, existingNodeIds, usedNodeIds, "map-node");

      if (requestedId && !nodeIdRemap.has(requestedId)) {
        nodeIdRemap.set(requestedId, id);
      }

      addNodes.push({
        id,
        description: typeof nodeRecord.description === "string" ? nodeRecord.description.slice(0, 2000) : "",
        name,
        type
      });

      if (addNodes.length >= 12) {
        break;
      }
    }
  }

  if (addNodes.length === 0 || !Array.isArray(record.addEdges)) {
    return {};
  }

  const newNodeIds = new Set(addNodes.map((node) => node.id).filter((id): id is string => Boolean(id)));
  const validNodeIds = new Set([...existingNodeIds, ...newNodeIds]);
  const addEdges: NonNullable<MapDraftPatch["addEdges"]> = [];

  for (const edge of record.addEdges) {
    if (!edge || typeof edge !== "object") {
      continue;
    }

    const edgeRecord = edge as Record<string, unknown>;
    const relation = typeof edgeRecord.relation === "string" && isMapRelationType(edgeRecord.relation)
      ? edgeRecord.relation
      : null;
    const sourceId = normalizeMapAssistId(edgeRecord.source);
    const targetId = normalizeMapAssistId(edgeRecord.target);
    const source = nodeIdRemap.get(sourceId) ?? sourceId;
    const target = nodeIdRemap.get(targetId) ?? targetId;

    if (!relation || !source || !target || source === target || !validNodeIds.has(source) || !validNodeIds.has(target)) {
      continue;
    }

    const requestedId = normalizeMapAssistId(edgeRecord.id) || createMapDeriveId("map-edge");
    const id = getAvailableMapDeriveId(requestedId, existingEdgeIds, usedEdgeIds, "map-edge");

    addEdges.push({
      id,
      description: typeof edgeRecord.description === "string" ? edgeRecord.description.slice(0, 2000) : "",
      relation,
      source,
      target
    });

    if (addEdges.length >= 20) {
      break;
    }
  }

  const hasOldNewConnection = addEdges.some((edge) =>
    (existingNodeIds.has(edge.source) && newNodeIds.has(edge.target)) ||
    (newNodeIds.has(edge.source) && existingNodeIds.has(edge.target))
  );

  if (addEdges.length === 0 || !hasOldNewConnection) {
    return {};
  }

  return {
    addNodes,
    addEdges
  };
}

function normalizeMapAssistId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createMapDeriveId(prefix: "map-node" | "map-edge") {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function getAvailableMapDeriveId(requestedId: string, existingIds: Set<string>, usedIds: Set<string>, prefix: "map-node" | "map-edge") {
  let id = normalizeMapAssistId(requestedId) || createMapDeriveId(prefix);

  while (existingIds.has(id) || usedIds.has(id)) {
    id = createMapDeriveId(prefix);
  }

  usedIds.add(id);

  return id;
}

function normalizeMapDeriveRound(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(20, Math.max(1, Math.round(parsed)));
}

const maskBodyFieldIds: WorkspaceMaskBodyFieldId[] = [
  "hairStyle",
  "browShape",
  "faceShape",
  "eyeShape",
  "noseType",
  "mouthShape",
  "earShape",
  "height",
  "weight",
  "gender",
  "ageStage",
  "bodyType"
];
const maskColorFieldIds: WorkspaceMaskColorFieldId[] = ["hairColor", "eyeColor", "browColor", "skinColor"];
const maskVoiceFieldIds: WorkspaceMaskVoiceFieldId[] = [
  "pitch",
  "speechSpeed",
  "volume",
  "intonation",
  "emotionExposure",
  "nasalResonance",
  "breathiness"
];
const maskPersonalityFieldIds: WorkspaceMaskPersonalityFieldId[] = [
  "extroversion",
  "dominance",
  "rationality",
  "emotionalStability",
  "confidence",
  "affinity",
  "sharingDesire",
  "humor",
  "aggression",
  "politeness",
  "coquetry",
  "sensitivity",
  "possessiveness",
  "dependency",
  "proactiveCare",
  "boundaries",
  "loyalty",
  "action",
  "curiosity",
  "performative"
];
const creatureTaxonomyFieldIds: WorkspaceCreatureTaxonomyFieldId[] = ["creatureType"];
const creatureMorphologyFieldIds: WorkspaceCreatureMorphologyFieldId[] = [
  "sizeClass",
  "length",
  "weight",
  "limbStructure",
  "bodyCovering",
  "headFeature",
  "tailAppendage",
  "movement",
  "specialOrgans"
];
const creatureColorFieldIds: WorkspaceCreatureColorFieldId[] = ["primaryColor", "secondaryColor", "markingColor", "glowColor"];
const creatureVocalizationFieldIds: WorkspaceCreatureVocalizationFieldId[] = [
  "frequency",
  "rhythm",
  "volume",
  "emotionReadability",
  "mimicry"
];
const creatureSenseFieldIds: WorkspaceCreatureSenseFieldId[] = ["sensoryAcuity"];
const creatureEcologyFieldIds: WorkspaceCreatureEcologyFieldId[] = [
  "habitat",
  "diet",
  "activityCycle",
  "socialStructure",
  "reproduction"
];
const creatureAbilityFieldIds: WorkspaceCreatureAbilityFieldId[] = [
  "powers",
  "weaknesses",
  "resourceNeeds",
  "interactionUses",
  "dangerNotes",
  "keywords"
];
const creatureBehaviorFieldIds: WorkspaceCreatureBehaviorFieldId[] = [
  "aggression",
  "sociability",
  "territoriality",
  "curiosity",
  "alertness",
  "stealth",
  "persistence",
  "adaptability",
  "tameability",
  "bonding",
  "threatResponse",
  "resourceGuarding"
];

function pickStringRecord<T extends string>(value: unknown, keys: T[]) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const result: Partial<Record<T, string>> = {};

  keys.forEach((key) => {
    if (typeof source[key] === "string") {
      result[key] = source[key].slice(0, 160);
    }
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

function pickColorRecord<T extends string>(value: unknown, keys: T[]) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const result: Partial<Record<T, string>> = {};

  keys.forEach((key) => {
    const color = typeof source[key] === "string" ? source[key].trim() : "";

    if (/^#[0-9a-f]{6}$/i.test(color)) {
      result[key] = color.toUpperCase();
    }
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

function pickNumberRecord<T extends string>(value: unknown, keys: T[], ranges: Partial<Record<T, [number, number]>> = {}) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const result: Partial<Record<T, number>> = {};

  keys.forEach((key) => {
    if (typeof source[key] !== "number" || !Number.isFinite(source[key])) {
      return;
    }

    const [min, max] = ranges[key] ?? [0, 100];
    result[key] = Math.min(max, Math.max(min, Math.round(source[key])));
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

function isWorkspaceMaterialStyle(style: string): style is WorkspaceMaterialStyle {
  return ["realistic", "fantasy", "sciFi", "mystery", "cyberpunk", "classical", "apocalyptic"].includes(style);
}

function mapMessage(message: {
  id: string;
  role: string;
  content: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  tokenUsageEstimated?: boolean;
  createdAt: Date;
}): WorkspaceMessage {
  return {
    id: message.id,
    role: message.role === userRole ? "user" : "assistant",
    content: message.content,
    promptTokens: message.promptTokens ?? null,
    completionTokens: message.completionTokens ?? null,
    tokenUsageEstimated: message.tokenUsageEstimated ?? false,
    createdAt: message.createdAt.toISOString()
  };
}

function getFallbackWorkspaceData(locale: Locale): WorkspaceData {
  const fallbackScripts = builtInScripts.map((script) => {
    const isBaseScript = script.slug === baseScriptSlug;

    return mapScript(
      { id: script.slug, ...script },
      locale,
      {
        inLibrary: isBaseScript,
      librarySource: isBaseScript ? communityAddedSource : undefined
      }
    );
  });
  const fallbackMaterials = builtInMaterials.map((material) => {
    const isShared = defaultMaterialSlugs.includes(material.slug);

    return mapMaterial(
      { id: material.slug, ...material },
      locale,
      {
        inLibrary: isShared,
        librarySource: isShared ? communityAddedSource : undefined
      }
    );
  });

  return {
    viewer: null,
    myScripts: fallbackScripts.filter((script) => script.inLibrary),
    communityScripts: fallbackScripts,
    myMaterials: fallbackMaterials.filter((material) => material.inLibrary),
    communityMaterials: fallbackMaterials,
    conversations: [],
    persistenceAvailable: false
  };
}

function normalizeMaterialCategory(category: string): WorkspaceMaterialCategory {
  if (category === "MASK") {
    return "mask";
  }

  if (category === "MAP") {
    return "map";
  }

  if (category === "CREATURE") {
    return "creature";
  }

  if (category === "SCENE") {
    return "scene";
  }

  return "item";
}

function normalizeMaterialStyle(style?: string | null): WorkspaceMaterialStyle {
  if (style === "FANTASY") {
    return "fantasy";
  }

  if (style === "SCI_FI") {
    return "sciFi";
  }

  if (style === "MYSTERY") {
    return "mystery";
  }

  if (style === "CYBERPUNK") {
    return "cyberpunk";
  }

  if (style === "CLASSICAL") {
    return "classical";
  }

  if (style === "APOCALYPTIC") {
    return "apocalyptic";
  }

  return "realistic";
}

function getScriptCategory(slug: string): WorkspaceScript["category"] {
  if (slug.includes("world")) {
    return "world";
  }

  if (slug.includes("xianxia") || slug.includes("cyberpunk") || slug.includes("sci-fi")) {
    return "world";
  }

  if (slug.includes("roleplay") || slug.includes("mystery") || slug.includes("romance") || slug.includes("horror") || slug.includes("historical") || slug.includes("comedy")) {
    return "roleplay";
  }

  if (slug.includes("writing")) {
    return "writing";
  }

  if (slug.includes("analyst")) {
    return "analysis";
  }

  return "featured";
}
