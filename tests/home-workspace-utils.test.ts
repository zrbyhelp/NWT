import { describe, expect, it } from "vitest";
import {
  buildNarrativeLlmMessages,
  createConversationTitle,
  estimateTokenCount,
  filterConversations,
  summarizeConversationTokenUsage
} from "@/lib/home-workspace-utils";

describe("home workspace utilities", () => {
  it("creates compact conversation titles from the first user message", () => {
    expect(createConversationTitle("  角色在雨夜进入旧车站  ")).toBe("角色在雨夜进入旧车站");
    expect(createConversationTitle("这是一个非常长的剧情输入，用来确认标题会被稳定截断")).toBe("这是一个非常长的剧情输入，用来确认标题会被稳定截...");
  });

  it("filters conversations by title, script title, or recent message", () => {
    const conversations = [
      { title: "雨夜车站", scriptTitle: "基础 AI 剧本", lastMessage: "寻找失踪的列车员" },
      { title: "深海档案", scriptTitle: "调查剧本", lastMessage: "潜艇收到未知信号" }
    ];

    expect(filterConversations(conversations, "基础")).toEqual([conversations[0]]);
    expect(filterConversations(conversations, "信号")).toEqual([conversations[1]]);
    expect(filterConversations(conversations, "不存在")).toEqual([]);
  });

  it("estimates token counts for mixed language content", () => {
    expect(estimateTokenCount("   ")).toBe(0);
    expect(estimateTokenCount("进入森林")).toBe(4);
    expect(estimateTokenCount("enter the forest")).toBeGreaterThan(0);
    expect(estimateTokenCount("进入 forest!")).toBeGreaterThan(2);
  });

  it("summarizes saved and estimated conversation token usage", () => {
    expect(
      summarizeConversationTokenUsage([
        {
          role: "assistant",
          content: "已收到",
          promptTokens: 120,
          completionTokens: 32,
          tokenUsageEstimated: false
        }
      ])
    ).toEqual({ upstream: 120, downstream: 32, estimated: false });

    expect(
      summarizeConversationTokenUsage([
        { role: "user", content: "进入森林" },
        { role: "assistant", content: "你走入树影。" }
      ])
    ).toEqual({ upstream: 4, downstream: 6, estimated: true });
  });

  it("builds localized narrative model messages", () => {
    const zhMessages = buildNarrativeLlmMessages({
      existingMessages: [],
      locale: "zh-CN",
      scriptTitle: "基础 AI 剧本",
      scriptWelcome: "剧本已就绪",
      userContent: "进入森林"
    });
    const enMessages = buildNarrativeLlmMessages({
      existingMessages: [],
      locale: "en-US",
      scriptTitle: "Base AI Script",
      scriptWelcome: "Script ready",
      userContent: "enter the forest"
    });

    expect(zhMessages[0].content).toContain("新世界小说");
    expect(zhMessages.at(-1)).toEqual({ role: "user", content: "进入森林" });
    expect(enMessages[0].content).toContain("New World Novel");
    expect(enMessages.at(-1)).toEqual({ role: "user", content: "enter the forest" });
  });

  it("keeps model reasoning hidden unless the viewer enables thinking content", () => {
    const hiddenMessages = buildNarrativeLlmMessages({
      existingMessages: [],
      locale: "zh-CN",
      scriptTitle: "基础 AI 剧本",
      scriptWelcome: "剧本已就绪",
      userContent: "进入森林"
    });
    const visibleMessages = buildNarrativeLlmMessages({
      existingMessages: [],
      locale: "zh-CN",
      showThinking: true,
      scriptTitle: "基础 AI 剧本",
      scriptWelcome: "剧本已就绪",
      userContent: "进入森林"
    });

    expect(hiddenMessages[0].content).toContain("不要展示私密推理过程");
    expect(visibleMessages[0].content).toContain("用户可见的思考内容");
  });
});
