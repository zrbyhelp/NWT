import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import zhMessages from "../messages/zh-CN.json";
import { SettingsDialog } from "@/components/settings-dialog";

const emptyConfig = {
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
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/components/theme-provider", () => ({
  useAppTheme: () => ({
    resolvedTheme: "light",
    setTheme: vi.fn(),
    theme: "system"
  })
}));

vi.mock("@/app/[locale]/actions", () => ({
  getHomeAiConfig: vi.fn(async () => emptyConfig),
  saveHomeAiProvider: vi.fn(async () => emptyConfig),
  deleteHomeAiProvider: vi.fn(async () => emptyConfig),
  saveHomeLlmModel: vi.fn(async () => emptyConfig),
  deleteHomeLlmModel: vi.fn(async () => emptyConfig),
  saveHomeVectorModel: vi.fn(async () => emptyConfig),
  deleteHomeVectorModel: vi.fn(async () => emptyConfig)
}));

describe("SettingsDialog", () => {
  it("shows AI provider, LLM, and vector model management tabs", async () => {
    render(<SettingsDialog />);

    fireEvent.click(screen.getByRole("button", { name: "体验设置" }));

    expect(screen.getByRole("button", { name: /AI 供应商/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /LLM 模型/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /向量模型/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /AI 供应商/ }));
    expect(await screen.findByText("AI 供应商管理")).toBeInTheDocument();
    expect(screen.getByText("还没有 AI 供应商")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /LLM 模型/ }));
    expect(await screen.findByText("LLM 模型管理")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /向量模型/ }));
    expect(await screen.findByText("向量模型管理")).toBeInTheDocument();
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
