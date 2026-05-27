"use client";

import {
  Bot,
  BookOpen,
  Brain,
  DatabaseZap,
  ExternalLink,
  Info,
  Image as ImageIcon,
  KeyRound,
  Languages,
  Loader2,
  LogIn,
  LogOut,
  Moon,
  Monitor,
  Network,
  Box,
  Palette,
  Settings,
  ShieldCheck,
  Sun,
  Type,
  UploadCloud,
  UserRound,
  X
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import {
  changeHomePassword,
  getHomeAdminSystemSettings,
  logoutHomeAccount,
  saveHomeAdminOutboundProxySettings,
  updateHomePreferences,
  updateHomeProfile,
  uploadHomeAvatar
} from "@/app/[locale]/actions";
import { AiConfigManager } from "@/components/ai-config-manager";
import { useAppTheme } from "@/components/theme-provider";
import { UserAvatar } from "@/components/user-avatar";
import { routing, type Locale } from "@/i18n/routing";
import { localePath, switchLocalePath } from "@/lib/locale-path";
import { isValidAvatarFile } from "@/lib/storage/avatar-constraints";
import { colorThemes, typographyPresets } from "@/lib/theme-options";
import type { AuthViewer } from "@/lib/auth-types";
import type { OutboundProxySettings } from "@/lib/system-settings-types";
import { cn } from "@/lib/utils";

const languageNames: Record<Locale, string> = {
  "zh-CN": "中文",
  "en-US": "English"
};

const paletteStorageKey = "nwt-palette";
const typographyStorageKey = "nwt-typography";
const mainSiteUrl = "https://zrg.zrbyhelp.com/";
const docsSiteUrl = "http://localhost:5173";
const defaultOutboundProxyForm = {
  enabled: false,
  httpProxy: "",
  httpsProxy: "",
  noProxy: "127.0.0.1,localhost"
} satisfies OutboundProxySettings;
type PaletteId = (typeof colorThemes)[number]["id"];
type TypographyId = (typeof typographyPresets)[number]["id"];
type SettingsTab = "general" | "account" | "admin" | "appearance" | "about";
type AiSettingsTab = "providers" | "llm" | "vectors" | "images";
type MeshSettingsTab = "instantMesh";
type AnySettingsTab = SettingsTab | AiSettingsTab | MeshSettingsTab;

export function SettingsDialog({
  onLoginClick,
  onViewerChange,
  openSignal = 0,
  viewer
}: {
  onLoginClick?: () => void;
  onViewerChange?: (viewer: AuthViewer | null) => void;
  openSignal?: number;
  viewer?: AuthViewer | null;
}) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("home.settings");
  const actionsT = useTranslations("home.actions");
  const authT = useTranslations("home.auth");
  const { setTheme, theme, resolvedTheme } = useAppTheme();
  const isAdmin = viewer?.role === "ADMIN";
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AnySettingsTab>("general");
  const [palette, setPalette] = useState<PaletteId>(colorThemes[0].id);
  const [typography, setTypography] = useState<TypographyId>(typographyPresets[1].id);
  const [profileForm, setProfileForm] = useState({ avatarUrl: "", displayName: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [adminProxyForm, setAdminProxyForm] = useState<OutboundProxySettings>({ ...defaultOutboundProxyForm });
  const [adminSettingsLoaded, setAdminSettingsLoaded] = useState(false);
  const [adminSettingsLoading, setAdminSettingsLoading] = useState(false);
  const [isAdminSettingsPending, startAdminSettingsTransition] = useTransition();
  const [preferencePending, startPreferenceTransition] = useTransition();
  const [isAccountPending, startAccountTransition] = useTransition();
  const lastSavedDisplayNameRef = useRef("");
  const lastOpenSignalRef = useRef(openSignal);
  const tabs: Array<{ id: AnySettingsTab; icon: React.ElementType }> = [
    { id: "general", icon: Languages },
    { id: "account", icon: UserRound },
    ...(isAdmin ? [{ id: "admin" as const, icon: ShieldCheck }] : []),
    { id: "appearance", icon: Palette },
    { id: "providers", icon: KeyRound },
    { id: "llm", icon: Bot },
    { id: "vectors", icon: DatabaseZap },
    { id: "images", icon: ImageIcon },
    { id: "instantMesh", icon: Box },
    { id: "about", icon: Info }
  ];
  const activeSettingsTab: AnySettingsTab = activeTab === "admin" && !isAdmin ? "general" : activeTab;

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
    if (!open || activeSettingsTab !== "admin" || !isAdmin || adminSettingsLoaded) {
      return;
    }

    let cancelled = false;

    getHomeAdminSystemSettings()
      .then((result) => {
        if (cancelled) {
          return;
        }

        setAdminProxyForm(result.outboundProxy);
        setAdminSettingsLoaded(true);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(resolveAdminSettingsError(error, t));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAdminSettingsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSettingsTab, adminSettingsLoaded, isAdmin, open, t]);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    window.localStorage.setItem(paletteStorageKey, palette);
  }, [palette]);

  useEffect(() => {
    const preset = typographyPresets.find((item) => item.id === typography) ?? typographyPresets[1];
    const effectiveFontScale = preset.fontScale * (1 + (preset.density - 1) * 0.5);

    document.documentElement.style.setProperty("--app-font-scale", String(effectiveFontScale));
    document.documentElement.style.setProperty("--app-line-height", String(preset.lineHeight));
    document.documentElement.style.setProperty("--app-density", String(preset.density));
    window.localStorage.setItem(typographyStorageKey, typography);
  }, [typography]);

  useEffect(() => {
    if (!open || !viewer) {
      return;
    }

    const displayName = profileForm.displayName.trim();

    if (!displayName || displayName === lastSavedDisplayNameRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      startAccountTransition(async () => {
        try {
          const result = await updateHomeProfile({
            avatarUrl: profileForm.avatarUrl,
            displayName
          });
          lastSavedDisplayNameRef.current = result.viewer.displayName;
          onViewerChange?.(result.viewer);
          toast.success(t("account.profileSaved"));
          router.refresh();
        } catch (error) {
          toast.error(resolveAccountError(error, t));
        }
      });
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [onViewerChange, open, profileForm.avatarUrl, profileForm.displayName, router, t, viewer]);

  function openSettings() {
    setProfileForm({
      avatarUrl: viewer?.avatarUrl ?? "",
      displayName: viewer?.displayName ?? viewer?.account ?? ""
    });
    lastSavedDisplayNameRef.current = viewer?.displayName ?? viewer?.account ?? "";
    setPasswordForm({ currentPassword: "", newPassword: "" });
    setAdminSettingsLoaded(false);
    setAdminSettingsLoading(activeSettingsTab === "admin" && isAdmin);
    setOpen(true);
  }

  useEffect(() => {
    if (openSignal === lastOpenSignalRef.current) {
      return;
    }

    lastOpenSignalRef.current = openSignal;
    setProfileForm({
      avatarUrl: viewer?.avatarUrl ?? "",
      displayName: viewer?.displayName ?? viewer?.account ?? ""
    });
    lastSavedDisplayNameRef.current = viewer?.displayName ?? viewer?.account ?? "";
    setPasswordForm({ currentPassword: "", newPassword: "" });
    setAdminSettingsLoaded(false);
    setAdminSettingsLoading(activeSettingsTab === "admin" && isAdmin);
    setOpen(true);
  }, [activeSettingsTab, isAdmin, openSignal, viewer]);

  function selectSettingsTab(nextTab: AnySettingsTab) {
    setActiveTab(nextTab);
    setAdminSettingsLoading(nextTab === "admin" && isAdmin && !adminSettingsLoaded);
  }

  function handleAvatarUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!isValidAvatarFile(file)) {
      toast.error(t("account.errors.invalidAvatarFile"));
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    startAccountTransition(async () => {
      try {
        const result = await uploadHomeAvatar(formData);
        onViewerChange?.(result.viewer);
        setProfileForm((current) => ({
          ...current,
          avatarUrl: result.viewer.avatarUrl ?? ""
        }));
        toast.success(t("account.avatarUploaded"));
        router.refresh();
      } catch (error) {
        toast.error(resolveAccountError(error, t));
      }
    });
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startAccountTransition(async () => {
      try {
        await changeHomePassword(passwordForm);
        setPasswordForm({ currentPassword: "", newPassword: "" });
        setPasswordDialogOpen(false);
        toast.success(t("account.passwordSaved"));
      } catch (error) {
        toast.error(resolveAccountError(error, t));
      }
    });
  }

  function handleLogout() {
    startAccountTransition(async () => {
      const result = await logoutHomeAccount();
      onViewerChange?.(null);
      setOpen(false);
      toast.success(authT("logoutSuccess"));
      window.location.assign(result.logoutUrl ?? localePath(locale));
    });
  }

  function requestLoginFromSettings() {
    setOpen(false);

    if (onLoginClick) {
      onLoginClick();
      return;
    }

    router.push(localePath(locale, "/login") as never);
  }

  function handleThinkingPreferenceChange(enabled: boolean) {
    if (!viewer) {
      requestLoginFromSettings();
      return;
    }

    startPreferenceTransition(async () => {
      try {
        const result = await updateHomePreferences({ showAiThinking: enabled });
        onViewerChange?.(result.viewer);
        toast.success(t("preferenceSaved"));
        router.refresh();
      } catch (error) {
        toast.error(resolveAccountError(error, t));
      }
    });
  }

  function handleAdminProxySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startAdminSettingsTransition(async () => {
      try {
        const result = await saveHomeAdminOutboundProxySettings(adminProxyForm);

        setAdminProxyForm(result.outboundProxy);
        setAdminSettingsLoaded(true);
        toast.success(t("admin.saved"));
      } catch (error) {
        toast.error(resolveAdminSettingsError(error, t));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openSettings}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground/72 transition hover:bg-muted hover:text-foreground"
        aria-label={t("title")}
        title={t("title")}
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm">
          <section
            className="flex h-[40rem] max-h-[88vh] w-full max-w-[37.333rem] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
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
                    onClick={() => selectSettingsTab(id)}
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition hover:bg-muted",
                      activeSettingsTab === id && "bg-muted font-medium"
                    )}
                  >
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    {t(`tabs.${id}`)}
                  </button>
                ))}
              </nav>

              <div className="scrollbar-autohide min-h-0 overflow-y-auto p-4">
                {activeSettingsTab === "general" ? (
                  <div className="space-y-3">
                    <SettingInlineRow
                      action={
                        <select
                          value={locale}
                          aria-label={actionsT("language")}
                          onChange={(event) => router.push(switchLocalePath(pathname, event.target.value as Locale) as never)}
                          className="h-9 w-32 rounded-md border border-border bg-background px-2.5 text-sm outline-none"
                        >
                          {routing.locales.map((item) => (
                            <option key={item} value={item}>
                              {languageNames[item]}
                            </option>
                          ))}
                        </select>
                      }
                      icon={Languages}
                      title={actionsT("language")}
                    />

                    <SettingInlineRow
                      action={
                        <a
                          href={mainSiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground/72 transition hover:bg-muted hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("mainSiteAction")}
                        </a>
                      }
                      icon={ExternalLink}
                      title={t("mainSite")}
                    />

                    <SettingInlineRow
                      action={
                        <a
                          href={docsSiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground/72 transition hover:bg-muted hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("docsAction")}
                        </a>
                      }
                      description={t("docsDescription")}
                      icon={BookOpen}
                      title={t("docs")}
                    />

                    <SettingInlineRow
                      action={
                        <ToggleSwitch
                          ariaLabel={t("showThinking")}
                          checked={viewer?.showAiThinking ?? false}
                          disabled={preferencePending}
                          onChange={handleThinkingPreferenceChange}
                        />
                      }
                      description={t("showThinkingDescription")}
                      icon={Brain}
                      title={t("showThinking")}
                    />

                    {viewer ? (
                      <SettingInlineRow
                        action={
                          <button
                            type="button"
                            onClick={handleLogout}
                            disabled={isAccountPending}
                            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground/72 transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55"
                          >
                            {isAccountPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <LogOut className="h-3.5 w-3.5" aria-hidden="true" />}
                            {t("logoutAction")}
                          </button>
                        }
                        icon={LogOut}
                        title={authT("logout")}
                      />
                    ) : null}
                  </div>
                ) : null}

                {activeSettingsTab === "admin" && isAdmin ? (
                  <AdminProxySettingsPanel
                    form={adminProxyForm}
                    loading={adminSettingsLoading}
                    saving={isAdminSettingsPending}
                    onChange={setAdminProxyForm}
                    onSubmit={handleAdminProxySubmit}
                    t={t}
                  />
                ) : null}

                {activeSettingsTab === "account" ? (
                  <div className="space-y-5">
                    {viewer ? (
                      <>
                        <SettingSection icon={UserRound} title={t("account.profileTitle")}>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 px-1 py-1">
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <UserAvatar
                                  avatarUrl={profileForm.avatarUrl}
                                  name={profileForm.displayName || viewer.account}
                                  className="h-12 w-12 text-base"
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{profileForm.displayName || viewer.account}</p>
                                  <p className="truncate text-xs text-foreground/48">{viewer.account}</p>
                                </div>
                              </div>
                              <label className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground/72 transition hover:bg-muted hover:text-foreground">
                                {isAccountPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />}
                                {t("account.uploadAvatar")}
                                <input
                                  type="file"
                                  accept="image/gif,image/jpeg,image/png,image/webp"
                                  className="sr-only"
                                  disabled={isAccountPending}
                                  onChange={(event) => {
                                    handleAvatarUpload(event.currentTarget.files?.[0]);
                                    event.currentTarget.value = "";
                                  }}
                                />
                              </label>
                            </div>
                            <p className="px-1 text-xs leading-5 text-foreground/50">{t("account.avatarHint")}</p>
                            <label className="flex min-h-10 items-center justify-between gap-3 px-1 py-1">
                              <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground/82">
                                <Type className="h-4 w-4 text-primary" aria-hidden="true" />
                                {t("account.displayName")}
                              </span>
                              <input
                                type="text"
                                value={profileForm.displayName}
                                onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))}
                                maxLength={40}
                                required
                                className="h-9 w-40 min-w-0 max-w-[55%] rounded-md border border-border bg-background px-2.5 text-right text-sm outline-none transition placeholder:text-foreground/34 focus:border-primary"
                              />
                            </label>
                          </div>
                        </SettingSection>

                        <section className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="flex items-center gap-2 text-sm font-medium">
                                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                                {t("account.passwordTitle")}
                              </h3>
                              <p className="mt-1 text-xs text-foreground/50">{t("account.passwordDescription")}</p>
                            </div>
                          </div>
                        </section>
                      </>
                    ) : (
                      <SettingSection icon={LogIn} title={t("account.loginTitle")} description={t("account.loginDescription")}>
                        <button
                          type="button"
                          onClick={requestLoginFromSettings}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary/90"
                        >
                          <LogIn className="h-4 w-4" aria-hidden="true" />
                          {authT("login")}
                        </button>
                      </SettingSection>
                    )}
                  </div>
                ) : null}

                {activeSettingsTab === "appearance" ? (
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

                {activeSettingsTab === "providers" || activeSettingsTab === "llm" || activeSettingsTab === "vectors" || activeSettingsTab === "images" || activeSettingsTab === "instantMesh" ? (
                  <AiConfigManager mode={activeSettingsTab} viewer={viewer} />
                ) : null}

                {activeSettingsTab === "about" ? (
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
                        <AboutItem
                          label={t("aboutItems.star.label")}
                          value={t("aboutItems.star.value")}
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

      {passwordDialogOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm">
          <section
            className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("account.passwordTitle")}
              </h3>
              <button
                type="button"
                onClick={() => setPasswordDialogOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/58 transition hover:bg-muted hover:text-foreground"
                aria-label={t("close")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <form className="space-y-3" onSubmit={handlePasswordSubmit}>
              <FormTextField
                label={t("account.currentPassword")}
                type="password"
                value={passwordForm.currentPassword}
                onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))}
                required
              />
              <FormTextField
                label={t("account.newPassword")}
                type="password"
                value={passwordForm.newPassword}
                onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))}
                required
              />
              <FormActionButton loading={isAccountPending} label={t("account.savePassword")} icon={KeyRound} />
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function AdminProxySettingsPanel({
  form,
  loading,
  onChange,
  onSubmit,
  saving,
  t
}: {
  form: OutboundProxySettings;
  loading: boolean;
  onChange: (form: OutboundProxySettings) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  t: (key: string) => string;
}) {
  const disabled = loading || saving;

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <SettingSection icon={ShieldCheck} title={t("admin.title")} description={t("admin.description")} />

      <SettingSection icon={Network} title={t("admin.outboundProxyTitle")} description={t("admin.outboundProxyDescription")}>
        {loading ? (
          <div className="flex h-24 items-center justify-center gap-2 text-sm text-foreground/55">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("admin.loading")}
          </div>
        ) : (
          <div className="space-y-3">
            <SettingInlineRow
              action={
                <ToggleSwitch
                  ariaLabel={t("admin.enabled")}
                  checked={form.enabled}
                  disabled={disabled}
                  onChange={(enabled) => onChange({ ...form, enabled })}
                />
              }
              icon={Network}
              title={t("admin.enabled")}
            />

            <FormTextField
              label={t("admin.httpProxy")}
              value={form.httpProxy}
              onChange={(httpProxy) => onChange({ ...form, httpProxy })}
              placeholder={t("admin.httpProxyPlaceholder")}
              disabled={disabled}
            />
            <FormTextField
              label={t("admin.httpsProxy")}
              value={form.httpsProxy}
              onChange={(httpsProxy) => onChange({ ...form, httpsProxy })}
              placeholder={t("admin.httpsProxyPlaceholder")}
              disabled={disabled}
            />
            <label className="space-y-1.5 text-sm">
              <span className="text-foreground/64">{t("admin.noProxy")}</span>
              <textarea
                value={form.noProxy}
                onChange={(event) => onChange({ ...form, noProxy: event.target.value })}
                placeholder={t("admin.noProxyPlaceholder")}
                disabled={disabled}
                rows={3}
                className="min-h-20 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-foreground/34 focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <FormActionButton loading={disabled} label={t("admin.save")} icon={ShieldCheck} />
          </div>
        )}
      </SettingSection>
    </form>
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

function SettingInlineRow({
  action,
  description,
  icon: Icon,
  title
}: {
  action: React.ReactNode;
  description?: string;
  icon: React.ElementType;
  title: string;
}) {
  return (
    <section className="flex min-h-10 items-center justify-between gap-3 px-1 py-1">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </h3>
        {description ? <p className="mt-0.5 line-clamp-2 text-xs text-foreground/50">{description}</p> : null}
      </div>
      <div className="shrink-0">{action}</div>
    </section>
  );
}

function ToggleSwitch({
  ariaLabel,
  checked,
  disabled,
  onChange
}: {
  ariaLabel: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full border transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-55",
        checked ? "border-primary/70 bg-primary" : "border-foreground/28 bg-foreground/36"
      )}
    >
      <span
        className="absolute inset-0 rounded-full"
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full border border-foreground/18 bg-white shadow-sm transition dark:bg-background",
            checked ? "left-[1.375rem]" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

function FormTextField({
  disabled,
  label,
  maxLength,
  onChange,
  placeholder,
  required,
  type = "text",
  value
}: {
  disabled?: boolean;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "password" | "text";
  value: string;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="text-foreground/64">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        minLength={required ? 1 : undefined}
        disabled={disabled}
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition placeholder:text-foreground/34 focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function FormActionButton({
  icon: Icon,
  label,
  loading
}: {
  icon: React.ElementType;
  label: string;
  loading: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/38"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
      {label}
    </button>
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

function resolveAccountError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("INVALID_CURRENT_PASSWORD")) {
    return t("account.errors.invalidCurrentPassword");
  }

  if (message.includes("INVALID_PASSWORD")) {
    return t("account.errors.invalidPassword");
  }

  if (message.includes("INVALID_AVATAR_URL")) {
    return t("account.errors.invalidAvatarUrl");
  }

  if (message.includes("INVALID_AVATAR_FILE")) {
    return t("account.errors.invalidAvatarFile");
  }

  if (message.includes("INVALID_DISPLAY_NAME")) {
    return t("account.errors.invalidDisplayName");
  }

  return t("account.errors.generic");
}

function resolveAdminSettingsError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("FORBIDDEN")) {
    return t("admin.errors.forbidden");
  }

  if (message.includes("OUTBOUND_PROXY_URL_REQUIRED")) {
    return t("admin.errors.urlRequired");
  }

  if (message.includes("OUTBOUND_PROXY_URL_INVALID")) {
    return t("admin.errors.invalidUrl");
  }

  return t("admin.errors.generic");
}
