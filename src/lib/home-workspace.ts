import "server-only";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { StoryMaterialStyle as PrismaStoryMaterialStyle } from "@prisma/client";
import type { Locale } from "@/i18n/routing";
import {
  generateDefaultMaskBoardImage,
  generateDefaultScenePanorama,
  scenePanoramaFaces,
  type ScenePanoramaFace,
  type ScenePanoramaGenerationResult
} from "@/lib/ai/image-runtime";
import { generateDefaultLlmReply, streamDefaultLlmReply, type RuntimeChatMessage, type RuntimeTokenUsage } from "@/lib/ai/runtime";
import { ensureConfiguredAdminUser, getCurrentViewer, requireAuth } from "@/lib/auth";
import type { AuthViewer } from "@/lib/auth-types";
import {
  buildNarrativeLlmMessages,
  createConversationTitle,
  emptyTokenUsage,
  summarizeConversationTokenUsage
} from "@/lib/home-workspace-utils";
import { prisma } from "@/lib/prisma";
import { deleteMaterialImagesByUrls, uploadMaskBoardImage, uploadScenePanoramaFaceImage } from "@/lib/storage/material";

const baseScriptSlug = "base-ai-script";
const defaultUserId = "default-local";
const defaultUserSlug = "default-local";
const assistantRole = "assistant";
const userRole = "user";
const communityAddedSource = "COMMUNITY_ADDED" satisfies WorkspaceScriptLibrarySource;
const defaultMaterialSlugs = [
  "echo-mask",
  "mirror-mourning-mask",
  "floating-city-map",
  "tidal-route-chart",
  "echo-compass",
  "neon-access-chip",
  "mistguard-beast"
];

const builtInScripts = [
  {
    slug: baseScriptSlug,
    titleZh: "基础 AI 剧本",
    titleEn: "Base AI Script",
    descriptionZh: "适合第一次进入新世界小说的通用互动剧本，AI 会围绕角色、地点和事件推进叙事。",
    descriptionEn:
      "A general interactive script for first-time New World Novel sessions, focused on characters, places, and events.",
    welcomeZh: "已载入基础 AI 剧本。你可以输入角色、场景或冲突，我会把它推进为可交互剧情。",
    welcomeEn:
      "Base AI Script is loaded. Send a character, scene, or conflict and I will turn it into interactive fiction."
  },
  {
    slug: "world-architect",
    titleZh: "世界观架构师",
    titleEn: "World Architect",
    descriptionZh: "从文明、地理、规则和势力关系出发，搭建可长期演化的原创世界观。",
    descriptionEn: "Build evolving fictional worlds from civilizations, geography, rules, and faction relationships.",
    welcomeZh: "告诉我一个世界的核心规则，我会帮你扩展文明、地点、势力和冲突。",
    welcomeEn: "Give me a core world rule and I will expand civilizations, places, factions, and conflicts."
  },
  {
    slug: "character-roleplay",
    titleZh: "角色扮演导演",
    titleEn: "Roleplay Director",
    descriptionZh: "围绕角色动机、口吻和关系推进沉浸式互动对话，适合单角色或多角色戏剧场景。",
    descriptionEn:
      "Drive immersive roleplay through character motives, voice, and relationships for solo or ensemble scenes.",
    welcomeZh: "描述一个角色和当前处境，我会以导演视角推进对话、动作和关系变化。",
    welcomeEn: "Describe a character and situation, and I will direct dialogue, actions, and relationship shifts."
  },
  {
    slug: "mystery-case",
    titleZh: "悬疑案件生成器",
    titleEn: "Mystery Case Builder",
    descriptionZh: "生成线索、嫌疑人、误导信息和阶段性反转，适合推理、调查和悬疑互动。",
    descriptionEn: "Generate clues, suspects, misdirection, and staged twists for mystery and investigation stories.",
    welcomeZh: "给我案件主题或第一具线索，我会设计嫌疑人、动机和逐步揭开的真相。",
    welcomeEn: "Give me a case premise or first clue, and I will design suspects, motives, and reveals."
  },
  {
    slug: "serial-writing",
    titleZh: "连载写作助手",
    titleEn: "Serial Writing Assistant",
    descriptionZh: "帮助规划章节节奏、钩子、人物弧光和下一章推进，适合长篇连载创作。",
    descriptionEn: "Plan chapter pacing, hooks, character arcs, and next-episode beats for serial fiction.",
    welcomeZh: "发来当前章节梗概，我会帮你设计下一章冲突、钩子和人物推进。",
    welcomeEn: "Send the current chapter summary and I will design the next conflict, hook, and character movement."
  },
  {
    slug: "lore-analyst",
    titleZh: "设定研究员",
    titleEn: "Lore Analyst",
    descriptionZh: "整理复杂设定、时间线和因果关系，适合把零散灵感沉淀为体系文档。",
    descriptionEn: "Organize complex lore, timelines, and causality into structured world documents.",
    welcomeZh: "把零散设定发给我，我会整理为时间线、实体关系和可复用的设定条目。",
    welcomeEn: "Send scattered lore notes and I will organize timelines, entity links, and reusable entries."
  },
  {
    slug: "xianxia-sect",
    titleZh: "仙门纪事",
    titleEn: "Xianxia Sect Chronicle",
    descriptionZh: "围绕宗门、灵脉、功法和师徒关系展开修真世界的长期互动叙事。",
    descriptionEn: "A long-form cultivation script around sects, spirit veins, techniques, and master-disciple bonds.",
    welcomeZh: "告诉我你的宗门、境界或一次危机，我会展开修真世界的剧情线。",
    welcomeEn: "Tell me your sect, cultivation stage, or crisis, and I will unfold a xianxia storyline."
  },
  {
    slug: "cyberpunk-city",
    titleZh: "赛博城夜行",
    titleEn: "Cyberpunk Night City",
    descriptionZh: "适合霓虹都市、公司阴谋、黑客行动和身份迷失主题的赛博互动剧本。",
    descriptionEn: "Cyberpunk interaction for neon cities, corporate conspiracies, hacking, and identity drift.",
    welcomeZh: "给我一个城区、委托或公司秘密，我会生成赛博都市行动开场。",
    welcomeEn: "Give me a district, job, or corporate secret, and I will generate a cyberpunk opening."
  },
  {
    slug: "romance-slowburn",
    titleZh: "慢热关系线",
    titleEn: "Slow-Burn Romance",
    descriptionZh: "专注人物关系、细节互动和情绪递进，适合慢热恋爱与群像情感线。",
    descriptionEn: "A relationship-focused script for subtle interactions, emotional pacing, and ensemble romance.",
    welcomeZh: "描述两个人的关系起点，我会设计克制、递进的互动场景。",
    welcomeEn: "Describe the starting relationship and I will design restrained, evolving scenes."
  },
  {
    slug: "horror-mansion",
    titleZh: "怪谈宅邸",
    titleEn: "Haunted Mansion",
    descriptionZh: "构建封闭空间、诡异规则、心理压力和逐步揭露真相的恐怖互动。",
    descriptionEn: "A horror script for enclosed spaces, uncanny rules, pressure, and gradual revelations.",
    welcomeZh: "给我一条怪谈规则或一栋宅邸的异常，我会推进恐怖探索。",
    welcomeEn: "Give me an uncanny rule or mansion anomaly, and I will begin the horror investigation."
  },
  {
    slug: "sci-fi-expedition",
    titleZh: "深空远征",
    titleEn: "Deep Space Expedition",
    descriptionZh: "围绕星舰、未知文明、资源危机和船员抉择展开硬科幻探索。",
    descriptionEn: "Hard sci-fi exploration with starships, unknown civilizations, resource crises, and crew decisions.",
    welcomeZh: "告诉我目的星域或船上危机，我会生成远征任务与第一轮抉择。",
    welcomeEn: "Tell me the destination sector or shipboard crisis, and I will generate the first decisions."
  },
  {
    slug: "historical-intrigue",
    titleZh: "宫廷权谋",
    titleEn: "Court Intrigue",
    descriptionZh: "适合朝堂、家族、盟约和暗线布局的历史权谋互动剧本。",
    descriptionEn: "Historical intrigue around court politics, families, alliances, and hidden agendas.",
    welcomeZh: "给我一个朝局矛盾或人物身份，我会展开权谋局面和暗线。",
    welcomeEn: "Give me a court conflict or identity, and I will unfold intrigue and hidden agendas."
  },
  {
    slug: "comedy-sitcom",
    titleZh: "轻喜剧单元",
    titleEn: "Sitcom Episode",
    descriptionZh: "用误会、反差和角色习惯制造轻松单元剧冲突，适合日常群像。",
    descriptionEn: "A light comedy script built on misunderstandings, contrast, and ensemble habits.",
    welcomeZh: "给我一个场景和角色关系，我会设计一集轻喜剧冲突。",
    welcomeEn: "Give me a setting and relationship web, and I will design a sitcom-style episode."
  }
];

const builtInMaterials = [
  {
    slug: "echo-mask",
    category: "MASK",
    style: "REALISTIC",
    titleZh: "回声假面",
    titleEn: "Echo Mask",
    descriptionZh: "记录人物外观轮廓、性格倾向、说话方式和动作习惯的假面素材，不包含身世与背景故事。",
    descriptionEn:
      "A mask material for recording appearance, temperament, speech style, and habitual gestures, without backstory."
  },
  {
    slug: "mirror-mourning-mask",
    category: "MASK",
    style: "MYSTERY",
    titleZh: "镜语假面",
    titleEn: "Mirror Voice Mask",
    descriptionZh: "只收纳表层呈现的神态、语气和姿态，便于独立整理角色的外在呈现。",
    descriptionEn: "Stores only the surface presentation of expression, tone, and posture for a clean external character profile."
  },
  {
    slug: "floating-city-map",
    category: "MAP",
    style: "SCI_FI",
    titleZh: "悬空城地图",
    titleEn: "Floating City Map",
    descriptionZh: "标注环层街区、升降塔和禁飞风道的城市地图，适合空中都市和阶层冲突。",
    descriptionEn: "A city map of ring districts, lift towers, and forbidden windways for aerial cities and class conflict."
  },
  {
    slug: "tidal-route-chart",
    category: "MAP",
    style: "FANTASY",
    titleZh: "潮汐航线图",
    titleEn: "Tidal Route Chart",
    descriptionZh: "随月相改写航线的海图素材，适合远航、走私、失落岛屿和时间差谜题。",
    descriptionEn: "A sea chart whose routes shift with the moon, useful for voyages, smuggling, lost islands, and timing puzzles."
  },
  {
    slug: "echo-compass",
    category: "ITEM",
    style: "CLASSICAL",
    titleZh: "回声罗盘",
    titleEn: "Echo Compass",
    descriptionZh: "指向最近一次承诺回声的物品素材，适合寻人、追踪契约和情感债务。",
    descriptionEn: "An item that points toward the echo of the latest promise, ideal for searches, vows, and emotional debts."
  },
  {
    slug: "neon-access-chip",
    category: "ITEM",
    style: "CYBERPUNK",
    titleZh: "霓虹门禁芯片",
    titleEn: "Neon Access Chip",
    descriptionZh: "嵌有城市监控权限码的门禁芯片，适合潜入、黑市交易和企业身份伪装。",
    descriptionEn: "A gate chip carrying city surveillance permissions, suited to infiltration, black market deals, and corporate disguise."
  },
  {
    slug: "night-ink-vial",
    category: "ITEM",
    style: "MYSTERY",
    titleZh: "夜墨瓶",
    titleEn: "Night Ink Vial",
    descriptionZh: "只在无光处显影的墨水素材，适合密信、禁书批注和被隐藏的地图层。",
    descriptionEn: "Ink that appears only in darkness, suited to secret letters, forbidden annotations, and hidden map layers."
  },
  {
    slug: "mistguard-beast",
    category: "CREATURE",
    style: "APOCALYPTIC",
    titleZh: "雾卫兽",
    titleEn: "Mistguard Beast",
    descriptionZh: "守在废墟边界的雾生生物，能嗅出谎言和旧血，适合作为遗迹守卫或同行者。",
    descriptionEn: "A mist-born creature guarding ruin borders, able to scent lies and old blood as a sentinel or companion."
  },
  {
    slug: "lantern-wisp",
    category: "CREATURE",
    style: "FANTASY",
    titleZh: "灯焰灵",
    titleEn: "Lantern Wisp",
    descriptionZh: "寄居在旧灯中的微光生物，会被未完成的愿望吸引，适合引路、交易和温柔怪谈。",
    descriptionEn: "A small light creature living in old lanterns, drawn to unfinished wishes for guidance, bargains, and soft uncanny tales."
  }
] as const;

export type WorkspaceScript = {
  id: string;
  slug: string;
  category: "featured" | "world" | "roleplay" | "writing" | "analysis";
  title: string;
  description: string;
  welcome: string;
  inLibrary: boolean;
  librarySource?: WorkspaceScriptLibrarySource;
};

export type WorkspaceScriptLibrarySource = "SELF_CREATED" | "COMMUNITY_ADDED";

export type WorkspaceMaterialCategory = "mask" | "map" | "item" | "creature" | "scene";

export type WorkspaceMaterialStyle =
  | "realistic"
  | "fantasy"
  | "sciFi"
  | "mystery"
  | "cyberpunk"
  | "classical"
  | "apocalyptic";

export type WorkspaceMaterialLibrarySource = WorkspaceScriptLibrarySource;

export type WorkspaceMaterial = {
  id: string;
  slug: string;
  category: WorkspaceMaterialCategory;
  style: WorkspaceMaterialStyle;
  title: string;
  description: string;
  previewUrl: string | null;
  metadata?: WorkspaceMaterialMetadata | null;
  communityVisible: boolean;
  inLibrary: boolean;
  librarySource?: WorkspaceMaterialLibrarySource;
};

export type MaskDraftPatch = {
  name?: string;
  intro?: string;
  features?: string;
  style?: WorkspaceMaterialStyle;
  body?: Partial<Record<WorkspaceMaskBodyFieldId, string>>;
  colors?: Partial<Record<WorkspaceMaskColorFieldId, string>>;
  voice?: Partial<Record<WorkspaceMaskVoiceFieldId, number>>;
  personality?: Partial<Record<WorkspaceMaskPersonalityFieldId, number>>;
};

export type MaskAiAssistResult = {
  message: string;
  patch: MaskDraftPatch;
};

export type MaskBoardGenerationResult = {
  contentType: string;
  dataUrl: string;
  fileName: string;
};

export type MaskMaterialCreateInput = {
  name: string;
  intro: string;
  features: string;
  style: WorkspaceMaterialStyle;
  body: Record<WorkspaceMaskBodyFieldId, string>;
  colors: Record<WorkspaceMaskColorFieldId, string>;
  voice: Record<WorkspaceMaskVoiceFieldId, number>;
  personality: Record<WorkspaceMaskPersonalityFieldId, number>;
  boardDrawingStyle?: WorkspaceMaskBoardDrawingStyle;
  boardImageSource?: "uploaded" | "generated" | null;
};

export type SceneMaterialCreateInput = {
  name: string;
  description: string;
  style: WorkspaceMaterialStyle;
  panoramaDrawingStyle?: WorkspaceScenePanoramaDrawingStyle;
  blocks: SceneMaterialBlockInput[];
};

export type SceneMaterialBlockInput = {
  id: string;
  name: string;
  description: string;
  panorama: SceneMaterialPanoramaInput | null;
};

export type SceneMaterialPanoramaInput = {
  faceSource: "uploaded" | "generated" | "direct-cut" | "reference-repaint";
  faces: Record<ScenePanoramaFace, string>;
};

export type SceneDraftPatch = {
  name?: string;
  description?: string;
  style?: WorkspaceMaterialStyle;
  addBlocks?: Array<{
    id?: string;
    name: string;
    description: string;
  }>;
  updateBlocks?: Array<{
    id: string;
    name?: string;
    description?: string;
  }>;
  removeBlockIds?: string[];
};

export type SceneAiAssistResult = {
  message: string;
  patch: SceneDraftPatch;
};

export type ScenePanoramaGenerationState = ScenePanoramaGenerationResult;

type WorkspaceMaskBoardDrawingStyle =
  | "photo"
  | "realistic"
  | "anime"
  | "painterly"
  | "cel"
  | "guofeng"
  | "comic"
  | "concept";
type WorkspaceScenePanoramaDrawingStyle = WorkspaceMaskBoardDrawingStyle;

type WorkspaceMaskBodyFieldId =
  | "hairStyle"
  | "browShape"
  | "faceShape"
  | "eyeShape"
  | "noseType"
  | "mouthShape"
  | "earShape"
  | "height"
  | "weight"
  | "gender"
  | "ageStage"
  | "bodyType";

type WorkspaceMaskColorFieldId = "hairColor" | "eyeColor" | "browColor" | "skinColor";
type WorkspaceMaskBoardImageSource = "uploaded" | "generated";
type WorkspaceMaskVoiceFieldId =
  | "pitch"
  | "speechSpeed"
  | "volume"
  | "intonation"
  | "emotionExposure"
  | "nasalResonance"
  | "breathiness";
type WorkspaceMaskPersonalityFieldId =
  | "extroversion"
  | "dominance"
  | "rationality"
  | "emotionalStability"
  | "confidence"
  | "affinity"
  | "sharingDesire"
  | "humor"
  | "aggression"
  | "politeness"
  | "coquetry"
  | "sensitivity"
  | "possessiveness"
  | "dependency"
  | "proactiveCare"
  | "boundaries"
  | "loyalty"
  | "action"
  | "curiosity"
  | "performative";

export type WorkspaceMaskMaterialMetadata = {
  kind: "mask";
  version: 1;
  name: string;
  intro: string;
  features: string;
  style: WorkspaceMaterialStyle;
  body: Record<WorkspaceMaskBodyFieldId, string>;
  colors: Record<WorkspaceMaskColorFieldId, string>;
  voice: Record<WorkspaceMaskVoiceFieldId, number>;
  personality: Record<WorkspaceMaskPersonalityFieldId, number>;
  boardDrawingStyle: WorkspaceMaskBoardDrawingStyle;
  boardImage: {
    source: WorkspaceMaskBoardImageSource;
    url: string;
  } | null;
};

export type WorkspaceSceneMaterialMetadata = {
  kind: "scene";
  version: 1;
  name: string;
  description: string;
  style: WorkspaceMaterialStyle;
  panoramaDrawingStyle: WorkspaceScenePanoramaDrawingStyle;
  blocks: Array<{
    id: string;
    name: string;
    description: string;
    panorama: {
      faceSource: "uploaded" | "generated" | "direct-cut" | "reference-repaint";
      faces: Record<ScenePanoramaFace, { url: string }>;
    } | null;
  }>;
};

export type WorkspaceMaterialMetadata = WorkspaceMaskMaterialMetadata | WorkspaceSceneMaterialMetadata | Record<string, unknown>;

export type MaskMaterialBoardImageMode = "keep" | "replace" | "clear";

export type WorkspaceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
  tokenUsageEstimated: boolean;
  createdAt: string;
};

export type WorkspaceTokenUsage = {
  upstream: number;
  downstream: number;
  estimated: boolean;
};

export type WorkspaceConversation = {
  id: string;
  title: string;
  scriptTitle: string;
  scriptWelcome: string;
  updatedAt: string;
  lastMessage: string;
  tokenUsage: WorkspaceTokenUsage;
  messages: WorkspaceMessage[];
};

export type WorkspaceData = {
  viewer: AuthViewer | null;
  myScripts: WorkspaceScript[];
  communityScripts: WorkspaceScript[];
  myMaterials: WorkspaceMaterial[];
  communityMaterials: WorkspaceMaterial[];
  conversations: WorkspaceConversation[];
  persistenceAvailable: boolean;
};

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

  const previewUrl = boardImageFile && boardImageFile.size > 0 ? await uploadMaskBoardImage(viewer.id, boardImageFile) : null;
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
      communityVisible: false,
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

    previewUrl = await uploadMaskBoardImage(viewer.id, boardImageFile);
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
      )
    }
  });

  revalidatePath(`/${locale}`);

  return mapMaterial(material, locale, {
    inLibrary: true,
    librarySource: "SELF_CREATED"
  });
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
        communityVisible: false,
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
        metadata: buildSceneMaterialMetadata(input)
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

export async function assistSceneDraft(input: SceneMaterialCreateInput, instruction: string, locale: Locale): Promise<SceneAiAssistResult> {
  const viewer = await requireAuth();
  const normalizedInstruction = instruction.trim();

  if (!normalizedInstruction) {
    throw new Error("SCENE_ASSIST_EMPTY_INSTRUCTION");
  }

  const reply = await generateDefaultLlmReply(
    buildSceneAssistMessages(input, normalizedInstruction, locale),
    viewer.id,
    false,
    locale,
    {
      feature: "scene.assist",
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
    patch: sanitizeSceneDraftPatch(record.patch)
  };
}

export async function generateSceneBlockPanorama(input: SceneMaterialCreateInput, blockId: string, locale: Locale): Promise<ScenePanoramaGenerationState> {
  const viewer = await requireAuth();
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

  return generateDefaultScenePanorama(
    {
      sceneName: input.name.trim(),
      sceneDescription: input.description.trim(),
      blockName: block.name.trim(),
      blockDescription: block.description.trim(),
      panoramaDrawingStyle: normalizeScenePanoramaDrawingStyle(input.panoramaDrawingStyle),
      style: input.style,
      locale
    },
    viewer.id,
    {
      feature: "scene.block.panorama.generate",
      input: {
        currentDraft: input,
        blockId,
        locale
      },
      locale
    }
  );
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

export async function setMaterialCommunitySharing(materialId: string, shared: boolean, locale: Locale) {
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
      communityVisible: shared
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
    communityVisible: material.communityVisible ?? true,
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

function buildSceneMaterialMetadata(input: SceneMaterialCreateInput): WorkspaceSceneMaterialMetadata {
  return {
    kind: "scene",
    version: 1,
    name: input.name.trim(),
    description: input.description.trim(),
    style: input.style,
    panoramaDrawingStyle: normalizeScenePanoramaDrawingStyle(input.panoramaDrawingStyle),
    blocks: input.blocks.map((block) => ({
      id: normalizeSceneBlockId(block.id),
      name: block.name.trim(),
      description: block.description.trim(),
      panorama: block.panorama
        ? {
            faceSource: block.panorama.faceSource,
            faces: scenePanoramaFaces.reduce<Record<ScenePanoramaFace, { url: string }>>((faces, face) => {
              const url = block.panorama?.faces[face]?.trim() ?? "";

              if (!url) {
                throw new Error(`SCENE_PANORAMA_FACE_REQUIRED_${face}`);
              }

              faces[face] = { url };

              return faces;
            }, {} as Record<ScenePanoramaFace, { url: string }>)
          }
        : null
    }))
  };
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

    if (block.panorama) {
      scenePanoramaFaces.forEach((face) => {
        if (!block.panorama?.faces[face]?.trim()) {
          throw new Error(`SCENE_PANORAMA_FACE_REQUIRED_${face}`);
        }
      });
    }
  });
}

function getScenePreviewUrl(blocks: SceneMaterialBlockInput[]) {
  for (const block of blocks) {
    const front = block.panorama?.faces.front?.trim();

    if (front) {
      return front;
    }
  }

  return null;
}

export async function uploadScenePanoramaFace(userId: string, file: File) {
  return uploadScenePanoramaFaceImage(userId, file);
}

export async function cleanupUploadedMaterialImages(urls: string[]) {
  await deleteMaterialImagesByUrls(urls);
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
        "You are an assistant for editing a facade material in New World Novel.",
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

function buildSceneAssistMessages(input: SceneMaterialCreateInput, instruction: string, locale: Locale): RuntimeChatMessage[] {
  const isEnglish = locale === "en-US";
  const languageRule = isEnglish ? "Respond in English." : "请使用中文回复。";

  return [
    {
      role: "system",
      content: [
        "You are an assistant for editing a scene material in New World Novel.",
        "A scene material describes an interactive fiction place and its sub-areas.",
        "Scene description and every block description must be non-empty.",
        "You may update scene name, scene description, style, block names, block descriptions, add blocks, or remove blocks.",
        "Never modify panorama image data or URLs.",
        "Return strict JSON only: {\"message\":\"short explanation\",\"patch\":{...}}.",
        "Patch may include name, description, style, addBlocks, updateBlocks, removeBlockIds.",
        "style must be one of realistic, fantasy, sciFi, mystery, cyberpunk, classical, apocalyptic.",
        "addBlocks is an array of {name, description}. updateBlocks is an array of {id, name?, description?}. removeBlockIds is an array of existing block ids.",
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
      "Create a 16:9 horizontal character setting board for an interactive novel facade.",
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
    "生成一张 16:9 横版角色设定板，用于交互小说的假面素材。",
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
        name: typeof block.name === "string" ? block.name.slice(0, 120) : ""
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
        ...(typeof block.description === "string" ? { description: block.description.slice(0, 2000) } : {})
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
