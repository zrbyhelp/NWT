import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import zhMessages from "../messages/zh-CN.json";
import { SettingsDialog } from "@/components/settings-dialog";

const emptyConfig = {
  imageModels: [],
  providers: [],
  llmModels: [],
  vectorModels: []
};

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
  usePathname: () => "/zh-CN",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

vi.mock("@/components/theme-provider", () => ({
  useAppTheme: () => ({
    resolvedTheme: "light",
    setTheme: vi.fn(),
    theme: "system"
  })
}));

vi.mock("@/app/[locale]/actions", () => ({
  changeHomePassword: vi.fn(async () => ({ ok: true })),
  logoutHomeAccount: vi.fn(async () => ({ ok: true })),
  updateHomePreferences: vi.fn(async () => ({
    viewer: { account: "reader", avatarUrl: null, displayName: "reader", id: "user-id", role: "USER", showAiThinking: true }
  })),
  updateHomeProfile: vi.fn(async () => ({
    viewer: { account: "reader", avatarUrl: null, displayName: "reader", id: "user-id", role: "USER", showAiThinking: false }
  })),
  uploadHomeAvatar: vi.fn(async () => ({
    viewer: { account: "reader", avatarUrl: "https://cdn.example.com/avatar.gif", displayName: "reader", id: "user-id", role: "USER", showAiThinking: false }
  })),
  getHomeAiConfig: vi.fn(async () => emptyConfig),
  fetchHomeProviderModels: vi.fn(async () => []),
  saveHomeAiProvider: vi.fn(async () => emptyConfig),
  deleteHomeAiProvider: vi.fn(async () => emptyConfig),
  saveHomeImageModel: vi.fn(async () => emptyConfig),
  deleteHomeImageModel: vi.fn(async () => emptyConfig),
  saveHomeLlmModel: vi.fn(async () => emptyConfig),
  deleteHomeLlmModel: vi.fn(async () => emptyConfig),
  saveHomeVectorModel: vi.fn(async () => emptyConfig),
  deleteHomeVectorModel: vi.fn(async () => emptyConfig)
}));

describe("SettingsDialog", () => {
  it("shows AI provider, LLM, vector, and image model management tabs", async () => {
    render(<SettingsDialog />);

    fireEvent.click(screen.getByRole("button", { name: "体验设置" }));

    expect(screen.getByRole("button", { name: /账号/ })).toBeInTheDocument();
    expect(screen.getByText("前往总站")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /前往/ })).toHaveAttribute("href", "https://zrg.zrbyhelp.com/");
    expect(screen.getByRole("switch", { name: "显示思考内容" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: /AI 供应商/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /LLM 模型/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /向量模型/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /图片模型/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /AI 供应商/ }));
    expect(await screen.findByText("AI 供应商管理")).toBeInTheDocument();
    expect(screen.getByText("还没有 AI 供应商")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /LLM 模型/ }));
    expect(await screen.findByText("LLM 模型管理")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /向量模型/ }));
    expect(await screen.findByText("向量模型管理")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /图片模型/ }));
    expect(await screen.findByText("图片模型管理")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /关于/ }));
    expect(screen.getByText("点亮 Star")).toBeInTheDocument();
  });
});

function readMessage(path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, zhMessages);
}
