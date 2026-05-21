import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import zhMessages from "../messages/zh-CN.json";
import {
  assistHomeMaskDraft,
  createHomeMaskMaterial,
  deleteHomeMaterial,
  generateHomeMaskBoard,
  joinHomeMaterial,
  setHomeMaterialCommunitySharing,
  updateHomeMaskMaterial
} from "@/app/[locale]/actions";
import { HomeWorkspace } from "@/components/home-workspace";
import type { WorkspaceConversation, WorkspaceData, WorkspaceMaterial, WorkspaceScript } from "@/lib/home-workspace";

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
  assistHomeMaskDraft: vi.fn(),
  createHomeConversation: vi.fn(),
  createHomeMaskMaterial: vi.fn(),
  deleteHomeConversation: vi.fn(),
  deleteHomeMaterial: vi.fn(),
  generateHomeMaskBoard: vi.fn(),
  joinHomeMaterial: vi.fn(),
  loginHomeAccount: vi.fn(),
  logoutHomeAccount: vi.fn(),
  registerHomeAccount: vi.fn(),
  setHomeMaterialCommunitySharing: vi.fn(),
  updateHomeMaskMaterial: vi.fn()
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
    vi.clearAllMocks();

    class MockIntersectionObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    }
    class MockResizeObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    }

    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: MockIntersectionObserver
    });
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: MockResizeObserver
    });
    Element.prototype.scrollIntoView = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:mask-board");
    URL.revokeObjectURL = vi.fn();
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

  it("opens materials, shows community versions, and joins a material", async () => {
    vi.mocked(joinHomeMaterial).mockResolvedValue(joinedNightInkMaterial);
    vi.mocked(assistHomeMaskDraft).mockResolvedValue({
      message: "已自动调整假面。",
      patch: {
        intro: "银发旅人看起来疏离冷静，说话简短，动作习惯轻慢。",
        style: "mystery",
        voice: { pitch: 82 }
      }
    });
    vi.mocked(generateHomeMaskBoard).mockResolvedValue({
      contentType: "image/png",
      dataUrl: "data:image/png;base64,Ym9hcmQ=",
      fileName: "mask-board.png"
    });
    vi.mocked(createHomeMaskMaterial).mockResolvedValue(createdSilverMaskMaterial);
    vi.mocked(updateHomeMaskMaterial).mockImplementation(async (_materialId, formData) => {
      expect(formData.get("boardImageMode")).toBe("keep");
      return updatedSilverMaskMaterial;
    });
    vi.mocked(setHomeMaterialCommunitySharing).mockImplementation(async (_materialId, shared) => ({
      ...updatedSilverMaskMaterial,
      communityVisible: shared
    }));
    vi.mocked(deleteHomeMaterial).mockResolvedValue({ id: "silver-mask" });

    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));

    expect(screen.getByRole("heading", { level: 1, name: "我的素材" })).toBeInTheDocument();
    expect(screen.getByText("回声假面")).toBeInTheDocument();
    expect(screen.getAllByText("写实").length).toBeGreaterThan(0);
    expect(screen.getByText("假面")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "创建" }));

    expect(toast.info).not.toHaveBeenCalled();
    expect(screen.getByText("选择类型")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "假面" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "地图" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "物品" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "生物" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "假面" }));

    expect(screen.getByRole("heading", { name: "新建假面" })).toBeInTheDocument();
    expect(screen.queryByText("AI 辅助")).not.toBeInTheDocument();
    expect(screen.queryByText("角色设定板")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "AI 辅助" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "角色设定板" })).toBeInTheDocument();
    const saveMaskButton = screen.getByRole("button", { name: "保存假面" });
    expect(saveMaskButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("输入假面名称"), { target: { value: "银发旅人" } });
    expect(saveMaskButton).not.toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("例如：让她更冷淡、更像古风剑客，但不要写背景"), {
      target: { value: "让她更冷淡，风格偏悬疑" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送 AI 辅助消息" }));

    await waitFor(() => {
      expect(assistHomeMaskDraft).toHaveBeenCalled();
      expect(screen.getByLabelText("假面介绍")).toHaveValue("银发旅人看起来疏离冷静，说话简短，动作习惯轻慢。");
    });
    expect(screen.getByText("已自动调整假面。")).toBeInTheDocument();
    expect(screen.getByLabelText("内容风格")).toHaveValue("mystery");

    fireEvent.change(screen.getByLabelText("身高"), { target: { value: "168" } });
    fireEvent.change(screen.getByLabelText("体重"), { target: { value: "52" } });
    fireEvent.change(screen.getByLabelText("发型"), { target: { value: "银色长发" } });
    fireEvent.change(screen.getByLabelText("体型"), { target: { value: "轻盈但有力量感" } });

    expect(screen.getByLabelText("假面介绍")).toHaveValue("银发旅人看起来疏离冷静，说话简短，动作习惯轻慢。");
    expect(screen.getByText("不要填写人物背景故事、身世经历或世界关系。")).toBeInTheDocument();
    expect(screen.getByLabelText("身高")).toHaveValue("168");
    expect(screen.getByLabelText("体重")).toHaveValue("52");
    expect(screen.getByLabelText("发型")).toHaveValue("银色长发");
    expect(screen.getByLabelText("体型")).toHaveValue("轻盈但有力量感");
    expect(screen.getByText("建议：短发 / 长发 / 束发 / 微卷发")).toBeInTheDocument();

    const uploadFile = new File(["board"], "board.png", { type: "image/png" });

    fireEvent.change(screen.getByLabelText("上传设定板"), { target: { files: [uploadFile] } });
    expect(createHomeMaskMaterial).not.toHaveBeenCalled();
    expect(screen.getByText("board.png")).toBeInTheDocument();
    expect(screen.getByText("上传图片")).toBeInTheDocument();
    expect(screen.queryByText("尚未选择设定板")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "删除设定板" }));

    expect(screen.queryByText("board.png")).not.toBeInTheDocument();
    expect(screen.getByText("点击上传横版设定板")).toBeInTheDocument();

    expect(screen.getByLabelText("绘制风格")).toHaveValue("realistic");
    fireEvent.change(screen.getByLabelText("绘制风格"), { target: { value: "guofeng" } });
    expect(screen.getByLabelText("绘制风格")).toHaveValue("guofeng");

    fireEvent.click(screen.getByRole("button", { name: "生成" }));

    await waitFor(() => {
      expect(generateHomeMaskBoard).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("角色设定板已生成。");
    });
    expect(generateHomeMaskBoard).toHaveBeenCalledWith(expect.objectContaining({ boardDrawingStyle: "guofeng" }), "zh-CN");
    expect(screen.getByText("mask-board.png")).toBeInTheDocument();
    expect(screen.getByText("AI 生成")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "放大设定板" }));
    expect(screen.getByAltText("设定板预览")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭预览" }));
    expect(screen.queryByAltText("设定板预览")).not.toBeInTheDocument();

    const pitchSlider = screen.getByRole("slider", { name: "音高" });
    const speedSlider = screen.getByRole("slider", { name: "语速" });
    const extroversionSlider = screen.getByRole("slider", { name: "外向度" });
    const performativeSlider = screen.getByRole("slider", { name: "表演欲" });

    expect(screen.getAllByRole("slider")).toHaveLength(27);
    expect(speedSlider).toHaveAttribute("min", "80");
    expect(speedSlider).toHaveAttribute("max", "220");
    expect(screen.getByText("基础人格")).toBeInTheDocument();
    expect(screen.getByText("社交表现")).toBeInTheDocument();
    expect(screen.getByText("情绪表现")).toBeInTheDocument();
    expect(screen.getByText("关系表现")).toBeInTheDocument();
    expect(screen.getByText("行为倾向")).toBeInTheDocument();

    fireEvent.change(pitchSlider, { target: { value: "82" } });
    fireEvent.change(speedSlider, { target: { value: "180" } });
    fireEvent.change(extroversionSlider, { target: { value: "70" } });
    fireEvent.change(performativeSlider, { target: { value: "15" } });

    expect(pitchSlider).toHaveValue("82");
    expect(speedSlider).toHaveValue("180");
    expect(extroversionSlider).toHaveValue("70");
    expect(performativeSlider).toHaveValue("15");
    expect(screen.getByText("82/100")).toBeInTheDocument();
    expect(screen.getByText("180 字/分钟")).toBeInTheDocument();
    expect(screen.getByText("70/100")).toBeInTheDocument();
    expect(screen.getByText("15/100")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "选择肤色 #B77955" }));
    expect(screen.getByText("#B77955")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("瞳色颜色选择器"), { target: { value: "#3f7a4b" } });
    expect(screen.getByText("#3F7A4B")).toBeInTheDocument();

    fireEvent.click(saveMaskButton);

    await waitFor(() => {
      expect(createHomeMaskMaterial).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("假面已创建并加入我的素材。");
    });
    expect(screen.queryByRole("heading", { name: "新建假面" })).not.toBeInTheDocument();
    expect(screen.getByText("银发旅人")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /银发旅人/ }));

    expect(screen.getByRole("button", { name: "放大素材图片" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "放大素材图片" }));
    expect(screen.getByAltText("素材图片预览")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭素材图片预览" }));
    expect(screen.queryByAltText("素材图片预览")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    expect(screen.getByRole("heading", { name: "编辑假面" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入假面名称")).toHaveValue("银发旅人");
    expect(screen.getByLabelText("假面介绍")).toHaveValue("疏离冷静，说话简短。");
    expect(screen.getByLabelText("内容风格")).toHaveValue("mystery");
    expect(screen.getByLabelText("身高")).toHaveValue("168");
    expect(screen.getByLabelText("绘制风格")).toHaveValue("guofeng");
    expect(screen.getByText("AI 生成")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("输入假面名称"), { target: { value: "银发旅人·改" } });
    fireEvent.change(screen.getByLabelText("假面介绍"), { target: { value: "更冷淡，语气更克制。" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => {
      expect(updateHomeMaskMaterial).toHaveBeenCalledWith("silver-mask", expect.any(FormData), "zh-CN");
      expect(toast.success).toHaveBeenCalledWith("假面修改已保存。");
    });
    expect(screen.queryByRole("heading", { name: "编辑假面" })).not.toBeInTheDocument();
    expect(screen.getAllByText("银发旅人·改").length).toBeGreaterThan(0);
    expect(screen.getAllByText("银发旅人·改更冷淡，语气更克制。").length).toBeGreaterThan(0);

    const shareSwitch = screen.getByRole("switch", { name: "分享到社区" });

    expect(shareSwitch).not.toBeChecked();
    fireEvent.click(shareSwitch);

    await waitFor(() => {
      expect(setHomeMaterialCommunitySharing).toHaveBeenCalledWith("silver-mask", true, "zh-CN");
      expect(toast.success).toHaveBeenCalledWith("素材已分享到社区。");
    });
    expect(screen.getByRole("switch", { name: "分享到社区" })).toBeChecked();
    expect(screen.getByText("已分享")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "删除" })).not.toBeDisabled();
    });

    vi.stubGlobal("confirm", vi.fn(() => true));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(deleteHomeMaterial).toHaveBeenCalledWith("silver-mask", "zh-CN");
      expect(toast.success).toHaveBeenCalledWith("素材已删除。");
    });
    expect(screen.queryByText("银发旅人·改")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "地图" }));

    expect(toast.info).toHaveBeenCalledWith("素材创建功能将在后续版本开放。");

    fireEvent.click(screen.getByRole("button", { name: "查看社区版本" }));

    expect(screen.getByRole("heading", { level: 1, name: "社区素材" })).toBeInTheDocument();
    expect(screen.getByText("夜墨瓶")).toBeInTheDocument();
    expect(screen.getAllByText("悬疑").length).toBeGreaterThan(0);
    expect(screen.getByText("物品")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("搜索素材"), { target: { value: "物品" } });

    expect(screen.getByText("夜墨瓶")).toBeInTheDocument();
    expect(screen.queryByText("回声假面")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("搜索素材"), { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: /夜墨瓶/ }));
    expect(screen.queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加入我的素材" }));

    await waitFor(() => {
      expect(joinHomeMaterial).toHaveBeenCalledWith("night-ink", "zh-CN");
      expect(toast.success).toHaveBeenCalledWith("素材已加入我的素材库。");
    });
    expect(screen.getByRole("button", { name: "已加入" })).toBeDisabled();
  }, 20000);

  it("opens the login dialog when an anonymous user starts a protected action", () => {
    render(<HomeWorkspace data={{ ...workspaceData, conversations: [], viewer: null }} />);

    fireEvent.click(screen.getByRole("button", { name: "使用 基础 AI 剧本 剧本" }));

    expect(screen.getByRole("heading", { name: "登录新世界小说" })).toBeInTheDocument();
  });

  it("guides users to settings when no default LLM is configured", async () => {
    mockStreamError("missing-default-llm");

    render(<HomeWorkspace data={{ ...workspaceData, conversations: [conversation] }} />);

    fireEvent.change(screen.getByPlaceholderText("输入你想推进的角色、场景或冲突..."), {
      target: { value: "让角色进入图书馆" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("还没有可用的默认 LLM 模型，请前往右上角体验设置的 LLM 模型页添加并设为默认。");
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

const echoMaskMaterial: WorkspaceMaterial = {
  id: "echo-mask",
  slug: "echo-mask",
  category: "mask",
  style: "realistic",
  title: "回声假面",
  description: "可以记录并复现他人口吻的身份素材。",
  previewUrl: null,
  communityVisible: true,
  inLibrary: true,
  librarySource: "COMMUNITY_ADDED"
};

const nightInkMaterial: WorkspaceMaterial = {
  id: "night-ink",
  slug: "night-ink-vial",
  category: "item",
  style: "mystery",
  title: "夜墨瓶",
  description: "只在无光处显影的墨水素材。",
  previewUrl: null,
  communityVisible: true,
  inLibrary: false
};

const joinedNightInkMaterial: WorkspaceMaterial = {
  ...nightInkMaterial,
  inLibrary: true,
  librarySource: "COMMUNITY_ADDED"
};

const createdSilverMaskMaterial: WorkspaceMaterial = {
  id: "silver-mask",
  slug: "mask-silver",
  category: "mask",
  style: "mystery",
  title: "银发旅人",
  description: "银发旅人看起来疏离冷静，说话简短，动作习惯轻慢。",
  previewUrl: "https://cdn.example.com/mask-board.png",
  communityVisible: false,
  metadata: {
    kind: "mask",
    version: 1,
    name: "银发旅人",
    intro: "疏离冷静，说话简短。",
    style: "mystery",
    body: {
      ageStage: "青年",
      bodyType: "轻盈但有力量感",
      browShape: "平眉",
      earShape: "圆耳",
      eyeShape: "细长眼",
      faceShape: "鹅蛋脸",
      gender: "女性",
      hairStyle: "银色长发",
      height: "168",
      mouthShape: "薄唇",
      noseType: "直鼻",
      weight: "52"
    },
    boardDrawingStyle: "guofeng",
    boardImage: {
      source: "generated",
      url: "https://cdn.example.com/mask-board.png"
    },
    colors: {
      browColor: "#5C4033",
      eyeColor: "#3D6EA8",
      hairColor: "#F2F0E8",
      skinColor: "#D8AA78"
    },
    personality: {
      action: 50,
      affinity: 50,
      aggression: 50,
      boundaries: 50,
      confidence: 50,
      coquetry: 50,
      curiosity: 50,
      dependency: 50,
      dominance: 50,
      emotionalStability: 70,
      extroversion: 30,
      humor: 40,
      loyalty: 60,
      performative: 20,
      politeness: 80,
      possessiveness: 40,
      proactiveCare: 45,
      rationality: 80,
      sensitivity: 60,
      sharingDesire: 20
    },
    voice: {
      breathiness: 50,
      emotionExposure: 35,
      intonation: 35,
      nasalResonance: 20,
      pitch: 65,
      speechSpeed: 150,
      volume: 40
    }
  },
  inLibrary: true,
  librarySource: "SELF_CREATED"
};

const updatedSilverMaskMaterial: WorkspaceMaterial = {
  ...createdSilverMaskMaterial,
  title: "银发旅人·改",
  description: "银发旅人·改更冷淡，语气更克制。",
  metadata: {
    ...(createdSilverMaskMaterial.metadata as Record<string, unknown>),
    name: "银发旅人·改",
    intro: "更冷淡，语气更克制。"
  }
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
  myMaterials: [echoMaskMaterial],
  communityMaterials: [echoMaskMaterial, nightInkMaterial],
  conversations: [],
  persistenceAvailable: true
};

const conversation: WorkspaceConversation = {
  id: "conversation-id",
  title: "基础 AI 剧本",
  scriptTitle: "基础 AI 剧本",
  scriptWelcome: "已载入基础 AI 剧本。",
  updatedAt: "2026-05-21T00:00:00.000Z",
  lastMessage: "已载入基础 AI 剧本。",
  tokenUsage: { downstream: 0, estimated: false, upstream: 0 },
  messages: []
};

function mockStreamError(message: string) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", message })}\n`));
      controller.close();
    }
  });

  vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
}

function readMessage(path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, zhMessages);
}
