import type { Locale } from "@/i18n/routing";

export type SearchableConversation = {
  title: string;
  scriptTitle: string;
  lastMessage: string;
};

export type NarrativePromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function createConversationTitle(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 24 ? `${compact.slice(0, 24)}...` : compact;
}

export function filterConversations<T extends SearchableConversation>(conversations: T[], search: string) {
  const keyword = search.trim().toLowerCase();

  if (!keyword) {
    return conversations;
  }

  return conversations.filter((conversation) =>
    [conversation.title, conversation.scriptTitle, conversation.lastMessage].some((value) =>
      value.toLowerCase().includes(keyword)
    )
  );
}

export function estimateTokenCount(content: string) {
  const normalized = content.trim();

  if (!normalized) {
    return 0;
  }

  const cjkMatches = normalized.match(/[\u3400-\u9fff]/g) ?? [];
  const latinMatches = normalized.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) ?? [];
  const symbolMatches = normalized.match(/[^\sA-Za-z0-9\u3400-\u9fff]/g) ?? [];

  return cjkMatches.length + Math.ceil(latinMatches.join(" ").length / 4) + symbolMatches.length;
}

export type TokenUsageMessage = {
  role: "user" | "assistant";
  content: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  tokenUsageEstimated?: boolean;
};

export type ConversationTokenUsage = {
  upstream: number;
  downstream: number;
  estimated: boolean;
};

export function emptyTokenUsage(): ConversationTokenUsage {
  return {
    upstream: 0,
    downstream: 0,
    estimated: false
  };
}

export function summarizeConversationTokenUsage(messages: TokenUsageMessage[]): ConversationTokenUsage {
  return messages.reduce<ConversationTokenUsage>((usage, message) => {
    const hasSavedUsage = typeof message.promptTokens === "number" || typeof message.completionTokens === "number";

    if (hasSavedUsage) {
      return {
        upstream: usage.upstream + (message.promptTokens ?? 0),
        downstream: usage.downstream + (message.completionTokens ?? 0),
        estimated: usage.estimated || Boolean(message.tokenUsageEstimated) || message.promptTokens == null || message.completionTokens == null
      };
    }

    if (message.role === "user") {
      return {
        ...usage,
        upstream: usage.upstream + estimateTokenCount(message.content),
        estimated: true
      };
    }

    return {
      ...usage,
      downstream: usage.downstream + estimateTokenCount(message.content),
      estimated: true
    };
  }, emptyTokenUsage());
}

export function buildNarrativeLlmMessages({
  existingMessages,
  locale,
  showThinking,
  scriptTitle,
  scriptWelcome,
  userContent
}: {
  existingMessages: Array<{ role: "user" | "assistant"; content: string }>;
  locale: Locale;
  showThinking?: boolean;
  scriptTitle: string;
  scriptWelcome: string;
  userContent: string;
}): NarrativePromptMessage[] {
  const systemPrompt =
    locale === "en-US"
      ? [
          "You are the narrative engine for New World Novel, an AI interactive fiction workspace.",
          `Current script: ${scriptTitle}.`,
          `Script opening: ${scriptWelcome}.`,
          showThinking
            ? "If the model provider exposes reasoning content, it may be shown to the user as visible thinking content."
            : "Think through the narrative logic internally before answering, but do not reveal private reasoning.",
          "Continue the story through immersive, interactive prose. Keep the reply concise, actionable, and suitable for the next user choice."
        ].join("\n")
      : [
          "你是“新世界小说”的叙事引擎，负责推进 AI 交互式小说体验。",
          `当前剧本：${scriptTitle}。`,
          `剧本开场：${scriptWelcome}。`,
          showThinking
            ? "如果模型供应商返回 reasoning_content，可将其作为用户可见的思考内容展示。"
            : "请先在内部思考剧情逻辑，但不要展示私密推理过程。",
          "请用沉浸、可交互的中文叙事推进剧情，回复要紧凑、可继续选择，并自然承接用户输入。"
        ].join("\n");
  const recentMessages = existingMessages.slice(-12).map((message) => ({
    role: message.role,
    content: message.content
  }));

  return [
    { role: "system", content: systemPrompt },
    ...recentMessages,
    { role: "user", content: userContent }
  ];
}
