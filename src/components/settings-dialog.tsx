"use client";

import { Bot, DatabaseZap, Info, KeyRound, Languages, Moon, Monitor, Palette, Settings, Sun, Type, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AiConfigManager } from "@/components/ai-config-manager";
import { useAppTheme } from "@/components/theme-provider";
import { routing, type Locale } from "@/i18n/routing";
import { switchLocalePath } from "@/lib/locale-path";
import { colorThemes, typographyPresets } from "@/lib/theme-options";
import { cn } from "@/lib/utils";

const languageNames: Record<Locale, string> = {
  "zh-CN": "中文",
  "en-US": "English"
};

const paletteStorageKey = "nwt-palette";
const typographyStorageKey = "nwt-typography";
type PaletteId = (typeof colorThemes)[number]["id"];
type TypographyId = (typeof typographyPresets)[number]["id"];
type SettingsTab = "general" | "appearance" | "about";
type AiSettingsTab = "providers" | "llm" | "vectors";
type AnySettingsTab = SettingsTab | AiSettingsTab;

export function SettingsDialog() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("home.settings");
  const actionsT = useTranslations("home.actions");
  const { setTheme, theme, resolvedTheme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AnySettingsTab>("general");
  const [palette, setPalette] = useState<PaletteId>(colorThemes[0].id);
  const [typography, setTypography] = useState<TypographyId>(typographyPresets[1].id);
  const tabs = [
    { id: "general", icon: Languages },
    { id: "appearance", icon: Palette },
    { id: "providers", icon: KeyRound },
    { id: "llm", icon: Bot },
    { id: "vectors", icon: DatabaseZap },
    { id: "about", icon: Info }
  ] as const;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedPalette = window.localStorage.getItem(paletteStorageKey);
      const storedTypography = window.localStorage.getItem(typographyStorageKey);

      if (colorThemes.some((item) => item.id === storedPalette)) {
        setPalette(storedPalette as (typeof colorThemes)[number]["id"]);
      }

      if (typographyPresets.some((item) => item.id === storedTypography)) {
        setTypography(storedTypography as (typeof typographyPresets)[number]["id"]);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    window.localStorage.setItem(paletteStorageKey, palette);
  }, [palette]);

  useEffect(() => {
    const preset = typographyPresets.find((item) => item.id === typography) ?? typographyPresets[1];
    document.documentElement.style.setProperty("--app-font-scale", String(preset.fontScale));
    document.documentElement.style.setProperty("--app-line-height", String(preset.lineHeight));
    document.documentElement.style.setProperty("--app-density", String(preset.density));
    window.localStorage.setItem(typographyStorageKey, typography);
  }, [typography]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground/72 transition hover:bg-muted hover:text-foreground"
        aria-label={t("title")}
        title={t("title")}
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <section
            className="flex h-[40rem] max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex h-14 items-center justify-between border-b border-border px-4">
              <h2 className="text-base font-semibold">{t("title")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/58 transition hover:bg-muted hover:text-foreground"
                aria-label={t("close")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 md:grid-cols-[11rem_minmax(0,1fr)]">
              <nav className="scrollbar-autohide flex gap-1 overflow-x-auto border-b border-border p-2 md:flex-col md:border-b-0 md:border-r">
                {tabs.map(({ id, icon: Icon }) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition hover:bg-muted",
                      activeTab === id && "bg-muted font-medium"
                    )}
                  >
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    {t(`tabs.${id}`)}
                  </button>
                ))}
              </nav>

              <div className="scrollbar-autohide min-h-0 overflow-y-auto p-4">
                {activeTab === "general" ? (
                  <div className="space-y-5">
                    <SettingSection icon={Languages} title={actionsT("language")}>
                      <select
                        value={locale}
                        aria-label={actionsT("language")}
                        onChange={(event) => router.push(switchLocalePath(pathname, event.target.value as Locale) as never)}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none"
                      >
                        {routing.locales.map((item) => (
                          <option key={item} value={item}>
                            {languageNames[item]}
                          </option>
                        ))}
                      </select>
                    </SettingSection>
                  </div>
                ) : null}

                {activeTab === "appearance" ? (
                  <div className="space-y-5">
                    <SettingSection icon={Monitor} title={t("mode")} description={t("current", { mode: t(`modeValue.${resolvedTheme}`) })}>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "system", icon: Monitor },
                          { id: "light", icon: Sun },
                          { id: "dark", icon: Moon }
                        ].map(({ id, icon: Icon }) => (
                          <button
                            type="button"
                            key={id}
                            onClick={() => setTheme(id as "system" | "light" | "dark")}
                            className={cn(
                              "rounded-xl border border-border px-3 py-3 text-left text-sm transition hover:bg-muted/50",
                              theme === id && "border-primary bg-primary/10 text-primary"
                            )}
                          >
                            <Icon className="mb-2 h-4 w-4" aria-hidden="true" />
                            {t(`modeOption.${id}`)}
                          </button>
                        ))}
                      </div>
                    </SettingSection>

                    <SettingSection icon={Palette} title={t("palette")}>
                      <div className="grid grid-cols-2 gap-2">
                        {colorThemes.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => setPalette(item.id)}
                            className={cn(
                              "rounded-xl border border-border px-3 py-3 text-left text-sm transition hover:bg-muted/50",
                              palette === item.id && "border-primary bg-primary/10 text-primary"
                            )}
                          >
                            <span className="mb-3 flex gap-1">
                              {item.swatches.map((swatch) => (
                                <span key={swatch} className="h-3 w-6 rounded-sm" style={{ background: swatch }} />
                              ))}
                            </span>
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </SettingSection>

                    <SettingSection icon={Type} title={t("typography")}>
                      <div className="grid grid-cols-3 gap-2">
                        {typographyPresets.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => setTypography(item.id)}
                            className={cn(
                              "rounded-xl border border-border px-3 py-2 text-sm transition hover:bg-muted/50",
                              typography === item.id && "border-primary bg-primary/10 text-primary"
                            )}
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </SettingSection>
                  </div>
                ) : null}

                {activeTab === "providers" || activeTab === "llm" || activeTab === "vectors" ? (
                  <AiConfigManager mode={activeTab} />
                ) : null}

                {activeTab === "about" ? (
                  <div className="space-y-5">
                    <SettingSection icon={Info} title={t("aboutTitle")} description={t("aboutDescription")}>
                      <div className="grid gap-x-6 lg:grid-cols-2">
                        <AboutItem label={t("aboutItems.product.label")} value={t("aboutItems.product.value")} />
                        <AboutItem label={t("aboutItems.author.label")} value={t("aboutItems.author.value")} />
                        <AboutItem label={t("aboutItems.license.label")} value={t("aboutItems.license.value")} />
                        <AboutItem label={t("aboutItems.qq.label")} value={t("aboutItems.qq.value")} />
                        <AboutItem label={t("aboutItems.wechat.label")} value={t("aboutItems.wechat.value")} />
                        <AboutItem
                          label={t("aboutItems.email.label")}
                          value={t("aboutItems.email.value")}
                          href={`mailto:${t("aboutItems.email.value")}`}
                        />
                        <AboutItem
                          label={t("aboutItems.repository.label")}
                          value={t("aboutItems.repository.value")}
                          href={t("aboutItems.repository.value")}
                        />
                        <AboutItem label={t("aboutItems.vision.label")} value={t("aboutItems.vision.value")} />
                      </div>
                    </SettingSection>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function SettingSection({
  children,
  description,
  icon: Icon,
  title
}: {
  children?: React.ReactNode;
  description?: string;
  icon: React.ElementType;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </h3>
        {description ? <p className="mt-1 text-xs text-foreground/50">{description}</p> : null}
      </div>
      {children ? children : null}
    </section>
  );
}

function AboutItem({ href, label, value }: { href?: string; label: string; value: string }) {
  const content = href ? (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="break-all text-sm font-medium text-primary hover:underline"
    >
      {value}
    </a>
  ) : (
    <p className="break-words text-sm font-medium text-foreground/82">{value}</p>
  );

  return (
    <div className="border-b border-border/70 py-2.5">
      <p className="text-xs text-foreground/46">{label}</p>
      <div className="mt-1">{content}</div>
    </div>
  );
}
