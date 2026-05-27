"use client";

import {
  ArrowLeft,
  Box,
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
import { useEffect, useMemo, useRef, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import {
  assistHomeCreatureDraft,
  assistHomeMaskDraft,
  assistHomeItemDraft,
  assistHomeItemDraftWithImages,
  assistHomeMapDraft,
  assistHomeSceneDraftWithImages,
  cleanupHomeUploadedMaterialImages,
  createHomeConversation,
  createHomeCreatureMaterial,
  createHomeItemMaterial,
  createHomeMapMaterial,
  createHomeMaskMaterial,
  createHomeSceneMaterial,
  deleteHomeMaterial,
  deleteHomeConversation,
  deriveHomeMapGraphRound,
  generateHomeCreatureBoard,
  generateHomeItemBoard,
  generateHomeItemBoardWithImages,
  generateHomeItemModelInputImage,
  generateHomeMaskBoard,
  joinHomeMaterial,
  updateHomeCreatureMaterial,
  updateHomeItemMaterial,
  updateHomeMapMaterial,
  updateHomeMaskMaterial,
  updateHomeSceneMaterial,
  uploadHomeScenePanoramaFace,
  uploadHomeScenePanoramaMother
} from "@/app/[locale]/actions";
import { AuthDialog } from "@/components/auth-dialog";
import { HeaderActions } from "@/components/header-actions";
import { UserAvatar } from "@/components/user-avatar";
import { ItemCreateDialog } from "./item-dialog";
import { CreatureCreateDialog } from "./creature-dialog";
import { MapBasicInfoDialog, MapEdgeDialog, MapGraphDialog, MapNodeDialog } from "./map-dialog";
import { MaskCreateDialog } from "./mask-dialog";
import { MaterialDetailModal, MaterialExploreCard, ScriptExploreCard } from "./material-detail";
import { SceneCreateDialog } from "./scene-dialog";
import { Metric } from "./form-fields";
import { groupConversations, mergeMaterials, mergeScripts, upsertMaterialList } from "./lists";
import {
  generateHomeMapImageOutline,
  resolveSendError,
  streamHomeMapImage,
  streamHomeMessage,
  streamHomeScenePanorama,
  streamHomeScenePanoramaMother
} from "./streams";
import type { Locale } from "@/i18n/routing";
import { authRequiredEventName } from "@/lib/auth-client";
import { isAuthRequiredError, type AuthViewer } from "@/lib/auth-types";
import type {
  WorkspaceConversation,
  WorkspaceData,
  MapCreateDraft,
  MapDraftPatch,
  MapMaterialCreateInput,
  WorkspaceMapMaterialEdge,
  WorkspaceMapMaterialMetadata,
  WorkspaceMapMaterialNode,
  WorkspaceMapMaterialNodeType,
  WorkspaceMapMaterialRelationType,
  WorkspaceMaterial,
  WorkspaceMaterialCategory,
  WorkspaceMaterialMetadata,
  ItemDraftPatch,
  ItemMaterialCreateInput,
  SceneDraftPatch,
  SceneMaterialCreateInput,
  WorkspaceItemMaterialMetadata,
  WorkspaceSceneMaterialMetadata,
  WorkspaceSceneScalePreset,
  WorkspaceMaterialStyle,
  WorkspaceScript
} from "@/lib/home-workspace";
import { formatDisplayTime } from "@/lib/format";
import { createConversationTitle, filterConversations } from "@/lib/home-workspace-utils";
import { cn } from "@/lib/utils";
import {
  defaultScenePanoramaView,
  defaultSceneScalePreset,
  defaultScenePanoramaMaxRedrawAttempts,
  itemTagFields,
  maskBoardAcceptedTypes,
  maskBoardDrawingStyles,
  maskBodyFields,
  maskColorFields,
  maskPersonalityGroups,
  maskVoiceFields,
  materialIcons,
  materialStyles,
  materialTypes,
  maxMaskBoardImageBytes,
  maxScenePanoramaFaceBytes,
  maxScenePanoramaMaxRedrawAttempts,
  maxMapReferenceImages,
  defaultMapImageNodeBatchSize,
  maxSceneReferenceImages,
  minScenePanoramaMaxRedrawAttempts,
  scenePanoramaAcceptedTypes,
  scenePanoramaFaces,
  scenePanoramaThreeFaceOrder,
  sceneScalePresets,
  scriptCategories,
  scriptPickerPageSize,
  clampScenePanoramaView,
  loadSceneEquirectangularTexture,
  loadScenePanoramaCubeTexture,
  scheduleScenePanoramaWebglStart,
  type ItemCreateDraft,
  type ItemModelInputImageDraft,
  type ItemModelDraft,
  type ItemModelProgress,
  type ItemModelStreamEvent,
  type ItemTagFieldId,
  type CreatureAbilityFieldId,
  type CreatureBehaviorFieldId,
  type CreatureColorFieldId,
  type CreatureCreateDraft,
  type CreatureDraftPatch,
  type CreatureEcologyFieldId,
  type CreatureMorphologyFieldId,
  type CreatureSenseFieldId,
  type CreatureTaxonomyFieldId,
  type CreatureVocalizationFieldId,
  type MaskAiMessage,
  type MapAiMessage,
  type MapImageDraft,
  type MapImageGenerationDraft,
  type MaskBoardDrawingStyle,
  type MaskBoardImageSource,
  type MaskBodyFieldId,
  type MaskColorFieldId,
  type MaskCreateDraft,
  type MaskDraftPatch,
  type MaskPersonalityFieldId,
  type MaskVoiceFieldId,
  type SceneAiMessage,
  type SceneBlockDraft,
  type SceneCreateDraft,
  type ScenePanoramaDraft,
  type ScenePanoramaDrawingStyle,
  type ScenePanoramaFace,
  type ScenePanoramaFaceDraft,
  type ScenePanoramaGenerationDraft,
  type ScenePanoramaStreamDoneEvent,
  type ScenePanoramaStreamEvent,
  type ScenePanoramaStreamFaceImage,
  type ScenePanoramaStreamImage,
  type ScenePanoramaView,
  type ScenePanoramaWebglLoadMode,
  type SceneReferenceImageDraft,
  type ViewMode,
  type ScriptManagerView,
  type MaterialManagerView,
  type StreamingReply
} from "./shared";
import {
  applyPatchToCreatureDraft,
  applyPatchToItemDraft,
  applyPatchToMaskDraft,
  applyPatchToSceneDraft,
  buildItemMaterialFormData,
  createClientId,
  createDefaultCreatureDraft,
  createDefaultItemDraft,
  createDefaultMaskDraft,
  createDefaultMapDraft,
  createDefaultSceneBlock,
  createDefaultSceneDraft,
  createInitialScenePanoramaGenerationDraft,
  createCreatureDraftFromMaterial,
  createItemDraftFromMaterial,
  createMapImageDraftFromMaterial,
  createMapDraftFromMaterial,
  createMapEdge,
  createMapNode,
  createMaskDraftFromMaterial,
  createPreviewUrl,
  createSceneDraftFromMaterial,
  createSceneReferenceImageDrafts,
  dataUrlToFile,
  downloadMaterialArchive,
  getCreatureBoardImageMode,
  getCompleteScenePanoramaFaceUrls,
  getItemModelInputFileForModel,
  getItemBoardFileForGeneration,
  getMaskBoardImageMode,
  isValidGeneratedMaterialImage,
  isValidGeneratedScenePanoramaImage,
  isValidMaskBoardImage,
  isValidScenePanoramaFace,
  isZipArchiveFile,
  normalizeSceneFaceSource,
  normalizeScenePanoramaMaxRedrawAttempts,
  readItemModelStream,
  readTransferErrorCode,
  revokeItemBoardPreview,
  revokeCreatureBoardPreview,
  revokeItemDraftPreviews,
  revokeItemModelInputImagePreview,
  revokeMapImagePreview,
  revokeMaskBoardPreview,
  revokeSceneBlockPreviews,
  revokeSceneDraftPreviews,
  revokeSceneFacePreview,
  revokeScenePanoramaMotherPreview,
  revokeSceneReferenceImagePreview,
  buildMapMaterialFormData,
  buildMapGraphSignature,
  normalizeMapImageNodeBatchSize,
  serializeCreatureDraft,
  serializeItemDraft,
  serializeMaskDraft,
  serializeMapDraft,
  serializeSceneTextDraft,
  applyPatchToMapDraft,
  layoutMapGraphNodes,
  validateMapDraftForGraphSave,
  validateMapDraftForSave,
  uploadSceneDraftPanoramaFaces,
  validateSceneBlockGeneration,
  validateSceneDraftForSave
} from "./drafts";
import {
  getRangeLevelIndex,
  getScriptAccent,
  getScriptChats,
  getScriptRank,
  getScriptRating,
  resolveCreatureAiError,
  resolveCreatureBoardError,
  resolveCreatureSaveError,
  resolveItemAiError,
  resolveItemBoardError,
  resolveItemModelError,
  resolveItemSaveError,
  resolveItemModelInputImageError,
  resolveMaskAiError,
  resolveMaskBoardError,
  resolveMaskSaveError,
  resolveMapAiError,
  resolveMapDeriveError,
  resolveMapImageError,
  resolveMapSaveError,
  resolveMaterialExportError,
  resolveMaterialImportError,
  resolveSceneAiError,
  resolveScenePanoramaError,
  resolveSceneSaveError
} from "./labels";

export { clampScenePanoramaView } from "./shared";

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
  const [creatureCreateOpen, setCreatureCreateOpen] = useState(false);
  const [creatureEditingMaterialId, setCreatureEditingMaterialId] = useState("");
  const [creatureCreateDraft, setCreatureCreateDraft] = useState<CreatureCreateDraft>(() => createDefaultCreatureDraft());
  const [creatureAiInput, setCreatureAiInput] = useState("");
  const [creatureAiPending, setCreatureAiPending] = useState(false);
  const [creatureBoardPending, setCreatureBoardPending] = useState(false);
  const [creatureSavePending, setCreatureSavePending] = useState(false);
  const [itemCreateOpen, setItemCreateOpen] = useState(false);
  const [itemEditingMaterialId, setItemEditingMaterialId] = useState("");
  const [itemCreateDraft, setItemCreateDraft] = useState<ItemCreateDraft>(() => createDefaultItemDraft());
  const [itemAiInput, setItemAiInput] = useState("");
  const [itemAiPending, setItemAiPending] = useState(false);
  const [itemAiReferenceImages, setItemAiReferenceImages] = useState<SceneReferenceImageDraft[]>([]);
  const [itemBoardPending, setItemBoardPending] = useState(false);
  const [itemBoardReferenceImages, setItemBoardReferenceImages] = useState<SceneReferenceImageDraft[]>([]);
  const [itemModelInputPending, setItemModelInputPending] = useState(false);
  const [itemModelPending, setItemModelPending] = useState(false);
  const [itemModelProgress, setItemModelProgress] = useState<ItemModelProgress | null>(null);
  const [itemSavePending, setItemSavePending] = useState(false);
  const [sceneCreateOpen, setSceneCreateOpen] = useState(false);
  const [sceneEditingMaterialId, setSceneEditingMaterialId] = useState("");
  const [sceneCreateDraft, setSceneCreateDraft] = useState<SceneCreateDraft>(() => createDefaultSceneDraft());
  const [sceneActiveBlockId, setSceneActiveBlockId] = useState("");
  const [sceneAiInput, setSceneAiInput] = useState("");
  const [sceneAiMessages, setSceneAiMessages] = useState<SceneAiMessage[]>([]);
  const [sceneAiPending, setSceneAiPending] = useState(false);
  const [sceneAiReferenceImages, setSceneAiReferenceImages] = useState<SceneReferenceImageDraft[]>([]);
  const [scenePanoramaPendingBlockId, setScenePanoramaPendingBlockId] = useState("");
  const [scenePanoramaGenerationByBlock, setScenePanoramaGenerationByBlock] = useState<Record<string, ScenePanoramaGenerationDraft>>({});
  const [scenePanoramaMaxRedrawAttempts, setScenePanoramaMaxRedrawAttempts] = useState(defaultScenePanoramaMaxRedrawAttempts);
  const [sceneSavePending, setSceneSavePending] = useState(false);
  const [mapCreateOpen, setMapCreateOpen] = useState(false);
  const [mapGraphOpen, setMapGraphOpen] = useState(false);
  const [mapEditingMaterialId, setMapEditingMaterialId] = useState("");
  const [mapCreateDraft, setMapCreateDraft] = useState<MapCreateDraft>(() => createDefaultMapDraft());
  const [mapAiInput, setMapAiInput] = useState("");
  const [mapAiMessages, setMapAiMessages] = useState<MapAiMessage[]>([]);
  const [mapAiPending, setMapAiPending] = useState(false);
  const [mapDerivePending, setMapDerivePending] = useState(false);
  const [mapDeriveMaxRounds, setMapDeriveMaxRounds] = useState(3);
  const [mapDeriveRound, setMapDeriveRound] = useState(0);
  const [mapDeriveStatus, setMapDeriveStatus] = useState("");
  const [mapImageDraft, setMapImageDraft] = useState<MapImageDraft | null>(null);
  const [mapImageGeneration, setMapImageGeneration] = useState<MapImageGenerationDraft>(() => createInitialMapImageGenerationDraft());
  const [mapImageNodeBatchSize, setMapImageNodeBatchSize] = useState(defaultMapImageNodeBatchSize);
  const [mapImageReferenceImages, setMapImageReferenceImages] = useState<SceneReferenceImageDraft[]>([]);
  const [mapImageReferencePrompt, setMapImageReferencePrompt] = useState("");
  const [mapSelectedNodeId, setMapSelectedNodeId] = useState("");
  const [mapSelectedEdgeId, setMapSelectedEdgeId] = useState("");
  const [mapNodeDialogOpen, setMapNodeDialogOpen] = useState(false);
  const [mapEdgeDialogOpen, setMapEdgeDialogOpen] = useState(false);
  const [mapEditingNodeId, setMapEditingNodeId] = useState("");
  const [mapEditingEdgeId, setMapEditingEdgeId] = useState("");
  const [mapEdgeConnectSourceId, setMapEdgeConnectSourceId] = useState("");
  const [mapEdgeConnectTargetId, setMapEdgeConnectTargetId] = useState("");
  const [mapSavePending, setMapSavePending] = useState(false);
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
  const mapCreateDraftRef = useRef(mapCreateDraft);
  const mapImageDraftRef = useRef<MapImageDraft | null>(mapImageDraft);
  const mapImageGenerationRef = useRef(mapImageGeneration);
  const mapDeriveRunIdRef = useRef("");
  const mapImageRunIdRef = useRef("");
  const mapImageOutlineRunIdRef = useRef("");
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
  const isCreatureActionPending = creatureAiPending || creatureBoardPending || creatureSavePending;
  const isItemActionPending = itemAiPending || itemBoardPending || itemModelInputPending || itemModelPending || itemSavePending;
  const isSceneActionPending = sceneAiPending || Boolean(scenePanoramaPendingBlockId) || sceneSavePending;
  const isMapActionPending = mapAiPending || mapDerivePending || mapSavePending || mapImageGeneration.pending;
  const isMaterialTransferDisabled = materialTransferPending;
  const isEditingMask = Boolean(maskEditingMaterialId);
  const isEditingCreature = Boolean(creatureEditingMaterialId);
  const isEditingItem = Boolean(itemEditingMaterialId);
  const isEditingScene = Boolean(sceneEditingMaterialId);
  const isEditingMap = Boolean(mapEditingMaterialId);

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
      setCreatureCreateOpen(false);
      resetCreatureCreateDraft();
      setItemCreateOpen(false);
      resetItemCreateDraft();
      setSceneCreateOpen(false);
      resetSceneCreateDraft();
      setMapCreateOpen(false);
      setMapGraphOpen(false);
      setMapNodeDialogOpen(false);
      setMapEdgeDialogOpen(false);
      setMapEditingNodeId("");
      setMapEditingEdgeId("");
      resetMapCreateDraft();
      resetMapAiState();
      resetMapDeriveState();
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
    if (!creatureCreateOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCreatureCreateOpen(false);
        resetCreatureCreateDraft();
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [creatureCreateOpen]);

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
    mapCreateDraftRef.current = mapCreateDraft;
  }, [mapCreateDraft]);

  useEffect(() => {
    mapImageDraftRef.current = mapImageDraft;
  }, [mapImageDraft]);

  useEffect(() => {
    mapImageGenerationRef.current = mapImageGeneration;
  }, [mapImageGeneration]);

  useEffect(() => {
    const graphSignature = buildMapGraphSignature(mapCreateDraft);

    setMapImageDraft((current) => {
      if (!current) {
        return current;
      }

      if (!current.graphSignature || current.graphSignature === graphSignature) {
        return current.stale ? { ...current, stale: false } : current;
      }

      return {
        ...current,
        stale: true
      };
    });

  }, [mapCreateDraft]);

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
      setCreatureCreateOpen(false);
      setItemCreateOpen(false);
      setSceneCreateOpen(false);
      setMaskCreateOpen(true);
      return;
    }

    if (category === "creature") {
      resetCreatureCreateDraft();
      setMaskCreateOpen(false);
      setItemCreateOpen(false);
      setSceneCreateOpen(false);
      setCreatureCreateOpen(true);
      return;
    }

    if (category === "item") {
      resetItemCreateDraft();
      setMaskCreateOpen(false);
      setCreatureCreateOpen(false);
      setSceneCreateOpen(false);
      setItemCreateOpen(true);
      return;
    }

    if (category === "scene") {
      resetSceneCreateDraft();
      setMaskCreateOpen(false);
      setCreatureCreateOpen(false);
      setItemCreateOpen(false);
      setSceneCreateOpen(true);
      return;
    }

    if (category === "map") {
      openMapCreateDialog();
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

      if (!isValidGeneratedMaterialImage(file)) {
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
        if (!isValidMaskBoardImage(maskCreateDraft.boardImageFile, { allowOversize: maskCreateDraft.boardImageSource === "generated" })) {
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
        material.communityVisible
          ? upsertMaterialList(current, material)
          : current.filter((item) => item.id !== material.id)
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

  function closeCreatureCreateDialog() {
    setCreatureCreateOpen(false);
    resetCreatureCreateDraft();
  }

  function resetCreatureCreateDraft() {
    setCreatureCreateDraft((current) => {
      revokeCreatureBoardPreview(current.boardImagePreviewUrl);

      return createDefaultCreatureDraft();
    });
    setCreatureAiInput("");
    setCreatureEditingMaterialId("");
  }

  function openCreatureEditDialog(material: WorkspaceMaterial) {
    if (material.category !== "creature" || material.librarySource !== "SELF_CREATED") {
      return;
    }

    setMaterialCreateMenuOpen(false);
    setCreatureCreateDraft((current) => {
      revokeCreatureBoardPreview(current.boardImagePreviewUrl);

      return createCreatureDraftFromMaterial(material);
    });
    setCreatureAiInput("");
    setCreatureEditingMaterialId(material.id);
    setCreatureCreateOpen(true);
  }

  function updateCreatureName(name: string) {
    setCreatureCreateDraft((current) => ({ ...current, name }));
  }

  function updateCreatureDescription(description: string) {
    setCreatureCreateDraft((current) => ({ ...current, description }));
  }

  function updateCreatureStyle(style: WorkspaceMaterialStyle) {
    setCreatureCreateDraft((current) => ({ ...current, style }));
  }

  function updateCreatureTaxonomyField(fieldId: CreatureTaxonomyFieldId, value: string) {
    setCreatureCreateDraft((current) => ({
      ...current,
      taxonomy: {
        ...current.taxonomy,
        [fieldId]: value
      }
    }));
  }

  function updateCreatureMorphologyField(fieldId: CreatureMorphologyFieldId, value: string) {
    setCreatureCreateDraft((current) => ({
      ...current,
      morphology: {
        ...current.morphology,
        [fieldId]: value
      }
    }));
  }

  function updateCreatureColorField(fieldId: CreatureColorFieldId, value: string) {
    setCreatureCreateDraft((current) => ({
      ...current,
      colors: {
        ...current.colors,
        [fieldId]: value.toUpperCase()
      }
    }));
  }

  function updateCreatureVocalizationField(fieldId: CreatureVocalizationFieldId, value: number) {
    setCreatureCreateDraft((current) => ({
      ...current,
      vocalization: {
        ...current.vocalization,
        [fieldId]: value
      }
    }));
  }

  function updateCreatureSenseField(fieldId: CreatureSenseFieldId, value: number) {
    setCreatureCreateDraft((current) => ({
      ...current,
      senses: {
        ...current.senses,
        [fieldId]: value
      }
    }));
  }

  function updateCreatureEcologyField(fieldId: CreatureEcologyFieldId, value: string) {
    setCreatureCreateDraft((current) => ({
      ...current,
      ecology: {
        ...current.ecology,
        [fieldId]: value
      }
    }));
  }

  function updateCreatureAbilityTags(fieldId: CreatureAbilityFieldId, values: string[]) {
    setCreatureCreateDraft((current) => ({
      ...current,
      abilities: {
        ...current.abilities,
        [fieldId]: values
      }
    }));
  }

  function updateCreatureBehaviorLogic(behaviorLogic: string) {
    setCreatureCreateDraft((current) => ({ ...current, behaviorLogic }));
  }

  function updateCreatureBehaviorField(fieldId: CreatureBehaviorFieldId, value: number) {
    setCreatureCreateDraft((current) => ({
      ...current,
      behavior: {
        ...current.behavior,
        [fieldId]: value
      }
    }));
  }

  function updateCreatureBoardDrawingStyle(style: MaskBoardDrawingStyle) {
    setCreatureCreateDraft((current) => ({ ...current, boardDrawingStyle: style }));
  }

  function applyCreatureDraftPatch(patch: CreatureDraftPatch) {
    setCreatureCreateDraft((current) => applyPatchToCreatureDraft(current, patch));
  }

  function updateCreatureBoardImage(file: File, source: Exclude<MaskBoardImageSource, null>, previewUrl: string) {
    setCreatureCreateDraft((current) => {
      revokeCreatureBoardPreview(current.boardImagePreviewUrl);

      return {
        ...current,
        boardImageFile: file,
        boardImagePreviewUrl: previewUrl,
        boardImageSource: source
      };
    });
  }

  function clearCreatureBoardImage() {
    setCreatureCreateDraft((current) => {
      revokeCreatureBoardPreview(current.boardImagePreviewUrl);

      return {
        ...current,
        boardImageFile: null,
        boardImagePreviewUrl: "",
        boardImageSource: null
      };
    });
  }

  function selectCreatureBoardImage(file: File | null) {
    if (!file) {
      return;
    }

    if (!isValidMaskBoardImage(file)) {
      toast.error(materialT("creatureForm.invalidBoardImage"));
      return;
    }

    updateCreatureBoardImage(file, "uploaded", createPreviewUrl(file));
  }

  async function sendCreatureAiMessage(authenticatedViewer = viewer) {
    const instruction = creatureAiInput.trim();

    if (!instruction || creatureAiPending) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void sendCreatureAiMessage(nextViewer);
      });
      return;
    }

    setCreatureAiInput("");
    setCreatureAiPending(true);
    setCreatureCreateDraft((current) => ({
      ...current,
      aiMessages: [...current.aiMessages, { id: createClientId("creature-ai-user"), role: "user", content: instruction }]
    }));

    try {
      const result = await assistHomeCreatureDraft(serializeCreatureDraft(creatureCreateDraft), instruction, locale);

      applyCreatureDraftPatch(result.patch);
      setCreatureCreateDraft((current) => ({
        ...current,
        aiMessages: [
          ...current.aiMessages,
          { id: createClientId("creature-ai-assistant"), role: "assistant", content: result.message }
        ]
      }));
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void sendCreatureAiMessage(nextViewer);
        });
        return;
      }

      toast.error(resolveCreatureAiError(error, materialT));
      setCreatureAiInput(instruction);
    } finally {
      setCreatureAiPending(false);
    }
  }

  async function generateCreatureBoard(authenticatedViewer = viewer) {
    if (creatureBoardPending) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void generateCreatureBoard(nextViewer);
      });
      return;
    }

    setCreatureBoardPending(true);

    try {
      const result = await generateHomeCreatureBoard(serializeCreatureDraft(creatureCreateDraft), locale);
      const file = await dataUrlToFile(result.dataUrl, result.fileName, result.contentType);

      if (!isValidGeneratedMaterialImage(file)) {
        toast.error(materialT("creatureForm.invalidBoardImage"));
        return;
      }

      updateCreatureBoardImage(file, "generated", result.dataUrl);
      toast.success(materialT("creatureForm.boardGenerated"));
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void generateCreatureBoard(nextViewer);
        });
        return;
      }

      toast.error(resolveCreatureBoardError(error, materialT));
    } finally {
      setCreatureBoardPending(false);
    }
  }

  async function submitCreatureCreateDraft(authenticatedViewer = viewer) {
    if (!creatureCreateDraft.name.trim()) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void submitCreatureCreateDraft(nextViewer);
      });
      return;
    }

    if (!persistenceAvailable) {
      toast.error(t("errors.persistence"));
      return;
    }

    setCreatureSavePending(true);

    try {
      const isEditing = Boolean(creatureEditingMaterialId);
      const formData = new FormData();

      formData.append("draft", JSON.stringify(serializeCreatureDraft(creatureCreateDraft)));

      if (creatureCreateDraft.boardImageFile) {
        if (!isValidMaskBoardImage(creatureCreateDraft.boardImageFile, { allowOversize: creatureCreateDraft.boardImageSource === "generated" })) {
          toast.error(materialT("creatureForm.invalidBoardImage"));
          return;
        }

        formData.append("boardImage", creatureCreateDraft.boardImageFile);
      }

      if (isEditing) {
        formData.append("boardImageMode", getCreatureBoardImageMode(creatureCreateDraft));
      }

      const material = isEditing
        ? await updateHomeCreatureMaterial(creatureEditingMaterialId, formData, locale)
        : await createHomeCreatureMaterial(formData, locale);

      setMyMaterials((current) => upsertMaterialList(current, material));
      setCommunityMaterials((current) =>
        material.communityVisible
          ? upsertMaterialList(current, material)
          : current.filter((item) => item.id !== material.id)
      );
      setMaterialStyle(material.style);
      toast.success(materialT(isEditing ? "creatureForm.updateSuccess" : "creatureForm.saveSuccess"));
      closeCreatureCreateDialog();
      router.refresh();
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void submitCreatureCreateDraft(nextViewer);
        });
        return;
      }

      toast.error(resolveCreatureSaveError(error, materialT, Boolean(creatureEditingMaterialId)));
    } finally {
      setCreatureSavePending(false);
    }
  }

  function closeItemCreateDialog() {
    setItemCreateOpen(false);
    resetItemCreateDraft();
  }

  function resetItemCreateDraft() {
    setItemCreateDraft((current) => {
      revokeItemDraftPreviews(current);

      return createDefaultItemDraft();
    });
    setItemAiInput("");
    setItemAiReferenceImages((current) => {
      current.forEach(revokeSceneReferenceImagePreview);

      return [];
    });
    setItemBoardReferenceImages((current) => {
      current.forEach(revokeSceneReferenceImagePreview);

      return [];
    });
    setItemEditingMaterialId("");
    setItemModelProgress(null);
  }

  function openItemEditDialog(material: WorkspaceMaterial) {
    if (material.category !== "item" || material.librarySource !== "SELF_CREATED") {
      return;
    }

    setMaterialCreateMenuOpen(false);
    setItemCreateDraft((current) => {
      revokeItemDraftPreviews(current);

      return createItemDraftFromMaterial(material);
    });
    setItemAiInput("");
    setItemAiReferenceImages((current) => {
      current.forEach(revokeSceneReferenceImagePreview);

      return [];
    });
    setItemBoardReferenceImages((current) => {
      current.forEach(revokeSceneReferenceImagePreview);

      return [];
    });
    setItemModelProgress(null);
    setItemEditingMaterialId(material.id);
    setMaskCreateOpen(false);
    setSceneCreateOpen(false);
    setItemCreateOpen(true);
  }

  function updateItemField(field: "brand" | "description" | "itemCategory" | "model" | "name" | "scaleHint", value: string) {
    setItemCreateDraft((current) => ({ ...current, [field]: value }));
  }

  function updateItemStyle(style: WorkspaceMaterialStyle) {
    setItemCreateDraft((current) => ({ ...current, style }));
  }

  function updateItemBoardDrawingStyle(style: MaskBoardDrawingStyle) {
    setItemCreateDraft((current) => ({ ...current, boardDrawingStyle: style }));
  }

  function updateItemTags(field: ItemTagFieldId, tags: string[]) {
    setItemCreateDraft((current) => ({ ...current, [field]: tags }));
  }

  function applyItemDraftPatch(patch: ItemDraftPatch) {
    setItemCreateDraft((current) => applyPatchToItemDraft(current, patch));
  }

  function updateItemBoardImage(file: File, source: Exclude<MaskBoardImageSource, null>, previewUrl: string) {
    setItemCreateDraft((current) => {
      revokeItemBoardPreview(current.boardImagePreviewUrl);

      return {
        ...current,
        boardImageFile: file,
        boardImagePreviewUrl: previewUrl,
        boardImageSource: source
      };
    });
  }

  function clearItemBoardImage() {
    setItemCreateDraft((current) => {
      revokeItemBoardPreview(current.boardImagePreviewUrl);

      return {
        ...current,
        boardImageFile: null,
        boardImagePreviewUrl: "",
        boardImageSource: null
      };
    });
  }

  function selectItemBoardImage(file: File | null) {
    if (!file) {
      return;
    }

    if (!isValidMaskBoardImage(file)) {
      toast.error(materialT("itemForm.invalidBoardImage"));
      return;
    }

    updateItemBoardImage(file, "uploaded", createPreviewUrl(file));
  }

  function selectItemModelInputImage(file: File | null) {
    if (!file) {
      return;
    }

    if (!isValidMaskBoardImage(file)) {
      toast.error(materialT("itemForm.invalidModelInputImage"));
      return;
    }

    setItemCreateDraft((current) => {
      revokeItemModelInputImagePreview(current.modelInputImage);

      return {
        ...current,
        modelInputImage: {
          file,
          previewUrl: createPreviewUrl(file),
          source: "uploaded",
          storedUrl: null
        },
        model3d: null
      };
    });
    setItemModelProgress(null);
  }

  function clearItemModelInputImage() {
    setItemCreateDraft((current) => {
      revokeItemModelInputImagePreview(current.modelInputImage);

      return {
        ...current,
        modelInputImage: null,
        model3d: null
      };
    });
    setItemModelProgress(null);
  }

  function addItemReferenceImages(
    files: FileList | File[],
    setImages: Dispatch<SetStateAction<SceneReferenceImageDraft[]>>
  ) {
    const { images: nextImages, invalidCount } = createSceneReferenceImageDrafts(Array.from(files));

    if (invalidCount > 0) {
      toast.error(materialT("itemForm.invalidReferenceImage"));
    }

    if (nextImages.length === 0) {
      return;
    }

    setImages((current) => {
      const availableSlots = Math.max(0, maxSceneReferenceImages - current.length);
      const accepted = nextImages.slice(0, availableSlots);
      const rejected = nextImages.slice(availableSlots);

      rejected.forEach(revokeSceneReferenceImagePreview);

      if (accepted.length < nextImages.length) {
        toast.error(materialT("itemForm.referenceImageLimit"));
      }

      return [...current, ...accepted];
    });
  }

  function addItemAiReferenceImages(files: FileList | File[]) {
    addItemReferenceImages(files, setItemAiReferenceImages);
  }

  function addItemBoardReferenceImages(files: FileList | File[]) {
    addItemReferenceImages(files, setItemBoardReferenceImages);
  }

  function removeItemAiReferenceImage(imageId: string) {
    setItemAiReferenceImages((current) => {
      const removed = current.find((image) => image.id === imageId);

      if (removed) {
        revokeSceneReferenceImagePreview(removed);
      }

      return current.filter((image) => image.id !== imageId);
    });
  }

  function removeItemBoardReferenceImage(imageId: string) {
    setItemBoardReferenceImages((current) => {
      const removed = current.find((image) => image.id === imageId);

      if (removed) {
        revokeSceneReferenceImagePreview(removed);
      }

      return current.filter((image) => image.id !== imageId);
    });
  }

  function buildItemAiAssistFormData(draft: ItemCreateDraft, instruction: string, referenceImages: SceneReferenceImageDraft[]) {
    const formData = new FormData();

    formData.append("draft", JSON.stringify(serializeItemDraft(draft)));
    formData.append("instruction", instruction);
    referenceImages.forEach((image) => {
      formData.append("referenceImages", image.file);
    });

    return formData;
  }

  function buildItemBoardGenerationFormData(draft: ItemCreateDraft, referenceImages: SceneReferenceImageDraft[]) {
    const formData = new FormData();

    formData.append("draft", JSON.stringify(serializeItemDraft(draft)));
    referenceImages.forEach((image) => {
      formData.append("referenceImages", image.file);
    });

    return formData;
  }

  async function sendItemAiMessage(authenticatedViewer = viewer) {
    const instruction = itemAiInput.trim();

    if ((!instruction && itemAiReferenceImages.length === 0) || itemAiPending) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void sendItemAiMessage(nextViewer);
      });
      return;
    }

    setItemAiInput("");
    setItemAiPending(true);
    setItemCreateDraft((current) => ({
      ...current,
      aiMessages: [
        ...current.aiMessages,
        {
          id: createClientId("item-ai-user"),
          role: "user",
          content: instruction || materialT("itemForm.aiReferenceOnlyMessage")
        }
      ]
    }));

    try {
      const result = itemAiReferenceImages.length > 0
        ? await assistHomeItemDraftWithImages(buildItemAiAssistFormData(itemCreateDraft, instruction, itemAiReferenceImages), locale)
        : await assistHomeItemDraft(serializeItemDraft(itemCreateDraft), instruction, locale);

      applyItemDraftPatch(result.patch);
      setItemAiReferenceImages((current) => {
        current.forEach(revokeSceneReferenceImagePreview);

        return [];
      });
      setItemCreateDraft((current) => ({
        ...current,
        aiMessages: [
          ...current.aiMessages,
          { id: createClientId("item-ai-assistant"), role: "assistant", content: result.message }
        ]
      }));
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void sendItemAiMessage(nextViewer);
        });
        return;
      }

      toast.error(resolveItemAiError(error, materialT));
      setItemAiInput(instruction);
    } finally {
      setItemAiPending(false);
    }
  }

  async function generateItemBoard(authenticatedViewer = viewer) {
    if (itemBoardPending) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void generateItemBoard(nextViewer);
      });
      return;
    }

    setItemBoardPending(true);

    try {
      const result = itemBoardReferenceImages.length > 0
        ? await generateHomeItemBoardWithImages(buildItemBoardGenerationFormData(itemCreateDraft, itemBoardReferenceImages), locale)
        : await generateHomeItemBoard(serializeItemDraft(itemCreateDraft), locale);
      const file = await dataUrlToFile(result.dataUrl, result.fileName, result.contentType);

      if (!isValidGeneratedMaterialImage(file)) {
        toast.error(materialT("itemForm.invalidBoardImage"));
        return;
      }

      updateItemBoardImage(file, "generated", result.dataUrl);
      setItemBoardReferenceImages((current) => {
        current.forEach(revokeSceneReferenceImagePreview);

        return [];
      });
      toast.success(materialT("itemForm.boardGenerated"));
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void generateItemBoard(nextViewer);
        });
        return;
      }

      toast.error(resolveItemBoardError(error, materialT));
    } finally {
      setItemBoardPending(false);
    }
  }

  async function generateItemModelInputImage(authenticatedViewer = viewer) {
    if (itemModelInputPending) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void generateItemModelInputImage(nextViewer);
      });
      return;
    }

    setItemModelInputPending(true);

    try {
      const boardFile = await getItemBoardFileForGeneration(itemCreateDraft);

      if (!boardFile) {
        toast.error(materialT("itemForm.boardRequiredForModelInput"));
        return;
      }

      const formData = new FormData();

      formData.append("draft", JSON.stringify(serializeItemDraft(itemCreateDraft)));
      formData.append("boardImage", boardFile);

      const result = await generateHomeItemModelInputImage(formData, locale);
      const image = result.image;

      if (!image?.dataUrl) {
        throw new Error("ITEM_MODEL_INPUT_IMAGE_REQUIRED");
      }

      const file = await dataUrlToFile(image.dataUrl, image.fileName, image.contentType);

      if (!isValidGeneratedMaterialImage(file)) {
        throw new Error("INVALID_ITEM_MODEL_INPUT_IMAGE_FILE");
      }

      setItemCreateDraft((current) => {
        revokeItemModelInputImagePreview(current.modelInputImage);

        return {
          ...current,
          modelInputImage: {
            file,
            previewUrl: image.dataUrl,
            source: "generated",
            storedUrl: null
          } satisfies ItemModelInputImageDraft,
          model3d: null
        };
      });
      setItemModelProgress(null);
      toast.success(materialT("itemForm.modelInputGenerated"));
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void generateItemModelInputImage(nextViewer);
        });
        return;
      }

      toast.error(resolveItemModelInputImageError(error, materialT));
    } finally {
      setItemModelInputPending(false);
    }
  }

  async function generateItemModel(authenticatedViewer = viewer) {
    if (itemModelPending) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void generateItemModel(nextViewer);
      });
      return;
    }

    setItemModelPending(true);
    setItemModelProgress({ messageKey: "itemForm.modelProgressQueued", progress: 4 });

    try {
      const modelInputImage = await getItemModelInputFileForModel(itemCreateDraft);

      if (!modelInputImage) {
        toast.error(materialT("itemForm.modelInputRequiredForModel"));
        return;
      }

      const formData = new FormData();

      formData.append("modelInputImage", modelInputImage);
      formData.append("modelInputImageSource", itemCreateDraft.modelInputImage?.source === "uploaded" ? "uploaded" : "generated");
      formData.append("scaleHint", itemCreateDraft.scaleHint);
      formData.append("extraParams", itemCreateDraft.modelExtraParams);

      const response = await fetch("/api/materials/item-model/stream", {
        method: "POST",
        body: formData
      });

      if (response.status === 401) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void generateItemModel(nextViewer);
        });
        return;
      }

      if (!response.ok) {
        throw new Error(await readTransferErrorCode(response));
      }

      let completed = false;

      await readItemModelStream(response, (event) => {
        if (event.type === "progress") {
          setItemModelProgress({ messageKey: event.messageKey, progress: event.progress });
          return;
        }

        if (event.type === "done") {
          completed = true;
          setItemCreateDraft((current) => ({
            ...current,
            model3d: {
              byteSize: event.byteSize,
              contentType: event.contentType,
              fileName: event.fileName,
              source: "instantmesh",
              url: event.url
            }
          }));
          setItemModelProgress({ messageKey: "itemForm.modelProgressDone", progress: 100 });
          return;
        }

        throw new Error(event.message);
      });

      if (!completed) {
        throw new Error("INSTANTMESH_STREAM_INCOMPLETE");
      }

      toast.success(materialT("itemForm.modelGenerated"));
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void generateItemModel(nextViewer);
        });
        return;
      }

      toast.error(resolveItemModelError(error, materialT));
      setItemModelProgress({ messageKey: "itemForm.modelProgressFailed", progress: 100 });
    } finally {
      setItemModelPending(false);
    }
  }

  async function submitItemCreateDraft(authenticatedViewer = viewer) {
    if (!itemCreateDraft.name.trim()) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void submitItemCreateDraft(nextViewer);
      });
      return;
    }

    if (!persistenceAvailable) {
      toast.error(t("errors.persistence"));
      return;
    }

    setItemSavePending(true);

    try {
      const isEditing = Boolean(itemEditingMaterialId);
      const formData = buildItemMaterialFormData(itemCreateDraft, isEditing);
      const material = isEditing
        ? await updateHomeItemMaterial(itemEditingMaterialId, formData, locale)
        : await createHomeItemMaterial(formData, locale);

      setMyMaterials((current) => upsertMaterialList(current, material));
      setCommunityMaterials((current) =>
        material.communityVisible
          ? upsertMaterialList(current, material)
          : current.filter((item) => item.id !== material.id)
      );
      setMaterialStyle(material.style);
      toast.success(materialT(isEditing ? "itemForm.updateSuccess" : "itemForm.saveSuccess"));
      closeItemCreateDialog();
      router.refresh();
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void submitItemCreateDraft(nextViewer);
        });
        return;
      }

      toast.error(resolveItemSaveError(error, materialT, Boolean(itemEditingMaterialId)));
    } finally {
      setItemSavePending(false);
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
    setSceneAiReferenceImages((current) => {
      current.forEach(revokeSceneReferenceImagePreview);

      return [];
    });
    setSceneEditingMaterialId("");
    setScenePanoramaGenerationByBlock({});
  }

  function openMaterialEditDialog(material: WorkspaceMaterial) {
    if (material.category === "mask") {
      openMaskEditDialog(material);
      return;
    }

    if (material.category === "creature") {
      openCreatureEditDialog(material);
      return;
    }

    if (material.category === "item") {
      openItemEditDialog(material);
      return;
    }

    if (material.category === "scene") {
      openSceneEditDialog(material);
      return;
    }

    if (material.category === "map") {
      openMapBasicEditDialog(material);
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
    setSceneAiReferenceImages((current) => {
      current.forEach(revokeSceneReferenceImagePreview);

      return [];
    });
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

  function updateSceneBlock(blockId: string, patch: Partial<Pick<SceneBlockDraft, "name" | "description" | "scalePreset">>) {
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
    clearScenePanoramaGeneration(blockId);
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
            },
            mother: block.panorama?.mother ?? null
          }
        };
      })
    }));
  }

  function clearSceneBlockPanorama(blockId: string) {
    clearScenePanoramaGeneration(blockId);
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

  function clearScenePanoramaGeneration(blockId: string) {
    setScenePanoramaGenerationByBlock((current) => {
      if (!current[blockId]) {
        return current;
      }

      const { [blockId]: _removed, ...rest } = current;

      return rest;
    });
  }

  function updateScenePanoramaMaxRedrawAttempts(value: number) {
    setScenePanoramaMaxRedrawAttempts(normalizeScenePanoramaMaxRedrawAttempts(value));
  }

  function addSceneBlockReferenceImages(blockId: string, files: FileList | File[]) {
    const { images: nextImages, invalidCount } = createSceneReferenceImageDrafts(Array.from(files));

    if (invalidCount > 0) {
      toast.error(materialT("sceneForm.invalidReferenceImage"));
    }

    if (nextImages.length === 0) {
      return;
    }

    setSceneCreateDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== blockId) {
          return block;
        }

        const availableSlots = Math.max(0, maxSceneReferenceImages - block.referenceImages.length);
        const accepted = nextImages.slice(0, availableSlots);
        const rejected = nextImages.slice(availableSlots);

        rejected.forEach(revokeSceneReferenceImagePreview);

        if (accepted.length < nextImages.length) {
          toast.error(materialT("sceneForm.referenceImageLimit"));
        }

        return {
          ...block,
          referenceImages: [...block.referenceImages, ...accepted]
        };
      })
    }));
  }

  function removeSceneBlockReferenceImage(blockId: string, imageId: string) {
    setSceneCreateDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== blockId) {
          return block;
        }

        const removed = block.referenceImages.find((image) => image.id === imageId);

        if (removed) {
          revokeSceneReferenceImagePreview(removed);
        }

        return {
          ...block,
          referenceImages: block.referenceImages.filter((image) => image.id !== imageId)
        };
      })
    }));
  }

  function addSceneAiReferenceImages(files: FileList | File[]) {
    const { images: nextImages, invalidCount } = createSceneReferenceImageDrafts(Array.from(files));

    if (invalidCount > 0) {
      toast.error(materialT("sceneForm.invalidReferenceImage"));
    }

    if (nextImages.length === 0) {
      return;
    }

    setSceneAiReferenceImages((current) => {
      const availableSlots = Math.max(0, maxSceneReferenceImages - current.length);
      const accepted = nextImages.slice(0, availableSlots);
      const rejected = nextImages.slice(availableSlots);

      rejected.forEach(revokeSceneReferenceImagePreview);

      if (accepted.length < nextImages.length) {
        toast.error(materialT("sceneForm.referenceImageLimit"));
      }

      return [...current, ...accepted];
    });
  }

  function removeSceneAiReferenceImage(imageId: string) {
    setSceneAiReferenceImages((current) => {
      const removed = current.find((image) => image.id === imageId);

      if (removed) {
        revokeSceneReferenceImagePreview(removed);
      }

      return current.filter((image) => image.id !== imageId);
    });
  }

  async function sendSceneAiMessage(authenticatedViewer = viewer) {
    const instruction = sceneAiInput.trim();

    if ((!instruction && sceneAiReferenceImages.length === 0) || sceneAiPending) {
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
    setSceneAiMessages((current) => [
      ...current,
      {
        id: createClientId("scene-ai-user"),
        role: "user",
        content: instruction || materialT("sceneForm.aiReferenceOnlyMessage")
      }
    ]);

    try {
      const formData = new FormData();

      formData.append("draft", JSON.stringify(serializeSceneTextDraft(sceneCreateDraft)));
      formData.append("instruction", instruction);
      sceneAiReferenceImages.forEach((image) => {
        formData.append("referenceImages", image.file);
      });

      const result = await assistHomeSceneDraftWithImages(formData, locale);

      applySceneDraftPatch(result.patch);
      setSceneAiReferenceImages((current) => {
        current.forEach(revokeSceneReferenceImagePreview);

        return [];
      });
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

  async function generateScenePanoramaMother(blockId: string, authenticatedViewer = viewer) {
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
        void generateScenePanoramaMother(blockId, nextViewer);
      });
      return;
    }

    setScenePanoramaPendingBlockId(blockId);
    const maxRedrawAttempts = normalizeScenePanoramaMaxRedrawAttempts(scenePanoramaMaxRedrawAttempts);

    try {
      setScenePanoramaGenerationByBlock((current) => ({
        ...current,
        [blockId]: createInitialScenePanoramaGenerationDraft()
      }));

      const motherEvent = await streamHomeScenePanoramaMother(
        serializeSceneTextDraft(sceneCreateDraft),
        blockId,
        locale,
        maxRedrawAttempts,
        sceneCreateDraft.blocks.find((block) => block.id === blockId)?.referenceImages ?? [],
        (event) => {
          if (event.type === "progress") {
            setScenePanoramaGenerationByBlock((current) => ({
              ...current,
              [blockId]: {
                ...(current[blockId] ?? createInitialScenePanoramaGenerationDraft()),
                messageKey: event.messageKey,
                progress: event.progress,
                stage: event.stage
              }
            }));
          }

          if (event.type === "mother") {
            setScenePanoramaGenerationByBlock((current) => ({
              ...current,
              [blockId]: {
                ...(current[blockId] ?? createInitialScenePanoramaGenerationDraft()),
                motherImage: event.image,
                progress: Math.max(current[blockId]?.progress ?? 0, 100),
                messageKey: "sceneForm.panoramaProgressMotherReady",
                stage: "mother-ready"
              }
            }));
          }

          if (event.type === "motherQuality") {
            setScenePanoramaGenerationByBlock((current) => ({
              ...current,
              [blockId]: {
                ...(current[blockId] ?? createInitialScenePanoramaGenerationDraft()),
                messageKey: event.passed
                  ? "sceneForm.panoramaProgressMotherQualityPassed"
                  : "sceneForm.panoramaProgressMotherQuality",
                progress: Math.max(current[blockId]?.progress ?? 0, event.passed ? 96 : 36),
                stage: event.passed ? "mother-quality-passed" : "mother-quality-checking"
              }
            }));
          }

          if (event.type === "motherDone") {
            setScenePanoramaGenerationByBlock((current) => ({
              ...current,
              [blockId]: {
                ...(current[blockId] ?? createInitialScenePanoramaGenerationDraft()),
                completed: true,
                motherImage: event.image,
                progress: 100,
                messageKey: event.qualityPassed
                  ? "sceneForm.panoramaProgressMotherReady"
                  : "sceneForm.panoramaProgressMotherQualityFailed",
                stage: event.qualityPassed ? "mother-ready" : "mother-quality-failed"
              }
            }));
          }
        }
      );
      const motherImage = motherEvent.image;
      const file = await dataUrlToFile(motherImage.dataUrl, motherImage.fileName, motherImage.contentType);

      if (!isValidGeneratedScenePanoramaImage(file)) {
        throw new Error("INVALID_SCENE_PANORAMA_MOTHER_FILE");
      }

      setSceneCreateDraft((current) => ({
        ...current,
        blocks: current.blocks.map((block) => {
          if (block.id !== blockId) {
            return block;
          }

          revokeScenePanoramaMotherPreview(block.panorama?.mother);

          return {
            ...block,
            panorama: {
              faceSource: block.panorama?.faceSource ?? "reference-repaint",
              faces: block.panorama?.faces ?? {},
              mother: {
                file,
                previewUrl: motherImage.dataUrl,
                qualityPassed: motherEvent.qualityPassed,
                source: "generated",
                storedUrl: null
              }
            }
          };
        })
      }));

      if (motherEvent.qualityPassed) {
        toast.success(materialT("sceneForm.panoramaMotherGenerated"));
      } else {
        toast.error(materialT("sceneForm.panoramaMotherQualityFailed"));
      }
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void generateScenePanoramaMother(blockId, nextViewer);
        });
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const isMotherQualityFailure = errorMessage.includes("SCENE_PANORAMA_MOTHER_QUALITY_FAILED");

      toast.error(resolveScenePanoramaError(error, materialT));
      setScenePanoramaGenerationByBlock((current) => ({
        ...current,
        [blockId]: {
          ...(current[blockId] ?? createInitialScenePanoramaGenerationDraft()),
          error: errorMessage,
          messageKey: isMotherQualityFailure
            ? "sceneForm.panoramaProgressMotherQualityFailed"
            : "sceneForm.panoramaProgressFailed",
          stage: isMotherQualityFailure ? "mother-quality-failed" : "failed"
        }
      }));
    } finally {
      setScenePanoramaPendingBlockId("");
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

    const blockDraft = sceneCreateDraft.blocks.find((block) => block.id === blockId);
    const mother = blockDraft?.panorama?.mother ?? null;

    if (!mother || (!mother.previewUrl && !mother.storedUrl)) {
      toast.error(materialT("sceneForm.panoramaMotherRequired"));
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
    const maxRedrawAttempts = normalizeScenePanoramaMaxRedrawAttempts(scenePanoramaMaxRedrawAttempts);
    const streamedFaces: Partial<Record<ScenePanoramaFace, ScenePanoramaStreamFaceImage>> = {};
    const finalFaces: Partial<Record<ScenePanoramaFace, ScenePanoramaStreamFaceImage>> = {};
    let doneEvent: ScenePanoramaStreamDoneEvent | null = null;

    try {
      setScenePanoramaGenerationByBlock((current) => ({
        ...current,
        [blockId]: createInitialScenePanoramaGenerationDraft()
      }));

      doneEvent = await streamHomeScenePanorama(
        serializeSceneTextDraft(sceneCreateDraft),
        blockId,
        locale,
        maxRedrawAttempts,
        mother,
        (event) => {
          if (event.type === "progress") {
            setScenePanoramaGenerationByBlock((current) => ({
              ...current,
              [blockId]: {
                ...(current[blockId] ?? createInitialScenePanoramaGenerationDraft()),
                messageKey: event.messageKey,
                progress: event.progress,
                stage: event.stage
              }
            }));
          }

          if (event.type === "face") {
            streamedFaces[event.face] = event.image;

            if (event.phase === "final") {
              finalFaces[event.face] = event.image;
            }

            setScenePanoramaGenerationByBlock((current) => {
              const previous = current[blockId] ?? createInitialScenePanoramaGenerationDraft();
              const nextIteratingFaces =
                event.phase === "final"
                  ? previous.iteratingFaces.filter((face) => face !== event.face)
                  : previous.iteratingFaces;

              return {
                ...current,
                [blockId]: {
                  ...previous,
                  faces: {
                    ...previous.faces,
                    [event.face]: event.image
                  },
                  finalFaces: event.phase === "final"
                    ? {
                        ...previous.finalFaces,
                        [event.face]: event.image
                      }
                    : previous.finalFaces,
                  iteratingFaces: nextIteratingFaces,
                  messageKey: event.phase === "final" ? "sceneForm.panoramaProgressQuality" : "sceneForm.panoramaProgressFaces",
                  progress: Math.max(previous.progress, event.phase === "final" ? 66 : 38),
                  stage: event.phase === "final" ? "quality-checking" : "faces-generating"
                }
              };
            });
          }

          if (event.type === "motherQuality") {
            setScenePanoramaGenerationByBlock((current) => {
              const previous = current[blockId] ?? createInitialScenePanoramaGenerationDraft();

              return {
                ...current,
                [blockId]: {
                  ...previous,
                  messageKey: event.passed
                    ? "sceneForm.panoramaProgressMotherQualityPassed"
                    : "sceneForm.panoramaProgressMotherQuality",
                  progress: Math.max(previous.progress, event.passed ? 22 : 18),
                  stage: event.passed ? "mother-quality-passed" : "mother-quality-checking"
                }
              };
            });
          }

          if (event.type === "iterating") {
            setScenePanoramaGenerationByBlock((current) => {
              const previous = current[blockId] ?? createInitialScenePanoramaGenerationDraft();

              return {
                ...current,
                [blockId]: {
                  ...previous,
                  iteratingFaces: event.faces,
                  messageKey: "sceneForm.panoramaProgressIterating",
                  progress: Math.max(previous.progress, 72),
                  stage: "iterating"
                }
              };
            });
          }

          if (event.type === "quality") {
            setScenePanoramaGenerationByBlock((current) => {
              const previous = current[blockId] ?? createInitialScenePanoramaGenerationDraft();

              return {
                ...current,
                [blockId]: {
                  ...previous,
                  iteratingFaces: event.passed ? [] : previous.iteratingFaces,
                  messageKey: event.passed ? "sceneForm.panoramaProgressDone" : "sceneForm.panoramaProgressQuality",
                  progress: Math.max(previous.progress, event.passed ? 96 : 70),
                  stage: event.passed ? "quality-passed" : "quality-checking"
                }
              };
            });
          }

          if (event.type === "done") {
            doneEvent = event;
            setScenePanoramaGenerationByBlock((current) => {
              const previous = current[blockId] ?? createInitialScenePanoramaGenerationDraft();

              return {
                ...current,
                [blockId]: {
                  ...previous,
                  completed: true,
                  iteratingFaces: [],
                  messageKey: "sceneForm.panoramaProgressDone",
                  progress: 100,
                  stage: "done"
                }
              };
            });
          }
        }
      );
      const faces = await Promise.all(
        scenePanoramaFaces.map(async (face) => {
          const image = finalFaces[face] ?? streamedFaces[face];

          if (!image) {
            throw new Error("SCENE_PANORAMA_IMAGE_EMPTY");
          }

          const file = await dataUrlToFile(image.dataUrl, image.fileName, image.contentType);

          if (!isValidGeneratedScenePanoramaImage(file)) {
            throw new Error("INVALID_SCENE_PANORAMA_FACE_FILE");
          }

          return [
            face,
            {
              file,
              previewUrl: image.dataUrl,
              source: doneEvent?.mode === "direct-cut" ? "direct-cut" : "reference-repaint",
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
              faceSource: doneEvent?.mode === "direct-cut" ? "direct-cut" : "reference-repaint",
              faces: Object.fromEntries(faces),
              mother: block.panorama?.mother ?? null
            }
          };
        })
      }));
      toast.success(
        materialT(
          doneEvent?.qualityBestEffort
            ? "sceneForm.panoramaGeneratedBestEffort"
            : doneEvent?.colorStatus === "rejected"
              ? "sceneForm.panoramaGeneratedColorRejected"
            : doneEvent?.colorStatus === "skipped"
              ? "sceneForm.panoramaGeneratedColorSkipped"
            : doneEvent?.mode === "direct-cut"
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
      setScenePanoramaGenerationByBlock((current) => ({
        ...current,
        [blockId]: {
          ...(current[blockId] ?? createInitialScenePanoramaGenerationDraft()),
          error: error instanceof Error ? error.message : String(error),
          messageKey: "sceneForm.panoramaProgressFailed",
          stage: "failed"
        }
      }));
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
        material.communityVisible
          ? upsertMaterialList(current, material)
          : current.filter((item) => item.id !== material.id)
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

  function closeMapNodeDialog() {
    setMapNodeDialogOpen(false);
    setMapEditingNodeId("");
  }

  function clearMapEdgeConnectState() {
    setMapEdgeConnectSourceId("");
    setMapEdgeConnectTargetId("");
  }

  function closeMapEdgeDialog() {
    setMapEdgeDialogOpen(false);
    setMapEditingEdgeId("");
    clearMapEdgeConnectState();
  }

  function resetMapCreateDraft() {
    const nextDraft = createDefaultMapDraft();

    resetMapImageState();
    mapCreateDraftRef.current = nextDraft;
    setMapCreateDraft(nextDraft);
    setMapSelectedNodeId("");
    setMapSelectedEdgeId("");
    setMapEditingMaterialId("");
  }

  function updateMapCreateDraft(updater: (current: MapCreateDraft) => MapCreateDraft) {
    setMapCreateDraft((current) => {
      const nextDraft = updater(current);

      mapCreateDraftRef.current = nextDraft;

      return nextDraft;
    });
  }

  function resetMapAiState() {
    setMapAiInput("");
    setMapAiMessages([]);
    setMapAiPending(false);
  }

  function resetMapDeriveState() {
    mapDeriveRunIdRef.current = "";
    setMapDerivePending(false);
    setMapDeriveMaxRounds(3);
    setMapDeriveRound(0);
    setMapDeriveStatus("");
  }

  function resetMapImageState() {
    mapImageRunIdRef.current = "";
    mapImageOutlineRunIdRef.current = "";
    revokeMapImagePreview(mapImageDraftRef.current);
    mapImageReferenceImages.forEach(revokeSceneReferenceImagePreview);
    mapImageDraftRef.current = null;
    setMapImageDraft(null);
    setMapImageGeneration(createInitialMapImageGenerationDraft());
    setMapImageNodeBatchSize(defaultMapImageNodeBatchSize);
    setMapImageReferenceImages([]);
    setMapImageReferencePrompt("");
  }

  function closeMapCreateDialog() {
    setMapCreateOpen(false);
    closeMapNodeDialog();
    closeMapEdgeDialog();
    resetMapCreateDraft();
    resetMapAiState();
    resetMapDeriveState();
  }

  function closeMapGraphDialog() {
    setMapGraphOpen(false);
    closeMapNodeDialog();
    closeMapEdgeDialog();
    resetMapCreateDraft();
    resetMapAiState();
    resetMapDeriveState();
  }

  function openMapCreateDialog() {
    setMaterialCreateMenuOpen(false);
    setMaskCreateOpen(false);
    setCreatureCreateOpen(false);
    setItemCreateOpen(false);
    setSceneCreateOpen(false);
    setMapGraphOpen(false);
    closeMapNodeDialog();
    closeMapEdgeDialog();
    resetMapCreateDraft();
    resetMapAiState();
    resetMapDeriveState();
    setMapCreateOpen(true);
  }

  function openMapBasicEditDialog(material: WorkspaceMaterial) {
    if (material.category !== "map" || material.librarySource !== "SELF_CREATED") {
      return;
    }

    const nextDraft = createMapDraftFromMaterial(material);
    const nextMapImage = createMapImageDraftFromMaterial(material);

    setMaterialCreateMenuOpen(false);
    resetMapImageState();
    mapCreateDraftRef.current = nextDraft;
    setMapCreateDraft(nextDraft);
    mapImageDraftRef.current = nextMapImage;
    setMapImageDraft(nextMapImage);
    setMapImageNodeBatchSize(nextMapImage?.nodeBatchSize ?? defaultMapImageNodeBatchSize);
    setMapSelectedNodeId("");
    setMapSelectedEdgeId("");
    setMapEditingMaterialId(material.id);
    closeMapNodeDialog();
    closeMapEdgeDialog();
    resetMapAiState();
    resetMapDeriveState();
    setMapGraphOpen(false);
    setMaskCreateOpen(false);
    setCreatureCreateOpen(false);
    setItemCreateOpen(false);
    setSceneCreateOpen(false);
    setMapCreateOpen(true);
  }

  function openMapBasicInfoFromGraphDialog() {
    closeMapNodeDialog();
    closeMapEdgeDialog();
    setMapGraphOpen(false);
    setMapCreateOpen(true);
  }

  function openMapGraphEditDialog(material: WorkspaceMaterial) {
    if (material.category !== "map" || material.librarySource !== "SELF_CREATED") {
      return;
    }

    const nextDraft = createMapDraftFromMaterial(material);
    const nextMapImage = createMapImageDraftFromMaterial(material);

    setMaterialCreateMenuOpen(false);
    resetMapImageState();
    mapCreateDraftRef.current = nextDraft;
    setMapCreateDraft(nextDraft);
    mapImageDraftRef.current = nextMapImage;
    setMapImageDraft(nextMapImage);
    setMapImageNodeBatchSize(nextMapImage?.nodeBatchSize ?? defaultMapImageNodeBatchSize);
    setMapSelectedNodeId(nextDraft.nodes[0]?.id ?? "");
    setMapSelectedEdgeId(nextDraft.edges[0]?.id ?? "");
    setMapEditingMaterialId(material.id);
    closeMapNodeDialog();
    closeMapEdgeDialog();
    resetMapAiState();
    resetMapDeriveState();
    setMapCreateOpen(false);
    setMaskCreateOpen(false);
    setCreatureCreateOpen(false);
    setItemCreateOpen(false);
    setSceneCreateOpen(false);
    setMapGraphOpen(true);
  }

  function openMapNodeCreateDialog() {
    if (mapDerivePending) {
      return;
    }

    closeMapEdgeDialog();
    setMapEditingNodeId("");
    setMapNodeDialogOpen(true);
  }

  function openMapNodeEditDialog(nodeId: string) {
    if (mapDerivePending) {
      return;
    }

    setMapSelectedNodeId(nodeId);
    setMapSelectedEdgeId("");
    setMapEditingNodeId(nodeId);
    closeMapEdgeDialog();
    setMapNodeDialogOpen(true);
  }

  function startMapNodeConnect(nodeId: string) {
    if (mapDerivePending || mapCreateDraft.nodes.length < 2 || !nodeId) {
      return;
    }

    if (mapEdgeConnectSourceId === nodeId && !mapEdgeDialogOpen) {
      clearMapEdgeConnectState();
      return;
    }

    closeMapNodeDialog();
    setMapEditingEdgeId("");
    setMapSelectedNodeId(nodeId);
    setMapSelectedEdgeId("");
    setMapEdgeConnectSourceId(nodeId);
    setMapEdgeConnectTargetId("");
    setMapEdgeDialogOpen(false);
  }

  function openMapEdgeEditDialog(edgeId: string) {
    if (mapDerivePending) {
      return;
    }

    clearMapEdgeConnectState();
    setMapSelectedEdgeId(edgeId);
    setMapSelectedNodeId("");
    setMapEditingEdgeId(edgeId);
    closeMapNodeDialog();
    setMapEdgeDialogOpen(true);
  }

  function selectMapNode(nodeId: string) {
    if (mapDerivePending) {
      return;
    }

    if (!nodeId) {
      setMapSelectedNodeId("");
      if (mapEdgeConnectSourceId) {
        clearMapEdgeConnectState();
      }
      return;
    }

    if (mapEdgeConnectSourceId && nodeId !== mapEdgeConnectSourceId) {
      setMapSelectedNodeId(nodeId);
      setMapSelectedEdgeId("");
      setMapEditingEdgeId("");
      setMapEdgeConnectTargetId(nodeId);
      setMapEdgeDialogOpen(true);
      return;
    }

    setMapSelectedNodeId(nodeId);
    setMapSelectedEdgeId("");
  }

  function selectMapEdge(edgeId: string) {
    if (mapDerivePending) {
      return;
    }

    setMapSelectedEdgeId(edgeId);

    if (edgeId) {
      clearMapEdgeConnectState();
    }
  }

  function updateMapName(name: string) {
    updateMapCreateDraft((current) => ({ ...current, name }));
  }

  function updateMapDescription(description: string) {
    updateMapCreateDraft((current) => ({ ...current, description }));
  }

  function updateMapStyle(style: WorkspaceMaterialStyle) {
    updateMapCreateDraft((current) => ({ ...current, style }));
  }

  function updateMapCommunityVisible(checked: boolean) {
    updateMapCreateDraft((current) => ({ ...current, communityVisible: checked }));
  }

  async function sendMapAiMessage(authenticatedViewer = viewer) {
    const instruction = mapAiInput.trim();

    if (!instruction || mapAiPending || mapDerivePending) {
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void sendMapAiMessage(nextViewer);
      });
      return;
    }

    const snapshot = serializeMapDraft(mapCreateDraftRef.current);
    setMapAiInput("");
    setMapAiPending(true);
    setMapAiMessages((current) => [
      ...current,
      { id: createClientId("map-ai-user"), role: "user", content: instruction }
    ]);

    try {
      const result = await assistHomeMapDraft(snapshot, instruction, locale);

      updateMapCreateDraft((current) => applyPatchToMapDraft(current, result.patch));
      setMapAiMessages((current) => [
        ...current,
        { id: createClientId("map-ai-assistant"), role: "assistant", content: result.message }
      ]);
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void sendMapAiMessage(nextViewer);
        });
        return;
      }

      toast.error(resolveMapAiError(error, materialT));
      setMapAiInput(instruction);
    } finally {
      setMapAiPending(false);
    }
  }

  function normalizeMapDeriveMaxRounds(value: number) {
    if (!Number.isFinite(value)) {
      return 3;
    }

    return Math.min(20, Math.max(1, Math.round(value)));
  }

  function stopMapDerive() {
    if (!mapDeriveRunIdRef.current) {
      return;
    }

    mapDeriveRunIdRef.current = "";
    setMapDerivePending(false);
    setMapDeriveRound(0);
    setMapDeriveStatus(materialT("mapForm.deriveStopped"));
    setMapAiMessages((current) => [
      ...current,
      {
        id: createClientId("map-ai-assistant"),
        role: "assistant",
        content: materialT("mapForm.deriveStopped")
      }
    ]);
    toast.info(materialT("mapForm.deriveStopped"));
  }

  async function startMapDerive(authenticatedViewer = viewer) {
    if (mapDerivePending || mapDeriveRunIdRef.current) {
      return;
    }

    const maxRounds = normalizeMapDeriveMaxRounds(mapDeriveMaxRounds);
    const initialDraft = mapCreateDraftRef.current;

    setMapDeriveMaxRounds(maxRounds);

    if (initialDraft.nodes.length === 0) {
      toast.error(materialT("mapForm.deriveNodeRequired"));
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void startMapDerive(nextViewer);
      });
      return;
    }

    const runId = createClientId("map-derive-run");

    mapDeriveRunIdRef.current = runId;
    setMapDerivePending(true);
    setMapDeriveRound(0);
    setMapDeriveStatus(materialT("mapForm.deriveStarting", { rounds: maxRounds }));
    setMapAiMessages((current) => [
      ...current,
      {
        id: createClientId("map-ai-user"),
        role: "user",
        content: materialT("mapForm.deriveStartMessage", { rounds: maxRounds })
      }
    ]);

    for (let roundIndex = 1; roundIndex <= maxRounds; roundIndex += 1) {
      if (mapDeriveRunIdRef.current !== runId) {
        return;
      }

      const snapshot = serializeMapDraft(mapCreateDraftRef.current);

      if (snapshot.nodes.length === 0) {
        mapDeriveRunIdRef.current = "";
        setMapDerivePending(false);
        setMapDeriveRound(0);
        setMapDeriveStatus(materialT("mapForm.deriveNodeRequired"));
        toast.error(materialT("mapForm.deriveNodeRequired"));
        return;
      }

      setMapDeriveRound(roundIndex);
      setMapDeriveStatus(materialT("mapForm.deriveProgress", {
        maxRounds,
        round: roundIndex
      }));

      try {
        const result = await deriveHomeMapGraphRound(snapshot, roundIndex, maxRounds, locale);

        if (mapDeriveRunIdRef.current !== runId) {
          return;
        }

        const nextDraft = applyPatchToMapDraft(mapCreateDraftRef.current, result.patch);
        const firstNewNodeId = result.patch.addNodes?.[0]?.id ?? "";
        const layoutUpdates = layoutMapGraphNodes(nextDraft.nodes, nextDraft.edges);
        const laidOutDraft = applyMapLayoutUpdatesToDraft(nextDraft, layoutUpdates);

        mapCreateDraftRef.current = laidOutDraft;
        setMapCreateDraft(laidOutDraft);
        setMapSelectedNodeId(firstNewNodeId || nextDraft.nodes[0]?.id || "");
        setMapSelectedEdgeId("");
        setMapAiMessages((current) => [
          ...current,
          {
            id: createClientId("map-ai-assistant"),
            role: "assistant",
            content: materialT("mapForm.deriveRoundMessage", {
              maxRounds,
              message: result.message || materialT("mapForm.deriveRoundFallback"),
              round: roundIndex
            })
          }
        ]);
      } catch (error) {
        if (mapDeriveRunIdRef.current !== runId) {
          return;
        }

        if (isAuthRequiredError(error)) {
          mapDeriveRunIdRef.current = "";
          setMapDerivePending(false);
          setMapDeriveRound(0);
          requestAuth((nextViewer) => {
            setViewer(nextViewer);
            void startMapDerive(nextViewer);
          });
          return;
        }

        mapDeriveRunIdRef.current = "";
        setMapDerivePending(false);
        setMapDeriveRound(0);
        setMapDeriveStatus(resolveMapDeriveError(error, materialT));
        toast.error(resolveMapDeriveError(error, materialT));
        return;
      }
    }

    if (mapDeriveRunIdRef.current === runId) {
      mapDeriveRunIdRef.current = "";
      setMapDerivePending(false);
      setMapDeriveRound(0);
      setMapDeriveStatus(materialT("mapForm.deriveComplete", { rounds: maxRounds }));
      toast.success(materialT("mapForm.deriveComplete", { rounds: maxRounds }));
    }
  }

  function updateMapNode(
    nodeId: string,
    patch: Partial<Pick<WorkspaceMapMaterialNode, "description" | "name" | "type" | "x" | "y">>
  ) {
    updateMapCreateDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              ...(typeof patch.type === "string" ? { type: patch.type as WorkspaceMapMaterialNodeType } : {}),
              ...(typeof patch.name === "string" ? { name: patch.name } : {}),
              ...(typeof patch.description === "string" ? { description: patch.description } : {}),
              ...(typeof patch.x === "number" && Number.isFinite(patch.x) ? { x: patch.x } : {}),
              ...(typeof patch.y === "number" && Number.isFinite(patch.y) ? { y: patch.y } : {})
            }
          : node
      )
    }));
  }

  function updateMapEdge(
    edgeId: string,
    patch: Partial<Pick<WorkspaceMapMaterialEdge, "description" | "relation" | "source" | "target">>
  ) {
    updateMapCreateDraft((current) => ({
      ...current,
      edges: current.edges.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              ...(typeof patch.relation === "string" ? { relation: patch.relation as WorkspaceMapMaterialRelationType } : {}),
              ...(typeof patch.source === "string" ? { source: patch.source } : {}),
              ...(typeof patch.target === "string" ? { target: patch.target } : {}),
              ...(typeof patch.description === "string" ? { description: patch.description } : {})
            }
          : edge
      )
    }));
  }

  function saveMapNode(value: {
    type: WorkspaceMapMaterialNodeType;
    name: string;
    description: string;
  }) {
    if (mapEditingNodeId) {
      updateMapNode(mapEditingNodeId, value);
      setMapSelectedNodeId(mapEditingNodeId);
      setMapSelectedEdgeId("");
      closeMapNodeDialog();
      return;
    }

    const node = createMapNode(value.type, mapCreateDraft.nodes.length, {
      name: value.name,
      description: value.description
    });

    updateMapCreateDraft((current) => ({
      ...current,
      nodes: [...current.nodes, node]
    }));
    setMapSelectedNodeId(node.id);
    setMapSelectedEdgeId("");
    closeMapNodeDialog();
  }

  function saveMapEdge(value: {
    relation: WorkspaceMapMaterialRelationType;
    source: string;
    target: string;
    description: string;
  }) {
    if (mapEditingEdgeId) {
      updateMapEdge(mapEditingEdgeId, value);
      setMapSelectedEdgeId(mapEditingEdgeId);
      setMapSelectedNodeId("");
      closeMapEdgeDialog();
      return;
    }

    if (!value.source || !value.target || value.source === value.target) {
      return;
    }

    const edge = createMapEdge(value.source, value.target, value.relation, {
      description: value.description
    });

    updateMapCreateDraft((current) => ({
      ...current,
      edges: [...current.edges, edge]
    }));
    setMapSelectedEdgeId(edge.id);
    setMapSelectedNodeId("");
    closeMapEdgeDialog();
  }

  function removeMapNode(nodeId: string) {
    let nextSelectedNodeId = mapSelectedNodeId;
    let nextSelectedEdgeId = mapSelectedEdgeId;

    updateMapCreateDraft((current) => {
      const nextNodes = current.nodes.filter((node) => node.id !== nodeId);
      const nextEdges = current.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);

      if (nextSelectedNodeId === nodeId || !nextNodes.some((node) => node.id === nextSelectedNodeId)) {
        nextSelectedNodeId = nextNodes[0]?.id ?? "";
      }

      if (nextSelectedEdgeId && !nextEdges.some((edge) => edge.id === nextSelectedEdgeId)) {
        nextSelectedEdgeId = nextEdges[0]?.id ?? "";
      }

      return {
        ...current,
        nodes: nextNodes,
        edges: nextEdges
      };
    });

    setMapSelectedNodeId(nextSelectedNodeId);
    setMapSelectedEdgeId(nextSelectedEdgeId);

    if (mapEditingNodeId === nodeId) {
      closeMapNodeDialog();
    }
  }

  function removeMapEdge(edgeId: string) {
    let nextSelectedEdgeId = mapSelectedEdgeId;

    updateMapCreateDraft((current) => {
      const nextEdges = current.edges.filter((edge) => edge.id !== edgeId);

      if (nextSelectedEdgeId === edgeId || !nextEdges.some((edge) => edge.id === nextSelectedEdgeId)) {
        nextSelectedEdgeId = nextEdges[0]?.id ?? "";
      }

      return {
        ...current,
        edges: nextEdges
      };
    });

    setMapSelectedEdgeId(nextSelectedEdgeId);

    if (mapEditingEdgeId === edgeId) {
      closeMapEdgeDialog();
    }
  }

  function moveMapNode(nodeId: string, x: number, y: number) {
    updateMapCreateDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node))
    }));
  }

  function layoutMapNodes(updates: Array<Pick<WorkspaceMapMaterialNode, "id" | "x" | "y">>) {
    updateMapCreateDraft((current) => applyMapLayoutUpdatesToDraft(current, updates));
  }

  function setMapImageDraftState(nextImage: MapImageDraft | null) {
    revokeMapImagePreview(mapImageDraftRef.current, nextImage);
    mapImageDraftRef.current = nextImage;
    setMapImageDraft(nextImage);
  }

  function clearMapImageDraft() {
    mapImageOutlineRunIdRef.current = "";
    setMapImageDraftState(null);
    setMapImageGeneration(createInitialMapImageGenerationDraft());
    mapImageReferenceImages.forEach(revokeSceneReferenceImagePreview);
    setMapImageReferenceImages([]);
    setMapImageReferencePrompt("");
  }

  function updateMapImageNodeBatchSize(value: number) {
    setMapImageNodeBatchSize(normalizeMapImageNodeBatchSize(value));
  }

  function updateMapImageReferencePrompt(value: string) {
    setMapImageReferencePrompt(value);
  }

  function addMapImageReferenceImages(files: FileList | File[]) {
    const fileList = Array.from(files).slice(0, maxMapReferenceImages);
    const selected = createSceneReferenceImageDrafts(fileList);

    if (selected.invalidCount > 0) {
      toast.error(materialT("mapForm.invalidReferenceImage"));
    }

    if (selected.images.length === 0) {
      return;
    }

    const allImages = [...mapImageReferenceImages, ...selected.images];
    const nextImages = allImages.slice(0, maxMapReferenceImages);
    const droppedImages = allImages.slice(maxMapReferenceImages);

    droppedImages.forEach(revokeSceneReferenceImagePreview);

    if (allImages.length > maxMapReferenceImages) {
      toast.error(materialT("mapForm.referenceImageLimit"));
    }

    setMapImageReferenceImages(nextImages);
  }

  function removeMapImageReferenceImage(imageId: string) {
    const nextImages = mapImageReferenceImages.filter((image) => image.id !== imageId);
    const removed = mapImageReferenceImages.find((image) => image.id === imageId);

    if (removed) {
      revokeSceneReferenceImagePreview(removed);
    }

    setMapImageReferenceImages(nextImages);
  }

  function selectMapFinalImage(file: File | null) {
    if (!file) {
      return;
    }

    if (!isValidMaskBoardImage(file, { allowOversize: false })) {
      toast.error(materialT("mapForm.invalidFinalImage"));
      return;
    }

    const previewUrl = createPreviewUrl(file);
    const graphSignature = buildMapGraphSignature(mapCreateDraftRef.current);
    const nextImage: MapImageDraft = {
      edgeCount: mapCreateDraftRef.current.edges.length,
      file,
      generatedAt: new Date().toISOString(),
      graphSignature,
      iterationCount: mapImageGenerationRef.current.totalRounds || 1,
      nodeBatchSize: mapImageNodeBatchSize,
      nodeCount: mapCreateDraftRef.current.nodes.length,
      outlineError: null,
      outlinePending: true,
      outlinePreviewUrl: null,
      previewUrl,
      referencePrompt: mapImageReferencePrompt,
      source: "uploaded",
      stale: false,
      storedUrl: null
    };

    setMapImageGeneration(createInitialMapImageGenerationDraft());
    setMapImageDraftState(nextImage);
    void requestMapImageOutline(nextImage);
    toast.success(materialT("mapForm.finalImageUploaded"));
  }

  async function requestMapImageOutline(image: MapImageDraft) {
    if (!image.file) {
      return;
    }

    const runId = createClientId("map-image-outline");

    mapImageOutlineRunIdRef.current = runId;
    setMapImageDraftState({
      ...image,
      outlineError: null,
      outlinePending: true,
      outlinePreviewUrl: null
    });

    try {
      const outline = await generateHomeMapImageOutline(image.file, image.source);

      if (mapImageOutlineRunIdRef.current !== runId) {
        return;
      }

      const current = mapImageDraftRef.current;

      if (!current || current.file !== image.file || current.previewUrl !== image.previewUrl) {
        return;
      }

      setMapImageDraftState({
        ...current,
        outlineError: null,
        outlinePending: false,
        outlinePreviewUrl: outline.dataUrl
      });
    } catch (error) {
      if (mapImageOutlineRunIdRef.current !== runId) {
        return;
      }

      const current = mapImageDraftRef.current;

      if (!current || current.file !== image.file || current.previewUrl !== image.previewUrl) {
        return;
      }

      setMapImageDraftState({
        ...current,
        outlineError: error instanceof Error ? error.message : String(error),
        outlinePending: false
      });
    }
  }

  async function generateMapImage(authenticatedViewer = viewer, continuePaused = false) {
    if (mapImageGeneration.pending) {
      return;
    }

    const snapshot = serializeMapDraft(mapCreateDraftRef.current);

    if (snapshot.nodes.length === 0) {
      toast.error(materialT("mapForm.imageNodeRequired"));
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void generateMapImage(nextViewer, continuePaused);
      });
      return;
    }

    const currentImage = mapImageDraftRef.current;
    const canContinue = continuePaused && currentImage && !currentImage.stale && Boolean(currentImage.file);
    const runId = createClientId("map-image-run");
    const initialCompletedNodeIds = canContinue ? mapImageGeneration.completedNodeIds : [];

    mapImageRunIdRef.current = runId;
    setMapImageGeneration({
      completedNodeIds: initialCompletedNodeIds,
      error: null,
      failedRound: 0,
      paused: false,
      pending: true,
      progress: 4,
      relationSummary: "",
      round: 0,
      totalRounds: 0
    });

    try {
      const result = await streamHomeMapImage(
        snapshot,
        locale,
        mapImageNodeBatchSize,
        mapImageReferenceImages,
        mapImageReferencePrompt,
        (event) => {
          if (mapImageRunIdRef.current !== runId) {
            return;
          }

          if (event.type === "progress") {
            setMapImageGeneration((current) => ({
              ...current,
              error: null,
              failedRound: 0,
              paused: false,
              pending: true,
              progress: event.progress,
              relationSummary: event.relationSummary ?? current.relationSummary,
              round: event.round,
              totalRounds: event.totalRounds
            }));
            return;
          }

          if (event.type === "image") {
            void dataUrlToFile(event.image.dataUrl, event.image.fileName, event.image.contentType).then((file) => {
              if (mapImageRunIdRef.current && mapImageRunIdRef.current !== runId) {
                return;
              }

              const nextImage: MapImageDraft = {
                edgeCount: snapshot.edges.length,
                file,
                generatedAt: new Date().toISOString(),
                graphSignature: buildMapGraphSignature(snapshot),
                iterationCount: event.round,
                nodeBatchSize: mapImageNodeBatchSize,
                nodeCount: snapshot.nodes.length,
                previewUrl: event.image.dataUrl,
                referencePrompt: mapImageReferencePrompt,
                source: "generated",
                stale: false,
                storedUrl: null
              };

              setMapImageDraftState(nextImage);
              setMapImageGeneration((current) => ({
                ...current,
                completedNodeIds: event.completedNodeIds,
                error: null,
                failedRound: 0,
                paused: false,
                pending: true,
                progress: event.progress,
                relationSummary: event.relationSummary,
                round: event.round,
                totalRounds: event.totalRounds
              }));
            });
            return;
          }

          if (event.type === "paused") {
            const pausedImage = event.image;
            if (pausedImage) {
              void dataUrlToFile(pausedImage.dataUrl, pausedImage.fileName, pausedImage.contentType).then((file) => {
                if (mapImageRunIdRef.current && mapImageRunIdRef.current !== runId) {
                  return;
                }

                const nextImage: MapImageDraft = {
                  edgeCount: snapshot.edges.length,
                  file,
                  generatedAt: new Date().toISOString(),
                  graphSignature: buildMapGraphSignature(snapshot),
                  iterationCount: event.round,
                  nodeBatchSize: mapImageNodeBatchSize,
                  nodeCount: snapshot.nodes.length,
                  previewUrl: pausedImage.dataUrl,
                  referencePrompt: mapImageReferencePrompt,
                  source: "generated",
                  stale: false,
                  storedUrl: null
                };

                setMapImageDraftState(nextImage);
              });
            }

            setMapImageGeneration((current) => ({
              ...current,
              completedNodeIds: event.completedNodeIds,
              error: event.message,
              failedRound: event.failedRound,
              paused: true,
              pending: false,
              progress: event.progress,
              relationSummary: event.relationSummary ?? current.relationSummary,
              round: event.round,
              totalRounds: event.totalRounds
            }));
          }

          if (event.type === "done") {
            void dataUrlToFile(event.image.dataUrl, event.image.fileName, event.image.contentType).then((file) => {
              if (mapImageRunIdRef.current && mapImageRunIdRef.current !== runId) {
                return;
              }

              const nextImage: MapImageDraft = {
                edgeCount: event.edgeCount,
                file,
                generatedAt: new Date().toISOString(),
                graphSignature: event.graphSignature,
                iterationCount: event.iterationCount,
                nodeBatchSize: event.nodeBatchSize,
                nodeCount: event.nodeCount,
                outlineError: null,
                outlinePending: true,
                outlinePreviewUrl: null,
                previewUrl: event.image.dataUrl,
                referencePrompt: event.referencePrompt ?? "",
                source: "generated",
                stale: false,
                storedUrl: null
              };

              setMapImageDraftState(nextImage);
              void requestMapImageOutline(nextImage);
              setMapImageGeneration((current) => ({
                ...current,
                completedNodeIds: snapshot.nodes.map((node) => node.id),
                error: null,
                failedRound: 0,
                paused: false,
                pending: false,
                progress: 100,
                relationSummary: "",
                round: event.iterationCount,
                totalRounds: event.iterationCount
              }));
            });
          }
        },
        {
          completedNodeIds: initialCompletedNodeIds,
          previousImageFile: canContinue ? currentImage?.file ?? null : null,
          previousImageSource: canContinue ? currentImage?.source ?? "generated" : undefined,
          previousImageUrl: canContinue ? currentImage?.storedUrl ?? undefined : undefined,
          resumeRound: canContinue ? mapImageGeneration.failedRound : undefined
        }
      );

      if (mapImageRunIdRef.current !== runId) {
        return;
      }

      if (result.type === "paused") {
        toast.error(materialT("mapForm.imagePaused"));
        return;
      }

      toast.success(materialT("mapForm.imageGenerated"));
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void generateMapImage(nextViewer, continuePaused);
        });
        return;
      }

      setMapImageGeneration((current) => ({
        ...current,
        error: error instanceof Error ? error.message : String(error),
        failedRound: 0,
        paused: false,
        pending: false
      }));
      toast.error(resolveMapImageError(error, materialT));
    } finally {
      if (mapImageRunIdRef.current === runId) {
        mapImageRunIdRef.current = "";
        setMapImageGeneration((current) => ({
          ...current,
          pending: false
        }));
      }
    }
  }

  async function submitMapDraft(mode: "basic" | "graph", authenticatedViewer = viewer) {
    const validationError =
      mode === "basic" ? validateMapDraftForSave(mapCreateDraft) : validateMapDraftForGraphSave(mapCreateDraft);

    if (validationError) {
      toast.error(materialT(validationError));
      return;
    }

    if (!authenticatedViewer) {
      requestAuth((nextViewer) => {
        setViewer(nextViewer);
        void submitMapDraft(mode, nextViewer);
      });
      return;
    }

    if (!persistenceAvailable) {
      toast.error(materialT("mapForm.persistenceUnavailable"));
      return;
    }

    setMapSavePending(true);

    try {
      const isEditing = Boolean(mapEditingMaterialId);
      const formData = buildMapMaterialFormData(mapCreateDraft, mapImageDraft, isEditing);
      const material = isEditing
        ? await updateHomeMapMaterial(mapEditingMaterialId, formData, locale)
        : await createHomeMapMaterial(formData, locale);

      setMyMaterials((current) => upsertMaterialList(current, material));
      setCommunityMaterials((current) =>
        material.communityVisible
          ? upsertMaterialList(current, material)
          : current.filter((item) => item.id !== material.id)
      );
      setMaterialStyle(material.style);
      toast.success(materialT(isEditing ? "mapForm.updateSuccess" : "mapForm.saveSuccess"));
      router.refresh();

      if (mode === "basic" && !isEditing) {
        const shouldOpenGraph = window.confirm(materialT("mapForm.openGraphAfterSave"));

        if (shouldOpenGraph) {
          openMapGraphEditDialog(material);
          return;
        }
      }

      if (mode === "graph") {
        closeMapGraphDialog();
      } else {
        closeMapCreateDialog();
      }
    } catch (error) {
      if (isAuthRequiredError(error)) {
        requestAuth((nextViewer) => {
          setViewer(nextViewer);
          void submitMapDraft(mode, nextViewer);
        });
        return;
      }

      toast.error(resolveMapSaveError(error, materialT, Boolean(mapEditingMaterialId)));
    } finally {
      setMapSavePending(false);
    }
  }

  function submitMapBasicDraft(authenticatedViewer = viewer) {
    return submitMapDraft("basic", authenticatedViewer);
  }

  function submitMapGraphDraft(authenticatedViewer = viewer) {
    return submitMapDraft("graph", authenticatedViewer);
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
              (detailMaterial.category === "mask" ||
                detailMaterial.category === "map" ||
                detailMaterial.category === "creature" ||
                detailMaterial.category === "item" ||
                detailMaterial.category === "scene")
            }
            canExport={!isCommunityMaterialView && detailMaterial.librarySource === "SELF_CREATED"}
            canShare={!isCommunityMaterialView && detailMaterial.librarySource === "SELF_CREATED"}
            closeLabel={materialT("close")}
            deleteLabel={materialT("delete")}
            editGraphLabel={materialT("mapForm.editGraph")}
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
            onEditGraph={openMapGraphEditDialog}
            onEdit={openMaterialEditDialog}
            onExport={(material) => void exportMaterialArchive(material.id)}
            onJoin={handleJoinMaterial}
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
            onChangeCommunityVisible={(checked) => setMaskCreateDraft((current) => ({ ...current, communityVisible: checked }))}
            onGenerateBoard={() => void generateMaskBoard()}
            onSelectBoardImage={selectMaskBoardImage}
            onSendAiMessage={() => void sendMaskAiMessage()}
            onSubmit={submitMaskCreateDraft}
            saveLabel={materialT(isEditingMask ? "maskForm.saveEdit" : "saveMask")}
            t={materialT}
            title={materialT(isEditingMask ? "maskForm.editTitle" : "maskForm.title")}
          />
        ) : null}
        {creatureCreateOpen ? (
          <CreatureCreateDialog
            aiInput={creatureAiInput}
            aiPending={creatureAiPending}
            boardPending={creatureBoardPending}
            description={materialT(isEditingCreature ? "creatureForm.editDescription" : "creatureForm.description")}
            draft={creatureCreateDraft}
            isPending={isPending || isCreatureActionPending}
            onCancel={closeCreatureCreateDialog}
            onChangeAbilityTags={updateCreatureAbilityTags}
            onChangeAiInput={setCreatureAiInput}
            onChangeBehaviorField={updateCreatureBehaviorField}
            onChangeBehaviorLogic={updateCreatureBehaviorLogic}
            onChangeBoardDrawingStyle={updateCreatureBoardDrawingStyle}
            onChangeCommunityVisible={(checked) => setCreatureCreateDraft((current) => ({ ...current, communityVisible: checked }))}
            onChangeColorField={updateCreatureColorField}
            onChangeDescription={updateCreatureDescription}
            onChangeEcologyField={updateCreatureEcologyField}
            onChangeMorphologyField={updateCreatureMorphologyField}
            onChangeName={updateCreatureName}
            onChangeSenseField={updateCreatureSenseField}
            onChangeStyle={updateCreatureStyle}
            onChangeTaxonomyField={updateCreatureTaxonomyField}
            onChangeVocalizationField={updateCreatureVocalizationField}
            onClearBoardImage={clearCreatureBoardImage}
            onGenerateBoard={() => void generateCreatureBoard()}
            onSelectBoardImage={selectCreatureBoardImage}
            onSendAiMessage={() => void sendCreatureAiMessage()}
            onSubmit={submitCreatureCreateDraft}
            saveLabel={materialT(isEditingCreature ? "creatureForm.saveEdit" : "saveCreature")}
            t={materialT}
            title={materialT(isEditingCreature ? "creatureForm.editTitle" : "creatureForm.title")}
          />
        ) : null}
        {itemCreateOpen ? (
          <ItemCreateDialog
            aiInput={itemAiInput}
            aiPending={itemAiPending}
            aiReferenceImages={itemAiReferenceImages}
            boardPending={itemBoardPending}
            boardReferenceImages={itemBoardReferenceImages}
            description={materialT(isEditingItem ? "itemForm.editDescription" : "itemForm.description")}
            draft={itemCreateDraft}
            isPending={isPending || isItemActionPending}
            modelPending={itemModelPending}
            modelProgress={itemModelProgress}
            saveLabel={materialT(isEditingItem ? "itemForm.saveEdit" : "saveItem")}
            title={materialT(isEditingItem ? "itemForm.editTitle" : "itemForm.title")}
            modelInputPending={itemModelInputPending}
            onCancel={closeItemCreateDialog}
            onAddAiReferenceImages={addItemAiReferenceImages}
            onAddBoardReferenceImages={addItemBoardReferenceImages}
            onChangeAiInput={setItemAiInput}
            onChangeBoardDrawingStyle={updateItemBoardDrawingStyle}
            onChangeCommunityVisible={(checked) => setItemCreateDraft((current) => ({ ...current, communityVisible: checked }))}
            onChangeField={updateItemField}
            onChangeModelExtraParams={(value) => setItemCreateDraft((current) => ({ ...current, modelExtraParams: value }))}
            onChangeStyle={updateItemStyle}
            onChangeTags={updateItemTags}
            onClearBoardImage={clearItemBoardImage}
            onClearModelInputImage={clearItemModelInputImage}
            onGenerateBoard={() => void generateItemBoard()}
            onGenerateModel={() => void generateItemModel()}
            onGenerateModelInputImage={() => void generateItemModelInputImage()}
            onRemoveAiReferenceImage={removeItemAiReferenceImage}
            onRemoveBoardReferenceImage={removeItemBoardReferenceImage}
            onSelectBoardImage={selectItemBoardImage}
            onSelectModelInputImage={selectItemModelInputImage}
            onSendAiMessage={() => void sendItemAiMessage()}
            onSubmit={submitItemCreateDraft}
            t={materialT}
          />
        ) : null}
        {mapCreateOpen ? (
          <MapBasicInfoDialog
            aiInput={mapAiInput}
            aiMessages={mapAiMessages}
            aiPending={mapAiPending}
            description={materialT(isEditingMap ? "mapForm.editDescription" : "mapForm.description")}
            draft={mapCreateDraft}
            isPending={isPending || isMapActionPending}
            saveLabel={materialT(isEditingMap ? "mapForm.saveBasicInfo" : "saveMap")}
            title={materialT(isEditingMap ? "mapForm.editTitle" : "mapForm.title")}
            onCancel={closeMapCreateDialog}
            onChangeAiInput={setMapAiInput}
            onChangeCommunityVisible={updateMapCommunityVisible}
            onChangeDescription={updateMapDescription}
            onChangeName={updateMapName}
            onChangeStyle={updateMapStyle}
            onSendAiMessage={() => void sendMapAiMessage()}
            onSubmit={submitMapBasicDraft}
            t={materialT}
          />
        ) : null}
        {mapGraphOpen ? (
          <MapGraphDialog
            aiInput={mapAiInput}
            aiMessages={mapAiMessages}
            aiPending={mapAiPending || mapDerivePending}
            description={materialT("mapForm.graphDescription")}
            connectSourceNodeId={mapEdgeConnectSourceId}
            draft={mapCreateDraft}
            deriveMaxRounds={mapDeriveMaxRounds}
            derivePending={mapDerivePending}
            deriveRound={mapDeriveRound}
            deriveStatus={mapDeriveStatus}
            isPending={isPending || isMapActionPending}
            mapImageDraft={mapImageDraft}
            mapImageGeneration={mapImageGeneration}
            mapImageNodeBatchSize={mapImageNodeBatchSize}
            mapImageReferenceImages={mapImageReferenceImages}
            mapImageReferencePrompt={mapImageReferencePrompt}
            saveLabel={materialT("mapForm.saveGraph")}
            selectedEdgeId={mapSelectedEdgeId}
            selectedNodeId={mapSelectedNodeId}
            title={materialT("mapForm.graphTitle")}
            onAddNode={openMapNodeCreateDialog}
            onCancel={closeMapGraphDialog}
            onAddMapImageReferenceImages={addMapImageReferenceImages}
            onChangeAiInput={setMapAiInput}
            onChangeDeriveMaxRounds={(value) => setMapDeriveMaxRounds(value)}
            onChangeMapImageNodeBatchSize={updateMapImageNodeBatchSize}
            onChangeMapImageReferencePrompt={updateMapImageReferencePrompt}
            onClearMapImage={clearMapImageDraft}
            onConnectNode={startMapNodeConnect}
            onContinueMapImage={() => void generateMapImage(viewer, true)}
            onEditEdge={openMapEdgeEditDialog}
            onEditBasicInfo={openMapBasicInfoFromGraphDialog}
            onEditNode={openMapNodeEditDialog}
            onGenerateMapImage={() => void generateMapImage(viewer, false)}
            onLayoutNodes={layoutMapNodes}
            onMoveNode={moveMapNode}
            onRemoveMapImageReferenceImage={removeMapImageReferenceImage}
            onRemoveEdge={removeMapEdge}
            onRemoveNode={removeMapNode}
            onSelectMapFinalImage={selectMapFinalImage}
            onSelectEdge={selectMapEdge}
            onSelectNode={selectMapNode}
            onSendAiMessage={() => void sendMapAiMessage()}
            onStartDerive={() => void startMapDerive()}
            onStopDerive={stopMapDerive}
            onSubmit={submitMapGraphDraft}
            t={materialT}
          />
        ) : null}
        {mapNodeDialogOpen ? (
          <MapNodeDialog
            key={mapEditingNodeId || "map-node-create"}
            draft={mapCreateDraft}
            editingNodeId={mapEditingNodeId}
            description={materialT(mapEditingNodeId ? "mapForm.editNodeDescription" : "mapForm.addNodeDescription")}
            isPending={isPending || isMapActionPending}
            saveLabel={materialT(mapEditingNodeId ? "mapForm.saveNode" : "mapForm.createNode")}
            title={materialT(mapEditingNodeId ? "mapForm.editNodeTitle" : "mapForm.addNodeTitle")}
            onCancel={closeMapNodeDialog}
            onRemove={removeMapNode}
            onSave={saveMapNode}
            t={materialT}
          />
        ) : null}
        {mapEdgeDialogOpen ? (
          <MapEdgeDialog
            key={mapEditingEdgeId || "map-edge-create"}
            draft={mapCreateDraft}
            editingEdgeId={mapEditingEdgeId}
            description={materialT(mapEditingEdgeId ? "mapForm.editEdgeDescription" : "mapForm.addEdgeDescription")}
            initialSourceNodeId={mapEdgeConnectSourceId}
            initialTargetNodeId={mapEdgeConnectTargetId}
            isPending={isPending || isMapActionPending}
            saveLabel={materialT(mapEditingEdgeId ? "mapForm.saveEdge" : "mapForm.createEdge")}
            selectedNodeId={mapSelectedNodeId}
            title={materialT(mapEditingEdgeId ? "mapForm.editEdgeTitle" : "mapForm.addEdgeTitle")}
            onCancel={closeMapEdgeDialog}
            onRemove={removeMapEdge}
            onSave={saveMapEdge}
            t={materialT}
          />
        ) : null}
        {sceneCreateOpen ? (
          <SceneCreateDialog
            activeBlockId={sceneActiveBlockId || (sceneCreateDraft.blocks[0]?.id ?? "")}
            aiInput={sceneAiInput}
            aiMessages={sceneAiMessages}
            aiPending={sceneAiPending}
            aiReferenceImages={sceneAiReferenceImages}
            draft={sceneCreateDraft}
            isPending={isPending || isSceneActionPending}
            panoramaGenerationByBlock={scenePanoramaGenerationByBlock}
            panoramaMaxRedrawAttempts={scenePanoramaMaxRedrawAttempts}
            panoramaPendingBlockId={scenePanoramaPendingBlockId}
            saveLabel={materialT(isEditingScene ? "sceneForm.saveEdit" : "saveScene")}
            title={materialT(isEditingScene ? "sceneForm.editTitle" : "sceneForm.title")}
            description={materialT(isEditingScene ? "sceneForm.editDescription" : "sceneForm.description")}
            onAddAiReferenceImages={addSceneAiReferenceImages}
            onAddBlock={addSceneBlock}
            onAddBlockReferenceImages={addSceneBlockReferenceImages}
            onCancel={closeSceneCreateDialog}
            onChangeActiveBlock={setSceneActiveBlockId}
            onChangeAiInput={setSceneAiInput}
            onChangeBlock={updateSceneBlock}
            onChangeDescription={updateSceneDescription}
            onChangeCommunityVisible={(checked) => setSceneCreateDraft((current) => ({ ...current, communityVisible: checked }))}
            onChangeName={updateSceneName}
            onChangePanoramaMaxRedrawAttempts={updateScenePanoramaMaxRedrawAttempts}
            onChangePanoramaDrawingStyle={updateScenePanoramaDrawingStyle}
            onChangeStyle={updateSceneStyle}
            onClearBlockPanorama={clearSceneBlockPanorama}
            onGenerateMother={(blockId) => void generateScenePanoramaMother(blockId)}
            onGeneratePanorama={(blockId) => void generateScenePanorama(blockId)}
            onRemoveAiReferenceImage={removeSceneAiReferenceImage}
            onRemoveBlock={removeSceneBlock}
            onRemoveBlockReferenceImage={removeSceneBlockReferenceImage}
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

function applyMapLayoutUpdatesToDraft(
  draft: MapCreateDraft,
  updates: Array<Pick<WorkspaceMapMaterialNode, "id" | "x" | "y">>
) {
  const updateByNodeId = new Map(updates.map((update) => [update.id, update] as const));

  return {
    ...draft,
    nodes: draft.nodes.map((node) => {
      const update = updateByNodeId.get(node.id);

      return update ? { ...node, x: update.x, y: update.y } : node;
    })
  };
}

function createInitialMapImageGenerationDraft(): MapImageGenerationDraft {
  return {
    completedNodeIds: [],
    error: null,
    failedRound: 0,
    paused: false,
    pending: false,
    progress: 0,
    relationSummary: "",
    round: 0,
    totalRounds: 0
  };
}


