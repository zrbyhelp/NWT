import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import zhMessages from "../messages/zh-CN.json";
import { AuthPanel } from "@/components/auth-panel";
import { HeaderActions } from "@/components/header-actions";

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
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

vi.mock("@/app/[locale]/actions", () => ({
  loginHomeAccount: vi.fn(async () => ({
    viewer: { account: "reader", avatarUrl: null, displayName: "reader", id: "user-id", role: "USER", showAiThinking: false }
  })),
  logoutHomeAccount: vi.fn(async () => ({ ok: true })),
  registerHomeAccount: vi.fn(async () => ({
    viewer: { account: "reader", avatarUrl: null, displayName: "reader", id: "user-id", role: "USER", showAiThinking: false }
  })),
  changeHomePassword: vi.fn(async () => ({ ok: true })),
  updateHomePreferences: vi.fn(async () => ({
    viewer: { account: "reader", avatarUrl: null, displayName: "reader", id: "user-id", role: "USER", showAiThinking: true }
  })),
  updateHomeProfile: vi.fn(async () => ({
    viewer: { account: "reader", avatarUrl: null, displayName: "reader", id: "user-id", role: "USER", showAiThinking: false }
  })),
  uploadHomeAvatar: vi.fn(async () => ({
    viewer: { account: "reader", avatarUrl: "https://cdn.example.com/avatar.gif", displayName: "reader", id: "user-id", role: "USER", showAiThinking: false }
  })),
  getHomeAdminSystemSettings: vi.fn(async () => ({
    outboundProxy: { enabled: false, httpProxy: "", httpsProxy: "", noProxy: "127.0.0.1,localhost" }
  })),
  saveHomeAdminOutboundProxySettings: vi.fn(async (outboundProxy) => ({ outboundProxy })),
  getHomeAiConfig: vi.fn(async () => ({ imageModels: [], providers: [], llmModels: [], vectorModels: [] })),
  fetchHomeProviderModels: vi.fn(async () => []),
  saveHomeAiProvider: vi.fn(),
  deleteHomeAiProvider: vi.fn(),
  saveHomeImageModel: vi.fn(),
  deleteHomeImageModel: vi.fn(),
  saveHomeLlmModel: vi.fn(),
  deleteHomeLlmModel: vi.fn(),
  saveHomeVectorModel: vi.fn(),
  deleteHomeVectorModel: vi.fn()
}));

vi.mock("@/components/theme-provider", () => ({
  useAppTheme: () => ({
    resolvedTheme: "light",
    setTheme: vi.fn(),
    theme: "system"
  })
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

describe("auth components", () => {
  it("renders the unified login entry in the auth panel", () => {
    render(<AuthPanel variant="page" />);

    expect(screen.getByRole("heading", { name: "统一登录栖境AI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前往统一登录" })).toBeInTheDocument();
    expect(screen.queryByLabelText("账号")).not.toBeInTheDocument();
  });

  it("keeps logout inside settings instead of the header account chip", () => {
    render(
      <HeaderActions
        viewer={{ account: "reader", avatarUrl: null, displayName: "reader", id: "user-id", role: "USER", showAiThinking: false }}
      />
    );

    expect(screen.queryByText("reader")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "退出登录" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
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
