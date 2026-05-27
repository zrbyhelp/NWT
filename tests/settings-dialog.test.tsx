import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import zhMessages from "../messages/zh-CN.json";
import { getHomeAdminSystemSettings, saveHomeAdminOutboundProxySettings, uploadHomeAvatar } from "@/app/[locale]/actions";
import { SettingsDialog } from "@/components/settings-dialog";
import { maxAvatarBytes } from "@/lib/storage/avatar-constraints";

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

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

vi.mock("@/app/[locale]/actions", () => ({
  changeHomePassword: vi.fn(async () => ({ ok: true })),
  getHomeAdminSystemSettings: vi.fn(async () => ({
    outboundProxy: {
      enabled: false,
      httpProxy: "",
      httpsProxy: "",
      noProxy: "127.0.0.1,localhost"
    }
  })),
  logoutHomeAccount: vi.fn(async () => ({ ok: true })),
  saveHomeAdminOutboundProxySettings: vi.fn(async (outboundProxy) => ({ outboundProxy })),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows AI provider, LLM, vector, and image model management tabs", async () => {
    render(<SettingsDialog />);

    fireEvent.click(screen.getByRole("button", { name: "设置" }));

    expect(screen.getByRole("button", { name: /账号/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /管理员/ })).not.toBeInTheDocument();
    expect(screen.getByText("前往总站")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /前往/ })).toHaveAttribute("href", "https://zrg.zrbyhelp.com/");
    expect(screen.getByText("打开文档")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开" })).toHaveAttribute("href", "http://localhost:5173");
    expect(screen.getByRole("link", { name: "打开" })).toHaveAttribute("target", "_blank");
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

  it("shows admin settings only for admin viewers and saves the global proxy form", async () => {
    render(
      <SettingsDialog
        viewer={{ account: "root", avatarUrl: null, displayName: "root", id: "admin-id", role: "ADMIN", showAiThinking: false }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("button", { name: /管理员/ }));

    expect(await screen.findByText("全局出站代理")).toBeInTheDocument();
    expect(getHomeAdminSystemSettings).toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("switch", { name: "启用代理" }));
    fireEvent.change(screen.getByLabelText("HTTP 代理"), { target: { value: "http://127.0.0.1:7890" } });
    fireEvent.submit(screen.getByRole("button", { name: "保存代理设置" }).closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(saveHomeAdminOutboundProxySettings).toHaveBeenCalledWith({
        enabled: true,
        httpProxy: "http://127.0.0.1:7890",
        httpsProxy: "",
        noProxy: "127.0.0.1,localhost"
      });
    });
    expect(toast.success).toHaveBeenCalledWith("代理设置已保存");
  });

  it("validates avatar files before submitting the upload action", () => {
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: maxAvatarBytes + 1 });

    render(
      <SettingsDialog
        viewer={{ account: "reader", avatarUrl: null, displayName: "reader", id: "user-id", role: "USER", showAiThinking: false }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("button", { name: /账号/ }));
    expect(screen.getByText("支持 gif/png/jpg/webp，最大 5MB。")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("上传头像"), { target: { files: [file] } });

    expect(toast.error).toHaveBeenCalledWith("头像文件仅支持 gif/png/jpg/webp，且不能超过 5MB。");
    expect(uploadHomeAvatar).not.toHaveBeenCalled();
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
