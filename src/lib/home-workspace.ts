import "server-only";

import { revalidatePath } from "next/cache";
import type { Locale } from "@/i18n/routing";
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

const baseScriptSlug = "base-ai-script";
const defaultUserId = "default-local";
const defaultUserSlug = "default-local";
const assistantRole = "assistant";
const userRole = "user";
const communityAddedSource = "COMMUNITY_ADDED" satisfies WorkspaceScriptLibrarySource;

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
  conversations: WorkspaceConversation[];
  persistenceAvailable: boolean;
};

export async function getHomeWorkspaceData(locale: Locale): Promise<WorkspaceData> {
  try {
    const viewer = await getCurrentViewer();
    const workspaceUserId = viewer?.id ?? defaultUserId;

    await ensureHomeWorkspaceDefaults(workspaceUserId);

    const [communityScripts, libraryEntries, conversations] = await Promise.all([
      prisma.storyScript.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.storyScriptLibraryEntry.findMany({
        where: { userId: workspaceUserId },
        include: { script: true },
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
    generateDefaultLlmReply(messages, viewer.id, viewer.showAiThinking, locale)
  );
}

export async function streamConversationMessage(
  conversationId: string,
  content: string,
  locale: Locale,
  onDelta: (content: string) => void
) {
  return createConversationReply(conversationId, content, locale, (messages, viewer) =>
    streamDefaultLlmReply(messages, onDelta, viewer.id, viewer.showAiThinking, locale)
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

async function ensureHomeWorkspaceDefaults(userId = defaultUserId) {
  await ensureConfiguredAdminUser();

  const [scripts] = await Promise.all([
    Promise.all(
      builtInScripts.map((script) =>
        prisma.storyScript.upsert({
          where: { slug: script.slug },
          update: {},
          create: script
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

  return {
    viewer: null,
    myScripts: fallbackScripts.filter((script) => script.inLibrary),
    communityScripts: fallbackScripts,
    conversations: [],
    persistenceAvailable: false
  };
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
