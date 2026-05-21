"use client";

import {
  ArrowLeft,
  Bot,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ClipboardList,
  Download,
  Ghost,
  Globe2,
  FileText,
  Images,
  Loader2,
  MapPinned,
  MessageSquarePlus,
  MessagesSquare,
  Maximize2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  SendHorizontal,
  Sparkles,
  Star,
  Trash2,
  Upload,
  VenetianMask,
  X
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  assistHomeMaskDraft,
  assistHomeSceneDraft,
  cleanupHomeUploadedMaterialImages,
  createHomeConversation,
  createHomeMaskMaterial,
  createHomeSceneMaterial,
  deleteHomeMaterial,
  deleteHomeConversation,
  generateHomeMaskBoard,
  generateHomeSceneBlockPanorama,
  joinHomeMaterial,
  setHomeMaterialCommunitySharing,
  updateHomeMaskMaterial,
  updateHomeSceneMaterial,
  uploadHomeScenePanoramaFace
} from "@/app/[locale]/actions";
import { AuthDialog } from "@/components/auth-dialog";
import { HeaderActions } from "@/components/header-actions";
import { UserAvatar } from "@/components/user-avatar";
import type { Locale } from "@/i18n/routing";
import { authRequiredEventName } from "@/lib/auth-client";
import { authRequiredCode, isAuthRequiredError, type AuthViewer } from "@/lib/auth-types";
import type {
  WorkspaceConversation,
  WorkspaceData,
  WorkspaceMaterial,
  WorkspaceMaterialCategory,
  WorkspaceMaterialMetadata,
  SceneDraftPatch,
  SceneMaterialCreateInput,
  WorkspaceSceneMaterialMetadata,
  WorkspaceMaterialStyle,
  WorkspaceScript
} from "@/lib/home-workspace";
import { formatDisplayTime } from "@/lib/format";
import { createConversationTitle, filterConversations } from "@/lib/home-workspace-utils";
import { cn } from "@/lib/utils";

type ViewMode = "scriptPicker" | "scriptManager" | "materialManager" | "chat";
type ScriptManagerView = "mine" | "community";
type MaterialManagerView = ScriptManagerView;
type StreamingReply = {
  content: string;
  conversationId: string;
};
type MessageStreamEvent =
  | { type: "delta"; content: string }
  | { type: "done"; conversation: WorkspaceConversation }
  | { type: "error"; message: string };
const scriptCategories = ["featured", "world", "roleplay", "writing", "analysis"] as const;
const materialStyles = ["realistic", "fantasy", "sciFi", "mystery", "cyberpunk", "classical", "apocalyptic"] as const;
const materialTypes = ["mask", "map", "item", "creature", "scene"] as const;
const scenePanoramaFaces = ["front", "back", "left", "right", "top", "bottom"] as const;
const scenePanoramaThreeFaceOrder = ["right", "left", "top", "bottom", "front", "back"] as const;
const materialIcons = {
  mask: VenetianMask,
  map: MapPinned,
  item: PackageOpen,
  creature: Ghost,
  scene: Clapperboard
} as const;
const scriptPickerPageSize = 6;
const maskBodyFields = [
  { id: "hairStyle", options: ["short", "long", "tied", "wavy", "curly", "buzz"] },
  { id: "browShape", options: ["straight", "arched", "sword", "soft", "thick", "thin"] },
  { id: "faceShape", options: ["oval", "round", "square", "heart", "long", "sharp"] },
  { id: "eyeShape", options: ["almond", "round", "phoenix", "narrow", "drooping", "deepSet"] },
  { id: "noseType", options: ["straight", "highBridge", "small", "broad", "hooked", "roundTip"] },
  { id: "mouthShape", options: ["thin", "full", "bow", "wide", "small", "firm"] },
  { id: "earShape", options: ["round", "pointed", "small", "broad", "long", "hidden"] },
  { id: "height", unit: "cm", options: [] },
  { id: "weight", unit: "kg", options: [] },
  { id: "gender", options: ["female", "male", "androgynous", "nonbinary"] },
  { id: "ageStage", options: ["child", "youth", "adult", "elder"] },
  { id: "bodyType", options: ["slim", "athletic", "soft", "sturdy", "graceful", "imposing"] }
] as const;
const maskColorFields = [
  { id: "hairColor", swatches: ["#1F1A17", "#5C4033", "#C7C7C7", "#F2F0E8", "#8A2E24", "#C99B3D"] },
  { id: "eyeColor", swatches: ["#1B1B1D", "#5B3823", "#C9822B", "#3F7A4B", "#3D6EA8", "#8B9198"] },
  { id: "browColor", swatches: ["#1F1A17", "#5C4033", "#C7C7C7", "#8A2E24"] },
  { id: "skinColor", swatches: ["#F3D7BD", "#D8AA78", "#B77955", "#7A4B37", "#F1E3D3", "#C8A47E"] }
] as const;
const maskVoiceFields = [
  { id: "pitch", min: 0, max: 100, defaultValue: 50 },
  { id: "speechSpeed", min: 80, max: 220, defaultValue: 150 },
  { id: "volume", min: 0, max: 100, defaultValue: 50 },
  { id: "intonation", min: 0, max: 100, defaultValue: 50 },
  { id: "emotionExposure", min: 0, max: 100, defaultValue: 50 },
  { id: "nasalResonance", min: 0, max: 100, defaultValue: 50 },
  { id: "breathiness", min: 0, max: 100, defaultValue: 50 }
] as const;
const maskPersonalityGroups = [
  { id: "basic", fields: ["extroversion", "dominance", "rationality", "emotionalStability", "confidence"] },
  { id: "social", fields: ["affinity", "sharingDesire", "humor", "aggression", "politeness"] },
  { id: "emotion", fields: ["coquetry", "sensitivity", "possessiveness", "dependency"] },
  { id: "relationship", fields: ["proactiveCare", "boundaries", "loyalty"] },
  { id: "behavior", fields: ["action", "curiosity", "performative"] }
] as const;
const maskBoardDrawingStyles = ["photo", "realistic", "anime", "painterly", "cel", "guofeng", "comic", "concept"] as const;
type MaskBodyFieldId = (typeof maskBodyFields)[number]["id"];
type MaskColorFieldId = (typeof maskColorFields)[number]["id"];
type MaskVoiceFieldId = (typeof maskVoiceFields)[number]["id"];
type MaskPersonalityFieldId = (typeof maskPersonalityGroups)[number]["fields"][number];
type MaskBoardDrawingStyle = (typeof maskBoardDrawingStyles)[number];
type ScenePanoramaDrawingStyle = MaskBoardDrawingStyle;
type MaskCreateDraft = {
  name: string;
  intro: string;
  features: string;
  style: WorkspaceMaterialStyle;
  body: Record<MaskBodyFieldId, string>;
  colors: Record<MaskColorFieldId, string>;
  voice: Record<MaskVoiceFieldId, number>;
  personality: Record<MaskPersonalityFieldId, number>;
  boardDrawingStyle: MaskBoardDrawingStyle;
  boardImagePreviewUrl: string;
  boardImageFile: File | null;
  boardImageSource: MaskBoardImageSource;
  aiMessages: MaskAiMessage[];
};
type MaskBoardImageSource = "uploaded" | "generated" | null;
type MaskAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
type MaskDraftPatch = {
  name?: string;
  intro?: string;
  features?: string;
  style?: WorkspaceMaterialStyle;
  body?: Partial<Record<MaskBodyFieldId, string>>;
  colors?: Partial<Record<MaskColorFieldId, string>>;
  voice?: Partial<Record<MaskVoiceFieldId, number>>;
  personality?: Partial<Record<MaskPersonalityFieldId, number>>;
};
type ScenePanoramaFace = (typeof scenePanoramaFaces)[number];
type ScenePanoramaFaceDraft = {
  file: File | null;
  previewUrl: string;
  source: "uploaded" | "generated" | "existing" | "direct-cut" | "reference-repaint";
  storedUrl: string | null;
};
type ScenePanoramaDraft = {
  faceSource: "uploaded" | "generated" | "direct-cut" | "reference-repaint";
  faces: Partial<Record<ScenePanoramaFace, ScenePanoramaFaceDraft>>;
};
type SceneBlockDraft = {
  id: string;
  name: string;
  description: string;
  panorama: ScenePanoramaDraft | null;
};
type SceneCreateDraft = {
  name: string;
  description: string;
  style: WorkspaceMaterialStyle;
  panoramaDrawingStyle: ScenePanoramaDrawingStyle;
  blocks: SceneBlockDraft[];
};
type SceneAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
const maskBoardAcceptedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxMaskBoardImageBytes = 10 * 1024 * 1024;
const scenePanoramaAcceptedTypes = maskBoardAcceptedTypes;
const maxScenePanoramaFaceBytes = 10 * 1024 * 1024;

export function HomeWorkspace({ data }: { data: WorkspaceData }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const t = useTranslations("home.workspace");
  const scriptT = useTranslations("home.scripts");
  const materialT = useTranslations("home.materials");
  const homeT = useTranslations("home");
  const authT = useTranslations("home.auth");
  const myScripts = data.myScripts;
  const communityScripts = data.communityScripts;
  const [myMaterials, setMyMaterials] = useState(data.myMaterials);
  const [communityMaterials, setCommunityMaterials] = useState(data.communityMaterials);
  const [viewer, setViewer] = useState(data.viewer);
  const [conversations, setConversations] = useState(data.conversations);
  const [activeConversationId, setActiveConversationId] = useState(data.conversations[0]?.id ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>(data.conversations.length > 0 ? "chat" : "scriptPicker");
  const [scriptManagerView, setScriptManagerView] = useState<ScriptManagerView>("mine");
  const [materialManagerView, setMaterialManagerView] = useState<MaterialManagerView>("mine");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [streamingReply, setStreamingReply] = useState<StreamingReply | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [scriptSearch, setScriptSearch] = useState("");
  const [scriptCategory, setScriptCategory] = useState("featured");
  const [scriptPickerPage, setScriptPickerPage] = useState(0);
  const [detailScriptId, setDetailScriptId] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialStyle, setMaterialStyle] = useState<WorkspaceMaterialStyle>("realistic");
  const [detailMaterialId, setDetailMaterialId] = useState("");
  const [materialCreateMenuOpen, setMaterialCreateMenuOpen] = useState(false);
  const [maskCreateOpen, setMaskCreateOpen] = useState(false);
  const [maskEditingMaterialId, setMaskEditingMaterialId] = useState("");
  const [maskCreateDraft, setMaskCreateDraft] = useState<MaskCreateDraft>(() => createDefaultMaskDraft());
  const [maskAiInput, setMaskAiInput] = useState("");
  const [maskAiPending, setMaskAiPending] = useState(false);
  const [maskBoardPending, setMaskBoardPending] = useState(false);
  const [maskSavePending, setMaskSavePending] = useState(false);
  const [sceneCreateOpen, setSceneCreateOpen] = useState(false);
  const [sceneEditingMaterialId, setSceneEditingMaterialId] = useState("");
  const [sceneCreateDraft, setSceneCreateDraft] = useState<SceneCreateDraft>(() => createDefaultSceneDraft());
  const [sceneActiveBlockId, setSceneActiveBlockId] = useState("");
  const [sceneAiInput, setSceneAiInput] = useState("");
  const [sceneAiMessages, setSceneAiMessages] = useState<SceneAiMessage[]>([]);
  const [sceneAiPending, setSceneAiPending] = useState(false);
  const [scenePanoramaPendingBlockId, setScenePanoramaPendingBlockId] = useState("");
  const [sceneSavePending, setSceneSavePending] = useState(false);
  const [materialTransferPending, setMaterialTransferPending] = useState(false);
  const [titleMenuOpen, setTitleMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleMenuRef = useRef<HTMLDivElement>(null);
  const materialCreateMenuRef = useRef<HTMLDivElement>(null);
  const materialImportInputRef = useRef<HTMLInputElement>(null);
  const scriptScrollRef = useRef<HTMLDivElement>(null);
  const scriptSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const materialScrollRef = useRef<HTMLDivElement>(null);
  const materialSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const optimisticIdRef = useRef(0);
  const pendingAuthActionRef = useRef<((viewer: AuthViewer) => void) | null>(null);
  const persistenceAvailable = data.persistenceAvailable;
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const activeConversation = conversations.find((item) => item.id === activeConversationId);
  const scriptPickerScripts = myScripts.length > 0 ? myScripts : communityScripts;
  const managerScripts = scriptManagerView === "community" ? communityScripts : myScripts;
  const managerMaterials = materialManagerView === "community" ? communityMaterials : myMaterials;
  const allScripts = useMemo(() => mergeScripts(communityScripts, myScripts), [communityScripts, myScripts]);
  const allMaterials = useMemo(() => mergeMaterials(communityMaterials, myMaterials), [communityMaterials, myMaterials]);
  const detailScript = allScripts.find((script) => script.id === detailScriptId);
  const detailMaterial = allMaterials.find((material) => material.id === detailMaterialId);
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
  const materialsByStyle = useMemo(() => {
    const keyword = materialSearch.trim().toLowerCase();
    const filtered = keyword
      ? managerMaterials.filter((material) =>
          [
            material.title,
            material.description,
            material.slug,
            materialT(`styles.${material.style}`),
            materialT(`types.${material.category}`)
          ].some((value) => value.toLowerCase().includes(keyword))
        )
      : managerMaterials;

    return materialStyles
      .map((style) => ({
        style,
        materials: filtered.filter((material) => material.style === style)
      }))
      .filter((group) => group.materials.length > 0);
  }, [managerMaterials, materialSearch, materialT]);
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
  const isCommunityMaterialView = materialManagerView === "community";
  const isMaskActionPending = maskAiPending || maskBoardPending || maskSavePending;
  const isSceneActionPending = sceneAiPending || Boolean(scenePanoramaPendingBlockId) || sceneSavePending;
  const isMaterialTransferDisabled = materialTransferPending;
  const isEditingMask = Boolean(maskEditingMaterialId);
  const isEditingScene = Boolean(sceneEditingMaterialId);

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
      setMaterialManagerView("community");
      setMaterialSearch("");
      setMaterialStyle("realistic");
      setDetailMaterialId("");
      setMaterialCreateMenuOpen(false);
      setMaskCreateOpen(false);
      resetMaskCreateDraft();
      setSceneCreateOpen(false);
      resetSceneCreateDraft();
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
    if (!materialCreateMenuOpen) {
      return;
    }

    function closeOnOutsidePointer(event: MouseEvent) {
      if (!materialCreateMenuRef.current?.contains(event.target as Node)) {
        setMaterialCreateMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMaterialCreateMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [materialCreateMenuOpen]);

  useEffect(() => {
    if (!maskCreateOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMaskCreateOpen(false);
        resetMaskCreateDraft();
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [maskCreateOpen]);

  useEffect(() => {
    if (!sceneCreateOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSceneCreateOpen(false);
        resetSceneCreateDraft();
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [sceneCreateOpen]);

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

  useEffect(() => {
    if (viewMode !== "materialManager") {
      return;
    }

    const root = materialScrollRef.current;

    if (!root) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const style = visibleEntry?.target.getAttribute("data-material-style");

        if (style) {
          setMaterialStyle(style as WorkspaceMaterialStyle);
        }
      },
      {
        root,
        rootMargin: "-128px 0px -55% 0px",
        threshold: [0.12, 0.28, 0.5]
      }
    );

    Object.values(materialSectionRefs.current).forEach((section) => {
      if (section) {
        observer.observe(section);
      }
    });

    return () => observer.disconnect();
  }, [materialsByStyle, viewMode]);

  function showScriptSelection() {
    setTitleMenuOpen(false);
    setActiveConversationId("");
    setDetailScriptId("");
    setDetailMaterialId("");
    setViewMode("scriptPicker");
  }

  function showScriptManager() {
    setTitleMenuOpen(false);
    setActiveConversationId("");
    setDetailScriptId("");
    setDetailMaterialId("");
    setScriptManagerView(viewer ? "mine" : "community");
    setScriptCategory("featured");
    setScriptSearch("");
    setViewMode("scriptManager");
  }

  function showMaterialManager() {
    setTitleMenuOpen(false);
    setActiveConversationId("");
    setDetailScriptId("");
    setDetailMaterialId("");
    setMaterialManagerView(viewer ? "mine" : "community");
    setMaterialStyle("realistic");
    setMaterialSearch("");
    setMaterialCreateMenuOpen(false);
    setMaskCreateOpen(false);
    resetMaskCreateDraft();
    setSceneCreateOpen(false);
    resetSceneCreateDraft();
    setViewMode("materialManager");
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

  function showCommunityMaterials() {
    setDetailMaterialId("");
    setMaterialManagerView("community");
    setMaterialStyle("realistic");
    setMaterialSearch("");
    setMaterialCreateMenuOpen(false);
    setMaskCreateOpen(false);
    resetMaskCreateDraft();
    setSceneCreateOpen(false);
    resetSceneCreateDraft();
  }

  function showMyMaterials() {
    if (!viewer) {
      requestAuth(() => {
        setDetailMaterialId("");
        setMaterialManagerView("mine");
        setMaterialStyle("realistic");
        setMaterialSearch("");
        setMaterialCreateMenuOpen(false);
        setMaskCreateOpen(false);
        resetMaskCreateDraft();
        setSceneCreateOpen(false);
        resetSceneCreateDraft();
      });
      return;
    }

    setDetailMaterialId("");
    setMaterialManagerView("mine");
    setMaterialStyle("realistic");
    setMaterialSearch("");
    setMaterialCreateMenuOpen(false);
    setMaskCreateOpen(false);
    resetMaskCreateDraft();
    setSceneCreateOpen(false);
    resetSceneCreateDraft();
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

  function handleJoinMaterial(materialId: string, authenticatedViewer = viewer) {
    if (!authenticatedViewer) {
      requestAuth((nextViewer) => handleJoinMaterial(materialId, nextViewer));
      return;
    }

    if (!persistenceAvailable) {
      toast.error(materialT("errors.persistence"));
      return;
    }

    startTransition(async () => {
      try {
        const joinedMaterial = await joinHomeMaterial(materialId, locale);
        setMyMaterials((current) =>
          current.some((material) => material.id === joinedMaterial.id)
            ? current.map((material) => (material.id === joinedMaterial.id ? joinedMaterial : material))
            : [joinedMaterial, ...current]
        );
        setCommunityMaterials((current) =>
          current.map((material) => (material.id === joinedMaterial.id ? joinedMaterial : material))
        );
        setDetailMaterialId(joinedMaterial.id);
        setMaterialManagerView("community");
        toast.success(materialT("joinedToast"));
      } catch (error) {
        if (isAuthRequiredError(error)) {
          requestAuth((nextViewer) => handleJoinMaterial(materialId, nextViewer));
          return;
        }

        toast.error(materialT("errors.join"));
      }
    });
  }

  function handleDeleteMaterial(material: WorkspaceMaterial, authenticatedViewer = viewer) {
    if (material.librarySource !== "SELF_CREATED") {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => handleDeleteMaterial(material, nextViewer));
      return;
    }

    if (!persistenceAvailable) {
      toast.error(materialT("errors.persistence"));
      return;
    }

    const shouldDelete = window.confirm(materialT("deleteConfirm", { name: material.title }));

    if (!shouldDelete) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteHomeMaterial(material.id, locale);
        setMyMaterials((current) => current.filter((item) => item.id !== material.id));
        setCommunityMaterials((current) => current.filter((item) => item.id !== material.id));
        setDetailMaterialId("");
        toast.success(materialT("deletedToast"));
        router.refresh();
      } catch (error) {
        if (isAuthRequiredError(error)) {
          requestAuth((nextViewer) => handleDeleteMaterial(material, nextViewer));
          return;
        }

        toast.error(materialT("errors.delete"));
      }
    });
  }

  function handleToggleMaterialCommunitySharing(material: WorkspaceMaterial, shared: boolean, authenticatedViewer = viewer) {
    if (material.librarySource !== "SELF_CREATED") {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => handleToggleMaterialCommunitySharing(material, shared, nextViewer));
      return;
    }

    if (!persistenceAvailable) {
      toast.error(materialT("errors.persistence"));
      return;
    }

    startTransition(async () => {
      try {
        const updatedMaterial = await setHomeMaterialCommunitySharing(material.id, shared, locale);

        setMyMaterials((current) => upsertMaterialList(current, updatedMaterial));
        setCommunityMaterials((current) =>
          updatedMaterial.communityVisible
            ? upsertMaterialList(current, updatedMaterial)
            : current.filter((item) => item.id !== updatedMaterial.id)
        );
        toast.success(materialT(updatedMaterial.communityVisible ? "shareEnabledToast" : "shareDisabledToast"));
        router.refresh();
      } catch (error) {
        if (isAuthRequiredError(error)) {
          requestAuth((nextViewer) => handleToggleMaterialCommunitySharing(material, shared, nextViewer));
          return;
        }

        toast.error(materialT("errors.share"));
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

        toast.error(resolveSendError(error, t));
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

  function scrollToMaterialStyle(style: WorkspaceMaterialStyle) {
    const section = document.getElementById(`material-style-${style}`);

    if (!section) {
      return;
    }

    setMaterialStyle(style);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToScriptCategory(category: string) {
    const section = scriptSectionRefs.current[category];

    if (!section) {
      return;
    }

    setScriptCategory(category);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectMaterialCreateType(category: WorkspaceMaterialCategory) {
    setMaterialCreateMenuOpen(false);

    if (category === "mask") {
      resetMaskCreateDraft();
      setSceneCreateOpen(false);
      setMaskCreateOpen(true);
      return;
    }

    if (category === "scene") {
      resetSceneCreateDraft();
      setMaskCreateOpen(false);
      setSceneCreateOpen(true);
      return;
    }

    toast.info(materialT("createSoon"));
  }

  function triggerMaterialImport(authenticatedViewer = viewer) {
    setMaterialCreateMenuOpen(false);

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        materialImportInputRef.current?.click();
      });
      return;
    }

    materialImportInputRef.current?.click();
  }

  async function importMaterialArchive(file: File | null, authenticatedViewer = viewer) {
    if (!file) {
      return;
    }

    if (!isZipArchiveFile(file)) {
      toast.error(materialT("invalidImportFile"));
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void importMaterialArchive(file, nextViewer);
      });
      return;
    }

    setMaterialTransferPending(true);

    try {
      const formData = new FormData();
      formData.append("archive", file);

      const response = await fetch(`/api/materials/import?locale=${encodeURIComponent(locale)}`, {
        method: "POST",
        body: formData
      });

      if (response.status === 401) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void importMaterialArchive(file, nextViewer);
        });
        return;
      }

      if (!response.ok) {
        throw new Error(await readTransferErrorCode(response));
      }

      const result = await response.json() as { importedCount: number; materials: WorkspaceMaterial[] };

      setMyMaterials((current) => result.materials.reduce((next, material) => upsertMaterialList(next, material), current));
      if (result.materials[0]) {
        setMaterialStyle(result.materials[0].style);
      }
      toast.success(materialT("importSuccess", { count: result.importedCount }));
      router.refresh();
    } catch (error) {
      toast.error(resolveMaterialImportError(error, materialT));
    } finally {
      setMaterialTransferPending(false);
      if (materialImportInputRef.current) {
        materialImportInputRef.current.value = "";
      }
    }
  }

  async function exportMaterialArchive(materialId?: string, authenticatedViewer = viewer) {
    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void exportMaterialArchive(materialId, nextViewer);
      });
      return;
    }

    setMaterialCreateMenuOpen(false);
    setMaterialTransferPending(true);

    try {
      const query = new URLSearchParams({ locale });
      if (materialId) {
        query.set("materialId", materialId);
      }

      await downloadMaterialArchive(`/api/materials/export?${query.toString()}`);
      toast.success(materialT("exportSuccess"));
    } catch (error) {
      toast.error(resolveMaterialExportError(error, materialT));
    } finally {
      setMaterialTransferPending(false);
    }
  }

  function closeMaskCreateDialog() {
    setMaskCreateOpen(false);
    resetMaskCreateDraft();
  }

  function resetMaskCreateDraft() {
    setMaskCreateDraft((current) => {
      revokeMaskBoardPreview(current.boardImagePreviewUrl);

      return createDefaultMaskDraft();
    });
    setMaskAiInput("");
    setMaskEditingMaterialId("");
  }

  function openMaskEditDialog(material: WorkspaceMaterial) {
    if (material.category !== "mask" || material.librarySource !== "SELF_CREATED") {
      return;
    }

    setMaterialCreateMenuOpen(false);
    setMaskCreateDraft((current) => {
      revokeMaskBoardPreview(current.boardImagePreviewUrl);

      return createMaskDraftFromMaterial(material);
    });
    setMaskAiInput("");
    setMaskEditingMaterialId(material.id);
    setMaskCreateOpen(true);
  }

  function updateMaskName(name: string) {
    setMaskCreateDraft((current) => ({ ...current, name }));
  }

  function updateMaskIntro(intro: string) {
    setMaskCreateDraft((current) => ({ ...current, intro }));
  }

  function updateMaskFeatures(features: string) {
    setMaskCreateDraft((current) => ({ ...current, features }));
  }

  function updateMaskStyle(style: WorkspaceMaterialStyle) {
    setMaskCreateDraft((current) => ({ ...current, style }));
  }

  function updateMaskBodyField(fieldId: MaskBodyFieldId, value: string) {
    setMaskCreateDraft((current) => ({
      ...current,
      body: {
        ...current.body,
        [fieldId]: value
      }
    }));
  }

  function updateMaskColorField(fieldId: MaskColorFieldId, value: string) {
    setMaskCreateDraft((current) => ({
      ...current,
      colors: {
        ...current.colors,
        [fieldId]: value.toUpperCase()
      }
    }));
  }

  function updateMaskVoiceField(fieldId: MaskVoiceFieldId, value: number) {
    setMaskCreateDraft((current) => ({
      ...current,
      voice: {
        ...current.voice,
        [fieldId]: value
      }
    }));
  }

  function updateMaskPersonalityField(fieldId: MaskPersonalityFieldId, value: number) {
    setMaskCreateDraft((current) => ({
      ...current,
      personality: {
        ...current.personality,
        [fieldId]: value
      }
    }));
  }

  function updateMaskBoardDrawingStyle(style: MaskBoardDrawingStyle) {
    setMaskCreateDraft((current) => ({ ...current, boardDrawingStyle: style }));
  }

  function applyMaskDraftPatch(patch: MaskDraftPatch) {
    setMaskCreateDraft((current) => applyPatchToMaskDraft(current, patch));
  }

  function updateMaskBoardImage(file: File, source: Exclude<MaskBoardImageSource, null>, previewUrl: string) {
    setMaskCreateDraft((current) => {
      revokeMaskBoardPreview(current.boardImagePreviewUrl);

      return {
        ...current,
        boardImageFile: file,
        boardImagePreviewUrl: previewUrl,
        boardImageSource: source
      };
    });
  }

  function clearMaskBoardImage() {
    setMaskCreateDraft((current) => {
      revokeMaskBoardPreview(current.boardImagePreviewUrl);

      return {
        ...current,
        boardImageFile: null,
        boardImagePreviewUrl: "",
        boardImageSource: null
      };
    });
  }

  function selectMaskBoardImage(file: File | null) {
    if (!file) {
      return;
    }

    if (!isValidMaskBoardImage(file)) {
      toast.error(materialT("maskForm.invalidBoardImage"));
      return;
    }

    updateMaskBoardImage(file, "uploaded", createPreviewUrl(file));
  }

  async function sendMaskAiMessage(authenticatedViewer = viewer) {
    const instruction = maskAiInput.trim();

    if (!instruction || maskAiPending) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void sendMaskAiMessage(nextViewer);
      });
      return;
    }

    setMaskAiInput("");
    setMaskAiPending(true);
    setMaskCreateDraft((current) => ({
      ...current,
      aiMessages: [...current.aiMessages, { id: createClientId("mask-ai-user"), role: "user", content: instruction }]
    }));

    try {
      const result = await assistHomeMaskDraft(serializeMaskDraft(maskCreateDraft), instruction, locale);

      applyMaskDraftPatch(result.patch);
      setMaskCreateDraft((current) => ({
        ...current,
        aiMessages: [
          ...current.aiMessages,
          { id: createClientId("mask-ai-assistant"), role: "assistant", content: result.message }
        ]
      }));
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void sendMaskAiMessage(nextViewer);
        });
        return;
      }

      toast.error(resolveMaskAiError(error, materialT));
      setMaskAiInput(instruction);
    } finally {
      setMaskAiPending(false);
    }
  }

  async function generateMaskBoard(authenticatedViewer = viewer) {
    if (maskBoardPending) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void generateMaskBoard(nextViewer);
      });
      return;
    }

    setMaskBoardPending(true);

    try {
      const result = await generateHomeMaskBoard(serializeMaskDraft(maskCreateDraft), locale);
      const file = await dataUrlToFile(result.dataUrl, result.fileName, result.contentType);

      if (!isValidMaskBoardImage(file)) {
        toast.error(materialT("maskForm.invalidBoardImage"));
        return;
      }

      updateMaskBoardImage(file, "generated", result.dataUrl);
      toast.success(materialT("maskForm.boardGenerated"));
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void generateMaskBoard(nextViewer);
        });
        return;
      }

      toast.error(resolveMaskBoardError(error, materialT));
    } finally {
      setMaskBoardPending(false);
    }
  }

  async function submitMaskCreateDraft(authenticatedViewer = viewer) {
    if (!maskCreateDraft.name.trim()) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void submitMaskCreateDraft(nextViewer);
      });
      return;
    }

    if (!persistenceAvailable) {
      toast.error(t("errors.persistence"));
      return;
    }

    setMaskSavePending(true);

    try {
      const isEditing = Boolean(maskEditingMaterialId);
      const formData = new FormData();

      formData.append("draft", JSON.stringify(serializeMaskDraft(maskCreateDraft)));

      if (maskCreateDraft.boardImageFile) {
        if (!isValidMaskBoardImage(maskCreateDraft.boardImageFile)) {
          toast.error(materialT("maskForm.invalidBoardImage"));
          return;
        }

        formData.append("boardImage", maskCreateDraft.boardImageFile);
      }

      if (isEditing) {
        formData.append("boardImageMode", getMaskBoardImageMode(maskCreateDraft));
      }

      const material = isEditing
        ? await updateHomeMaskMaterial(maskEditingMaterialId, formData, locale)
        : await createHomeMaskMaterial(formData, locale);

      setMyMaterials((current) => upsertMaterialList(current, material));
      setCommunityMaterials((current) =>
        isEditing && current.some((item) => item.id === material.id) ? upsertMaterialList(current, material) : current
      );
      setMaterialStyle(material.style);
      toast.success(materialT(isEditing ? "maskForm.updateSuccess" : "maskForm.saveSuccess"));
      closeMaskCreateDialog();
      router.refresh();
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void submitMaskCreateDraft(nextViewer);
        });
        return;
      }

      toast.error(resolveMaskSaveError(error, materialT, Boolean(maskEditingMaterialId)));
    } finally {
      setMaskSavePending(false);
    }
  }

  function closeSceneCreateDialog() {
    setSceneCreateOpen(false);
    resetSceneCreateDraft();
  }

  function resetSceneCreateDraft() {
    const nextDraft = createDefaultSceneDraft();

    setSceneCreateDraft((current) => {
      revokeSceneDraftPreviews(current);

      return nextDraft;
    });
    setSceneActiveBlockId(nextDraft.blocks[0]?.id ?? "");
    setSceneAiInput("");
    setSceneAiMessages([]);
    setSceneEditingMaterialId("");
  }

  function openMaterialEditDialog(material: WorkspaceMaterial) {
    if (material.category === "mask") {
      openMaskEditDialog(material);
      return;
    }

    if (material.category === "scene") {
      openSceneEditDialog(material);
    }
  }

  function openSceneEditDialog(material: WorkspaceMaterial) {
    if (material.category !== "scene" || material.librarySource !== "SELF_CREATED") {
      return;
    }

    const nextDraft = createSceneDraftFromMaterial(material);

    setMaterialCreateMenuOpen(false);
    setSceneCreateDraft((current) => {
      revokeSceneDraftPreviews(current);

      return nextDraft;
    });
    setSceneActiveBlockId(nextDraft.blocks[0]?.id ?? "");
    setSceneAiInput("");
    setSceneAiMessages([]);
    setSceneEditingMaterialId(material.id);
    setSceneCreateOpen(true);
  }

  function updateSceneName(name: string) {
    setSceneCreateDraft((current) => ({ ...current, name }));
  }

  function updateSceneDescription(description: string) {
    setSceneCreateDraft((current) => ({ ...current, description }));
  }

  function updateSceneStyle(style: WorkspaceMaterialStyle) {
    setSceneCreateDraft((current) => ({ ...current, style }));
  }

  function updateScenePanoramaDrawingStyle(panoramaDrawingStyle: ScenePanoramaDrawingStyle) {
    setSceneCreateDraft((current) => ({ ...current, panoramaDrawingStyle }));
  }

  function updateSceneBlock(blockId: string, patch: Partial<Pick<SceneBlockDraft, "name" | "description">>) {
    setSceneCreateDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block))
    }));
  }

  function addSceneBlock() {
    const block = createDefaultSceneBlock();

    setSceneCreateDraft((current) => ({
      ...current,
      blocks: [...current.blocks, block]
    }));
    setSceneActiveBlockId(block.id);
  }

  function removeSceneBlock(blockId: string) {
    setSceneCreateDraft((current) => {
      const blockToRemove = current.blocks.find((block) => block.id === blockId);
      const remaining = current.blocks.filter((block) => block.id !== blockId);
      const nextBlocks = remaining.length > 0 ? remaining : [createDefaultSceneBlock()];

      if (blockToRemove) {
        revokeSceneBlockPreviews(blockToRemove);
      }

      if (!nextBlocks.some((block) => block.id === sceneActiveBlockId)) {
        setSceneActiveBlockId(nextBlocks[0]?.id ?? "");
      }

      return {
        ...current,
        blocks: nextBlocks
      };
    });
  }

  function applySceneDraftPatch(patch: SceneDraftPatch) {
    setSceneCreateDraft((current) => {
      const removeIds = new Set(patch.removeBlockIds ?? []);

      current.blocks.filter((block) => removeIds.has(block.id)).forEach(revokeSceneBlockPreviews);

      return applyPatchToSceneDraft(current, patch);
    });
  }

  function selectScenePanoramaFace(blockId: string, face: ScenePanoramaFace, file: File | null) {
    if (!file) {
      return;
    }

    if (!isValidScenePanoramaFace(file)) {
      toast.error(materialT("sceneForm.invalidPanoramaFace"));
      return;
    }

    updateScenePanoramaFace(blockId, face, {
      file,
      previewUrl: createPreviewUrl(file),
      source: "uploaded",
      storedUrl: null
    });
  }

  function updateScenePanoramaFace(blockId: string, face: ScenePanoramaFace, image: ScenePanoramaFaceDraft) {
    setSceneCreateDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== blockId) {
          return block;
        }

        const previousFace = block.panorama?.faces[face];

        if (previousFace) {
          revokeSceneFacePreview(previousFace);
        }

        return {
          ...block,
          panorama: {
            faceSource: image.source === "existing" ? block.panorama?.faceSource ?? "uploaded" : normalizeSceneFaceSource(image.source),
            faces: {
              ...(block.panorama?.faces ?? {}),
              [face]: image
            }
          }
        };
      })
    }));
  }

  function clearSceneBlockPanorama(blockId: string) {
    setSceneCreateDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== blockId) {
          return block;
        }

        revokeSceneBlockPreviews(block);

        return {
          ...block,
          panorama: null
        };
      })
    }));
  }

  async function sendSceneAiMessage(authenticatedViewer = viewer) {
    const instruction = sceneAiInput.trim();

    if (!instruction || sceneAiPending) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void sendSceneAiMessage(nextViewer);
      });
      return;
    }

    setSceneAiInput("");
    setSceneAiPending(true);
    setSceneAiMessages((current) => [...current, { id: createClientId("scene-ai-user"), role: "user", content: instruction }]);

    try {
      const result = await assistHomeSceneDraft(serializeSceneTextDraft(sceneCreateDraft), instruction, locale);

      applySceneDraftPatch(result.patch);
      setSceneAiMessages((current) => [
        ...current,
        { id: createClientId("scene-ai-assistant"), role: "assistant", content: result.message }
      ]);
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void sendSceneAiMessage(nextViewer);
        });
        return;
      }

      toast.error(resolveSceneAiError(error, materialT));
      setSceneAiInput(instruction);
    } finally {
      setSceneAiPending(false);
    }
  }

  async function generateScenePanorama(blockId: string, authenticatedViewer = viewer) {
    if (scenePanoramaPendingBlockId) {
      return;
    }

    const validationError = validateSceneBlockGeneration(sceneCreateDraft, blockId);

    if (validationError) {
      toast.error(materialT(validationError));
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void generateScenePanorama(blockId, nextViewer);
      });
      return;
    }

    setScenePanoramaPendingBlockId(blockId);

    try {
      const result = await generateHomeSceneBlockPanorama(serializeSceneTextDraft(sceneCreateDraft), blockId, locale);
      const faces = await Promise.all(
        scenePanoramaFaces.map(async (face) => {
          const image = result.faces[face];
          const file = await dataUrlToFile(image.dataUrl, image.fileName, image.contentType);

          if (!isValidScenePanoramaFace(file)) {
            throw new Error("INVALID_SCENE_PANORAMA_FACE_FILE");
          }

          return [
            face,
            {
              file,
              previewUrl: image.dataUrl,
              source: result.mode === "direct-cut" ? "direct-cut" : "reference-repaint",
              storedUrl: null
            } satisfies ScenePanoramaFaceDraft
          ] as const;
        })
      );

      setSceneCreateDraft((current) => ({
        ...current,
        blocks: current.blocks.map((block) => {
          if (block.id !== blockId) {
            return block;
          }

          revokeSceneBlockPreviews(block);

          return {
            ...block,
            panorama: {
              faceSource: result.mode === "direct-cut" ? "direct-cut" : "reference-repaint",
              faces: Object.fromEntries(faces)
            }
          };
        })
      }));
      toast.success(
        materialT(
          result.qualityBestEffort
            ? "sceneForm.panoramaGeneratedBestEffort"
            : result.mode === "direct-cut"
              ? "sceneForm.panoramaGeneratedFallback"
              : "sceneForm.panoramaGenerated"
        )
      );
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void generateScenePanorama(blockId, nextViewer);
        });
        return;
      }

      toast.error(resolveScenePanoramaError(error, materialT));
    } finally {
      setScenePanoramaPendingBlockId("");
    }
  }

  async function submitSceneCreateDraft(authenticatedViewer = viewer) {
    const validationError = validateSceneDraftForSave(sceneCreateDraft);

    if (validationError) {
      toast.error(materialT(validationError));
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void submitSceneCreateDraft(nextViewer);
      });
      return;
    }

    if (!persistenceAvailable) {
      toast.error(t("errors.persistence"));
      return;
    }

    setSceneSavePending(true);
    const uploadedFaceUrls: string[] = [];

    try {
      const isEditing = Boolean(sceneEditingMaterialId);
      const draft = await uploadSceneDraftPanoramaFaces(sceneCreateDraft, uploadedFaceUrls);
      const formData = new FormData();

      formData.append("draft", JSON.stringify(draft));
      formData.append("uploadedFaceUrls", JSON.stringify(uploadedFaceUrls));

      const material = isEditing
        ? await updateHomeSceneMaterial(sceneEditingMaterialId, formData, locale)
        : await createHomeSceneMaterial(formData, locale);

      setMyMaterials((current) => upsertMaterialList(current, material));
      setCommunityMaterials((current) =>
        isEditing && current.some((item) => item.id === material.id) ? upsertMaterialList(current, material) : current
      );
      setMaterialStyle(material.style);
      toast.success(materialT(isEditing ? "sceneForm.updateSuccess" : "sceneForm.saveSuccess"));
      closeSceneCreateDialog();
      router.refresh();
    } catch (error) {
      if (uploadedFaceUrls.length > 0) {
        await cleanupHomeUploadedMaterialImages(uploadedFaceUrls);
      }

      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void submitSceneCreateDraft(nextViewer);
        });
        return;
      }

      toast.error(resolveSceneSaveError(error, materialT, Boolean(sceneEditingMaterialId)));
    } finally {
      setSceneSavePending(false);
    }
  }

  function showPreviousScriptPage() {
    setScriptPickerPage((page) => (page === 0 ? scriptPickerPageCount - 1 : page - 1));
  }

  function showNextScriptPage() {
    setScriptPickerPage((page) => (page + 1) % scriptPickerPageCount);
  }

  function renderMaterialManager() {
    return (
      <div ref={materialScrollRef} className="scrollbar-autohide min-h-0 flex-1 overflow-y-auto px-4">
        <div className="absolute right-4 top-3 z-40 flex max-w-[calc(100%-2rem)] flex-wrap items-center justify-end gap-2">
          {isCommunityMaterialView ? (
            <button
              type="button"
              onClick={showMyMaterials}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {materialT("backToMine")}
            </button>
          ) : (
            <>
              <div ref={materialCreateMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMaterialCreateMenuOpen((open) => !open)}
                  aria-expanded={materialCreateMenuOpen}
                  aria-haspopup="menu"
                  disabled={isMaterialTransferDisabled}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-sm font-medium text-background transition hover:bg-foreground/88"
                >
                  {materialTransferPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  )}
                  {materialT("actions")}
                </button>
                <input
                  ref={materialImportInputRef}
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  className="sr-only"
                  aria-label={materialT("importZipFile")}
                  onChange={(event) => void importMaterialArchive(event.target.files?.[0] ?? null)}
                />
                {materialCreateMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-10 z-50 w-max min-w-36 overflow-hidden rounded-xl border border-border bg-background p-1.5 text-sm shadow-xl shadow-foreground/12"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => triggerMaterialImport()}
                      disabled={isMaterialTransferDisabled}
                      className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-foreground/78 transition hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Upload className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span>{materialT("importZip")}</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void exportMaterialArchive()}
                      disabled={isMaterialTransferDisabled}
                      className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-foreground/78 transition hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Download className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span>{materialT("exportAll")}</span>
                    </button>
                    <div className="my-1 border-t border-border" />
                    <p className="px-2.5 pb-1 pt-1 text-xs text-foreground/45">{materialT("chooseType")}</p>
                    {materialTypes.map((type) => {
                      const Icon = materialIcons[type];

                      return (
                        <button
                          type="button"
                          role="menuitem"
                          key={type}
                          onClick={() => selectMaterialCreateType(type)}
                          disabled={isMaterialTransferDisabled}
                          className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-foreground/78 transition hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground focus:outline-none"
                        >
                          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                          <span>{materialT(`types.${type}`)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={showCommunityMaterials}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <Globe2 className="h-4 w-4" aria-hidden="true" />
                {materialT("viewCommunity")}
              </button>
            </>
          )}
        </div>

        <div className="mx-auto w-full max-w-5xl">
          <div className="pt-12 text-center">
            <h1 className="text-4xl font-semibold tracking-normal">
              {materialT(isCommunityMaterialView ? "communityTitle" : "mineTitle")}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-foreground/58">
              {materialT(isCommunityMaterialView ? "communityDescription" : "mineDescription")}
            </p>
          </div>

          <div className="sticky top-0 z-20 mx-auto mt-6 max-w-3xl bg-background/95 pb-3 pt-3 backdrop-blur">
            <label className="mx-auto flex h-12 max-w-3xl items-center gap-3 rounded-2xl border border-border px-4 text-sm shadow-sm transition focus-within:border-foreground/28">
              <Search className="h-4 w-4 text-foreground/42" aria-hidden="true" />
              <span className="sr-only">{materialT("search")}</span>
              <input
                value={materialSearch}
                onChange={(event) => setMaterialSearch(event.target.value)}
                placeholder={materialT("search")}
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-foreground/42"
              />
            </label>

            <nav className="scrollbar-autohide mt-4 flex gap-4 overflow-x-auto border-b border-border">
              {materialStyles.map((style) => {
                const hasSection = materialsByStyle.some((group) => group.style === style);

                return (
                  <button
                    type="button"
                    key={style}
                    onClick={() => scrollToMaterialStyle(style)}
                    disabled={!hasSection}
                    className={cn(
                      "shrink-0 border-b px-1 pb-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-35",
                      materialStyle === style
                        ? "border-foreground text-foreground"
                        : "border-transparent text-foreground/52 hover:text-foreground"
                    )}
                  >
                    {materialT(`styles.${style}`)}
                  </button>
                );
              })}
            </nav>
          </div>

          {materialsByStyle.length === 0 ? (
            <p className="mx-auto mt-10 max-w-2xl rounded-2xl bg-muted/40 p-5 text-sm text-foreground/58">
              {materialT(isCommunityMaterialView ? "empty" : "mineEmpty")}
            </p>
          ) : (
            <div className="mx-auto mt-8 w-full max-w-3xl space-y-12 pb-16">
              {materialsByStyle.map((group) => (
                <section
                  key={group.style}
                  id={`material-style-${group.style}`}
                  ref={(node) => {
                    materialSectionRefs.current[group.style] = node;
                  }}
                  data-material-style={group.style}
                  className="scroll-mt-36"
                >
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-normal">{materialT(`styles.${group.style}`)}</h2>
                      <p className="text-sm text-foreground/50">
                        {materialT(isCommunityMaterialView ? "communitySectionSubtitle" : "mineSectionSubtitle")}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/50">
                      {materialT("itemCount", { count: group.materials.length })}
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {group.materials.map((material) => (
                      <MaterialExploreCard
                        key={material.id}
                        joinedLabel={materialT("joined")}
                        librarySourceLabel={
                          !isCommunityMaterialView && material.librarySource
                            ? materialT(material.librarySource === "SELF_CREATED" ? "source.selfCreated" : "source.communityAdded")
                            : undefined
                        }
                        material={material}
                        showJoined={isCommunityMaterialView}
                        styleLabel={materialT(`styles.${material.style}`)}
                        typeLabel={materialT(`types.${material.category}`)}
                        onOpen={() => setDetailMaterialId(material.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {detailMaterial ? (
          <MaterialDetailModal
            canDelete={!isCommunityMaterialView && detailMaterial.librarySource === "SELF_CREATED"}
            canEdit={
              !isCommunityMaterialView &&
              detailMaterial.librarySource === "SELF_CREATED" &&
              (detailMaterial.category === "mask" || detailMaterial.category === "scene")
            }
            canExport={!isCommunityMaterialView && detailMaterial.librarySource === "SELF_CREATED"}
            canShare={!isCommunityMaterialView && detailMaterial.librarySource === "SELF_CREATED"}
            closeLabel={materialT("close")}
            deleteLabel={materialT("delete")}
            editLabel={materialT("edit")}
            exportLabel={materialT("export")}
            isCommunityView={isCommunityMaterialView}
            isPending={isPending || materialTransferPending}
            joinedLabel={materialT("joined")}
            joinLabel={materialT("join")}
            material={detailMaterial}
            previewAlt={materialT("previewAlt")}
            previewCloseLabel={materialT("previewClose")}
            previewOpenLabel={materialT("previewOpen")}
            shareDisabledLabel={materialT("shareDisabled")}
            shareEnabledLabel={materialT("shareEnabled")}
            shareHint={materialT("shareHint")}
            shareLabel={materialT("shareToCommunity")}
            styleLabel={materialT(`styles.${detailMaterial.style}`)}
            sourceLabel={
              detailMaterial.librarySource
                ? materialT(detailMaterial.librarySource === "SELF_CREATED" ? "source.selfCreated" : "source.communityAdded")
                : undefined
            }
            typeLabel={materialT(`types.${detailMaterial.category}`)}
            t={materialT}
            onClose={() => setDetailMaterialId("")}
            onDelete={handleDeleteMaterial}
            onEdit={openMaterialEditDialog}
            onExport={(material) => void exportMaterialArchive(material.id)}
            onJoin={handleJoinMaterial}
            onToggleShare={handleToggleMaterialCommunitySharing}
          />
        ) : null}
        {maskCreateOpen ? (
          <MaskCreateDialog
            aiInput={maskAiInput}
            aiPending={maskAiPending}
            boardPending={maskBoardPending}
            description={materialT(isEditingMask ? "maskForm.editDescription" : "maskForm.description")}
            draft={maskCreateDraft}
            isPending={isPending || isMaskActionPending}
            onCancel={closeMaskCreateDialog}
            onChangeBodyField={updateMaskBodyField}
            onChangeColorField={updateMaskColorField}
            onChangeAiInput={setMaskAiInput}
            onChangeFeatures={updateMaskFeatures}
            onChangeIntro={updateMaskIntro}
            onChangeName={updateMaskName}
            onChangePersonalityField={updateMaskPersonalityField}
            onChangeStyle={updateMaskStyle}
            onChangeVoiceField={updateMaskVoiceField}
            onClearBoardImage={clearMaskBoardImage}
            onChangeBoardDrawingStyle={updateMaskBoardDrawingStyle}
            onGenerateBoard={() => void generateMaskBoard()}
            onSelectBoardImage={selectMaskBoardImage}
            onSendAiMessage={() => void sendMaskAiMessage()}
            onSubmit={submitMaskCreateDraft}
            saveLabel={materialT(isEditingMask ? "maskForm.saveEdit" : "saveMask")}
            t={materialT}
            title={materialT(isEditingMask ? "maskForm.editTitle" : "maskForm.title")}
          />
        ) : null}
        {sceneCreateOpen ? (
          <SceneCreateDialog
            activeBlockId={sceneActiveBlockId || (sceneCreateDraft.blocks[0]?.id ?? "")}
            aiInput={sceneAiInput}
            aiMessages={sceneAiMessages}
            aiPending={sceneAiPending}
            draft={sceneCreateDraft}
            isPending={isPending || isSceneActionPending}
            panoramaPendingBlockId={scenePanoramaPendingBlockId}
            saveLabel={materialT(isEditingScene ? "sceneForm.saveEdit" : "saveScene")}
            title={materialT(isEditingScene ? "sceneForm.editTitle" : "sceneForm.title")}
            description={materialT(isEditingScene ? "sceneForm.editDescription" : "sceneForm.description")}
            onAddBlock={addSceneBlock}
            onCancel={closeSceneCreateDialog}
            onChangeActiveBlock={setSceneActiveBlockId}
            onChangeAiInput={setSceneAiInput}
            onChangeBlock={updateSceneBlock}
            onChangeDescription={updateSceneDescription}
            onChangeName={updateSceneName}
            onChangePanoramaDrawingStyle={updateScenePanoramaDrawingStyle}
            onChangeStyle={updateSceneStyle}
            onClearBlockPanorama={clearSceneBlockPanorama}
            onGeneratePanorama={(blockId) => void generateScenePanorama(blockId)}
            onRemoveBlock={removeSceneBlock}
            onSelectFace={selectScenePanoramaFace}
            onSendAiMessage={() => void sendSceneAiMessage()}
            onSubmit={submitSceneCreateDraft}
            t={materialT}
          />
        ) : null}
      </div>
    );
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

          <button
            type="button"
            onClick={showMaterialManager}
            className={cn(
              "mt-1 inline-flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm transition hover:bg-background",
              viewMode === "materialManager" && "bg-background shadow-sm",
              sidebarCollapsed ? "justify-center" : "justify-start"
            )}
            title={t("materials")}
          >
            <Images className="h-4 w-4 text-foreground/58" aria-hidden="true" />
            {!sidebarCollapsed ? t("materials") : null}
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
        {viewMode !== "scriptManager" && viewMode !== "materialManager" ? (
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
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm">
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
        ) : viewMode === "materialManager" ? (
          renderMaterialManager()
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

function resolveSendError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-llm")) {
    return t("errors.missingDefaultLlm");
  }

  if (message.includes("missing-provider-secret")) {
    return t("errors.missingProviderSecret");
  }

  return t("errors.send");
}

function mergeScripts(primaryScripts: WorkspaceScript[], preferredScripts: WorkspaceScript[]) {
  const scriptsById = new Map<string, WorkspaceScript>();

  primaryScripts.forEach((script) => scriptsById.set(script.id, script));
  preferredScripts.forEach((script) => scriptsById.set(script.id, script));

  return Array.from(scriptsById.values());
}

function mergeMaterials(primaryMaterials: WorkspaceMaterial[], preferredMaterials: WorkspaceMaterial[]) {
  const materialsById = new Map<string, WorkspaceMaterial>();

  primaryMaterials.forEach((material) => materialsById.set(material.id, material));
  preferredMaterials.forEach((material) => materialsById.set(material.id, material));

  return Array.from(materialsById.values());
}

function upsertMaterialList(materials: WorkspaceMaterial[], material: WorkspaceMaterial) {
  const exists = materials.some((item) => item.id === material.id);

  if (!exists) {
    return [material, ...materials];
  }

  return materials.map((item) => (item.id === material.id ? material : item));
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

function MaterialExploreCard({
  joinedLabel,
  librarySourceLabel,
  material,
  onOpen,
  showJoined,
  styleLabel,
  typeLabel
}: {
  joinedLabel: string;
  librarySourceLabel?: string;
  material: WorkspaceMaterial;
  onOpen: () => void;
  showJoined: boolean;
  styleLabel: string;
  typeLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid gap-4 rounded-2xl border border-border bg-background p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 sm:grid-cols-[8.5rem_minmax(0,1fr)]"
    >
      <MaterialPreview compact material={material} styleLabel={styleLabel} />
      <span className="flex min-h-28 min-w-0 flex-col py-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-base font-semibold">{material.title}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/58">
            {typeLabel}
          </span>
          {librarySourceLabel ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/50">
              {librarySourceLabel}
            </span>
          ) : null}
          {showJoined && material.inLibrary ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/56">
              <Check className="h-3 w-3" aria-hidden="true" />
              {joinedLabel}
            </span>
          ) : null}
        </span>
        <span className="mt-2 line-clamp-3 text-sm leading-6 text-foreground/64">{material.description}</span>
        <span className="mt-auto flex items-center justify-between gap-3 pt-3 text-xs text-foreground/42">
          <span className="truncate">{material.slug}</span>
        </span>
      </span>
    </button>
  );
}

function MaterialDetailModal({
  closeLabel,
  canDelete,
  canEdit,
  canExport,
  canShare,
  deleteLabel,
  editLabel,
  exportLabel,
  isCommunityView,
  isPending,
  joinedLabel,
  joinLabel,
  material,
  onClose,
  onDelete,
  onEdit,
  onExport,
  onJoin,
  onToggleShare,
  previewAlt,
  previewCloseLabel,
  previewOpenLabel,
  shareDisabledLabel,
  shareEnabledLabel,
  shareHint,
  shareLabel,
  sourceLabel,
  styleLabel,
  t,
  typeLabel
}: {
  closeLabel: string;
  canDelete: boolean;
  canEdit: boolean;
  canExport: boolean;
  canShare: boolean;
  deleteLabel: string;
  editLabel: string;
  exportLabel: string;
  isCommunityView: boolean;
  isPending: boolean;
  joinedLabel: string;
  joinLabel: string;
  material: WorkspaceMaterial;
  onClose: () => void;
  onDelete: (material: WorkspaceMaterial) => void;
  onEdit: (material: WorkspaceMaterial) => void;
  onExport: (material: WorkspaceMaterial) => void;
  onJoin: (materialId: string) => void;
  onToggleShare: (material: WorkspaceMaterial, shared: boolean) => void;
  previewAlt: string;
  previewCloseLabel: string;
  previewOpenLabel: string;
  shareDisabledLabel: string;
  shareEnabledLabel: string;
  shareHint: string;
  shareLabel: string;
  sourceLabel?: string;
  styleLabel: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  typeLabel: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!previewOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [previewOpen]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm">
      <section
        className="flex h-[53rem] max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex h-12 shrink-0 justify-end px-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/58 transition hover:bg-muted hover:text-foreground"
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="scrollbar-autohide min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <MaterialPreview
            fit="contain"
            material={material}
            previewAlt={previewAlt}
            previewOpenLabel={previewOpenLabel}
            styleLabel={styleLabel}
            onPreviewOpen={material.previewUrl ? () => setPreviewOpen(true) : undefined}
          />
          <div className="mx-auto mt-5 max-w-md text-center">
            <h2 className="text-2xl font-semibold tracking-normal">{material.title}</h2>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/58">
                {styleLabel}
              </span>
              <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/58">
                {typeLabel}
              </span>
              {sourceLabel ? (
                <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/58">
                  {sourceLabel}
                </span>
              ) : null}
              {material.inLibrary ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/58">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {joinedLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-5 text-sm leading-7 text-foreground/72">{material.description}</p>
            <p className="mt-4 text-xs text-foreground/42">{material.slug}</p>
          </div>
          {material.category === "mask" ? <MaskMaterialDetail metadata={material.metadata} t={t} /> : null}
          {material.category === "scene" ? <SceneMaterialDetail key={material.id} metadata={material.metadata} t={t} /> : null}
        </div>

        <div className="shrink-0 border-t border-border bg-background px-4 py-3">
          {isCommunityView ? (
            <button
              type="button"
              onClick={() => onJoin(material.id)}
              disabled={isPending || material.inLibrary}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : material.inLibrary ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              {material.inLibrary ? joinedLabel : joinLabel}
            </button>
          ) : (
            <div className="space-y-2">
              {canShare ? (
                <label className="flex cursor-pointer items-center justify-between gap-3 px-1 py-1.5 text-left">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground/76">{shareLabel}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-foreground/48">{shareHint}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-2">
                    <span className="text-xs text-foreground/52">
                      {material.communityVisible ? shareEnabledLabel : shareDisabledLabel}
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={material.communityVisible}
                      disabled={isPending}
                      onChange={(event) => onToggleShare(material, event.target.checked)}
                      className="peer sr-only"
                      aria-label={shareLabel}
                    />
                    <span
                      className="relative h-6 w-11 rounded-full bg-muted transition after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-background after:shadow-sm after:transition peer-checked:bg-foreground peer-checked:after:translate-x-5 peer-disabled:opacity-45"
                      aria-hidden="true"
                    />
                  </span>
                </label>
              ) : null}
              {canEdit || canDelete || canExport ? (
                <div className="flex flex-wrap gap-2">
                  {canExport ? (
                    <button
                      type="button"
                      onClick={() => onExport(material)}
                      disabled={isPending}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-foreground/44"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      {exportLabel}
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(material)}
                      disabled={isPending}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-foreground/44"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      {editLabel}
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(material)}
                      disabled={isPending}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-foreground/44"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      {deleteLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {previewOpen && material.previewUrl ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/32 p-4 backdrop-blur-sm">
            <section className="relative max-h-[92vh] max-w-[92vw]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={material.previewUrl}
                alt={previewAlt}
                className="max-h-[92vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl shadow-foreground/30"
              />
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/90 text-foreground/68 shadow-sm transition hover:bg-background hover:text-foreground"
                aria-label={previewCloseLabel}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MaskMaterialDetail({
  metadata,
  t
}: {
  metadata: WorkspaceMaterialMetadata | undefined | null;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const record = getMaskMaterialMetadata(metadata);

  if (!record || record.kind !== "mask") {
    return null;
  }

  const body = getNestedRecord(record.body);
  const colors = getNestedRecord(record.colors);
  const voice = getNestedRecord(record.voice);
  const personality = getNestedRecord(record.personality);

  return (
    <div className="mx-auto mt-8 max-w-md space-y-6 text-left">
      <MaskDetailTextBlock title={t("maskForm.intro")} value={record.intro} />
      <MaskDetailTextBlock title={t("maskForm.features")} value={record.features} preserveLines />
      <MaskDetailKeyValues
        title={t("maskForm.bodyTitle")}
        entries={maskBodyFields.map((field) => ({
          label: t(`maskForm.bodyFields.${field.id}.label`),
          value: getRecordString(body, field.id)
        }))}
      />
      <MaskDetailColors
        title={t("maskForm.colorTitle")}
        entries={maskColorFields.map((field) => ({
          label: t(`maskForm.colorFields.${field.id}.label`),
          value: getRecordString(colors, field.id)
        }))}
      />
      <MaskDetailKeyValues
        title={t("maskForm.voiceTitle")}
        entries={maskVoiceFields.map((field) => ({
          label: t(`maskForm.voiceFields.${field.id}.label`),
          value: getRecordNumber(voice, field.id) === null ? "" : getMaskVoiceDetailLabel(field.id, getRecordNumber(voice, field.id) ?? 0, t)
        }))}
      />
      <MaskDetailKeyValues
        title={t("maskForm.personalityTitle")}
        entries={maskPersonalityGroups.flatMap((group) =>
          group.fields.map((fieldId) => ({
            label: t(`maskForm.personalityFields.${fieldId}.label`),
            value:
              getRecordNumber(personality, fieldId) === null
                ? ""
                : getMaskPersonalityDetailLabel(fieldId, getRecordNumber(personality, fieldId) ?? 0, t)
          }))
        )}
      />
    </div>
  );
}

function SceneMaterialDetail({
  metadata,
  t
}: {
  metadata: WorkspaceMaterialMetadata | undefined | null;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const record = getSceneMaterialMetadata(metadata);
  const [activeBlockId, setActiveBlockId] = useState(record?.blocks[0]?.id ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!record || record.kind !== "scene") {
    return null;
  }

  const activeBlock = record.blocks.find((block) => block.id === activeBlockId) ?? record.blocks[0];
  const faces = activeBlock?.panorama
    ? scenePanoramaFaces.reduce<Record<ScenePanoramaFace, string>>((result, face) => {
        result[face] = activeBlock.panorama?.faces[face]?.url ?? "";

        return result;
      }, {} as Record<ScenePanoramaFace, string>)
    : null;
  const completeFaces = faces && isCompleteScenePanoramaFaceUrls(faces) ? faces : null;

  return (
    <div className="mx-auto mt-8 max-w-md space-y-6 text-left">
      <MaskDetailTextBlock title={t("sceneForm.sceneDescription")} value={record.description} preserveLines />
      <section>
        <div className="mb-3 flex flex-wrap gap-2">
          {record.blocks.map((block) => (
            <button
              key={block.id}
              type="button"
              onClick={() => setActiveBlockId(block.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                block.id === activeBlock?.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-foreground/58 hover:bg-muted"
              )}
            >
              {block.name}
            </button>
          ))}
        </div>
        {activeBlock ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground/72">{activeBlock.name}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-foreground/68">{activeBlock.description}</p>
            </div>
            <ScenePanoramaViewer
              faces={completeFaces}
              emptyLabel={t("sceneForm.panoramaEmpty")}
              expandLabel={t("sceneForm.panoramaPreviewOpen")}
              onExpand={completeFaces ? () => setPreviewOpen(true) : undefined}
            />
          </div>
        ) : null}
      </section>
      {previewOpen && completeFaces ? (
        <ScenePanoramaPreviewDialog
          faces={completeFaces}
          onClose={() => setPreviewOpen(false)}
          t={t}
        />
      ) : null}
    </div>
  );
}

function MaskDetailTextBlock({
  preserveLines,
  title,
  value
}: {
  preserveLines?: boolean;
  title: string;
  value: unknown;
}) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground/72">{title}</h3>
      <p className={cn("mt-2 text-sm leading-7 text-foreground/68", preserveLines ? "whitespace-pre-line" : "")}>
        {value.trim()}
      </p>
    </section>
  );
}

function getRecordString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];

  return typeof value === "string" ? value : "";
}

function getRecordNumber(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getMaskVoiceDetailLabel(
  fieldId: MaskVoiceFieldId,
  value: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return t(`maskForm.voiceFields.${fieldId}.ticks.${getTraitTickKey(value, getMaskVoiceRange(fieldId))}`);
}

function getMaskPersonalityDetailLabel(
  fieldId: MaskPersonalityFieldId,
  value: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  const level = getTraitLevel(value);

  if (level === "balanced") {
    return t("maskForm.detailTraitLevels.balanced");
  }

  const direction = level === "veryLow" || level === "low" ? "low" : "high";

  return t(`maskForm.detailTraitLevels.${level}`, {
    description: t(`maskForm.personalityFields.${fieldId}.${direction}`)
  });
}

function getMaskVoiceRange(fieldId: MaskVoiceFieldId) {
  return maskVoiceFields.find((field) => field.id === fieldId) ?? { min: 0, max: 100 };
}

function getTraitTickKey(value: number, range: { min: number; max: number }) {
  const normalizedValue = getNormalizedTraitValue(value, range);

  if (normalizedValue <= 20) {
    return "first";
  }

  if (normalizedValue <= 40) {
    return "second";
  }

  if (normalizedValue <= 60) {
    return "third";
  }

  if (normalizedValue <= 80) {
    return "fourth";
  }

  return "fifth";
}

function getTraitLevel(value: number) {
  const normalizedValue = getNormalizedTraitValue(value, { min: 0, max: 100 });

  if (normalizedValue <= 15) {
    return "veryLow";
  }

  if (normalizedValue <= 35) {
    return "low";
  }

  if (normalizedValue < 65) {
    return "balanced";
  }

  if (normalizedValue < 85) {
    return "high";
  }

  return "veryHigh";
}

function getNormalizedTraitValue(value: number, range: { min: number; max: number }) {
  if (range.max <= range.min) {
    return 50;
  }

  return Math.min(100, Math.max(0, ((value - range.min) / (range.max - range.min)) * 100));
}

function MaskDetailKeyValues({
  entries,
  title
}: {
  entries: Array<{ label: string; value: string | number }>;
  title: string;
}) {
  const visibleEntries = entries.filter((entry) => String(entry.value).trim());

  if (visibleEntries.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground/72">{title}</h3>
      <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {visibleEntries.map((entry) => (
          <div key={entry.label} className="min-w-0">
            <dt className="text-xs text-foreground/42">{entry.label}</dt>
            <dd className="mt-0.5 break-words text-sm text-foreground/72">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MaskDetailColors({
  entries,
  title
}: {
  entries: Array<{ label: string; value: string }>;
  title: string;
}) {
  const visibleEntries = entries.filter((entry) => /^#[0-9a-f]{6}$/i.test(entry.value));

  if (visibleEntries.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground/72">{title}</h3>
      <dl className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {visibleEntries.map((entry) => (
          <div key={entry.label} className="flex min-w-0 items-center gap-2">
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-border shadow-sm"
              style={{ backgroundColor: entry.value }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="text-xs text-foreground/42">{entry.label}</dt>
              <dd className="text-sm font-medium text-foreground/72">{entry.value.toUpperCase()}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MaterialPreview({
  compact,
  fit = "cover",
  material,
  onPreviewOpen,
  previewAlt,
  previewOpenLabel,
  styleLabel
}: {
  compact?: boolean;
  fit?: "cover" | "contain";
  material: WorkspaceMaterial;
  onPreviewOpen?: () => void;
  previewAlt?: string;
  previewOpenLabel?: string;
  styleLabel: string;
}) {
  const Icon = materialIcons[material.category];
  const previewClassName = fit === "contain" ? "object-contain" : "object-cover";
  const hasPreview = Boolean(material.previewUrl);

  return (
    <span
      className={cn(
        "relative flex w-full shrink-0 items-center justify-center overflow-hidden rounded-xl",
        compact ? "h-28" : "aspect-video",
        hasPreview
          ? "bg-muted/25 text-foreground shadow-sm ring-1 ring-border/70"
          : cn("text-white shadow-inner", getMaterialAccent(material.category))
      )}
    >
      {material.previewUrl ? (
        onPreviewOpen ? (
          <button
            type="button"
            onClick={onPreviewOpen}
            className="group relative h-full w-full cursor-zoom-in overflow-hidden"
            aria-label={previewOpenLabel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={material.previewUrl} alt="" className={cn("h-full w-full bg-background", previewClassName)} />
            <span className="absolute inset-0 bg-foreground/0 transition group-hover:bg-foreground/5" aria-hidden="true" />
            <span className="absolute right-2 top-2 rounded-full bg-background/88 p-1.5 text-foreground shadow-sm">
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </button>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={material.previewUrl} alt={previewAlt ?? ""} className={cn("h-full w-full bg-background", previewClassName)} />
        )
      ) : (
        <>
          <span
            className="absolute inset-0 opacity-25 [background-image:linear-gradient(135deg,hsl(var(--background)/0.22)_0_25%,transparent_25%_50%,hsl(var(--background)/0.22)_50%_75%,transparent_75%)] [background-size:1.1rem_1.1rem]"
            aria-hidden="true"
          />
          <Icon className={cn("relative drop-shadow", compact ? "h-9 w-9" : "h-14 w-14")} aria-hidden="true" />
        </>
      )}
      <span className="absolute left-2 top-2 rounded-full bg-background/88 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm">
        {styleLabel}
      </span>
    </span>
  );
}

function MaskCreateDialog({
  aiInput,
  aiPending,
  boardPending,
  draft,
  isPending,
  saveLabel,
  title,
  description,
  onCancel,
  onChangeBodyField,
  onChangeColorField,
  onChangeAiInput,
  onChangeFeatures,
  onChangeIntro,
  onChangeName,
  onChangePersonalityField,
  onChangeStyle,
  onChangeVoiceField,
  onClearBoardImage,
  onChangeBoardDrawingStyle,
  onGenerateBoard,
  onSelectBoardImage,
  onSendAiMessage,
  onSubmit,
  t
}: {
  aiInput: string;
  aiPending: boolean;
  boardPending: boolean;
  draft: MaskCreateDraft;
  isPending: boolean;
  saveLabel: string;
  title: string;
  description: string;
  onCancel: () => void;
  onChangeBodyField: (fieldId: MaskBodyFieldId, value: string) => void;
  onChangeColorField: (fieldId: MaskColorFieldId, value: string) => void;
  onChangeAiInput: (value: string) => void;
  onChangeFeatures: (features: string) => void;
  onChangeIntro: (intro: string) => void;
  onChangeName: (value: string) => void;
  onChangePersonalityField: (fieldId: MaskPersonalityFieldId, value: number) => void;
  onChangeStyle: (style: WorkspaceMaterialStyle) => void;
  onChangeVoiceField: (fieldId: MaskVoiceFieldId, value: number) => void;
  onClearBoardImage: () => void;
  onChangeBoardDrawingStyle: (style: MaskBoardDrawingStyle) => void;
  onGenerateBoard: () => void;
  onSelectBoardImage: (file: File | null) => void;
  onSendAiMessage: () => void;
  onSubmit: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm">
      <section
        className="flex h-[48rem] max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
            <p className="mt-1 text-sm text-foreground/55">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/58 transition hover:bg-muted hover:text-foreground"
            aria-label={t("close")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.85fr)_minmax(20rem,1fr)]">
          <form
            className="scrollbar-autohide min-h-0 overflow-y-auto px-5 py-5"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground/70">{t("maskForm.basicTitle")}</h3>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
                  <label className="block space-y-2 text-sm">
                    <span className="text-foreground/64">{t("maskForm.name")}</span>
                    <input
                      value={draft.name}
                      onChange={(event) => onChangeName(event.target.value)}
                      placeholder={t("maskForm.namePlaceholder")}
                      className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition placeholder:text-foreground/38 focus:border-primary"
                    />
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span className="text-foreground/64">{t("maskForm.style")}</span>
                    <select
                      value={draft.style}
                      onChange={(event) => onChangeStyle(event.target.value as WorkspaceMaterialStyle)}
                      className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
                    >
                      {materialStyles.map((style) => (
                        <option key={style} value={style}>
                          {t(`styles.${style}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="space-y-2 text-sm">
                  <label htmlFor="mask-intro" className="block text-foreground/64">
                    {t("maskForm.intro")}
                  </label>
                  <textarea
                    id="mask-intro"
                    value={draft.intro}
                    onChange={(event) => onChangeIntro(event.target.value)}
                    placeholder={t("maskForm.introPlaceholder")}
                    rows={4}
                    className="min-h-24 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-foreground/38 focus:border-primary"
                  />
                  <span className="block text-xs text-foreground/42">{t("maskForm.introHint")}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <label htmlFor="mask-features" className="block text-foreground/64">
                    {t("maskForm.features")}
                  </label>
                  <textarea
                    id="mask-features"
                    value={draft.features}
                    onChange={(event) => onChangeFeatures(event.target.value)}
                    placeholder={t("maskForm.featuresPlaceholder")}
                    rows={5}
                    className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-foreground/38 focus:border-primary"
                  />
                  <span className="block text-xs text-foreground/42">{t("maskForm.featuresHint")}</span>
                </div>
              </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground/70">{t("maskForm.bodyTitle")}</h3>
              <p className="text-xs text-foreground/48">{t("maskForm.bodyDescription")}</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {maskBodyFields.map((field) => {
                  const unit = "unit" in field ? t(`maskForm.units.${field.unit}`) : undefined;

                  return (
                    <BodyTextField
                      key={field.id}
                      fieldId={field.id}
                      inputMode={unit ? "decimal" : "text"}
                      label={t(`maskForm.bodyFields.${field.id}.label`)}
                      options={field.options.map((option) => getMaskBodyOptionLabel(field.id, option, t))}
                      placeholder={unit ? t("maskForm.numericPlaceholder") : t("maskForm.inputPlaceholder")}
                      unit={unit}
                      value={draft.body[field.id]}
                      onChange={onChangeBodyField}
                      t={t}
                    />
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground/70">{t("maskForm.colorTitle")}</h3>
              <p className="text-xs text-foreground/48">{t("maskForm.colorDescription")}</p>
              <div className="grid gap-4 md:grid-cols-2">
                {maskColorFields.map((field) => (
                  <ColorField
                    key={field.id}
                    fieldId={field.id}
                    label={t(`maskForm.colorFields.${field.id}.label`)}
                    palette={field.swatches}
                    value={draft.colors[field.id]}
                    onChange={onChangeColorField}
                    t={t}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground/70">{t("maskForm.voiceTitle")}</h3>
              <p className="text-xs text-foreground/48">{t("maskForm.voiceDescription")}</p>
              <div className="grid gap-4 xl:grid-cols-2">
                {maskVoiceFields.map((field) => (
                  <MaskRangeField
                    key={field.id}
                    description={t(`maskForm.voiceFields.${field.id}.description`)}
                    displayValue={getMaskVoiceValueLabel(field.id, draft.voice[field.id], t)}
                    highLabel={t(`maskForm.voiceFields.${field.id}.high`)}
                    id={`mask-voice-${field.id}`}
                    label={t(`maskForm.voiceFields.${field.id}.label`)}
                    lowLabel={t(`maskForm.voiceFields.${field.id}.low`)}
                    max={field.max}
                    min={field.min}
                    ticks={["first", "second", "third", "fourth", "fifth"].map((tick) =>
                      t(`maskForm.voiceFields.${field.id}.ticks.${tick}`)
                    )}
                    value={draft.voice[field.id]}
                    onChange={(value) => onChangeVoiceField(field.id, value)}
                    t={t}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground/70">{t("maskForm.personalityTitle")}</h3>
              <p className="text-xs text-foreground/48">{t("maskForm.personalityDescription")}</p>
              <div className="space-y-5">
                {maskPersonalityGroups.map((group) => (
                  <div key={group.id} className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/48">
                      {t(`maskForm.personalityGroups.${group.id}`)}
                    </h4>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {group.fields.map((fieldId) => (
                        <MaskRangeField
                          key={fieldId}
                          displayValue={t("maskForm.scoreValue", { value: draft.personality[fieldId] })}
                          highLabel={t(`maskForm.personalityFields.${fieldId}.high`)}
                          id={`mask-personality-${fieldId}`}
                          label={t(`maskForm.personalityFields.${fieldId}.label`)}
                          lowLabel={t(`maskForm.personalityFields.${fieldId}.low`)}
                          max={100}
                          min={0}
                          value={draft.personality[fieldId]}
                          onChange={(value) => onChangePersonalityField(fieldId, value)}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              </section>
            </div>
          </form>

          <aside className="scrollbar-autohide flex min-h-0 flex-col overflow-y-auto border-t border-border bg-muted/14 p-4 lg:border-l lg:border-t-0">
            <MaskAssistantPanel
              input={aiInput}
              isPending={aiPending}
              messages={draft.aiMessages}
              onChangeInput={onChangeAiInput}
              onSend={onSendAiMessage}
              t={t}
            />
            <MaskBoardPanel
              draft={draft}
              isPending={boardPending}
              onClearImage={onClearBoardImage}
              onChangeDrawingStyle={onChangeBoardDrawingStyle}
              onGenerate={onGenerateBoard}
              onSelectImage={onSelectBoardImage}
              t={t}
            />
          </aside>
        </div>

        <footer className="shrink-0 border-t border-border bg-background px-5 py-4">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              onClick={onSubmit}
              disabled={!draft.name.trim() || isPending}
              className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
            >
              {saveLabel}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function MaskAssistantPanel({
  input,
  isPending,
  messages,
  onChangeInput,
  onSend,
  t
}: {
  input: string;
  isPending: boolean;
  messages: MaskAiMessage[];
  onChangeInput: (value: string) => void;
  onSend: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <section className="flex min-h-[18rem] flex-1 flex-col border-b border-border/70 pb-4" aria-label={t("maskForm.aiTitle")}>
      <div className="scrollbar-autohide min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg bg-background/72 p-2">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-background/55 p-3 text-xs leading-5 text-foreground/48">
            {t("maskForm.aiEmpty")}
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-lg px-3 py-2 text-xs leading-5",
                message.role === "user" ? "ml-8 bg-foreground text-background" : "mr-8 bg-background text-foreground/70"
              )}
            >
              {message.content}
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(event) => onChangeInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={t("maskForm.aiPlaceholder")}
          rows={2}
          className="min-h-11 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-5 outline-none transition placeholder:text-foreground/38 focus:border-primary"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!input.trim() || isPending}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
          aria-label={t("maskForm.aiSend")}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
}

function MaskBoardPanel({
  draft,
  isPending,
  onClearImage,
  onChangeDrawingStyle,
  onGenerate,
  onSelectImage,
  t
}: {
  draft: MaskCreateDraft;
  isPending: boolean;
  onClearImage: () => void;
  onChangeDrawingStyle: (style: MaskBoardDrawingStyle) => void;
  onGenerate: () => void;
  onSelectImage: (file: File | null) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceLabel = draft.boardImageSource ? t(`maskForm.boardSource.${draft.boardImageSource}`) : "";
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!previewOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [previewOpen]);

  return (
    <section className="pt-4" aria-label={t("maskForm.boardTitle")}>
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <label className="block">
          <span className="sr-only">{t("maskForm.boardDrawingStyle")}</span>
          <select
            value={draft.boardDrawingStyle}
            onChange={(event) => onChangeDrawingStyle(event.target.value as MaskBoardDrawingStyle)}
            className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary"
            aria-label={t("maskForm.boardDrawingStyle")}
          >
            {maskBoardDrawingStyles.map((style) => (
              <option key={style} value={style}>
                {t(`maskForm.boardDrawingStyles.${style}`)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {t("maskForm.boardGenerate")}
        </button>
      </div>

      <div className="relative">
        {draft.boardImagePreviewUrl ? (
          <>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="group relative flex aspect-video w-full overflow-hidden rounded-xl border border-border bg-background/70 text-left transition hover:border-primary/40"
              aria-label={t("maskForm.boardPreviewOpen")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.boardImagePreviewUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 bg-foreground/0 transition group-hover:bg-foreground/5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPreviewOpen(false);
                onClearImage();
              }}
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground/68 shadow-sm transition hover:bg-background hover:text-foreground"
              aria-label={t("maskForm.boardRemove")}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="group flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background/70 text-left transition hover:border-primary/40"
          >
            <span className="flex flex-col items-center gap-2 px-4 text-center text-sm text-foreground/52">
              {t("maskForm.boardEmpty")}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={t("maskForm.boardUpload")}
        onChange={(event) => {
          onSelectImage(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />

      {draft.boardImageSource || draft.boardImageFile ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/46">
          <span>{sourceLabel}</span>
          {draft.boardImageFile ? <span className="max-w-40 truncate">{draft.boardImageFile.name}</span> : null}
        </div>
      ) : null}

      {previewOpen && draft.boardImagePreviewUrl ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/28 p-3 backdrop-blur-sm">
          <section className="relative max-h-[92vh] max-w-[92vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={draft.boardImagePreviewUrl}
              alt={t("maskForm.boardPreviewAlt")}
              className="max-h-[92vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl shadow-foreground/30"
            />
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/90 text-foreground/68 shadow-sm transition hover:bg-background hover:text-foreground"
              aria-label={t("maskForm.boardPreviewClose")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function SceneCreateDialog({
  activeBlockId,
  aiInput,
  aiMessages,
  aiPending,
  draft,
  description,
  isPending,
  panoramaPendingBlockId,
  saveLabel,
  title,
  onAddBlock,
  onCancel,
  onChangeActiveBlock,
  onChangeAiInput,
  onChangeBlock,
  onChangeDescription,
  onChangeName,
  onChangePanoramaDrawingStyle,
  onChangeStyle,
  onClearBlockPanorama,
  onGeneratePanorama,
  onRemoveBlock,
  onSelectFace,
  onSendAiMessage,
  onSubmit,
  t
}: {
  activeBlockId: string;
  aiInput: string;
  aiMessages: SceneAiMessage[];
  aiPending: boolean;
  draft: SceneCreateDraft;
  description: string;
  isPending: boolean;
  panoramaPendingBlockId: string;
  saveLabel: string;
  title: string;
  onAddBlock: () => void;
  onCancel: () => void;
  onChangeActiveBlock: (blockId: string) => void;
  onChangeAiInput: (value: string) => void;
  onChangeBlock: (blockId: string, patch: Partial<Pick<SceneBlockDraft, "name" | "description">>) => void;
  onChangeDescription: (value: string) => void;
  onChangeName: (value: string) => void;
  onChangePanoramaDrawingStyle: (style: ScenePanoramaDrawingStyle) => void;
  onChangeStyle: (style: WorkspaceMaterialStyle) => void;
  onClearBlockPanorama: (blockId: string) => void;
  onGeneratePanorama: (blockId: string) => void;
  onRemoveBlock: (blockId: string) => void;
  onSelectFace: (blockId: string, face: ScenePanoramaFace, file: File | null) => void;
  onSendAiMessage: () => void;
  onSubmit: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const activeBlock = draft.blocks.find((block) => block.id === activeBlockId) ?? draft.blocks[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm">
      <section className="flex h-[48rem] max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-3">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">{title}</h2>
            <p className="mt-0.5 text-sm text-foreground/55">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/58 transition hover:bg-muted hover:text-foreground"
            aria-label={t("close")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(22rem,1fr)]">
          <form
            className="scrollbar-autohide min-h-0 overflow-y-auto px-5 py-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <div className="space-y-4">
              <section className="space-y-2.5">
                <h3 className="text-sm font-semibold text-foreground/70">{t("sceneForm.basicTitle")}</h3>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem_11rem]">
                  <label className="block space-y-1.5 text-sm">
                    <span className="text-foreground/64">{t("sceneForm.name")}</span>
                    <input
                      value={draft.name}
                      onChange={(event) => onChangeName(event.target.value)}
                      placeholder={t("sceneForm.namePlaceholder")}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition placeholder:text-foreground/38 focus:border-primary"
                    />
                  </label>
                  <label className="block space-y-1.5 text-sm">
                    <span className="text-foreground/64">{t("sceneForm.style")}</span>
                    <select
                      value={draft.style}
                      onChange={(event) => onChangeStyle(event.target.value as WorkspaceMaterialStyle)}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
                    >
                      {materialStyles.map((style) => (
                        <option key={style} value={style}>
                          {t(`styles.${style}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5 text-sm">
                    <span className="text-foreground/64">{t("sceneForm.panoramaDrawingStyle")}</span>
                    <select
                      value={draft.panoramaDrawingStyle}
                      onChange={(event) => onChangePanoramaDrawingStyle(event.target.value as ScenePanoramaDrawingStyle)}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
                    >
                      {maskBoardDrawingStyles.map((style) => (
                        <option key={style} value={style}>
                          {t(`sceneForm.panoramaDrawingStyles.${style}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-foreground/64">{t("sceneForm.sceneDescription")}</span>
                  <textarea
                    value={draft.description}
                    onChange={(event) => onChangeDescription(event.target.value)}
                    placeholder={t("sceneForm.sceneDescriptionPlaceholder")}
                    rows={3}
                    className="min-h-20 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-foreground/38 focus:border-primary"
                  />
                </label>
              </section>

              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground/70">{t("sceneForm.blocksTitle")}</h3>
                    <p className="text-xs text-foreground/48">{t("sceneForm.blocksDescription")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onAddBlock}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-sm font-medium transition hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {t("sceneForm.addBlock")}
                  </button>
                </div>

                <div className="space-y-3">
                  {draft.blocks.map((block, index) => {
                    const isActive = block.id === activeBlock?.id;
                    const blockFaces = getCompleteScenePanoramaFaceUrls(block.panorama);

                    return (
                      <section
                        key={block.id}
                        className={cn(
                          "rounded-xl border p-3 transition",
                          isActive ? "border-primary/55 bg-primary/5" : "border-border bg-background"
                        )}
                      >
                        <div className="mb-2.5 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onChangeActiveBlock(block.id)}
                            className="inline-flex min-w-0 items-center gap-2 text-left text-sm font-semibold text-foreground/76"
                          >
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                              {index + 1}
                            </span>
                            <span className="truncate">{block.name || t("sceneForm.untitledBlock")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveBlock(block.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/48 transition hover:bg-muted hover:text-foreground"
                            aria-label={t("sceneForm.removeBlock")}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[13rem_minmax(0,1fr)]">
                          <label className="block space-y-1.5 text-sm">
                            <span className="text-foreground/64">{t("sceneForm.blockName")}</span>
                            <input
                              value={block.name}
                              onFocus={() => onChangeActiveBlock(block.id)}
                              onChange={(event) => onChangeBlock(block.id, { name: event.target.value })}
                              placeholder={t("sceneForm.blockNamePlaceholder")}
                              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition placeholder:text-foreground/38 focus:border-primary"
                            />
                          </label>
                          <label className="block space-y-1.5 text-sm">
                            <span className="text-foreground/64">{t("sceneForm.blockDescription")}</span>
                            <textarea
                              value={block.description}
                              onFocus={() => onChangeActiveBlock(block.id)}
                              onChange={(event) => onChangeBlock(block.id, { description: event.target.value })}
                              placeholder={t("sceneForm.blockDescriptionPlaceholder")}
                              rows={2}
                              className="min-h-16 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-foreground/38 focus:border-primary"
                            />
                          </label>
                        </div>

                        <SceneBlockPanoramaPanel
                          block={block}
                          faces={blockFaces}
                          isPending={panoramaPendingBlockId === block.id}
                          isBlocked={Boolean(panoramaPendingBlockId)}
                          onClear={() => onClearBlockPanorama(block.id)}
                          onGenerate={() => {
                            onChangeActiveBlock(block.id);
                            onGeneratePanorama(block.id);
                          }}
                          onSelectFace={(face, file) => {
                            onChangeActiveBlock(block.id);
                            onSelectFace(block.id, face, file);
                          }}
                          t={t}
                        />
                      </section>
                    );
                  })}
                </div>
              </section>
            </div>
          </form>

          <aside className="flex min-h-0 flex-col border-t border-border bg-muted/14 p-4 lg:border-l lg:border-t-0">
            <SceneAssistantPanel
              input={aiInput}
              isPending={aiPending}
              messages={aiMessages}
              onChangeInput={onChangeAiInput}
              onSend={onSendAiMessage}
              t={t}
            />
          </aside>
        </div>

        <footer className="shrink-0 border-t border-border bg-background px-5 py-3">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              onClick={onSubmit}
              disabled={isPending}
              className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
            >
              {saveLabel}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function SceneBlockPanoramaPanel({
  block,
  faces,
  isBlocked,
  isPending,
  onClear,
  onGenerate,
  onSelectFace,
  t
}: {
  block: SceneBlockDraft;
  faces: Record<ScenePanoramaFace, string> | null;
  isBlocked: boolean;
  isPending: boolean;
  onClear: () => void;
  onGenerate: () => void;
  onSelectFace: (face: ScenePanoramaFace, file: File | null) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <section className="mt-3 space-y-2.5 border-t border-border/70 pt-3" aria-label={t("sceneForm.panoramaTitle")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground/70">{t("sceneForm.panoramaTitle")}</h4>
          <p className="text-xs text-foreground/48">{t("sceneForm.panoramaDescription")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {block.panorama ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium text-foreground/68 transition hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("sceneForm.clearPanorama")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onGenerate}
            disabled={isBlocked}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            {t("sceneForm.generatePanorama")}
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(16rem,1fr)]">
        <ScenePanoramaViewer
          faces={faces}
          emptyLabel={t("sceneForm.panoramaEmpty")}
          expandLabel={t("sceneForm.panoramaPreviewOpen")}
          onExpand={faces ? () => setPreviewOpen(true) : undefined}
        />

        <div className="grid grid-cols-3 gap-2">
          {scenePanoramaFaces.map((face) => {
            const image = block.panorama?.faces[face];

            return (
              <label
                key={face}
                className="group flex min-h-20 cursor-pointer flex-col justify-between overflow-hidden rounded-lg border border-border bg-background/70 text-xs transition hover:border-primary/40"
              >
                <span className="flex items-center justify-between gap-2 px-2 py-1.5 text-foreground/52">
                  <span>{t(`sceneForm.faces.${face}`)}</span>
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {image?.previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={image.previewUrl} alt="" className="h-14 w-full object-cover" />
                ) : (
                  <span className="flex h-14 items-center justify-center px-2 text-center text-foreground/38">
                    {t("sceneForm.faceEmpty")}
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label={t("sceneForm.faceUpload", { face: t(`sceneForm.faces.${face}`) })}
                  onChange={(event) => {
                    onSelectFace(face, event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
              </label>
            );
          })}
        </div>
      </div>
      {previewOpen && faces ? (
        <ScenePanoramaPreviewDialog
          faces={faces}
          onClose={() => setPreviewOpen(false)}
          t={t}
        />
      ) : null}
    </section>
  );
}

function SceneAssistantPanel({
  input,
  isPending,
  messages,
  onChangeInput,
  onSend,
  t
}: {
  input: string;
  isPending: boolean;
  messages: SceneAiMessage[];
  onChangeInput: (value: string) => void;
  onSend: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={t("sceneForm.aiTitle")}>
      <h3 className="mb-3 text-sm font-semibold text-foreground/70">{t("sceneForm.aiTitle")}</h3>
      <div className="scrollbar-autohide min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg bg-background/72 p-2">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-background/55 p-3 text-xs leading-5 text-foreground/48">
            {t("sceneForm.aiEmpty")}
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-lg px-3 py-2 text-xs leading-5",
                message.role === "user" ? "ml-8 bg-foreground text-background" : "mr-8 bg-background text-foreground/70"
              )}
            >
              {message.content}
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(event) => onChangeInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={t("sceneForm.aiPlaceholder")}
          rows={2}
          className="min-h-11 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-5 outline-none transition placeholder:text-foreground/38 focus:border-primary"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!input.trim() || isPending}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
          aria-label={t("sceneForm.aiSend")}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
}

function ScenePanoramaViewer({
  className,
  emptyLabel,
  expandLabel,
  faces,
  onExpand
}: {
  className?: string;
  emptyLabel: string;
  expandLabel?: string;
  faces: Record<ScenePanoramaFace, string> | null;
  onExpand?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onExpandRef = useRef(onExpand);
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    onExpandRef.current = onExpand;
  }, [onExpand]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !faces) {
      setWebglReady(false);
      return;
    }

    const currentFaces = faces;
    let disposed = false;
    let cleanup = () => {};

    async function init() {
      setWebglReady(false);

      try {
        const canvas = document.createElement("canvas");
        const hasWebgl = Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));

        if (!hasWebgl || !containerRef.current) {
          setWebglReady(false);
          return;
        }

        const THREE = await import("three");
        THREE.ColorManagement.enabled = true;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
        camera.position.set(0, 0, 0.1);
        const loader = new THREE.CubeTextureLoader();
        let cubeTexture: import("three").CubeTexture | null = null;
        let observer: ResizeObserver | null = null;
        const removeListeners: Array<() => void> = [];
        let lon = 0;
        let lat = 0;
        let pointerDown = false;
        let startX = 0;
        let startY = 0;
        let startLon = 0;
        let startLat = 0;
        let movedSincePointerDown = false;

        loader.setCrossOrigin("anonymous");
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.domElement.style.display = "block";
        renderer.domElement.style.touchAction = "none";
        containerRef.current.appendChild(renderer.domElement);
        cleanup = () => {
          observer?.disconnect();
          removeListeners.forEach((removeListener) => removeListener());
          cubeTexture?.dispose();
          renderer.domElement.remove();
          renderer.dispose();
        };

        cubeTexture = await new Promise<import("three").CubeTexture>((resolve, reject) => {
          loader.load(
            scenePanoramaThreeFaceOrder.map((face) => currentFaces[face]),
            resolve,
            undefined,
            reject
          );
        });

        if (disposed) {
          cleanup();
          return;
        }

        cubeTexture.colorSpace = THREE.SRGBColorSpace;
        scene.background = cubeTexture;
        scene.environment = cubeTexture;

        function updateCamera() {
          lat = Math.max(-85, Math.min(85, lat));
          const phi = THREE.MathUtils.degToRad(90 - lat);
          const theta = THREE.MathUtils.degToRad(lon);

          camera.lookAt(
            new THREE.Vector3(
              Math.sin(phi) * Math.cos(theta),
              Math.cos(phi),
              Math.sin(phi) * Math.sin(theta)
            )
          );
        }

        function render() {
          updateCamera();
          renderer.render(scene, camera);
        }

        function resize() {
          if (!containerRef.current) {
            return;
          }

          const width = Math.max(1, containerRef.current.clientWidth);
          const height = Math.max(1, containerRef.current.clientHeight);

          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
          render();
        }

        function onPointerDown(event: PointerEvent) {
          pointerDown = true;
          movedSincePointerDown = false;
          startX = event.clientX;
          startY = event.clientY;
          startLon = lon;
          startLat = lat;
          renderer.domElement.setPointerCapture(event.pointerId);
          renderer.domElement.classList.add("cursor-grabbing");
        }

        function onPointerMove(event: PointerEvent) {
          if (!pointerDown) {
            return;
          }

          const deltaX = event.clientX - startX;
          const deltaY = event.clientY - startY;

          movedSincePointerDown ||= Math.hypot(deltaX, deltaY) > 6;
          lon = startLon - deltaX * 0.12;
          lat = startLat + deltaY * 0.12;
          render();
        }

        function onPointerUp(event: PointerEvent) {
          const shouldExpand = pointerDown && !movedSincePointerDown && event.type === "pointerup" && Boolean(onExpandRef.current);

          pointerDown = false;
          renderer.domElement.classList.remove("cursor-grabbing");

          if (renderer.domElement.hasPointerCapture(event.pointerId)) {
            renderer.domElement.releasePointerCapture(event.pointerId);
          }

          if (shouldExpand) {
            onExpandRef.current?.();
          }
        }

        function onWheel(event: WheelEvent) {
          event.preventDefault();
          camera.fov = Math.max(35, Math.min(95, camera.fov + Math.sign(event.deltaY) * 5));
          camera.updateProjectionMatrix();
          render();
        }

        observer = new ResizeObserver(resize);

        renderer.domElement.className = "h-full w-full cursor-grab rounded-xl";
        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerup", onPointerUp);
        renderer.domElement.addEventListener("pointercancel", onPointerUp);
        renderer.domElement.addEventListener("lostpointercapture", onPointerUp);
        renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
        removeListeners.push(
          () => renderer.domElement.removeEventListener("pointerdown", onPointerDown),
          () => renderer.domElement.removeEventListener("pointermove", onPointerMove),
          () => renderer.domElement.removeEventListener("pointerup", onPointerUp),
          () => renderer.domElement.removeEventListener("pointercancel", onPointerUp),
          () => renderer.domElement.removeEventListener("lostpointercapture", onPointerUp),
          () => renderer.domElement.removeEventListener("wheel", onWheel)
        );
        observer.observe(containerRef.current);
        resize();
        setWebglReady(true);
      } catch {
        cleanup();
        setWebglReady(false);
      }
    }

    void init();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [faces]);

  if (!faces) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-xl border border-dashed border-border bg-background/70 px-4 text-center text-sm text-foreground/48",
          className ?? "aspect-video"
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl border border-border bg-background/70", className ?? "aspect-video")}>
      <div ref={containerRef} className="absolute inset-0" />
      {!webglReady ? (
        <div className="grid h-full grid-cols-3 gap-1 p-1">
          {scenePanoramaFaces.map((face) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={face} src={faces[face]} alt="" className="h-full w-full rounded-md object-cover" />
          ))}
        </div>
      ) : null}
      {!webglReady && onExpand ? (
        <button
          type="button"
          onClick={onExpand}
          className="absolute inset-0 cursor-zoom-in"
          aria-label={expandLabel ?? ""}
        >
          <span className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/88 text-foreground/68 shadow-sm backdrop-blur transition hover:bg-background hover:text-foreground">
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
      ) : null}
      {webglReady && onExpand ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onExpand();
          }}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/88 text-foreground/68 shadow-sm backdrop-blur transition hover:bg-background hover:text-foreground"
          aria-label={expandLabel ?? ""}
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function ScenePanoramaPreviewDialog({
  faces,
  onClose,
  t
}: {
  faces: Record<ScenePanoramaFace, string>;
  onClose: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-3 backdrop-blur-sm sm:p-5">
      <section className="relative flex h-[min(82vh,52rem)] w-[min(94vw,76rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-foreground/25">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground/72">{t("sceneForm.panoramaPreviewTitle")}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground/68 transition hover:bg-muted hover:text-foreground"
            aria-label={t("sceneForm.panoramaPreviewClose")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <ScenePanoramaViewer
          className="min-h-0 flex-1 rounded-none border-0"
          faces={faces}
          emptyLabel={t("sceneForm.panoramaEmpty")}
        />
      </section>
    </div>
  );
}

function BodyTextField({
  fieldId,
  inputMode,
  label,
  options,
  onChange,
  placeholder,
  t,
  unit,
  value
}: {
  fieldId: MaskBodyFieldId;
  inputMode: "decimal" | "text";
  label: string;
  options: string[];
  onChange: (fieldId: MaskBodyFieldId, value: string) => void;
  placeholder: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  unit?: string;
  value: string;
}) {
  const inputId = `mask-body-${fieldId}`;
  const [isOpen, setIsOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const keyword = value.trim().toLowerCase();
  const visibleOptions = options.filter((option) => option.toLowerCase().includes(keyword)).slice(0, 8);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsidePointer(event: MouseEvent) {
      if (!fieldRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={fieldRef} className="relative block space-y-2 text-sm">
      <label htmlFor={inputId} className="block text-foreground/64">
        {label}
      </label>
      <span className="flex h-11 items-center rounded-md border border-border bg-background px-3 transition focus-within:border-primary">
        <input
          id={inputId}
          aria-label={label}
          inputMode={inputMode}
          value={value}
          onFocus={() => setIsOpen(options.length > 0)}
          onChange={(event) => {
            onChange(fieldId, event.target.value);
            setIsOpen(options.length > 0);
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/38"
        />
        {options.length > 0 ? (
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground/45 transition hover:bg-muted hover:text-foreground"
            aria-label={t("maskForm.openSuggestions", { field: label })}
          >
            <ChevronDown className={cn("h-4 w-4 transition", isOpen ? "rotate-180" : "")} aria-hidden="true" />
          </button>
        ) : null}
        {unit ? <span className="ml-2 shrink-0 text-xs text-foreground/45">{unit}</span> : null}
      </span>
      {isOpen && options.length > 0 ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[4.35rem] z-40 max-h-56 overflow-y-auto rounded-xl border border-border bg-background p-1.5 shadow-2xl shadow-foreground/12"
        >
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={value === option}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(fieldId, option);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted",
                  value === option ? "bg-muted text-foreground" : "text-foreground/70"
                )}
              >
                <span className="min-w-0 truncate">{option}</span>
                {value === option ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-foreground/45">{t("maskForm.suggestionsEmpty")}</p>
          )}
        </div>
      ) : null}
      {options.length > 0 ? (
        <span className="block truncate text-xs text-foreground/42">
          {t("maskForm.suggestionsLabel", { values: options.slice(0, 4).join(" / ") })}
        </span>
      ) : null}
    </div>
  );
}

function MaskRangeField({
  description,
  displayValue,
  highLabel,
  id,
  label,
  lowLabel,
  max,
  min,
  onChange,
  t,
  ticks,
  value
}: {
  description?: string;
  displayValue: string;
  highLabel: string;
  id: string;
  label: string;
  lowLabel: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  ticks?: string[];
  value: number;
}) {
  const activeTick = ticks?.[getRangeLevelIndex(value, min, max)];

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/18 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label htmlFor={id} className="text-sm font-medium text-foreground/72">
            {label}
          </label>
          {description ? <p className="mt-1 text-xs leading-5 text-foreground/48">{description}</p> : null}
        </div>
        <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground/62">
          {displayValue}
        </span>
      </div>

      {activeTick ? <p className="text-xs font-medium text-foreground/66">{activeTick}</p> : null}

      <input
        id={id}
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-primary"
      />

      {ticks ? (
        <div className="grid grid-cols-5 gap-1 text-center text-[11px] text-foreground/45">
          {ticks.map((tick) => (
            <span key={tick} className="min-w-0 truncate">
              {tick}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2 text-xs leading-5 text-foreground/50 sm:grid-cols-2">
        <p>
          <span className="font-medium text-foreground/58">{t("maskForm.lowValueLabel")}</span>
          {lowLabel}
        </p>
        <p>
          <span className="font-medium text-foreground/58">{t("maskForm.highValueLabel")}</span>
          {highLabel}
        </p>
      </div>
    </div>
  );
}

function ColorField({
  fieldId,
  label,
  onChange,
  palette,
  t,
  value
}: {
  fieldId: MaskColorFieldId;
  label: string;
  onChange: (fieldId: MaskColorFieldId, value: string) => void;
  palette: readonly string[];
  t: (key: string, values?: Record<string, string | number>) => string;
  value: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/18 p-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-foreground/72">{label}</label>
        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground/55">{value.toUpperCase()}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(fieldId, color)}
            className={cn(
              "h-8 w-8 rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
              value === color ? "border-foreground scale-105 shadow-md" : "border-border hover:scale-105"
            )}
            style={{ backgroundColor: color }}
            aria-label={t("maskForm.colorSwatchLabel", { color, field: label })}
            title={color}
          />
        ))}
        <label className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs text-foreground/62">
          <span>{t("maskForm.pickColor")}</span>
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(fieldId, event.target.value)}
            className="h-5 w-5 cursor-pointer rounded border-none bg-transparent p-0"
            aria-label={t("maskForm.colorPickerLabel", { field: label })}
          />
        </label>
      </div>
    </div>
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

function createDefaultMaskDraft(): MaskCreateDraft {
  return {
    name: "",
    intro: "",
    features: "",
    style: "realistic",
    body: {
      hairStyle: "",
      browShape: "",
      faceShape: "",
      eyeShape: "",
      noseType: "",
      mouthShape: "",
      earShape: "",
      height: "170",
      weight: "60",
      gender: "",
      ageStage: "",
      bodyType: ""
    },
    colors: {
      hairColor: "#1F1A17",
      eyeColor: "#3D6EA8",
      browColor: "#5C4033",
      skinColor: "#D8AA78"
    },
    voice: {
      pitch: 50,
      speechSpeed: 150,
      volume: 50,
      intonation: 50,
      emotionExposure: 50,
      nasalResonance: 50,
      breathiness: 50
    },
    personality: {
      extroversion: 50,
      dominance: 50,
      rationality: 50,
      emotionalStability: 50,
      confidence: 50,
      affinity: 50,
      sharingDesire: 50,
      humor: 50,
      aggression: 50,
      politeness: 50,
      coquetry: 50,
      sensitivity: 50,
      possessiveness: 50,
      dependency: 50,
      proactiveCare: 50,
      boundaries: 50,
      loyalty: 50,
      action: 50,
      curiosity: 50,
      performative: 50
    },
    boardDrawingStyle: "realistic",
    boardImagePreviewUrl: "",
    boardImageFile: null,
    boardImageSource: null,
    aiMessages: []
  };
}

function createDefaultSceneDraft(): SceneCreateDraft {
  const firstBlock = createDefaultSceneBlock();

  return {
    name: "",
    description: "",
    style: "realistic",
    panoramaDrawingStyle: "realistic",
    blocks: [firstBlock]
  };
}

function createDefaultSceneBlock(): SceneBlockDraft {
  return {
    id: createClientId("scene-block"),
    name: "",
    description: "",
    panorama: null
  };
}

function createMaskDraftFromMaterial(material: WorkspaceMaterial): MaskCreateDraft {
  const draft = createDefaultMaskDraft();
  const metadata = getMaskMaterialMetadata(material.metadata);
  const bodyRecord = getNestedRecord(metadata?.body) as Partial<Record<MaskBodyFieldId, string>> | null;
  const colorRecord = getNestedRecord(metadata?.colors) as Partial<Record<MaskColorFieldId, string>> | null;
  const voiceRecord = getNestedRecord(metadata?.voice) as Partial<Record<MaskVoiceFieldId, number>> | null;
  const personalityRecord = getNestedRecord(metadata?.personality) as Partial<Record<MaskPersonalityFieldId, number>> | null;
  const body = pickKnownStringPatch(bodyRecord ?? {}, maskBodyFields.map((field) => field.id));
  const colors = pickKnownColorPatch(colorRecord ?? {}, maskColorFields.map((field) => field.id));
  const voice = pickKnownNumberPatch(voiceRecord ?? {}, maskVoiceFields);
  const personality = pickKnownNumberPatch(
    personalityRecord ?? {},
    maskPersonalityGroups.flatMap((group) => group.fields).map((id) => ({ id, min: 0, max: 100 }))
  );
  const boardImage = getNestedRecord(metadata?.boardImage);
  const boardImagePreviewUrl =
    typeof boardImage?.url === "string" && boardImage.url ? boardImage.url : material.previewUrl ?? "";
  const boardImageSource = boardImage?.source;

  return {
    ...draft,
    name: typeof metadata?.name === "string" && metadata.name.trim() ? metadata.name : material.title,
    intro: typeof metadata?.intro === "string" ? metadata.intro : material.description,
    features: typeof metadata?.features === "string" ? metadata.features : "",
    style: typeof metadata?.style === "string" && isWorkspaceMaterialStyle(metadata.style) ? metadata.style : material.style,
    body: body ? { ...draft.body, ...body } : draft.body,
    colors: colors ? { ...draft.colors, ...colors } : draft.colors,
    voice: voice ? { ...draft.voice, ...voice } : draft.voice,
    personality: personality ? { ...draft.personality, ...personality } : draft.personality,
    boardDrawingStyle:
      typeof metadata?.boardDrawingStyle === "string" && isMaskBoardDrawingStyle(metadata.boardDrawingStyle)
        ? metadata.boardDrawingStyle
        : draft.boardDrawingStyle,
    boardImagePreviewUrl,
    boardImageFile: null,
    boardImageSource:
      boardImageSource === "generated" || boardImageSource === "uploaded"
        ? boardImageSource
        : boardImagePreviewUrl
          ? "uploaded"
          : null,
    aiMessages: []
  };
}

function createSceneDraftFromMaterial(material: WorkspaceMaterial): SceneCreateDraft {
  const metadata = getSceneMaterialMetadata(material.metadata);

  if (!metadata || metadata.kind !== "scene") {
    return {
      ...createDefaultSceneDraft(),
      name: material.title,
      description: material.description,
      style: material.style
    };
  }

  const blocks = metadata.blocks.length > 0 ? metadata.blocks.map((block) => ({
    id: block.id,
    name: block.name,
    description: block.description,
    panorama: block.panorama
      ? {
          faceSource: block.panorama.faceSource,
          faces: scenePanoramaFaces.reduce<Partial<Record<ScenePanoramaFace, ScenePanoramaFaceDraft>>>((faces, face) => {
            const url = block.panorama?.faces[face]?.url ?? "";

            if (url) {
              faces[face] = {
                file: null,
                previewUrl: url,
                source: "existing",
                storedUrl: url
              };
            }

            return faces;
          }, {})
        }
      : null
  })) : [createDefaultSceneBlock()];

  return {
    name: metadata.name || material.title,
    description: metadata.description || material.description,
    style: typeof metadata.style === "string" && isWorkspaceMaterialStyle(metadata.style) ? metadata.style : material.style,
    panoramaDrawingStyle:
      typeof metadata.panoramaDrawingStyle === "string" && isScenePanoramaDrawingStyle(metadata.panoramaDrawingStyle)
        ? metadata.panoramaDrawingStyle
        : "realistic",
    blocks
  };
}

function serializeMaskDraft(draft: MaskCreateDraft) {
  return {
    name: draft.name,
    intro: draft.intro,
    features: draft.features,
    style: draft.style,
    body: draft.body,
    colors: draft.colors,
    voice: draft.voice,
    personality: draft.personality,
    boardDrawingStyle: draft.boardDrawingStyle,
    boardImageSource: draft.boardImageSource
  };
}

function serializeSceneTextDraft(draft: SceneCreateDraft): SceneMaterialCreateInput {
  return {
    name: draft.name,
    description: draft.description,
    style: draft.style,
    panoramaDrawingStyle: draft.panoramaDrawingStyle,
    blocks: draft.blocks.map((block) => ({
      id: block.id,
      name: block.name,
      description: block.description,
      panorama: null
    }))
  };
}

function getMaskBoardImageMode(draft: MaskCreateDraft): "keep" | "replace" | "clear" {
  if (draft.boardImageFile) {
    return "replace";
  }

  if (draft.boardImagePreviewUrl) {
    return "keep";
  }

  return "clear";
}

function applyPatchToSceneDraft(draft: SceneCreateDraft, patch: SceneDraftPatch): SceneCreateDraft {
  const removeIds = new Set(patch.removeBlockIds ?? []);
  const updatedBlocks = draft.blocks
    .filter((block) => !removeIds.has(block.id))
    .map((block) => {
      const update = patch.updateBlocks?.find((item) => item.id === block.id);

      return update
        ? {
            ...block,
            ...(typeof update.name === "string" ? { name: update.name } : {}),
            ...(typeof update.description === "string" ? { description: update.description } : {})
          }
        : block;
    });
  const addedBlocks = (patch.addBlocks ?? []).map((block) => ({
    id: block.id || createClientId("scene-block"),
    name: block.name,
    description: block.description,
    panorama: null
  }));
  const blocks = [...updatedBlocks, ...addedBlocks];

  return {
    ...draft,
    ...(typeof patch.name === "string" ? { name: patch.name } : {}),
    ...(typeof patch.description === "string" ? { description: patch.description } : {}),
    ...(patch.style ? { style: patch.style } : {}),
    blocks: blocks.length > 0 ? blocks : [createDefaultSceneBlock()]
  };
}

function applyPatchToMaskDraft(draft: MaskCreateDraft, patch: MaskDraftPatch): MaskCreateDraft {
  return {
    ...draft,
    ...(typeof patch.name === "string" ? { name: patch.name } : {}),
    ...(typeof patch.intro === "string" ? { intro: patch.intro } : {}),
    ...(typeof patch.features === "string" ? { features: patch.features } : {}),
    ...(patch.style ? { style: patch.style } : {}),
    body: patch.body ? { ...draft.body, ...pickKnownStringPatch(patch.body, maskBodyFields.map((field) => field.id)) } : draft.body,
    colors: patch.colors ? { ...draft.colors, ...pickKnownColorPatch(patch.colors, maskColorFields.map((field) => field.id)) } : draft.colors,
    voice: patch.voice ? { ...draft.voice, ...pickKnownNumberPatch(patch.voice, maskVoiceFields) } : draft.voice,
    personality: patch.personality
      ? { ...draft.personality, ...pickKnownNumberPatch(patch.personality, maskPersonalityGroups.flatMap((group) => group.fields).map((id) => ({ id, min: 0, max: 100 }))) }
      : draft.personality
  };
}

function pickKnownStringPatch<T extends string>(patch: Partial<Record<T, string>>, keys: readonly T[]) {
  return keys.reduce<Partial<Record<T, string>>>((result, key) => {
    if (typeof patch[key] === "string") {
      result[key] = patch[key];
    }

    return result;
  }, {});
}

function pickKnownColorPatch<T extends string>(patch: Partial<Record<T, string>>, keys: readonly T[]) {
  return keys.reduce<Partial<Record<T, string>>>((result, key) => {
    const value = patch[key];

    if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) {
      result[key] = value.toUpperCase();
    }

    return result;
  }, {});
}

function pickKnownNumberPatch<T extends string>(
  patch: Partial<Record<T, number>>,
  fields: readonly { id: T; min: number; max: number }[]
) {
  return fields.reduce<Partial<Record<T, number>>>((result, field) => {
    const value = patch[field.id];

    if (typeof value === "number" && Number.isFinite(value)) {
      result[field.id] = Math.min(field.max, Math.max(field.min, Math.round(value)));
    }

    return result;
  }, {});
}

function getMaskMaterialMetadata(metadata: WorkspaceMaterialMetadata | undefined | null) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  return metadata as Record<string, unknown>;
}

function getSceneMaterialMetadata(metadata: WorkspaceMaterialMetadata | undefined | null): WorkspaceSceneMaterialMetadata | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Partial<WorkspaceSceneMaterialMetadata>;

  return record.kind === "scene" && Array.isArray(record.blocks) ? record as WorkspaceSceneMaterialMetadata : null;
}

function getNestedRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function isWorkspaceMaterialStyle(style: string): style is WorkspaceMaterialStyle {
  return materialStyles.includes(style as WorkspaceMaterialStyle);
}

function isMaskBoardDrawingStyle(style: string): style is MaskBoardDrawingStyle {
  return maskBoardDrawingStyles.includes(style as MaskBoardDrawingStyle);
}

function isScenePanoramaDrawingStyle(style: string): style is ScenePanoramaDrawingStyle {
  return maskBoardDrawingStyles.includes(style as ScenePanoramaDrawingStyle);
}

function isValidMaskBoardImage(file: File) {
  return maskBoardAcceptedTypes.includes(file.type.toLowerCase()) && file.size > 0 && file.size <= maxMaskBoardImageBytes;
}

function isValidScenePanoramaFace(file: File) {
  return scenePanoramaAcceptedTypes.includes(file.type.toLowerCase()) && file.size > 0 && file.size <= maxScenePanoramaFaceBytes;
}

function normalizeSceneFaceSource(source: ScenePanoramaFaceDraft["source"]): ScenePanoramaDraft["faceSource"] {
  if (source === "existing") {
    return "uploaded";
  }

  return source;
}

function isCompleteScenePanoramaFaceUrls(faces: Record<ScenePanoramaFace, string>) {
  return scenePanoramaFaces.every((face) => Boolean(faces[face]));
}

function getCompleteScenePanoramaFaceUrls(panorama: ScenePanoramaDraft | null) {
  if (!panorama) {
    return null;
  }

  const faces = scenePanoramaFaces.reduce<Record<ScenePanoramaFace, string>>((result, face) => {
    const image = panorama.faces[face];

    result[face] = image?.previewUrl ?? image?.storedUrl ?? "";

    return result;
  }, {} as Record<ScenePanoramaFace, string>);

  return isCompleteScenePanoramaFaceUrls(faces) ? faces : null;
}

function validateSceneBlockGeneration(draft: SceneCreateDraft, blockId: string) {
  const block = draft.blocks.find((item) => item.id === blockId);

  if (!draft.name.trim()) {
    return "sceneForm.errors.nameRequired";
  }

  if (!draft.description.trim()) {
    return "sceneForm.errors.descriptionRequired";
  }

  if (!block?.name.trim()) {
    return "sceneForm.errors.blockNameRequired";
  }

  if (!block.description.trim()) {
    return "sceneForm.errors.blockDescriptionRequired";
  }

  return "";
}

function validateSceneDraftForSave(draft: SceneCreateDraft) {
  if (!draft.name.trim()) {
    return "sceneForm.errors.nameRequired";
  }

  if (!draft.description.trim()) {
    return "sceneForm.errors.descriptionRequired";
  }

  if (draft.blocks.length === 0) {
    return "sceneForm.errors.blockRequired";
  }

  for (const block of draft.blocks) {
    if (!block.name.trim()) {
      return "sceneForm.errors.blockNameRequired";
    }

    if (!block.description.trim()) {
      return "sceneForm.errors.blockDescriptionRequired";
    }

    if (block.panorama) {
      const completeFaces = getCompleteScenePanoramaFaceUrls(block.panorama);

      if (!completeFaces) {
        return "sceneForm.errors.panoramaIncomplete";
      }
    }
  }

  return "";
}

async function uploadSceneDraftPanoramaFaces(draft: SceneCreateDraft, uploadedFaceUrls: string[]): Promise<SceneMaterialCreateInput> {
  const blocks: SceneMaterialCreateInput["blocks"] = [];

  for (const block of draft.blocks) {
    if (!block.panorama) {
      blocks.push({
        id: block.id,
        name: block.name,
        description: block.description,
        panorama: null
      });
      continue;
    }

    const settled = await Promise.allSettled(
      scenePanoramaFaces.map(async (face) => {
        const image = block.panorama?.faces[face];

        if (!image) {
          throw new Error("SCENE_PANORAMA_INCOMPLETE");
        }

        if (image.storedUrl && !image.file) {
          return [face, image.storedUrl] as const;
        }

        if (!image.file) {
          throw new Error("SCENE_PANORAMA_INCOMPLETE");
        }

        const formData = new FormData();

        formData.append("face", face);
        formData.append("file", image.file);

        const result = await uploadHomeScenePanoramaFace(formData);

        uploadedFaceUrls.push(result.url);

        return [face, result.url] as const;
      })
    );
    const failed = settled.find((result) => result.status === "rejected");

    if (failed) {
      throw failed.reason;
    }

    const faces = settled.reduce<Record<ScenePanoramaFace, string>>((result, item) => {
      if (item.status === "fulfilled") {
        const [face, url] = item.value;

        result[face] = url;
      }

      return result;
    }, {} as Record<ScenePanoramaFace, string>);

    blocks.push({
      id: block.id,
      name: block.name,
      description: block.description,
      panorama: {
        faceSource: block.panorama.faceSource,
        faces
      }
    });
  }

  return {
    name: draft.name,
    description: draft.description,
    style: draft.style,
    panoramaDrawingStyle: draft.panoramaDrawingStyle,
    blocks
  };
}

function isZipArchiveFile(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  return name.endsWith(".zip") || type === "application/zip" || type === "application/x-zip-compressed";
}

function createPreviewUrl(file: File) {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(file);
  }

  return "";
}

async function downloadMaterialArchive(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(await readTransferErrorCode(response));
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = getArchiveFileName(response.headers.get("content-disposition"));
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function readTransferErrorCode(response: Response) {
  try {
    const payload = await response.json() as { error?: string };

    return payload.error ?? "MATERIAL_TRANSFER_FAILED";
  } catch {
    return "MATERIAL_TRANSFER_FAILED";
  }
}

function getArchiveFileName(contentDisposition: string | null) {
  const encodedFileName = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainFileName = contentDisposition?.match(/filename="([^"]+)"/i)?.[1];

  if (encodedFileName) {
    return decodeURIComponent(encodedFileName);
  }

  return plainFileName ?? "nwt-materials.zip";
}

function revokeMaskBoardPreview(url: string) {
  if (url.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

function revokeSceneDraftPreviews(draft: SceneCreateDraft) {
  draft.blocks.forEach(revokeSceneBlockPreviews);
}

function revokeSceneBlockPreviews(block: SceneBlockDraft) {
  Object.values(block.panorama?.faces ?? {}).forEach(revokeSceneFacePreview);
}

function revokeSceneFacePreview(face: ScenePanoramaFaceDraft) {
  if (face.previewUrl.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(face.previewUrl);
  }
}

async function dataUrlToFile(dataUrl: string, fileName: string, contentType: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  return new File([blob], fileName, { type: contentType });
}

function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveMaskAiError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-llm")) {
    return t("maskForm.aiMissingDefaultLlm");
  }

  if (message.includes("missing-provider-secret")) {
    return t("maskForm.missingProviderSecret");
  }

  return t("maskForm.aiFailed");
}

function resolveMaskBoardError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-image")) {
    return t("maskForm.boardMissingDefaultImage");
  }

  if (message.includes("missing-provider-secret")) {
    return t("maskForm.missingProviderSecret");
  }

  return t("maskForm.boardGenerateFailed");
}

function resolveMaskSaveError(error: unknown, t: (key: string) => string, isEditing = false) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("INVALID_MATERIAL_IMAGE_FILE")) {
    return t("maskForm.invalidBoardImage");
  }

  return t(isEditing ? "maskForm.updateFailed" : "maskForm.saveFailed");
}

function resolveSceneAiError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-llm")) {
    return t("sceneForm.aiMissingDefaultLlm");
  }

  if (message.includes("missing-provider-secret")) {
    return t("sceneForm.missingProviderSecret");
  }

  return t("sceneForm.aiFailed");
}

function resolveScenePanoramaError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-image")) {
    return t("sceneForm.panoramaMissingDefaultImage");
  }

  if (message.includes("missing-provider-secret")) {
    return t("sceneForm.missingProviderSecret");
  }

  if (message.includes("INVALID_SCENE_PANORAMA_FACE_FILE")) {
    return t("sceneForm.invalidPanoramaFace");
  }

  if (message.includes("SCENE_PANORAMA_QUALITY_FAILED")) {
    return t("sceneForm.panoramaQualityFailed");
  }

  if (message.includes("SCENE_PANORAMA_REFERENCE_EDIT_UNSUPPORTED")) {
    return t("sceneForm.panoramaReferenceEditUnsupported");
  }

  return t("sceneForm.panoramaGenerateFailed");
}

function resolveSceneSaveError(error: unknown, t: (key: string) => string, isEditing = false) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("INVALID_SCENE_PANORAMA_FACE_FILE") || message.includes("INVALID_MATERIAL_IMAGE_FILE")) {
    return t("sceneForm.invalidPanoramaFace");
  }

  if (
    message.includes("Body exceeded") ||
    message.includes("request body") ||
    message.includes("Payload Too Large") ||
    message.includes("413")
  ) {
    return t("sceneForm.panoramaUploadTooLarge");
  }

  if (message.includes("SCENE_PANORAMA_UPLOAD_FAILED")) {
    return t("sceneForm.panoramaUploadFailed");
  }

  if (message.includes("R2") || message.includes("S3") || message.includes("AccessDenied") || message.includes("NoSuchBucket")) {
    return t("sceneForm.panoramaUploadFailed");
  }

  if (message.includes("SCENE_MATERIAL_CATEGORY_MIGRATION_REQUIRED")) {
    return t("sceneForm.migrationRequired");
  }

  if (message.includes("SCENE_MATERIAL_METADATA_TOO_LARGE")) {
    return t("sceneForm.metadataTooLarge");
  }

  if (message.includes("SCENE_MATERIAL_DATABASE_FAILED") || message.includes("SCENE_MATERIAL_PERSISTENCE_FAILED")) {
    return t("sceneForm.recordSaveFailed");
  }

  if (message.includes("SCENE_NAME_REQUIRED")) {
    return t("sceneForm.errors.nameRequired");
  }

  if (message.includes("SCENE_DESCRIPTION_REQUIRED")) {
    return t("sceneForm.errors.descriptionRequired");
  }

  if (message.includes("SCENE_BLOCK_REQUIRED")) {
    return t("sceneForm.errors.blockRequired");
  }

  if (message.includes("SCENE_BLOCK_NAME_REQUIRED")) {
    return t("sceneForm.errors.blockNameRequired");
  }

  if (message.includes("SCENE_BLOCK_DESCRIPTION_REQUIRED")) {
    return t("sceneForm.errors.blockDescriptionRequired");
  }

  if (message.includes("SCENE_PANORAMA_FACE_REQUIRED") || message.includes("SCENE_PANORAMA_INCOMPLETE")) {
    return t("sceneForm.errors.panoramaIncomplete");
  }

  return t(isEditing ? "sceneForm.updateFailed" : "sceneForm.saveFailed");
}

function resolveMaterialImportError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("INVALID_MATERIAL_ZIP")) {
    return t("invalidImportFile");
  }

  return t("importFailed");
}

function resolveMaterialExportError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("NO_SELF_CREATED_MATERIALS")) {
    return t("exportEmpty");
  }

  return t("exportFailed");
}

function getMaskBodyOptionLabel(
  fieldId: MaskBodyFieldId,
  option: string,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return t(`maskForm.bodyOptions.${fieldId}.${option}`);
}

function getMaskVoiceValueLabel(
  fieldId: MaskVoiceFieldId,
  value: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  if (fieldId === "speechSpeed") {
    return t("maskForm.speechSpeedValue", { value });
  }

  return t("maskForm.scoreValue", { value });
}

function getRangeLevelIndex(value: number, min: number, max: number) {
  const ratio = (value - min) / (max - min);

  return Math.min(4, Math.max(0, Math.round(ratio * 4)));
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

function getMaterialAccent(category: WorkspaceMaterialCategory) {
  if (category === "mask") {
    return "bg-rose-500";
  }

  if (category === "map") {
    return "bg-cyan-600";
  }

  if (category === "creature") {
    return "bg-emerald-600";
  }

  return "bg-amber-500";
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
