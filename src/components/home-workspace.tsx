"use client";

import {
  Bot,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Globe2,
  FileText,
  Loader2,
  MessageSquarePlus,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SendHorizontal,
  Sparkles,
  Star,
  Trash2,
  X
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createHomeConversation, deleteHomeConversation, sendHomeMessage } from "@/app/[locale]/actions";
import { HeaderActions } from "@/components/header-actions";
import type { Locale } from "@/i18n/routing";
import type { WorkspaceData } from "@/lib/home-workspace";
import { formatDisplayTime } from "@/lib/format";
import { createConversationTitle, filterConversations } from "@/lib/home-workspace-utils";
import { cn } from "@/lib/utils";

type ViewMode = "scriptPicker" | "scriptManager" | "chat";
const scriptCategories = ["featured", "world", "roleplay", "writing", "analysis"] as const;
const scriptPickerPageSize = 6;

export function HomeWorkspace({ data }: { data: WorkspaceData }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("home.workspace");
  const scriptT = useTranslations("home.scripts");
  const homeT = useTranslations("home");
  const [scripts] = useState(data.scripts);
  const [conversations, setConversations] = useState(data.conversations);
  const [activeConversationId, setActiveConversationId] = useState(data.conversations[0]?.id ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>(data.conversations.length > 0 ? "chat" : "scriptPicker");
  const [activeScriptId, setActiveScriptId] = useState(data.scripts[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
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
  const persistenceAvailable = data.persistenceAvailable;

  const activeConversation = conversations.find((item) => item.id === activeConversationId);
  const activeScript = scripts.find((script) => script.id === activeScriptId) ?? scripts[0];
  const detailScript = scripts.find((script) => script.id === detailScriptId);
  const scriptsByCategory = useMemo(() => {
    const keyword = scriptSearch.trim().toLowerCase();
    const filtered = keyword
      ? scripts.filter((script) =>
          [script.title, script.description, script.welcome].some((value) => value.toLowerCase().includes(keyword))
        )
      : scripts;

    return scriptCategories
      .map((category) => ({
        category,
        scripts: category === "featured" ? filtered.slice(0, 4) : filtered.filter((script) => script.category === category)
      }))
      .filter((group) => group.scripts.length > 0);
  }, [scriptSearch, scripts]);
  const filteredConversations = useMemo(() => {
    return filterConversations(conversations, search);
  }, [conversations, search]);
  const groupedConversations = useMemo(() => {
    return groupConversations(filteredConversations);
  }, [filteredConversations]);
  const scriptPickerPageCount = Math.max(1, Math.ceil(scripts.length / scriptPickerPageSize));
  const normalizedScriptPickerPage = Math.min(scriptPickerPage, scriptPickerPageCount - 1);
  const visiblePickerScripts = scripts.slice(
    normalizedScriptPickerPage * scriptPickerPageSize,
    normalizedScriptPickerPage * scriptPickerPageSize + scriptPickerPageSize
  );
  const activeTokenUsage = activeConversation?.tokenUsage ?? { upstream: 0, downstream: 0, estimated: false };
  const tokenStatsKey = activeTokenUsage.estimated ? "tokenStatsEstimated" : "tokenStats";
  const tokenUsageLabel = t(tokenStatsKey, {
    downstream: new Intl.NumberFormat(locale).format(activeTokenUsage.downstream),
    upstream: new Intl.NumberFormat(locale).format(activeTokenUsage.upstream)
  });
  const promptSuggestions = [t("suggestions.character"), t("suggestions.conflict"), t("suggestions.world")];

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
    setViewMode("scriptManager");
  }

  function selectConversation(conversationId: string) {
    setTitleMenuOpen(false);
    setActiveConversationId(conversationId);
    setViewMode("chat");
  }

  function handleCreateConversation(scriptId: string) {
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
      } catch {
        toast.error(t("errors.create"));
      }
    });
  }

  function handleSendMessage() {
    if (!activeConversation || !draft.trim()) {
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

    startTransition(async () => {
      try {
        const conversation = await sendHomeMessage(activeConversation.id, content, locale);
        setConversations((current) => [
          conversation,
          ...current.filter((item) => item.id !== conversation.id)
        ]);
        setActiveConversationId(conversation.id);
        setViewMode("chat");
      } catch {
        setDraft(content);
        setConversations((current) => [
          previousConversation,
          ...current.filter((item) => item.id !== previousConversation.id)
        ]);
        toast.error(t("errors.send"));
      }
    });
  }

  function handleDeleteConversation() {
    if (!activeConversation) {
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
      } catch {
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
          <div className="rounded-xl bg-background/70 px-3 py-2 text-xs text-foreground/54">
            <p className="flex items-center gap-2">
              <Circle
                className={cn("h-2.5 w-2.5 fill-current", persistenceAvailable ? "text-primary" : "text-accent")}
                aria-hidden="true"
              />
              {persistenceAvailable ? t("status.connected") : t("status.readonly")}
            </p>
            <p className="mt-1 text-foreground/42">{t("status.llm")}</p>
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
                    className="-ml-2 flex max-w-full flex-col items-start rounded-md px-2 py-1 text-left transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                    aria-expanded={titleMenuOpen}
                    aria-haspopup="menu"
                    aria-label={t("conversationActions.open")}
                  >
                    <span className="flex max-w-full items-center gap-1.5 text-sm font-medium text-foreground/82">
                      <span className="truncate">{activeConversation.title}</span>
                      <ChevronDown
                        className={cn("h-3.5 w-3.5 shrink-0 text-foreground/42 transition", titleMenuOpen && "rotate-180")}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="hidden max-w-full truncate text-xs text-foreground/48 sm:block">
                      {activeConversation.scriptTitle}
                    </span>
                  </button>
                  {titleMenuOpen ? (
                    <div
                      className="absolute left-0 top-full z-30 mt-2 w-56 rounded-xl border border-border bg-background p-1 shadow-xl shadow-foreground/10"
                      role="menu"
                    >
                      <button
                        type="button"
                        onClick={handleDeleteConversation}
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
              <HeaderActions />
            </div>
          </header>
        ) : null}

        {viewMode === "scriptManager" ? (
          <div ref={scriptScrollRef} className="scrollbar-autohide min-h-0 flex-1 overflow-y-auto px-4">
            <button
              type="button"
              onClick={() => toast.info(scriptT("createSoon"))}
              className="absolute right-4 top-3 z-40 inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-sm font-medium text-background transition hover:bg-foreground/88"
            >
              <span className="text-base leading-none">+</span>
              {scriptT("create")}
            </button>
            <div className="mx-auto w-full max-w-4xl">
              <div className="pt-12 text-center">
                <p className="text-sm text-foreground/54">{scriptT("kicker")}</p>
                <h1 className="mt-2 text-4xl font-semibold tracking-normal">{scriptT("heroTitle")}</h1>
                <p className="mx-auto mt-3 max-w-2xl text-sm text-foreground/58">{scriptT("heroDescription")}</p>
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
                  {scriptT("empty")}
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
                          {group.category === "featured" ? scriptT("featuredTitle") : scriptT(`categories.${group.category}`)}
                        </h2>
                        <p className="text-sm text-foreground/50">
                          {group.category === "featured" ? scriptT("featuredSubtitle") : scriptT("popularSubtitle")}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {group.scripts.map((script, index) => (
                          <ScriptExploreCard
                            key={script.id}
                            rank={index + 1}
                            script={script}
                            isDefault={script.slug === "base-ai-script"}
                            labels={{ default: scriptT("default"), creator: scriptT("creator"), chats: scriptT("metrics.chats") }}
                            onOpen={() => {
                              setActiveScriptId(script.id);
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
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-muted p-3" onClick={() => setDetailScriptId("")}>
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
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {promptSuggestions.map((suggestion) => (
                  <span
                    key={suggestion}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-foreground/62"
                  >
                    {suggestion}
                  </span>
                ))}
              </div>
            </div>

              <div className="mt-6 w-full">
                <div className="mb-3 flex items-center justify-between gap-3">
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

                <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {visiblePickerScripts.map((script) => (
                    <button
                      type="button"
                      key={script.id}
                      onClick={() => handleCreateConversation(script.id)}
                      disabled={isPending || !persistenceAvailable}
                      className="group grid h-28 grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 rounded-lg border border-border bg-background p-3 text-left transition hover:border-primary/35 hover:bg-muted/36 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-70"
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
                  <div className="mx-auto mt-6 grid max-w-2xl gap-2 sm:grid-cols-3">
                    {promptSuggestions.map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion}
                        onClick={() => setDraft(suggestion)}
                        className="rounded-2xl border border-border px-3 py-3 text-left text-sm text-foreground/68 transition hover:bg-muted/44"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
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
              {isPending && activeConversation.messages.length > 0 ? (
                <div className="flex gap-3">
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-foreground/58">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      {t("thinking")}
                    </span>
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
                    disabled={isPending || !draft.trim() || !persistenceAvailable}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/38"
                    aria-label={t("send")}
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  </button>
                </div>
              </form>
              <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-foreground/42">{t("composerHint")}</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
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
  onOpen,
  rank,
  script
}: {
  isDefault: boolean;
  labels: { chats: string; creator: string; default: string };
  onOpen: () => void;
  rank: number;
  script: { slug: string; title: string; description: string };
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
          <span className="truncate text-base font-semibold">{script.title}</span>
          {isDefault ? (
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] text-foreground/50">
              {labels.default}
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
