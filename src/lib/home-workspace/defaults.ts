import type { WorkspaceSceneScalePreset, WorkspaceScriptLibrarySource } from "./types";

export const baseScriptSlug = "base-ai-script";
export const defaultUserId = "default-local";
export const defaultUserSlug = "default-local";
export const assistantRole = "assistant";
export const userRole = "user";
export const communityAddedSource = "COMMUNITY_ADDED" satisfies WorkspaceScriptLibrarySource;
export const defaultSceneScalePreset = "mid" satisfies WorkspaceSceneScalePreset;
export const sceneScalePresetMeters: Record<WorkspaceSceneScalePreset, number> = {
  aerial: 500,
  closeUp: 2,
  mid: 25,
  near: 8,
  wide: 100
};

export const builtInScripts = [
  {
    slug: baseScriptSlug,
    titleZh: "基础 AI 剧本",
    titleEn: "Base AI Script",
    descriptionZh: "适合第一次进入工作台的通用互动剧本，AI 会围绕角色、地点和事件推进内容。",
    descriptionEn:
      "A general interactive script for first-time workspace sessions, focused on characters, places, and events.",
    welcomeZh: "已载入基础 AI 剧本。你可以输入角色、场景或冲突，我会把它推进为可交互剧情。",
    welcomeEn:
      "Base AI Script is loaded. Send a character, scene, or conflict and I will turn it into an interactive experience."
  },
  {
    slug: "world-architect",
    titleZh: "世界观架构师",
    titleEn: "World Architect",
    descriptionZh: "从文明、地理、规则和势力关系出发，搭建可长期演化的原创世界观。",
    descriptionEn: "Build evolving original worlds from civilizations, geography, rules, and faction relationships.",
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
    descriptionEn: "Plan chapter pacing, hooks, character arcs, and next-episode beats for serial writing.",
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
