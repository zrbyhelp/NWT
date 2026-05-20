"use client";

import {
  ArrowLeft,
  Bot,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Globe2,
  FileText,
  Loader2,
  MessageSquarePlus,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SendHorizontal,
  Sparkles,
  Star,
  Trash2,
  X
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createHomeConversation, deleteHomeConversation } from "@/app/[locale]/actions";
import { AuthDialog } from "@/components/auth-dialog";
import { HeaderActions } from "@/components/header-actions";
import { UserAvatar } from "@/components/user-avatar";
import type { Locale } from "@/i18n/routing";
import { authRequiredEventName } from "@/lib/auth-client";
import { authRequiredCode, isAuthRequiredError, type AuthViewer } from "@/lib/auth-types";
import type { WorkspaceConversation, WorkspaceData, WorkspaceScript } from "@/lib/home-workspace";
import { formatDisplayTime } from "@/lib/format";
import { createConversationTitle, filterConversations } from "@/lib/home-workspace-utils";
import { cn } from "@/lib/utils";

type ViewMode = "scriptPicker" | "scriptManager" | "chat";
type ScriptManagerView = "mine" | "community";
type StreamingReply = {
  content: string;
  conversationId: string;
};
type MessageStreamEvent =
  | { type: "delta"; content: string }
  | { type: "done"; conversation: WorkspaceConversation }
  | { type: "error"; message: string };
const scriptCategories = ["featured", "world", "roleplay", "writing", "analysis"] as const;
const scriptPickerPageSize = 6;

export function HomeWorkspace({ data }: { data: WorkspaceData }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const t = useTranslations("home.workspace");
  const scriptT = useTranslations("home.scripts");
  const homeT = useTranslations("home");
  const authT = useTranslations("home.auth");
  const myScripts = data.myScripts;
  const communityScripts = data.communityScripts;
  const [viewer, setViewer] = useState(data.viewer);
  const [conversations, setConversations] = useState(data.conversations);
  const [activeConversationId, setActiveConversationId] = useState(data.conversations[0]?.id ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>(data.conversations.length > 0 ? "chat" : "scriptPicker");
  const [scriptManagerView, setScriptManagerView] = useState<ScriptManagerView>("mine");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [streamingReply, setStreamingReply] = useState<StreamingReply | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [scriptSearch, setScriptSearch] = useState("");
  const [scriptCategory, setScriptCategory] = useState("featured");
  const [scriptPickerPage, setScriptPickerPage] = useState(0);
  const [detailScriptId, setDetailScriptId] = useState("");
  const [titleMenuOpen, setTitleMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleMenuRef = useRef<HTMLDivElement>(null);
  const scriptScrollRef = useRef<HTMLDivElement>(null);
  const scriptSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const optimisticIdRef = useRef(0);
  const pendingAuthActionRef = useRef<((viewer: AuthViewer) => void) | null>(null);
  const persistenceAvailable = data.persistenceAvailable;
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const activeConversation = conversations.find((item) => item.id === activeConversationId);
  const scriptPickerScripts = myScripts.length > 0 ? myScripts : communityScripts;
  const managerScripts = scriptManagerView === "community" ? communityScripts : myScripts;
  const allScripts = useMemo(() => mergeScripts(communityScripts, myScripts), [communityScripts, myScripts]);
  const detailScript = allScripts.find((script) => script.id === detailScriptId);
  const scriptsByCategory = useMemo(() => {
    const keyword = scriptSearch.trim().toLowerCase();
    const filtered = keyword
      ? managerScripts.filter((script) =>
          [script.title, script.description, script.welcome].some((value) => value.toLowerCase().includes(keyword))
        )
      : managerScripts;

    return scriptCategories
      .map((category) => ({
        category,
        scripts: category === "featured" ? filtered.slice(0, 4) : filtered.filter((script) => script.category === category)
      }))
      .filter((group) => group.scripts.length > 0);
  }, [managerScripts, scriptSearch]);
  const filteredConversations = useMemo(() => {
    return filterConversations(conversations, search);
  }, [conversations, search]);
  const groupedConversations = useMemo(() => {
    return groupConversations(filteredConversations);
  }, [filteredConversations]);
  const scriptPickerPageCount = Math.max(1, Math.ceil(scriptPickerScripts.length / scriptPickerPageSize));
  const normalizedScriptPickerPage = Math.min(scriptPickerPage, scriptPickerPageCount - 1);
  const visiblePickerScripts = scriptPickerScripts.slice(
    normalizedScriptPickerPage * scriptPickerPageSize,
    normalizedScriptPickerPage * scriptPickerPageSize + scriptPickerPageSize
  );
  const shouldShowScriptPager = scriptPickerScripts.length > scriptPickerPageSize;
  const activeTokenUsage = activeConversation?.tokenUsage ?? { upstream: 0, downstream: 0, estimated: false };
  const activeStreamingReply = streamingReply?.conversationId === activeConversation?.id ? streamingReply : null;
  const isBusy = isPending || Boolean(streamingReply);
  const tokenStatsKey = activeTokenUsage.estimated ? "tokenStatsEstimated" : "tokenStats";
  const tokenUsageLabel = t(tokenStatsKey, {
    downstream: new Intl.NumberFormat(locale).format(activeTokenUsage.downstream),
    upstream: new Intl.NumberFormat(locale).format(activeTokenUsage.upstream)
  });
  const promptSuggestions = [t("suggestions.character"), t("suggestions.conflict"), t("suggestions.world")];
  const isCommunityScriptView = scriptManagerView === "community";

  function requestAuth(afterLogin?: (viewer: AuthViewer) => void) {
    pendingAuthActionRef.current = afterLogin ?? null;
    setAuthDialogOpen(true);
  }

  function handleAuthenticated(nextViewer: AuthViewer) {
    const pendingAction = pendingAuthActionRef.current;

    pendingAuthActionRef.current = null;
    setViewer(nextViewer);
    setAuthDialogOpen(false);
    router.refresh();
    pendingAction?.(nextViewer);
  }

  function handleViewerChange(nextViewer: AuthViewer | null) {
    setViewer(nextViewer);

    if (!nextViewer) {
      setConversations([]);
      setActiveConversationId("");
      setViewMode("scriptPicker");
      setScriptManagerView("community");
    }
  }

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [draft]);

  useEffect(() => {
    if (!titleMenuOpen) {
      return;
    }

    function closeOnOutsidePointer(event: MouseEvent) {
      if (!titleMenuRef.current?.contains(event.target as Node)) {
        setTitleMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setTitleMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [titleMenuOpen]);

  useEffect(() => {
    function openAuthDialog() {
      requestAuth();
    }

    window.addEventListener(authRequiredEventName, openAuthDialog);

    return () => window.removeEventListener(authRequiredEventName, openAuthDialog);
  }, []);

  useEffect(() => {
    if (viewMode !== "scriptManager") {
      return;
    }

    const root = scriptScrollRef.current;

    if (!root) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const category = visibleEntry?.target.getAttribute("data-script-category");

        if (category) {
          setScriptCategory(category);
        }
      },
      {
        root,
        rootMargin: "-128px 0px -55% 0px",
        threshold: [0.12, 0.28, 0.5]
      }
    );

    Object.values(scriptSectionRefs.current).forEach((section) => {
      if (section) {
        observer.observe(section);
      }
    });

    return () => observer.disconnect();
  }, [scriptsByCategory, viewMode]);

  function showScriptSelection() {
    setTitleMenuOpen(false);
    setActiveConversationId("");
    setViewMode("scriptPicker");
  }

  function showScriptManager() {
    setTitleMenuOpen(false);
    setActiveConversationId("");
    setScriptManagerView(viewer ? "mine" : "community");
    setScriptCategory("featured");
    setScriptSearch("");
    setViewMode("scriptManager");
  }

  function showCommunityScripts() {
    setDetailScriptId("");
    setScriptManagerView("community");
    setScriptCategory("featured");
    setScriptSearch("");
  }

  function showMyScripts() {
    if (!viewer) {
      requestAuth(() => {
        setDetailScriptId("");
        setScriptManagerView("mine");
        setScriptCategory("featured");
        setScriptSearch("");
      });
      return;
    }

    setDetailScriptId("");
    setScriptManagerView("mine");
    setScriptCategory("featured");
    setScriptSearch("");
  }

  function selectConversation(conversationId: string) {
    setTitleMenuOpen(false);
    setActiveConversationId(conversationId);
    setViewMode("chat");
  }

  function handleCreateConversation(scriptId: string, authenticatedViewer = viewer) {
    if (!authenticatedViewer) {
      requestAuth((nextViewer) => handleCreateConversation(scriptId, nextViewer));
      return;
    }

    if (!persistenceAvailable) {
      toast.error(t("errors.persistence"));
      return;
    }

    startTransition(async () => {
      try {
        const conversation = await createHomeConversation(scriptId, locale);
        setConversations((current) => [conversation, ...current]);
        setTitleMenuOpen(false);
        setActiveConversationId(conversation.id);
        setViewMode("chat");
      } catch (error) {
        if (isAuthRequiredError(error)) {
          requestAuth((nextViewer) => handleCreateConversation(scriptId, nextViewer));
          return;
        }

        toast.error(t("errors.create"));
      }
    });
  }

  function handleSendMessage(authenticatedViewer = viewer) {
    if (!activeConversation || !draft.trim()) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => handleSendMessage(nextViewer));
      return;
    }

    const content = draft.trim();
    const previousConversation = activeConversation;
    optimisticIdRef.current += 1;
    const createdAt = new Date().toISOString();
    const optimisticConversation = {
      ...activeConversation,
      title: activeConversation.messages.length === 0 ? createConversationTitle(content) : activeConversation.title,
      updatedAt: createdAt,
      lastMessage: content,
      messages: [
        ...activeConversation.messages,
        {
          id: `optimistic-${optimisticIdRef.current}`,
          role: "user" as const,
          content,
          promptTokens: null,
          completionTokens: null,
          tokenUsageEstimated: false,
          createdAt
        }
      ]
    };

    setDraft("");
    setConversations((current) => [
      optimisticConversation,
      ...current.filter((item) => item.id !== optimisticConversation.id)
    ]);
    setStreamingReply({ conversationId: activeConversation.id, content: "" });

    void (async () => {
      try {
        const conversation = await streamHomeMessage(activeConversation.id, content, locale, (delta) => {
          setStreamingReply((current) =>
            current?.conversationId === activeConversation.id
              ? { ...current, content: current.content + delta }
              : current
          );
        });
        setConversations((current) => [
          conversation,
          ...current.filter((item) => item.id !== conversation.id)
        ]);
        setActiveConversationId(conversation.id);
        setViewMode("chat");
      } catch (error) {
        setDraft(content);
        setConversations((current) => [
          previousConversation,
          ...current.filter((item) => item.id !== previousConversation.id)
        ]);
        if (isAuthRequiredError(error)) {
          requestAuth((nextViewer) => handleSendMessage(nextViewer));
          return;
        }

        toast.error(t("errors.send"));
      } finally {
        setStreamingReply(null);
      }
    })();
  }

  function handleDeleteConversation(authenticatedViewer = viewer) {
    if (!activeConversation) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => handleDeleteConversation(nextViewer));
      return;
    }

    if (!persistenceAvailable) {
      toast.error(t("errors.persistence"));
      return;
    }

    const shouldDelete = window.confirm(t("conversationActions.confirmDelete"));

    if (!shouldDelete) {
      return;
    }

    const conversationId = activeConversation.id;
    const remainingConversations = conversations.filter((conversation) => conversation.id !== conversationId);
    const nextConversationId = remainingConversations[0]?.id ?? "";

    setTitleMenuOpen(false);

    startTransition(async () => {
      try {
        await deleteHomeConversation(conversationId, locale);
        setConversations(remainingConversations);
        setActiveConversationId(nextConversationId);
        setViewMode(nextConversationId ? "chat" : "scriptPicker");
        toast.success(t("conversationActions.deleted"));
      } catch (error) {
        if (isAuthRequiredError(error)) {
          requestAuth((nextViewer) => handleDeleteConversation(nextViewer));
          return;
        }

        toast.error(t("errors.delete"));
      }
    });
  }

  function scrollToScriptCategory(category: string) {
    const section = scriptSectionRefs.current[category];

    if (!section) {
      return;
    }

    setScriptCategory(category);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showPreviousScriptPage() {
    setScriptPickerPage((page) => (page === 0 ? scriptPickerPageCount - 1 : page - 1));
  }

  function showNextScriptPage() {
    setScriptPickerPage((page) => (page + 1) % scriptPickerPageCount);
  }

  return (
    <div className={cn("grid min-h-screen bg-background", sidebarCollapsed ? "lg:grid-cols-[4.5rem_minmax(0,1fr)]" : "lg:grid-cols-[17rem_minmax(0,1fr)]")}>
      <aside className="flex max-h-[42vh] min-h-[16rem] flex-col border-b border-border bg-muted/45 lg:h-screen lg:max-h-none lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center justify-between px-3">
          <button
            type="button"
            onClick={sidebarCollapsed ? () => setSidebarCollapsed(false) : showScriptSelection}
            className="group inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition hover:bg-background"
            aria-label={homeT("kicker")}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-white">
              {sidebarCollapsed ? (
                <>
                  <Sparkles className="h-4 w-4 group-hover:hidden group-focus:hidden" aria-hidden="true" />
                  <PanelLeftOpen className="hidden h-4 w-4 group-hover:block group-focus:block" aria-hidden="true" />
                </>
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
          </button>

          {!sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground/70 transition hover:bg-background hover:text-foreground"
              aria-label={t("sidebar.collapse")}
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={showScriptSelection}
            className={cn(
              "inline-flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm transition hover:bg-background",
              sidebarCollapsed ? "justify-center" : "justify-start"
            )}
            title={t("newMessage")}
          >
            <MessageSquarePlus className="h-4 w-4 text-foreground/58" aria-hidden="true" />
            {!sidebarCollapsed ? t("newMessage") : null}
          </button>

          <button
            type="button"
            onClick={showScriptManager}
            className={cn(
              "mt-1 inline-flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm transition hover:bg-background",
              viewMode === "scriptManager" && "bg-background shadow-sm",
              sidebarCollapsed ? "justify-center" : "justify-start"
            )}
            title={t("scripts")}
          >
            <BookOpen className="h-4 w-4 text-foreground/58" aria-hidden="true" />
            {!sidebarCollapsed ? t("scripts") : null}
          </button>

          <label
            className={cn(
              "mt-2 flex h-10 items-center gap-2 rounded-md px-3 text-sm transition focus-within:bg-background hover:bg-background",
              sidebarCollapsed && "hidden lg:hidden"
            )}
          >
            <Search className="h-4 w-4 text-foreground/46" aria-hidden="true" />
            <span className="sr-only">{t("searchLabel")}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/42"
            />
          </label>
        </div>

        {!persistenceAvailable && !sidebarCollapsed ? (
          <div className="mx-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-foreground/70">
            {t("persistenceUnavailable")}
          </div>
        ) : null}

        <div className={cn("flex items-center justify-between px-3 pb-2 pt-3", sidebarCollapsed && "hidden lg:hidden")}>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-foreground/56">
            <MessagesSquare className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("conversationList")}
          </div>
          <span className="rounded-md px-2 py-1 text-xs text-foreground/50">
            {filteredConversations.length}
          </span>
        </div>

        <div className={cn("scrollbar-autohide min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3", sidebarCollapsed && "hidden lg:hidden")}>
          {filteredConversations.length === 0 ? (
            <div className="mx-1 rounded-md px-3 py-3 text-sm text-foreground/58">
              {search.trim() ? t("emptySearch") : t("emptyConversations")}
            </div>
          ) : (
            groupedConversations.map((group) => (
              <div key={group.key} className="space-y-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-medium text-foreground/38">
                  {t(`groups.${group.key}`)}
                </p>
                {group.conversations.map((conversation) => (
                  <button
                    type="button"
                    key={conversation.id}
                    onClick={() => selectConversation(conversation.id)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left transition hover:bg-background",
                      activeConversationId === conversation.id && viewMode === "chat"
                        ? "bg-background shadow-sm"
                        : "bg-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm">{conversation.title}</p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-foreground/44">{conversation.scriptTitle}</p>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className={cn("border-t border-border/70 p-3", sidebarCollapsed && "hidden lg:hidden")}>
          <div className="flex items-center gap-3 px-1 py-1">
            <UserAvatar
              avatarUrl={viewer?.avatarUrl}
              name={viewer?.displayName ?? viewer?.account ?? t("account.anonymous")}
              className="h-10 w-10"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground/82">
                {viewer?.displayName ?? t("account.anonymous")}
              </p>
              <p className="truncate text-xs text-foreground/46">
                {viewer?.account ?? t("account.loginHint")}
              </p>
            </div>
            {!viewer ? (
              <button
                type="button"
                onClick={() => requestAuth()}
                className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-primary/90"
              >
                {authT("login")}
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <section className="relative flex min-h-[58vh] flex-col bg-background lg:h-screen lg:min-h-screen">
        {viewMode !== "scriptManager" ? (
          <header className="flex h-14 shrink-0 items-center justify-between px-4">
            <div className="relative min-w-0" ref={titleMenuRef}>
              {viewMode === "chat" && activeConversation ? (
                <>
                  <button
                    type="button"
                    onClick={() => setTitleMenuOpen((open) => !open)}
                    className="-ml-2 flex max-w-full items-center rounded-md px-2 py-2 text-left transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                    aria-expanded={titleMenuOpen}
                    aria-haspopup="menu"
                    aria-label={t("conversationActions.open")}
                  >
                    <span className="flex max-w-full items-center gap-1.5 text-sm font-medium text-foreground/82">
                      <span className="truncate">{activeConversation.scriptTitle}</span>
                      <ChevronDown
                        className={cn("h-3.5 w-3.5 shrink-0 text-foreground/42 transition", titleMenuOpen && "rotate-180")}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                  {titleMenuOpen ? (
                    <div
                      className="absolute left-0 top-full z-30 mt-2 w-56 rounded-xl border border-border bg-background p-1 shadow-xl shadow-foreground/10"
                      role="menu"
                    >
                      <button
                        type="button"
                        onClick={() => handleDeleteConversation()}
                        disabled={isPending || !persistenceAvailable}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-55 dark:text-red-400"
                        role="menuitem"
                      >
                        <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block font-medium">{t("conversationActions.delete")}</span>
                          <span className="block truncate text-xs text-foreground/42">
                            {t("conversationActions.deleteHint")}
                          </span>
                        </span>
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="truncate text-sm font-medium text-foreground/82">{homeT("title")}</p>
                  <p className="hidden text-xs text-foreground/48 sm:block">{t("scriptKicker")}</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="hidden h-7 items-center rounded-full bg-muted px-2.5 text-xs font-medium text-foreground/58 md:inline-flex"
                title={t("tokenStatsHint")}
              >
                {tokenUsageLabel}
              </span>
              <HeaderActions viewer={viewer} onLoginClick={() => requestAuth()} onViewerChange={handleViewerChange} />
            </div>
          </header>
        ) : null}

        {viewMode === "scriptManager" ? (
          <div ref={scriptScrollRef} className="scrollbar-autohide min-h-0 flex-1 overflow-y-auto px-4">
            <div className="absolute right-4 top-3 z-40 flex max-w-[calc(100%-2rem)] flex-wrap items-center justify-end gap-2">
              {isCommunityScriptView ? (
                <button
                  type="button"
                  onClick={showMyScripts}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {scriptT("backToMine")}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => toast.info(scriptT("createSoon"))}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-sm font-medium text-background transition hover:bg-foreground/88"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {scriptT("create")}
                  </button>
                  <button
                    type="button"
                    onClick={showCommunityScripts}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted"
                  >
                    <Globe2 className="h-4 w-4" aria-hidden="true" />
                    {scriptT("viewCommunity")}
                  </button>
                </>
              )}
            </div>
            <div className="mx-auto w-full max-w-4xl">
              <div className="pt-12 text-center">
                <h1 className="text-4xl font-semibold tracking-normal">{scriptT(isCommunityScriptView ? "communityTitle" : "mineTitle")}</h1>
                <p className="mx-auto mt-3 max-w-2xl text-sm text-foreground/58">
                  {scriptT(isCommunityScriptView ? "communityDescription" : "mineDescription")}
                </p>
              </div>

              <div className="sticky top-0 z-20 mx-auto mt-6 max-w-2xl bg-background pb-3 pt-3">
                <label className="mx-auto flex h-12 max-w-2xl items-center gap-3 rounded-2xl border border-border px-4 text-sm shadow-sm transition focus-within:border-foreground/28">
                  <Search className="h-4 w-4 text-foreground/42" aria-hidden="true" />
                  <span className="sr-only">{scriptT("search")}</span>
                  <input
                    value={scriptSearch}
                    onChange={(event) => setScriptSearch(event.target.value)}
                    placeholder={scriptT("search")}
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-foreground/42"
                  />
                </label>

                <nav className="scrollbar-autohide mt-4 flex gap-4 overflow-x-auto border-b border-border">
                  {scriptCategories.map((category) => {
                    const hasSection = scriptsByCategory.some((group) => group.category === category);

                    return (
                      <button
                        type="button"
                        key={category}
                        onClick={() => scrollToScriptCategory(category)}
                        disabled={!hasSection}
                        className={cn(
                          "shrink-0 border-b px-1 pb-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-35",
                          scriptCategory === category
                            ? "border-foreground text-foreground"
                            : "border-transparent text-foreground/52 hover:text-foreground"
                        )}
                      >
                        {scriptT(`categories.${category}`)}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {scriptsByCategory.length === 0 ? (
                <p className="mx-auto mt-10 max-w-2xl rounded-2xl bg-muted/40 p-5 text-sm text-foreground/58">
                  {scriptT(isCommunityScriptView ? "empty" : "mineEmpty")}
                </p>
              ) : (
                <div className="mx-auto mt-8 w-full max-w-2xl space-y-12">
                  {scriptsByCategory.map((group) => (
                    <section
                      key={group.category}
                      ref={(node) => {
                        scriptSectionRefs.current[group.category] = node;
                      }}
                      data-script-category={group.category}
                      className="scroll-mt-36"
                    >
                      <div className="mb-4">
                        <h2 className="text-2xl font-semibold tracking-normal">
                          {isCommunityScriptView
                            ? group.category === "featured"
                              ? scriptT("featuredTitle")
                              : scriptT(`categories.${group.category}`)
                            : scriptT("mineSectionTitle")}
                        </h2>
                        <p className="text-sm text-foreground/50">
                          {isCommunityScriptView
                            ? group.category === "featured"
                              ? scriptT("featuredSubtitle")
                              : scriptT("popularSubtitle")
                            : scriptT("mineSectionSubtitle")}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {group.scripts.map((script, index) => (
                          <ScriptExploreCard
                            key={script.id}
                            rank={index + 1}
                            script={script}
                            isDefault={script.slug === "base-ai-script"}
                            labels={{
                              chats: scriptT("metrics.chats"),
                              creator: scriptT("creator"),
                              default: scriptT("default"),
                              joined: scriptT("joined")
                            }}
                            librarySourceLabel={
                              !isCommunityScriptView && script.librarySource
                                ? scriptT(script.librarySource === "SELF_CREATED" ? "source.selfCreated" : "source.communityAdded")
                                : undefined
                            }
                            showJoined={isCommunityScriptView}
                            onOpen={() => {
                              setDetailScriptId(script.id);
                            }}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            {detailScript ? (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm" onClick={() => setDetailScriptId("")}>
                <section
                  className="flex h-[42rem] max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header className="flex h-12 shrink-0 justify-end px-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setDetailScriptId("")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/58 transition hover:bg-muted hover:text-foreground"
                      aria-label={scriptT("close")}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </header>

                  <div className="scrollbar-autohide min-h-0 flex-1 overflow-y-auto px-6 pb-20 text-center">
                    <div className={cn("mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white", getScriptAccent(detailScript.slug))}>
                      <ClipboardList className="h-8 w-8" aria-hidden="true" />
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold tracking-normal">{detailScript.title}</h2>
                    <p className="mt-2 text-sm text-foreground/50">
                      {scriptT("creator")}：{homeT("kicker")}
                    </p>
                    {detailScript.librarySource ? (
                      <p className="mt-3">
                        <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/58">
                          {scriptT(detailScript.librarySource === "SELF_CREATED" ? "source.selfCreated" : "source.communityAdded")}
                        </span>
                      </p>
                    ) : detailScript.inLibrary ? (
                      <p className="mt-3">
                        <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/58">
                          {scriptT("joined")}
                        </span>
                      </p>
                    ) : null}
                    <p className="mx-auto mt-4 max-w-md text-sm text-foreground/72">{detailScript.description}</p>

                    <div className="mt-8 grid grid-cols-3 gap-4">
                      <Metric icon={Star} value={getScriptRating(detailScript.slug)} label={scriptT("metrics.rating")} />
                      <Metric icon={Globe2} value={getScriptRank(detailScript.slug)} label={scriptT("metrics.rank")} />
                      <Metric icon={MessageSquarePlus} value={getScriptChats(detailScript.slug)} label={scriptT("metrics.chats")} />
                    </div>

                    <section className="mt-8 text-left">
                      <h3 className="font-semibold">{scriptT("starters")}</h3>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {promptSuggestions.map((suggestion) => (
                          <button
                            type="button"
                            key={suggestion}
                            onClick={() => setDraft(suggestion)}
                            className="rounded-xl border border-border px-3 py-3 text-left text-sm transition hover:bg-muted/42"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="mt-8 text-left">
                      <h3 className="font-semibold">{scriptT("capabilities")}</h3>
                      <div className="mt-3 space-y-2 text-sm text-foreground/68">
                        {[scriptT("capabilityItems.story"), scriptT("capabilityItems.world"), scriptT("capabilityItems.memory")].map((item) => (
                          <p key={item} className="flex items-center gap-2">
                            <span className="text-primary">✓</span>
                            {item}
                          </p>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="shrink-0 border-t border-border bg-background p-4">
                    <button
                      type="button"
                      onClick={() => {
                        setDetailScriptId("");
                        handleCreateConversation(detailScript.id);
                      }}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/88"
                    >
                      <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                      {scriptT("startChat")}
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        ) : viewMode === "scriptPicker" || !activeConversation ? (
          <div className="scrollbar-autohide min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center">
              <div className="mx-auto w-full max-w-3xl text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-semibold tracking-normal md:text-3xl">{t("welcomeQuestion")}</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-foreground/58">{t("scriptDescription")}</p>
            </div>

              <div className="mt-6 w-full">
                <div className="flex w-full flex-wrap justify-center gap-2">
                  {visiblePickerScripts.map((script) => (
                    <button
                      type="button"
                      key={script.id}
                      onClick={() => handleCreateConversation(script.id)}
                      disabled={isPending || !persistenceAvailable}
                      className="group grid h-28 w-full grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 rounded-lg border border-border bg-background p-3 text-left transition hover:border-primary/35 hover:bg-muted/36 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-70 sm:w-[calc((100%_-_0.5rem)/2)] lg:w-[calc((100%_-_1rem)/3)]"
                      aria-label={t("startScriptWithName", { title: script.title })}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary transition group-hover:bg-primary group-hover:text-white">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{script.title}</span>
                        <span className="mt-1 block line-clamp-3 text-xs leading-5 text-foreground/62">{script.description}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {shouldShowScriptPager ? (
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={showPreviousScriptPage}
                      disabled={scriptPickerPageCount <= 1}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground/62 transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={t("scriptPager.previous")}
                      title={t("scriptPager.previous")}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/50">
                      {normalizedScriptPickerPage + 1} / {scriptPickerPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={showNextScriptPage}
                      disabled={scriptPickerPageCount <= 1}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground/62 transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={t("scriptPager.next")}
                      title={t("scriptPager.next")}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
                    </div>
          </div>
        ) : (
          <>
            <div className="scrollbar-autohide min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 px-4 py-6">
              {activeConversation.messages.length === 0 ? (
                <div className="my-auto text-center">
                  <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white">
                    <Bot className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="text-lg font-semibold">{t("readyTitle")}</p>
                  <p className="mx-auto mt-2 max-w-xl text-sm text-foreground/62">{activeConversation.scriptWelcome}</p>
                </div>
              ) : (
                activeConversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <Bot className="h-4 w-4" aria-hidden="true" />
                      </span>
                    ) : null}
                    <div
                      className={cn(
                        "max-w-[86%] px-4 py-3 text-sm md:max-w-[76%]",
                        message.role === "user"
                          ? "rounded-2xl bg-muted text-foreground"
                          : "text-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className="mt-2 text-xs text-foreground/38">
                        {formatDisplayTime(message.createdAt, locale)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {activeStreamingReply ? (
                <div className="flex gap-3">
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-foreground/58">
                    {activeStreamingReply.content ? (
                      <p className="whitespace-pre-wrap text-foreground">{activeStreamingReply.content}</p>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        {t("thinking")}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
              </div>
            </div>

            <div className="shrink-0 bg-gradient-to-t from-background via-background to-background/75 px-4 pb-4 pt-4">
              <form
                className="mx-auto flex w-full max-w-3xl flex-col rounded-3xl border border-border bg-background p-2 shadow-[0_8px_30px_hsl(var(--foreground)/0.08)] transition focus-within:border-foreground/28"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSendMessage();
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={t("inputPlaceholder")}
                  rows={1}
                  className="max-h-36 min-h-14 w-full resize-none bg-transparent px-3 py-3 text-sm leading-6 outline-none placeholder:text-foreground/42"
                />
                <div className="flex items-center justify-end px-1 pb-1">
                  <button
                    type="submit"
                    disabled={isBusy || !draft.trim() || !persistenceAvailable}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/38"
                    aria-label={t("send")}
                  >
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  </button>
                </div>
              </form>
              <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-foreground/42">{t("composerHint")}</p>
            </div>
          </>
        )}
      </section>
      <AuthDialog
        open={authDialogOpen}
        onClose={() => {
          pendingAuthActionRef.current = null;
          setAuthDialogOpen(false);
        }}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}

async function streamHomeMessage(
  conversationId: string,
  content: string,
  locale: Locale,
  onDelta: (content: string) => void
) {
  const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/stream`, {
    body: JSON.stringify({ content, locale }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!response.ok || !response.body) {
    throw new Error("Message stream failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const event = JSON.parse(line) as MessageStreamEvent;

      if (event.type === "delta") {
        onDelta(event.content);
      }

      if (event.type === "done") {
        return event.conversation;
      }

      if (event.type === "error") {
        throw new Error(event.message === authRequiredCode ? authRequiredCode : event.message);
      }
    }

    if (done) {
      break;
    }
  }

  throw new Error("Message stream ended without a final conversation.");
}

function mergeScripts(primaryScripts: WorkspaceScript[], preferredScripts: WorkspaceScript[]) {
  const scriptsById = new Map<string, WorkspaceScript>();

  primaryScripts.forEach((script) => scriptsById.set(script.id, script));
  preferredScripts.forEach((script) => scriptsById.set(script.id, script));

  return Array.from(scriptsById.values());
}

function groupConversations<T extends { updatedAt: string }>(conversations: T[]) {
  const groups: Array<{ key: "today" | "earlier"; conversations: T[] }> = [
    { key: "today", conversations: [] },
    { key: "earlier", conversations: [] }
  ];
  const today = new Date();

  conversations.forEach((conversation) => {
    const date = new Date(conversation.updatedAt);
    const key = date.toDateString() === today.toDateString() ? "today" : "earlier";
    groups.find((group) => group.key === key)?.conversations.push(conversation);
  });

  return groups.filter((group) => group.conversations.length > 0);
}

function ScriptExploreCard({
  isDefault,
  labels,
  librarySourceLabel,
  onOpen,
  rank,
  script,
  showJoined
}: {
  isDefault: boolean;
  labels: { chats: string; creator: string; default: string; joined: string };
  librarySourceLabel?: string;
  onOpen: () => void;
  rank: number;
  script: WorkspaceScript;
  showJoined: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 rounded-2xl bg-muted/34 p-4 text-left transition hover:bg-muted/58"
    >
      <span className={cn("relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-sm", getScriptAccent(script.slug))}>
        <ClipboardList className="h-8 w-8" aria-hidden="true" />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">
          #{rank}
        </span>
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-base font-semibold">{script.title}</span>
          {isDefault ? (
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] text-foreground/50">
              {labels.default}
            </span>
          ) : null}
          {librarySourceLabel ? (
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] text-foreground/50">
              {librarySourceLabel}
            </span>
          ) : null}
          {showJoined && script.inLibrary ? (
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] text-foreground/50">
              {labels.joined}
            </span>
          ) : null}
        </span>
        <span className="mt-1 line-clamp-3 text-sm text-foreground/62">{script.description}</span>
        <span className="mt-2 flex items-center justify-between gap-3 text-xs text-foreground/42">
          <span className="truncate">{labels.creator}</span>
          <span className="shrink-0">{getScriptChats(script.slug)} {labels.chats}</span>
        </span>
      </span>
    </button>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div>
      <Icon className="mx-auto mb-1 h-4 w-4 text-primary" aria-hidden="true" />
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-foreground/46">{label}</p>
    </div>
  );
}

function getScriptAccent(slug: string) {
  if (slug.includes("world")) {
    return "bg-emerald-500";
  }

  if (slug.includes("roleplay")) {
    return "bg-sky-500";
  }

  if (slug.includes("mystery")) {
    return "bg-amber-500";
  }

  if (slug.includes("writing")) {
    return "bg-rose-500";
  }

  if (slug.includes("analyst")) {
    return "bg-violet-500";
  }

  return "bg-primary";
}

function getScriptRating(slug: string) {
  return slug === "base-ai-script" ? "4.9" : "4.8";
}

function getScriptRank(slug: string) {
  const ranks: Record<string, string> = {
    "base-ai-script": "#1",
    "world-architect": "#2",
    "character-roleplay": "#3",
    "mystery-case": "#4",
    "serial-writing": "#5",
    "lore-analyst": "#6"
  };

  return ranks[slug] ?? "#9";
}

function getScriptChats(slug: string) {
  const chats: Record<string, string> = {
    "base-ai-script": "1.2K+",
    "world-architect": "900+",
    "character-roleplay": "860+",
    "mystery-case": "720+",
    "serial-writing": "680+",
    "lore-analyst": "540+"
  };

  return chats[slug] ?? "100+";
}
