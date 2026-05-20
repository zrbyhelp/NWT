import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import zhMessages from "../messages/zh-CN.json";
import { HomeWorkspace } from "@/components/home-workspace";
import type { WorkspaceData, WorkspaceScript } from "@/lib/home-workspace";

vi.mock("next-intl", () => ({
  useLocale: () => "zh-CN",
  useTranslations: (namespace?: string) => {
    return (key: string, values?: Record<string, string | number>) => {
      const value = readMessage(namespace ? `${namespace}.${key}` : key);

      if (typeof value !== "string") {
        return key;
      }

      return Object.entries(values ?? {}).reduce(
        (text, [name, replacement]) => text.replace(`{${name}}`, String(replacement)),
        value
      );
    };
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

vi.mock("@/app/[locale]/actions", () => ({
  createHomeConversation: vi.fn(),
  deleteHomeConversation: vi.fn(),
  loginHomeAccount: vi.fn(),
  logoutHomeAccount: vi.fn(),
  registerHomeAccount: vi.fn()
}));

vi.mock("@/components/header-actions", () => ({
  HeaderActions: () => null
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn()
  }
}));

describe("HomeWorkspace script manager", () => {
  beforeEach(() => {
    class MockIntersectionObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    }

    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: MockIntersectionObserver
    });
  });

  it("opens my scripts by default and can switch to community scripts", () => {
    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "剧本" }));

    expect(screen.getByRole("heading", { level: 1, name: "我的剧本" })).toBeInTheDocument();
    expect(screen.getByText("社区添加")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看社区剧本" })).toBeInTheDocument();
    expect(screen.queryByText("世界观架构师")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看社区剧本" }));

    expect(screen.getByRole("heading", { level: 1, name: "社区剧本" })).toBeInTheDocument();
    expect(screen.getAllByText("世界观架构师").length).toBeGreaterThan(0);
    expect(screen.getByText("已加入")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /加入我的剧本/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回我的剧本" }));

    expect(screen.getByRole("heading", { level: 1, name: "我的剧本" })).toBeInTheDocument();
    expect(screen.queryByText("世界观架构师")).not.toBeInTheDocument();
  });

  it("opens the login dialog when an anonymous user starts a protected action", () => {
    render(<HomeWorkspace data={{ ...workspaceData, conversations: [], viewer: null }} />);

    fireEvent.click(screen.getByRole("button", { name: "使用 基础 AI 剧本 剧本" }));

    expect(screen.getByRole("heading", { name: "登录新世界小说" })).toBeInTheDocument();
  });
});

const baseScript: WorkspaceScript = {
  id: "base",
  slug: "base-ai-script",
  category: "featured",
  title: "基础 AI 剧本",
  description: "适合第一次进入新世界小说的通用互动剧本。",
  welcome: "已载入基础 AI 剧本。",
  inLibrary: true,
  librarySource: "COMMUNITY_ADDED"
};

const worldScript: WorkspaceScript = {
  id: "world",
  slug: "world-architect",
  category: "world",
  title: "世界观架构师",
  description: "搭建可长期演化的原创世界观。",
  welcome: "告诉我一个世界的核心规则。",
  inLibrary: false
};

const workspaceData: WorkspaceData = {
  viewer: {
    account: "reader",
    avatarUrl: null,
    displayName: "reader",
    id: "reader-id",
    role: "USER",
    showAiThinking: false
  },
  myScripts: [baseScript],
  communityScripts: [baseScript, worldScript],
  conversations: [],
  persistenceAvailable: true
};

function readMessage(path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, zhMessages);
}
