"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Graph, { MultiDirectedGraph } from "graphology";
import type { EdgeLabelDrawingFunction, NodeHoverDrawingFunction, NodeLabelDrawingFunction } from "sigma/rendering";
import {
  Check,
  ChevronDown,
  CornerUpLeft,
  Image as ImageIcon,
  Filter,
  Hand,
  LocateFixed,
  Link2,
  Loader2,
  Maximize2,
  Move,
  Network,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  SquareDashedMousePointer,
  StopCircle,
  Trash2,
  Upload,
  Wand2,
  ZoomIn,
  ZoomOut,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MapCreateDraft,
  WorkspaceMapGeoJsonFeature,
  WorkspaceMapMaterialNodeType,
  WorkspaceMapMaterialRelationType
} from "@/lib/home-workspace";
import { getMapGraphNodeBaseSize, layoutMapGraphNodes, mapNodeTypes, mapRelationTypes } from "@/lib/home-workspace/map";
import { ReferenceImageStrip } from "./reference-image-strip";
import type { MapGeoJsonDraft, MapImageDraft, MapImageGenerationDraft, SceneReferenceImageDraft } from "./shared";

export function MapGraphEditor({
  deriveMaxRounds = 3,
  derivePending = false,
  deriveRound = 0,
  deriveStatus = "",
  draft,
  embedded = false,
  mapGeoJsonDraft = null,
  mapImageDraft = null,
  mapImageGeneration,
  mapImageNodeBatchSize = 10,
  mapImageReferenceImages = [],
  mapImageReferencePrompt = "",
  connectSourceNodeId = "",
  readOnly = false,
  onAddNode,
  onAddMapImageReferenceImages,
  onChangeDeriveMaxRounds,
  onChangeMapImageNodeBatchSize,
  onChangeMapImageReferencePrompt,
  onClearMapImage,
  onConnectNode,
  onContinueMapImage,
  onEditEdge,
  onEditNode,
  onGenerateMapGeoJson,
  onGenerateMapImage,
  onLayoutNodes,
  onRemoveEdge,
  onRemoveMapImageReferenceImage,
  onRemoveNode,
  onSelectMapFinalImage,
  selectedEdgeId,
  selectedNodeId,
  onStartDerive,
  onStopDerive,
  onMoveNode,
  onSelectEdge,
  onSelectNode,
  showHeader = true,
  showSelectionPanel = true,
  relationLabel,
  t
}: {
  deriveMaxRounds?: number;
  derivePending?: boolean;
  deriveRound?: number;
  deriveStatus?: string;
  draft: MapCreateDraft;
  embedded?: boolean;
  mapGeoJsonDraft?: MapGeoJsonDraft | null;
  mapImageDraft?: MapImageDraft | null;
  mapImageGeneration?: MapImageGenerationDraft;
  mapImageNodeBatchSize?: number;
  mapImageReferenceImages?: SceneReferenceImageDraft[];
  mapImageReferencePrompt?: string;
  connectSourceNodeId?: string;
  readOnly?: boolean;
  onAddNode?: () => void;
  onAddMapImageReferenceImages?: (files: FileList | File[]) => void;
  onChangeDeriveMaxRounds?: (value: number) => void;
  onChangeMapImageNodeBatchSize?: (value: number) => void;
  onChangeMapImageReferencePrompt?: (value: string) => void;
  onClearMapImage?: () => void;
  onConnectNode?: (nodeId: string) => void;
  onContinueMapImage?: () => void;
  onEditEdge?: (edgeId: string) => void;
  onEditNode?: (nodeId: string) => void;
  onGenerateMapGeoJson?: () => void;
  onGenerateMapImage?: () => void;
  onLayoutNodes?: (updates: Array<{ id: string; x: number; y: number }>) => void;
  onRemoveEdge?: (edgeId: string) => void;
  onRemoveMapImageReferenceImage?: (imageId: string) => void;
  onRemoveNode?: (nodeId: string) => void;
  onSelectMapFinalImage?: (file: File | null) => void;
  selectedEdgeId: string;
  selectedNodeId: string;
  onStartDerive?: () => void;
  onStopDerive?: () => void;
  onMoveNode?: (nodeId: string, x: number, y: number) => void;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  showHeader?: boolean;
  showSelectionPanel?: boolean;
  relationLabel: (relation: WorkspaceMapMaterialRelationType) => string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const dragStateRef = useRef<{ nodeId: string; position: { x: number; y: number } | null }>({
    nodeId: "",
    position: null
  });
  const [graph] = useState(() => new MultiDirectedGraph());
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [failureReason, setFailureReason] = useState<"webgl" | "init" | null>(null);
  const [canvasDragMode, setCanvasDragMode] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [visibleNodeTypes, setVisibleNodeTypes] = useState<WorkspaceMapMaterialNodeType[]>(() => [...mapNodeTypes]);
  const [visibleRelationTypes, setVisibleRelationTypes] = useState<WorkspaceMapMaterialRelationType[]>(() => [...mapRelationTypes]);
  const [graphTheme, setGraphTheme] = useState<"light" | "dark">(() => getMapGraphThemeMode());
  const callbacksRef = useRef({
    onMoveNode,
    onSelectEdge,
    onSelectNode,
    canvasDragMode,
    readOnly
  });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const finalImageInputRef = useRef<HTMLInputElement>(null);
  const formatFrameRef = useRef(0);

  useEffect(() => {
    callbacksRef.current = {
      onMoveNode,
      onSelectEdge,
      onSelectNode,
      canvasDragMode,
      readOnly
    };
  }, [canvasDragMode, onMoveNode, onSelectEdge, onSelectNode, readOnly]);

  useEffect(() => {
    if (!filterPanelOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (toolbarRef.current?.contains(target) || filterPanelRef.current?.contains(target)) {
        return;
      }

      setFilterPanelOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFilterPanelOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filterPanelOpen]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const syncTheme = () => {
      setGraphTheme(getMapGraphThemeMode());
    };

    syncTheme();

    const observer = typeof MutationObserver !== "undefined" ? new MutationObserver(syncTheme) : null;
    observer?.observe(root, {
      attributes: true,
      attributeFilter: ["class", "style"]
    });

    const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    media?.addEventListener("change", syncTheme);

    return () => {
      observer?.disconnect();
      media?.removeEventListener("change", syncTheme);
    };
  }, []);

  useEffect(() => {
    const graphDraft = filterMapDraft(draft, visibleNodeTypes, visibleRelationTypes);
    const themeColors = getGraphThemeColors(containerRef.current, graphTheme);

    syncGraphToDraft(
      graph,
      graphDraft,
      selectedNodeId,
      selectedEdgeId,
      relationLabel,
      themeColors,
      {
        relatedNodeIds: buildRelatedNodeIdSet(graphDraft, selectedNodeId, selectedEdgeId),
        relatedEdgeIds: buildRelatedEdgeIdSet(graphDraft, selectedNodeId, selectedEdgeId)
      }
    );

    if (rendererRef.current) {
      rendererRef.current.refresh?.();
    }
  }, [draft, graph, graphTheme, relationLabel, selectedEdgeId, selectedNodeId, visibleNodeTypes, visibleRelationTypes]);

  useEffect(() => {
    if (selectedNodeId && !draft.nodes.some((node) => node.id === selectedNodeId && visibleNodeTypes.includes(node.type))) {
      onSelectNode("");
    }
  }, [draft.nodes, onSelectNode, selectedNodeId, visibleNodeTypes]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let disposed = false;
    let initStarted = false;
    let cleanupRenderer = () => {};
    let resizeObserver: ResizeObserver | null = null;
    let animationFrame = 0;

    const getContainerSize = () => ({
      height: container.clientHeight || container.offsetHeight,
      width: container.clientWidth || container.offsetWidth
    });

    const hasRenderableSize = () => {
      const size = getContainerSize();

      return size.width > 0 && size.height > 0;
    };

    const syncRendererSize = () => {
      const renderer = rendererRef.current;

      if (!renderer || !hasRenderableSize()) {
        return;
      }

      renderer.resize(true);
      renderer.scheduleRefresh?.({ layoutUnchange: true });
    };

    const stopObserver = () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    };

    const cleanup = () => {
      stopObserver();
      cleanupRenderer();
      cleanupRenderer = () => {};
      rendererRef.current = null;
      dragStateRef.current = {
        nodeId: "",
        position: null
      };
    };

    const markFallback = (reason: "webgl" | "init") => {
      setFailureReason(reason);
      setStatus("fallback");
    };

    async function initRenderer() {
      if (disposed || initStarted || rendererRef.current) {
        return;
      }

      if (!hasRenderableSize()) {
        setStatus("loading");
        return;
      }

      setFailureReason(null);
      initStarted = true;

      try {
        if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
          markFallback("init");
          return;
        }

        if (!hasCanvasWebglSupport(document.createElement("canvas"), ["webgl2", "webgl", "experimental-webgl"])) {
          markFallback("webgl");
          return;
        }

        const { default: Sigma } = await import("sigma");
        const currentGraphTheme = getMapGraphThemeMode();
        const themeColors = getGraphThemeColors(container, currentGraphTheme);
        const renderer = new Sigma(graph, container as HTMLElement, {
          defaultDrawEdgeLabel: createMapEdgeLabelDrawer(currentGraphTheme),
          defaultDrawNodeHover: createMapNodeHoverDrawer(currentGraphTheme),
          defaultDrawNodeLabel: createMapNodeLabelDrawer(currentGraphTheme),
          minEdgeThickness: 0.45,
          renderEdgeLabels: true,
          renderLabels: true,
          labelColor: { color: themeColors.nodeLabel },
          labelRenderedSizeThreshold: 4,
          labelWeight: "600",
          edgeLabelColor: { color: themeColors.edgeLabel },
          edgeLabelWeight: "500",
          zIndex: true
        });
        const camera = renderer.getCamera();
        const mouseCaptor = renderer.getMouseCaptor();

        rendererRef.current = renderer;

        const handleClickNode = ({ node }: { node: string }) => {
          callbacksRef.current.onSelectNode(node);
          callbacksRef.current.onSelectEdge("");
        };
        const handleClickEdge = ({ edge }: { edge: string }) => {
          callbacksRef.current.onSelectEdge(edge);
          callbacksRef.current.onSelectNode("");
        };
        const handleClickStage = () => {
          callbacksRef.current.onSelectNode("");
          callbacksRef.current.onSelectEdge("");
        };
        const handleDownNode = ({ node }: { node: string }) => {
          if (callbacksRef.current.readOnly || callbacksRef.current.canvasDragMode) {
            return;
          }

          dragStateRef.current = {
            nodeId: node,
            position: {
              x: graph.getNodeAttribute(node, "x"),
              y: graph.getNodeAttribute(node, "y")
            }
          };
          camera.disable();
        };
        const handleMouseMove = ({ x, y }: { x: number; y: number }) => {
          if (callbacksRef.current.readOnly || !dragStateRef.current.nodeId) {
            return;
          }

          const next = renderer.viewportToGraph({ x, y });

          dragStateRef.current.position = next;
          graph.setNodeAttribute(dragStateRef.current.nodeId, "x", next.x);
          graph.setNodeAttribute(dragStateRef.current.nodeId, "y", next.y);
          renderer.refresh();
        };
        const handleMouseUp = () => {
          if (!dragStateRef.current.nodeId) {
            return;
          }

          const { nodeId, position } = dragStateRef.current;

          dragStateRef.current = {
            nodeId: "",
            position: null
          };
          camera.enable();

          if (position && callbacksRef.current.onMoveNode) {
            callbacksRef.current.onMoveNode(nodeId, position.x, position.y);
          }
        };

        cleanupRenderer = () => {
          renderer.removeListener?.("clickNode", handleClickNode);
          renderer.removeListener?.("clickEdge", handleClickEdge);
          renderer.removeListener?.("clickStage", handleClickStage);
          renderer.removeListener?.("downNode", handleDownNode);
          mouseCaptor.removeListener?.("mousemovebody", handleMouseMove);
          mouseCaptor.removeListener?.("mouseup", handleMouseUp);
          renderer.kill?.();
        };

        renderer.on("clickNode", handleClickNode);
        renderer.on("clickEdge", handleClickEdge);
        renderer.on("clickStage", handleClickStage);
        renderer.on("downNode", handleDownNode);
        mouseCaptor.on("mousemovebody", handleMouseMove);
        mouseCaptor.on("mouseup", handleMouseUp);

        setStatus("ready");
        syncRendererSize();
      } catch (error) {
        cleanup();
        markFallback("init");
        if (process.env.NODE_ENV !== "production") {
          console.error("[MapGraphEditor] Failed to initialize Sigma", error);
        }
      }
    }

    const handleResize = () => {
      if (disposed) {
        return;
      }

      if (rendererRef.current) {
        syncRendererSize();
        return;
      }

      if (hasRenderableSize()) {
        void initRenderer();
      } else {
        setStatus("loading");
      }
    };

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
    }

    const pollForSize = () => {
      if (disposed) {
        return;
      }

      handleResize();

      if (!rendererRef.current) {
        animationFrame = window.requestAnimationFrame(pollForSize);
      }
    };

    animationFrame = window.requestAnimationFrame(
      typeof ResizeObserver !== "undefined"
        ? () => {
            if (!disposed) {
              handleResize();
            }
          }
        : pollForSize
    );

    return () => {
      disposed = true;
      cleanup();
    };
  }, [graph]);

  useEffect(() => {
    const renderer = rendererRef.current;

    if (!renderer) {
      return;
    }

    const themeColors = getGraphThemeColors(containerRef.current, graphTheme);

    renderer.setSettings?.({
      defaultDrawEdgeLabel: createMapEdgeLabelDrawer(graphTheme),
      defaultDrawNodeHover: createMapNodeHoverDrawer(graphTheme),
      defaultDrawNodeLabel: createMapNodeLabelDrawer(graphTheme),
      minEdgeThickness: 0.45,
      edgeLabelColor: { color: themeColors.edgeLabel },
      labelColor: { color: themeColors.nodeLabel }
    });
    renderer.refresh?.();
  }, [graphTheme]);

  const visibleNodeTypeSet = useMemo(() => new Set(visibleNodeTypes), [visibleNodeTypes]);
  const visibleRelationTypeSet = useMemo(() => new Set(visibleRelationTypes), [visibleRelationTypes]);
  const visibleDraft = useMemo(
    () => filterMapDraft(draft, visibleNodeTypeSet, visibleRelationTypeSet),
    [draft, visibleNodeTypeSet, visibleRelationTypeSet]
  );

  useEffect(() => {
    if (selectedEdgeId && !visibleDraft.edges.some((edge) => edge.id === selectedEdgeId)) {
      onSelectEdge("");
    }
  }, [onSelectEdge, selectedEdgeId, visibleDraft.edges]);
  const nodeCount = visibleDraft.nodes.length;
  const edgeCount = visibleDraft.edges.length;
  const selectedNode = draft.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = draft.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const nodeNameById = useMemo(
    () => new Map(draft.nodes.map((node) => [node.id, node.name || t("mapForm.nodeUntitled")])),
    [draft.nodes, t]
  );
  const selectedNodeRelationEdges = useMemo(
    () =>
      visibleDraft.edges.filter(
        (edge) => edge.source === selectedNodeId || edge.target === selectedNodeId
      ),
    [selectedNodeId, visibleDraft.edges]
  );
  const isFilterActive = visibleNodeTypes.length !== mapNodeTypes.length || visibleRelationTypes.length !== mapRelationTypes.length;
  const showAddNodeControl = !readOnly && Boolean(onAddNode);
  const showEditControls = showAddNodeControl;
  const showDeriveControls = draft.nodes.length >= 1 && Boolean(onStartDerive || onStopDerive || onChangeDeriveMaxRounds);
  const showLeftToolbar = showEditControls || showDeriveControls;
  const showToolbar = !readOnly && (showEditControls || showDeriveControls || Boolean(onLayoutNodes) || draft.nodes.length > 0 || draft.edges.length > 0);
  const mapImageState = mapImageGeneration ?? createEmptyMapImageGenerationDraft();
  const showMapImageControls = Boolean(onGenerateMapImage || onSelectMapFinalImage);

  useEffect(() => {
    return () => {
      if (formatFrameRef.current) {
        cancelAnimationFrame(formatFrameRef.current);
      }
    };
  }, []);

  function handleFormatGraph() {
    if (!onLayoutNodes || readOnly || derivePending || draft.nodes.length === 0) {
      return;
    }

    const updates = layoutMapGraphNodes(draft.nodes, draft.edges);

    if (updates.length === 0) {
      return;
    }

    onLayoutNodes(updates);

    if (formatFrameRef.current) {
      cancelAnimationFrame(formatFrameRef.current);
    }

    formatFrameRef.current = window.requestAnimationFrame(() => {
      rendererRef.current?.getCamera?.().animatedReset({ duration: 300 });
      rendererRef.current?.refresh?.();
    });
  }

  function toggleVisibleNodeType(type: WorkspaceMapMaterialNodeType) {
    setVisibleNodeTypes((current) =>
      current.includes(type) ? current.filter((value) => value !== type) : [...current, type]
    );
  }

  function toggleVisibleRelationType(type: WorkspaceMapMaterialRelationType) {
    setVisibleRelationTypes((current) =>
      current.includes(type) ? current.filter((value) => value !== type) : [...current, type]
    );
  }

  function resetGraphFilters() {
    setVisibleNodeTypes([...mapNodeTypes]);
    setVisibleRelationTypes([...mapRelationTypes]);
  }

  return (
    <section className={cn("flex min-h-0 flex-1 flex-col", embedded ? "bg-background" : "border-l border-border bg-muted/14")}>
      {showHeader ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/72">
              <Network className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">{t("mapForm.canvasTitle")}</span>
            </h3>
            <p className="mt-0.5 text-xs text-foreground/46">{t("mapForm.canvasDescription")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-foreground/46">
            <span className="rounded-full bg-muted px-2 py-0.5">{t("mapForm.metrics.nodeCount", { count: nodeCount })}</span>
            <span className="rounded-full bg-muted px-2 py-0.5">{t("mapForm.metrics.edgeCount", { count: edgeCount })}</span>
          </div>
        </div>
      ) : null}

      <div className={cn("min-h-0 flex-1", embedded ? "" : "p-4")}>
        <div
          className={cn(
            "relative h-full min-h-0 overflow-hidden",
            embedded ? "bg-background" : "min-h-[24rem] rounded-2xl border border-border bg-background shadow-sm"
          )}
        >
          <div ref={containerRef} className="absolute inset-0" />
          {showToolbar ? (
            <div className="absolute inset-x-4 top-4 z-20 flex flex-wrap items-start justify-between gap-2">
              {showLeftToolbar ? (
              <div className="flex max-w-[calc(100%-15rem)] flex-wrap items-center gap-2 rounded-2xl border border-border bg-background/95 p-1.5 shadow-lg shadow-foreground/8 backdrop-blur">
                {showEditControls ? (
                  <>
                    {showAddNodeControl ? (
                      <button
                        type="button"
                        onClick={onAddNode}
                        className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-3 text-sm font-medium text-background transition hover:bg-foreground/88"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {t("mapForm.addNode")}
                      </button>
                    ) : null}
                  </>
                ) : null}
                {showDeriveControls ? (
                  <>
                    <label className="flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground/62">
                      <span className="whitespace-nowrap">{t("mapForm.deriveMaxRounds")}</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        step={1}
                        value={deriveMaxRounds}
                        onChange={(event) => onChangeDeriveMaxRounds?.(clampMapDeriveMaxRounds(Number.parseInt(event.target.value, 10)))}
                        disabled={readOnly || derivePending}
                        aria-label={t("mapForm.deriveMaxRounds")}
                        className="h-6 w-12 rounded-md border border-border bg-background px-2 text-center text-sm font-semibold text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-foreground/44"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={derivePending ? onStopDerive : onStartDerive}
                      disabled={derivePending ? !onStopDerive : readOnly || !onStartDerive}
                      className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44",
                        derivePending
                          ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          : "bg-primary text-white hover:bg-primary/90"
                      )}
                    >
                      {derivePending ? (
                        <>
                          <StopCircle className="h-4 w-4" aria-hidden="true" />
                          {t("mapForm.stopDerive")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" aria-hidden="true" />
                          {t("mapForm.startDerive")}
                        </>
                      )}
                    </button>
                    {deriveStatus ? (
                      <span className="inline-flex h-9 max-w-[18rem] items-center gap-2 rounded-full bg-muted px-3 text-xs text-foreground/58" aria-live="polite">
                        {derivePending ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" /> : null}
                        <span className="truncate">
                          {deriveStatus || (deriveRound > 0 ? t("mapForm.deriveRunning") : "")}
                        </span>
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
              ) : (
                <span aria-hidden="true" />
              )}

              <div ref={toolbarRef} className="relative flex shrink-0 items-start gap-2">
                {onLayoutNodes ? (
                  <button
                    type="button"
                    onClick={handleFormatGraph}
                    disabled={readOnly || derivePending || draft.nodes.length === 0}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background/95 px-3 text-sm font-medium text-foreground shadow-lg shadow-foreground/8 backdrop-blur transition hover:bg-muted disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-foreground/44"
                    title={t("mapForm.formatGraph")}
                    aria-label={t("mapForm.formatGraph")}
                  >
                    <Wand2 className="h-4 w-4" aria-hidden="true" />
                    <span>{t("mapForm.formatGraph")}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setCanvasDragMode((current) => !current)}
                  disabled={readOnly || derivePending}
                  aria-pressed={canvasDragMode}
                  title={t("mapForm.dragCanvas")}
                  aria-label={t("mapForm.dragCanvas")}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium shadow-lg shadow-foreground/8 backdrop-blur transition disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-foreground/44",
                    canvasDragMode
                      ? "border-primary/45 bg-primary/10 text-primary hover:bg-primary/15"
                      : "border-border bg-background/95 text-foreground hover:bg-muted"
                  )}
                >
                  <Hand className="h-4 w-4" aria-hidden="true" />
                  <span>{t("mapForm.dragCanvas")}</span>
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFilterPanelOpen((current) => !current)}
                    title={t("mapForm.filterGraph")}
                    aria-label={t("mapForm.filterGraph")}
                    aria-expanded={filterPanelOpen}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium shadow-lg shadow-foreground/8 backdrop-blur transition",
                      filterPanelOpen || isFilterActive
                        ? "border-primary/45 bg-primary/10 text-primary hover:bg-primary/15"
                        : "border-border bg-background/95 text-foreground hover:bg-muted"
                    )}
                  >
                    <Filter className="h-4 w-4" aria-hidden="true" />
                    <span>{t("mapForm.filterGraph")}</span>
                    {isFilterActive ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
                        {visibleNodeTypes.length + visibleRelationTypes.length}
                      </span>
                    ) : null}
                    <ChevronDown className={cn("h-3.5 w-3.5 transition", filterPanelOpen ? "rotate-180" : "")} aria-hidden="true" />
                  </button>
                  {filterPanelOpen ? (
                    <div
                      ref={filterPanelRef}
                      className="absolute right-0 top-full z-30 mt-2 w-[22rem] rounded-2xl border border-border bg-background/98 p-3 shadow-2xl shadow-foreground/12 backdrop-blur"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground/78">{t("mapForm.filterGraph")}</p>
                          <p className="text-xs text-foreground/46">{t("mapForm.filterDescription")}</p>
                        </div>
                        <button
                          type="button"
                          onClick={resetGraphFilters}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                        >
                          {t("mapForm.filterReset")}
                        </button>
                      </div>
                      <div className="mt-3 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/40">{t("mapForm.filterNodeTypes")}</p>
                            <span className="text-xs text-foreground/42">
                              {visibleNodeTypes.length}/{mapNodeTypes.length}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {mapNodeTypes.map((type) => {
                              const active = visibleNodeTypes.includes(type);

                              return (
                                <label
                                  key={type}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                                    active
                                      ? "border-primary/30 bg-primary/8 text-foreground"
                                      : "border-border bg-background text-foreground/60 hover:bg-muted/40"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={() => toggleVisibleNodeType(type)}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                  />
                                  <span className="truncate">{t(`mapForm.nodeTypes.${type}`)}</span>
                                  {active ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> : null}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/40">{t("mapForm.filterRelationTypes")}</p>
                            <span className="text-xs text-foreground/42">
                              {visibleRelationTypes.length}/{mapRelationTypes.length}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {mapRelationTypes.map((relation) => {
                              const active = visibleRelationTypes.includes(relation);

                              return (
                                <label
                                  key={relation}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                                    active
                                      ? "border-primary/30 bg-primary/8 text-foreground"
                                      : "border-border bg-background text-foreground/60 hover:bg-muted/40"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={() => toggleVisibleRelationType(relation)}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                  />
                                  <span className="truncate">{t(`mapForm.relationTypes.${relation}`)}</span>
                                  {active ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> : null}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {showMapImageControls ? (
            <div className="absolute right-4 top-16 z-20 w-[min(22rem,calc(100%-2rem))] rounded-lg border border-border bg-background/96 shadow-xl shadow-foreground/12 backdrop-blur">
              <div className="flex items-start justify-between gap-3 border-b border-border/70 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground/78">{t("mapForm.imageTitle")}</p>
                  <p className="mt-0.5 truncate text-xs text-foreground/46">{t("mapForm.imageSubtitle")}</p>
                </div>
                {mapImageDraft?.stale ? (
                  <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    {t("mapForm.imageStale")}
                  </span>
                ) : mapImageDraft?.source ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/52">
                    {t(`mapForm.imageSource.${mapImageDraft.source}`)}
                  </span>
                ) : null}
              </div>
              <div className="space-y-3 p-3">
                <button
                  type="button"
                  onClick={() => {
                    if (mapImageDraft?.previewUrl) {
                      setImagePreviewOpen(true);
                    }
                  }}
                  disabled={!mapImageDraft?.previewUrl}
                  className="group relative aspect-video w-full overflow-hidden rounded-md border border-border bg-muted/25 text-left transition hover:border-primary/45 disabled:cursor-default disabled:hover:border-border"
                  aria-label={mapImageDraft?.previewUrl ? t("mapForm.imagePreviewOpen") : t("mapForm.imageEmpty")}
                >
                  {mapImageDraft?.previewUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mapImageDraft.previewUrl} alt={t("mapForm.imagePreviewAlt")} className="h-full w-full object-cover" />
                      <span className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/86 text-foreground/70 opacity-0 shadow-sm transition group-hover:opacity-100">
                        <Maximize2 className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </>
                  ) : (
                    <span className="flex h-full flex-col items-center justify-center px-5 text-center text-xs leading-5 text-foreground/42">
                      <ImageIcon className="mb-2 h-6 w-6 text-foreground/32" aria-hidden="true" />
                      {t("mapForm.imageEmpty")}
                    </span>
                  )}
                  {(mapImageState.pending || mapImageState.progress > 0) ? (
                    <span className="absolute left-2 top-2">
                      <MapImageProgressRing progress={mapImageState.pending ? mapImageState.progress : mapImageState.progress || 100} />
                    </span>
                  ) : null}
                </button>

                {mapImageDraft?.outlinePreviewUrl || mapImageDraft?.outlinePending || mapImageDraft?.outlineError ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-foreground/55">
                      <span>{t("mapForm.imageOutlineTitle")}</span>
                      {mapImageDraft.outlinePending ? (
                        <span className="inline-flex items-center gap-1 text-foreground/42">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          {t("mapForm.imageOutlinePending")}
                        </span>
                      ) : null}
                    </div>
                    <div className="aspect-video w-full overflow-hidden rounded-md border border-border bg-white">
                      {mapImageDraft.outlinePreviewUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={mapImageDraft.outlinePreviewUrl} alt={t("mapForm.imageOutlineAlt")} className="h-full w-full object-cover" />
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center text-xs leading-5 text-foreground/42">
                          {mapImageDraft.outlineError ? t("mapForm.imageOutlineFailed") : t("mapForm.imageOutlinePending")}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2 rounded-md border border-border bg-background/70 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground/68">{t("mapForm.geoJsonTitle")}</p>
                      <p className="mt-0.5 truncate text-[11px] text-foreground/42">
                        {mapGeoJsonDraft?.stale
                          ? t("mapForm.geoJsonStale")
                          : mapGeoJsonDraft?.data
                            ? t("mapForm.geoJsonFeatureCount", { count: mapGeoJsonDraft.data.features.length })
                            : t("mapForm.geoJsonEmpty")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onGenerateMapGeoJson}
                      disabled={mapGeoJsonDraft?.pending || mapImageState.pending || !onGenerateMapGeoJson}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground/68 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {mapGeoJsonDraft?.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />}
                      {mapGeoJsonDraft?.data ? t("mapForm.geoJsonRegenerate") : t("mapForm.geoJsonGenerate")}
                    </button>
                  </div>

                  {mapGeoJsonDraft?.data ? (
                    <MapGeoJsonPreview geojson={mapGeoJsonDraft} t={t} />
                  ) : mapGeoJsonDraft?.pending ? (
                    <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-xs text-foreground/42">
                      {t("mapForm.geoJsonGenerating")}
                    </div>
                  ) : mapGeoJsonDraft?.error ? (
                    <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs leading-5 text-rose-700">
                      {t("mapForm.geoJsonGenerateFailed")}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground/60">
                    <span className="shrink-0">{t("mapForm.imageBatchSize")}</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={mapImageNodeBatchSize}
                      disabled={mapImageState.pending}
                      onChange={(event) => onChangeMapImageNodeBatchSize?.(clampMapImageNodeBatchSize(Number.parseInt(event.target.value, 10)))}
                      aria-label={t("mapForm.imageBatchSize")}
                      className="h-6 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-center text-sm font-semibold text-foreground outline-none transition focus:border-primary disabled:bg-muted/50 disabled:text-foreground/44"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => finalImageInputRef.current?.click()}
                    disabled={mapImageState.pending || !onSelectMapFinalImage}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground/70 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("mapForm.imageUploadFinal")}
                  </button>
                  <input
                    ref={finalImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label={t("mapForm.imageUploadFinal")}
                    onChange={(event) => {
                      onSelectMapFinalImage?.(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                </div>

                <ReferenceImageStrip
                  addLabel={t("mapForm.imageReferenceAdd")}
                  emptyLabel={t("mapForm.imageReferenceEmpty")}
                  images={mapImageReferenceImages}
                  isDisabled={mapImageState.pending}
                  removeLabel={t("mapForm.imageReferenceRemove")}
                  title={t("mapForm.imageReferenceImages")}
                  onAddImages={(files) => onAddMapImageReferenceImages?.(files)}
                  onRemoveImage={(imageId) => onRemoveMapImageReferenceImage?.(imageId)}
                />

                <label className="block space-y-1.5 text-xs text-foreground/60">
                  <span>{t("mapForm.imageReferencePrompt")}</span>
                  <textarea
                    value={mapImageReferencePrompt}
                    onChange={(event) => onChangeMapImageReferencePrompt?.(event.target.value)}
                    disabled={mapImageState.pending}
                    rows={2}
                    placeholder={t("mapForm.imageReferencePromptPlaceholder")}
                    className="min-h-16 w-full resize-y rounded-lg border border-border bg-background px-2.5 py-2 text-xs leading-5 text-foreground outline-none transition placeholder:text-foreground/36 focus:border-primary disabled:bg-muted/50"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={mapImageState.paused && !mapImageDraft?.stale ? onContinueMapImage : onGenerateMapImage}
                    disabled={mapImageState.pending || (!onGenerateMapImage && !onContinueMapImage)}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/42"
                  >
                    {mapImageState.pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : mapImageState.paused && !mapImageDraft?.stale ? (
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    )}
                    {mapImageState.paused && !mapImageDraft?.stale
                      ? t("mapForm.imageContinue")
                      : mapImageDraft?.previewUrl
                        ? t("mapForm.imageRegenerate")
                        : t("mapForm.imageGenerate")}
                  </button>
                  {mapImageDraft?.previewUrl ? (
                    <button
                      type="button"
                      onClick={onClearMapImage}
                      disabled={mapImageState.pending || !onClearMapImage}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground/64 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("mapForm.imageRemove")}
                    </button>
                  ) : null}
                </div>
                {mapImageState.paused ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-700">
                    {t("mapForm.imagePausedHint", { round: mapImageState.failedRound || mapImageState.round || 1 })}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {imagePreviewOpen && mapImageDraft?.previewUrl ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 p-4" role="dialog" aria-modal="true" aria-label={t("mapForm.imagePreviewAlt")}>
              <button
                type="button"
                onClick={() => setImagePreviewOpen(false)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg transition hover:bg-background"
                aria-label={t("mapForm.imagePreviewClose")}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mapImageDraft.previewUrl} alt={t("mapForm.imagePreviewAlt")} className="max-h-[86vh] max-w-[92vw] rounded-lg object-contain shadow-2xl" />
            </div>
          ) : null}

          {!readOnly && showSelectionPanel && (selectedNode || selectedEdge) ? (
            <div className="absolute bottom-4 left-4 z-20 max-h-[26rem] max-w-[22rem] overflow-hidden rounded-2xl bg-background/96 p-3 shadow-lg shadow-foreground/12 ring-1 ring-border/55 backdrop-blur">
              {selectedNode ? (
                <div className="space-y-2">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-foreground/38">{t("mapForm.selection.node")}</p>
                    <p className="truncate text-sm font-semibold text-foreground">{selectedNode.name || t("mapForm.nodeUntitled")}</p>
                    <p className="mt-0.5 truncate text-xs text-foreground/46">{t(`mapForm.nodeTypes.${selectedNode.type}`)}</p>
                    {selectedNode.description ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-foreground/54">{selectedNode.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {onEditNode ? (
                        <button
                          type="button"
                          onClick={() => onEditNode(selectedNode.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("edit")}
                        </button>
                      ) : null}
                      {onRemoveNode ? (
                        <button
                          type="button"
                          onClick={() => onRemoveNode(selectedNode.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("mapForm.removeNode")}
                        </button>
                      ) : null}
                    </div>
                    {onConnectNode && nodeCount >= 2 ? (
                      <button
                        type="button"
                        onClick={() => onConnectNode(selectedNode.id)}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
                          connectSourceNodeId === selectedNode.id
                            ? "border-primary/45 bg-primary/10 text-primary hover:bg-primary/15"
                            : "border-border bg-background text-foreground hover:bg-muted"
                        )}
                      >
                        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("mapForm.connectNode")}
                      </button>
                    ) : null}
                  </div>
                  {connectSourceNodeId === selectedNode.id ? (
                    <p className="rounded-lg border border-primary/16 bg-primary/8 px-2.5 py-2 text-xs leading-5 text-foreground/62">
                      {t("mapForm.connectNodeHint", { node: selectedNode.name || t("mapForm.nodeUntitled") })}
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-wide text-foreground/38">{t("mapForm.relatedEdgesTitle")}</p>
                      <span className="text-[11px] text-foreground/42">
                        {t("mapForm.relatedEdgesCount", { count: selectedNodeRelationEdges.length })}
                      </span>
                    </div>
                    {selectedNodeRelationEdges.length > 0 ? (
                      <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                        {selectedNodeRelationEdges.map((edge) => (
                          <button
                            key={edge.id}
                            type="button"
                            onClick={() => {
                              onSelectEdge(edge.id);
                              onSelectNode("");
                            }}
                            className="flex w-full items-center gap-2 rounded-lg bg-muted/25 px-2.5 py-2 text-left transition hover:bg-primary/10"
                          >
                            <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">{relationLabel(edge.relation)}</span>
                              <span className="mt-0.5 block truncate text-[11px] text-foreground/62">
                                {formatEdgeEndpointLabel(edge.source, nodeNameById, t)} → {formatEdgeEndpointLabel(edge.target, nodeNameById, t)}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg bg-muted/20 px-2.5 py-2 text-xs leading-5 text-foreground/48">
                        {t("mapForm.relatedEdgesEmpty")}
                      </p>
                    )}
                  </div>
                </div>
              ) : selectedEdge ? (
                <div className="space-y-2">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-foreground/38">{t("mapForm.selection.edge")}</p>
                    <p className="truncate text-sm font-semibold text-foreground">{relationLabel(selectedEdge.relation)}</p>
                    <p className="mt-0.5 truncate text-xs text-foreground/46">
                      {formatEdgeEndpointLabel(selectedEdge.source, nodeNameById, t)} → {formatEdgeEndpointLabel(selectedEdge.target, nodeNameById, t)}
                    </p>
                    {selectedEdge.description ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-foreground/54">{selectedEdge.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {onEditEdge ? (
                      <button
                        type="button"
                        onClick={() => onEditEdge(selectedEdge.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("edit")}
                      </button>
                    ) : null}
                    {onRemoveEdge ? (
                      <button
                        type="button"
                        onClick={() => onRemoveEdge(selectedEdge.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("mapForm.removeEdge")}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {status !== "ready" ? (
            <div className="relative z-10 flex h-full flex-col bg-background/96">
              <div className={cn("flex items-center justify-between gap-3 px-4 py-3", embedded ? "border-b border-border/60" : "border-b border-border")}>
                <p className="text-sm font-medium text-foreground/64">
                  {status === "fallback"
                    ? t(failureReason === "webgl" ? "mapForm.canvasWebglUnavailable" : "mapForm.canvasInitFailed")
                    : t("mapForm.canvasLoading")}
                </p>
                <span className="inline-flex items-center gap-2 text-xs text-foreground/42">
                  <SquareDashedMousePointer className="h-3.5 w-3.5" aria-hidden="true" />
                  {readOnly ? t("mapForm.readOnly") : t("mapForm.dragHint")}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {nodeCount === 0 ? (
                  <div className="grid h-full place-items-center rounded-xl border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-foreground/46">
                    {draft.nodes.length > 0 ? t("mapForm.filterNoResult") : t("mapForm.canvasEmpty")}
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {visibleDraft.nodes.map((node) => {
                      const isSelected = selectedNodeId === node.id;

                      return (
                        <div
                          key={node.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            onSelectNode(node.id);
                            onSelectEdge("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") {
                              return;
                            }

                            event.preventDefault();
                            onSelectNode(node.id);
                            onSelectEdge("");
                          }}
                          className={cn(
                            "rounded-xl border px-3 py-3 text-left outline-none transition hover:border-primary/35 hover:bg-muted/40 focus:border-primary/45 focus:bg-muted/40",
                            isSelected
                              ? "border-primary/55 bg-primary/12 text-foreground shadow-sm shadow-primary/12 ring-1 ring-primary/25"
                              : "border-border bg-background text-foreground"
                          )}
                        >
                          <span className={cn("block text-sm font-medium", isSelected ? "text-foreground" : "text-foreground/72")}>
                            {node.name || t("mapForm.nodeUntitled")}
                          </span>
                          <span className={cn("mt-1 block text-xs", isSelected ? "text-foreground/64" : "text-foreground/46")}>
                            {t(`mapForm.nodeTypes.${node.type}`)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {edgeCount > 0 ? (
                  <div className="mt-4 space-y-2">
                    {visibleDraft.edges.map((edge) => {
                      const isSelected = selectedEdgeId === edge.id;

                      return (
                        <button
                          key={edge.id}
                          type="button"
                          onClick={() => {
                            onSelectEdge(edge.id);
                            onSelectNode("");
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:border-primary/35 hover:bg-muted/40",
                            isSelected
                              ? "border-primary/55 bg-primary/12 text-foreground shadow-sm shadow-primary/12 ring-1 ring-primary/25"
                              : "border-border bg-background text-foreground"
                          )}
                        >
                          <span className="min-w-0">
                            <span className={cn("block text-sm font-medium", isSelected ? "text-foreground" : "text-foreground/72")}>
                              {relationLabel(edge.relation)}
                            </span>
                            <span className={cn("mt-0.5 block truncate text-xs", isSelected ? "text-foreground/64" : "text-foreground/46")}>
                              {formatEdgeEndpointLabel(edge.source, nodeNameById, t)} → {formatEdgeEndpointLabel(edge.target, nodeNameById, t)}
                            </span>
                          </span>
                          <Move className={cn("h-4 w-4 shrink-0", isSelected ? "text-foreground/48" : "text-foreground/32")} aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function createEmptyMapImageGenerationDraft(): MapImageGenerationDraft {
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

function MapImageProgressRing({ progress }: { progress: number }) {
  const normalizedProgress = Math.min(100, Math.max(0, Math.round(Number.isFinite(progress) ? progress : 0)));

  return (
    <span
      className="grid h-12 w-12 place-items-center rounded-full p-1 shadow-lg shadow-foreground/12"
      style={{
        background: `conic-gradient(hsl(var(--primary)) ${normalizedProgress * 3.6}deg, hsl(var(--muted)) 0deg)`
      }}
      role="progressbar"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={normalizedProgress}
    >
      <span className="grid h-full w-full place-items-center rounded-full bg-background/92 text-[0.65rem] font-semibold text-foreground">
        {normalizedProgress}%
      </span>
    </span>
  );
}

function MapGeoJsonPreview({
  geojson,
  t
}: {
  geojson: MapGeoJsonDraft;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [selectedFeatureId, setSelectedFeatureId] = useState("");
  const [drillStack, setDrillStack] = useState<string[]>([]);
  const bbox = getGeoJsonSvgBbox(geojson.data.bbox);
  const activeNodeId = drillStack.at(-1) ?? "";
  const childNodeIds = useMemo(() => {
    if (!activeNodeId) {
      return new Set<string>();
    }

    return new Set(
      geojson.data.features
        .filter((feature) => feature.properties.parentId === activeNodeId && feature.properties.nodeId)
        .map((feature) => feature.properties.nodeId as string)
    );
  }, [activeNodeId, geojson.data.features]);
  const visibleFeatures = useMemo(() => {
    if (!activeNodeId) {
      return geojson.data.features;
    }

    return geojson.data.features.filter((feature) => {
      const nodeId = feature.properties.nodeId;

      if (nodeId === activeNodeId || feature.properties.parentId === activeNodeId) {
        return true;
      }

      return Boolean(
        feature.properties.sourceNodeId &&
          feature.properties.targetNodeId &&
          (childNodeIds.has(feature.properties.sourceNodeId) || childNodeIds.has(feature.properties.targetNodeId))
      );
    });
  }, [activeNodeId, childNodeIds, geojson.data.features]);
  const selectedFeature = geojson.data.features.find((feature) => feature.id === selectedFeatureId) ?? null;
  const canDrill = Boolean(selectedFeature?.properties.nodeId && geojson.data.features.some((feature) => feature.properties.parentId === selectedFeature.properties.nodeId));
  const scaleLabel = getGeoJsonScaleBarLabel(geojson, view.scale);

  function updateScale(nextScale: number) {
    setView((current) => ({
      ...current,
      scale: Math.min(8, Math.max(0.6, nextScale))
    }));
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-[#f8faf7]">
        <svg
          ref={svgRef}
          className="h-full w-full touch-none"
          role="img"
          aria-label={t("mapForm.geoJsonPreview")}
          viewBox={`${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`}
          onPointerDown={(event) => {
            dragRef.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!dragRef.current || !svgRef.current) {
              return;
            }

            const rect = svgRef.current.getBoundingClientRect();
            const dx = ((event.clientX - dragRef.current.x) / Math.max(1, rect.width)) * bbox.width / view.scale;
            const dy = ((event.clientY - dragRef.current.y) / Math.max(1, rect.height)) * bbox.height / view.scale;

            dragRef.current = { x: event.clientX, y: event.clientY };
            setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
          }}
          onPointerUp={(event) => {
            dragRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onWheel={(event) => {
            event.preventDefault();
            updateScale(view.scale * (event.deltaY > 0 ? 0.9 : 1.12));
          }}
        >
          <rect x={bbox.x} y={bbox.y} width={bbox.width} height={bbox.height} fill="#f8faf7" />
          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            {visibleFeatures.map((feature) => (
              <GeoJsonFeatureShape
                key={feature.id}
                feature={feature}
                isSelected={feature.id === selectedFeatureId}
                onSelect={() => setSelectedFeatureId(feature.id)}
              />
            ))}
          </g>
        </svg>

        <div className="absolute right-2 top-2 flex items-center gap-1">
          <button type="button" className="grid h-7 w-7 place-items-center rounded-md bg-background/90 text-foreground/68 shadow-sm hover:bg-background" aria-label={t("mapForm.geoJsonZoomIn")} onClick={() => updateScale(view.scale * 1.18)}>
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button type="button" className="grid h-7 w-7 place-items-center rounded-md bg-background/90 text-foreground/68 shadow-sm hover:bg-background" aria-label={t("mapForm.geoJsonZoomOut")} onClick={() => updateScale(view.scale * 0.84)}>
            <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button type="button" className="grid h-7 w-7 place-items-center rounded-md bg-background/90 text-foreground/68 shadow-sm hover:bg-background" aria-label={t("mapForm.geoJsonResetView")} onClick={() => setView({ scale: 1, x: 0, y: 0 })}>
            <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="absolute bottom-2 left-2 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium text-foreground/68 shadow-sm">
          <div className="h-1 w-24 rounded-full bg-foreground/70" />
          <div className="mt-1 flex justify-between gap-4">
            <span>0</span>
            <span>{scaleLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="min-w-0 text-foreground/54">
          {selectedFeature ? (
            <span className="block truncate">{selectedFeature.properties.name}</span>
          ) : (
            <span className="block truncate">{t("mapForm.geoJsonPreview")}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {drillStack.length > 0 ? (
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium text-foreground/62 hover:bg-muted"
              onClick={() => {
                setDrillStack((current) => current.slice(0, -1));
                setSelectedFeatureId("");
              }}
            >
              <CornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t("mapForm.geoJsonDrillUp")}
            </button>
          ) : null}
          {canDrill ? (
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-md bg-primary px-2 text-[11px] font-medium text-white hover:bg-primary/90"
              onClick={() => {
                if (selectedFeature?.properties.nodeId) {
                  setDrillStack((current) => [...current, selectedFeature.properties.nodeId as string]);
                  setSelectedFeatureId("");
                  setView({ scale: 1.4, x: 0, y: 0 });
                }
              }}
            >
              {t("mapForm.geoJsonDrillDown")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GeoJsonFeatureShape({
  feature,
  isSelected,
  onSelect
}: {
  feature: WorkspaceMapGeoJsonFeature;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const color = getGeoJsonFeatureColor(feature);

  if (feature.geometry.type === "Polygon") {
    return (
      <polygon
        points={feature.geometry.coordinates[0].map(([x, y]) => `${x},${-y}`).join(" ")}
        fill={color.fill}
        stroke={isSelected ? "#0f172a" : color.stroke}
        strokeWidth={isSelected ? 2.4 : 1.2}
        vectorEffect="non-scaling-stroke"
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      />
    );
  }

  if (feature.geometry.type === "LineString") {
    return (
      <polyline
        points={feature.geometry.coordinates.map(([x, y]) => `${x},${-y}`).join(" ")}
        fill="none"
        stroke={isSelected ? "#0f172a" : color.stroke}
        strokeDasharray={feature.properties.relationType === "connects" ? "4 3" : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={isSelected ? 2.8 : 1.5}
        vectorEffect="non-scaling-stroke"
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      />
    );
  }

  return (
    <g
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <circle
        cx={feature.geometry.coordinates[0]}
        cy={-feature.geometry.coordinates[1]}
        r={isSelected ? 4.8 : 3.6}
        fill={isSelected ? "#0f172a" : color.stroke}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={feature.geometry.coordinates[0] + 5}
        y={-feature.geometry.coordinates[1] - 4}
        className="fill-slate-700 text-[10px] font-medium"
        paintOrder="stroke"
        stroke="#f8faf7"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      >
        {feature.properties.name}
      </text>
    </g>
  );
}

function syncGraphToDraft(
  graph: Graph,
  draft: MapCreateDraft,
  selectedNodeId: string,
  selectedEdgeId: string,
  relationLabel: (relation: WorkspaceMapMaterialRelationType) => string,
  colors: {
    dimmedEdge: string;
    edge: string;
    relatedEdge: string;
    selectedEdge: string;
  },
  selection: {
    relatedNodeIds: Set<string>;
    relatedEdgeIds: Set<string>;
  }
) {
  const nextNodeIds = new Set(draft.nodes.map((node) => node.id));
  const nextEdgeIds = new Set(draft.edges.map((edge) => edge.id));
  const hasSelection = Boolean(selectedNodeId || selectedEdgeId);
  const relationCountByNodeId = buildRelationCountByNodeId(draft);

  for (const nodeId of graph.nodes()) {
    if (!nextNodeIds.has(nodeId)) {
      graph.dropNode(nodeId);
    }
  }

  for (const node of draft.nodes) {
    const selected = node.id === selectedNodeId;
    const related = selection.relatedNodeIds.has(node.id);
    const attributes = {
      color: getNodeColor(node.type, selected, related),
      forceLabel: selected || related,
      highlighted: selected || related,
      label: node.name || " ",
      size: getNodeSize(node.type, relationCountByNodeId.get(node.id) ?? 0, selected, related),
      mapType: node.type,
      type: "circle",
      zIndex: selected ? 2 : related ? 1 : 0,
      x: node.x,
      y: node.y
    };

    if (graph.hasNode(node.id)) {
      graph.mergeNodeAttributes(node.id, attributes);
    } else {
      graph.addNode(node.id, attributes);
    }
  }

  for (const edgeId of graph.edges()) {
    if (!nextEdgeIds.has(edgeId)) {
      graph.dropEdge(edgeId);
    }
  }

  for (const edge of draft.edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
      continue;
    }

    const selected = edge.id === selectedEdgeId;
    const related = selection.relatedEdgeIds.has(edge.id);
    const dimmed = hasSelection && !selected && !related;
    const attributes = {
      color: selected ? colors.selectedEdge : related ? colors.relatedEdge : dimmed ? colors.dimmedEdge : colors.edge,
      description: edge.description,
      forceLabel: selected || related,
      highlighted: selected || related,
      label: selected || related ? relationLabel(edge.relation) : "",
      relation: edge.relation,
      size: selected ? 3.6 : related ? 2.45 : dimmed ? 0.72 : 1.05,
      zIndex: selected ? 2 : related ? 1 : 0
    };

    if (graph.hasEdge(edge.id)) {
      const currentSource = graph.source(edge.id);
      const currentTarget = graph.target(edge.id);

      if (currentSource !== edge.source || currentTarget !== edge.target) {
        graph.dropEdge(edge.id);
        graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, attributes);
      } else {
        graph.mergeEdgeAttributes(edge.id, attributes);
      }
    } else {
      graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, attributes);
    }
  }
}

function buildRelationCountByNodeId(draft: MapCreateDraft) {
  const nodeIds = new Set(draft.nodes.map((node) => node.id));
  const counts = new Map<string, number>();

  for (const nodeId of nodeIds) {
    counts.set(nodeId, 0);
  }

  for (const edge of draft.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) {
      continue;
    }

    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }

  return counts;
}

function filterMapDraft(
  draft: MapCreateDraft,
  visibleNodeTypes: Set<WorkspaceMapMaterialNodeType> | WorkspaceMapMaterialNodeType[],
  visibleRelationTypes: Set<WorkspaceMapMaterialRelationType> | WorkspaceMapMaterialRelationType[]
): MapCreateDraft {
  const nodeTypeSet = visibleNodeTypes instanceof Set ? visibleNodeTypes : new Set(visibleNodeTypes);
  const relationTypeSet = visibleRelationTypes instanceof Set ? visibleRelationTypes : new Set(visibleRelationTypes);
  const nodes = draft.nodes.filter((node) => nodeTypeSet.has(node.type));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = draft.edges.filter(
    (edge) => relationTypeSet.has(edge.relation) && nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );

  return {
    ...draft,
    nodes,
    edges
  };
}

function buildRelatedNodeIdSet(draft: MapCreateDraft, selectedNodeId: string, selectedEdgeId = "") {
  const result = new Set<string>();

  if (selectedNodeId) {
    result.add(selectedNodeId);

    for (const edge of draft.edges) {
      if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
        result.add(edge.source);
        result.add(edge.target);
      }
    }
  }

  if (selectedEdgeId) {
    const edge = draft.edges.find((item) => item.id === selectedEdgeId);

    if (edge) {
      result.add(edge.source);
      result.add(edge.target);
    }
  }

  return result;
}

function buildRelatedEdgeIdSet(draft: MapCreateDraft, selectedNodeId: string, selectedEdgeId = "") {
  const result = new Set<string>();

  if (selectedNodeId) {
    for (const edge of draft.edges) {
      if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
        result.add(edge.id);
      }
    }
  }

  if (selectedEdgeId) {
    result.add(selectedEdgeId);
  }

  return result;
}

function getNodeColor(type: WorkspaceMapMaterialNodeType, selected: boolean, related = false) {
  const dark = getMapGraphThemeMode() === "dark";
  const lightPalette: Record<WorkspaceMapMaterialNodeType, string> = {
    country: selected ? "#1E3A8A" : related ? "#2563EB" : "#3B82F6",
    region: selected ? "#115E59" : related ? "#0F766E" : "#10B981",
    city: selected ? "#9F1239" : related ? "#DB2777" : "#F43F5E",
    village: selected ? "#92400E" : related ? "#D97706" : "#F59E0B",
    landmark: selected ? "#5B21B6" : related ? "#7C3AED" : "#8B5CF6",
    path: selected ? "#334155" : related ? "#475569" : "#94A3B8"
  };
  const darkPalette: Record<WorkspaceMapMaterialNodeType, string> = {
    country: selected ? "#60A5FA" : related ? "#93C5FD" : "#3B82F6",
    region: selected ? "#2DD4BF" : related ? "#5EEAD4" : "#14B8A6",
    city: selected ? "#FB7185" : related ? "#FDA4AF" : "#F43F5E",
    village: selected ? "#FBBF24" : related ? "#FDE68A" : "#F59E0B",
    landmark: selected ? "#A78BFA" : related ? "#C4B5FD" : "#8B5CF6",
    path: selected ? "#CBD5E1" : related ? "#E2E8F0" : "#94A3B8"
  };
  const palette = dark ? darkPalette : lightPalette;

  return palette[type];
}

function getNodeSize(type: WorkspaceMapMaterialNodeType, relationCount: number, selected: boolean, related = false) {
  return getMapGraphNodeBaseSize(type, relationCount) + (selected ? 4.2 : related ? 1.6 : 0);
}

function getCanvasThemeColor(container: HTMLElement | null, variable: string, fallback: string, alpha?: number) {
  if (!container) {
    return fallback;
  }

  const value = getComputedStyle(container).getPropertyValue(variable).trim();

  if (!value) {
    return fallback;
  }

  return `hsl(${value}${typeof alpha === "number" ? ` / ${alpha}` : ""})`;
}

function getMapGraphThemeMode(): "light" | "dark" {
  if (typeof document !== "undefined") {
    const root = document.documentElement;

    if (root.classList.contains("dark") || root.style.colorScheme === "dark") {
      return "dark";
    }

    if (root.style.colorScheme === "light") {
      return "light";
    }
  }

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return "light";
}

function getGraphThemeColors(container: HTMLElement | null, theme: "light" | "dark" = getMapGraphThemeMode()) {
  if (theme === "dark") {
    return {
      dimmedEdge: "rgba(100, 116, 139, 0.22)",
      edge: "rgba(148, 163, 184, 0.42)",
      edgeLabel: "#F8FAFC",
      edgeLabelHalo: "rgba(2, 6, 23, 0.96)",
      nodeLabel: "#F8FAFC",
      nodeLabelHalo: "rgba(2, 6, 23, 0.96)",
      relatedEdge: "rgba(248, 250, 252, 0.98)",
      selectedEdge: "#60A5FA"
    };
  }

  return {
    dimmedEdge: getCanvasThemeRgbaColor(container, "--foreground", "rgba(71, 85, 105, 0.18)", 0.18),
    edge: getCanvasThemeRgbaColor(container, "--foreground", "rgba(71, 85, 105, 0.32)", 0.32),
    edgeLabel: getCanvasThemeColor(container, "--foreground", "#0F172A"),
    edgeLabelHalo: "rgba(255, 255, 255, 0.96)",
    nodeLabel: getCanvasThemeColor(container, "--foreground", "#0F172A"),
    nodeLabelHalo: "rgba(255, 255, 255, 0.96)",
    relatedEdge: getCanvasThemeRgbaColor(container, "--foreground", "rgba(15, 23, 42, 0.96)", 0.96),
    selectedEdge: getCanvasThemeRgbaColor(container, "--primary", "rgba(37, 99, 235, 0.92)", 0.92)
  };
}

function getCanvasThemeRgbaColor(container: HTMLElement | null, variable: string, fallback: string, alpha: number) {
  if (!container) {
    return fallback;
  }

  const value = getComputedStyle(container).getPropertyValue(variable).trim();

  if (!value) {
    return fallback;
  }

  const hsl = value.match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);

  if (!hsl) {
    return fallback;
  }

  const hue = Number.parseFloat(hsl[1]);
  const saturation = Number.parseFloat(hsl[2]) / 100;
  const lightness = Number.parseFloat(hsl[3]) / 100;
  const [r, g, b] = hslToRgb(hue, saturation, lightness);

  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const normalizedHue = ((hue % 360) + 360) % 360 / 360;

  if (saturation === 0) {
    return [lightness, lightness, lightness] as const;
  }

  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const hueToRgb = (t: number) => {
    let next = t;

    if (next < 0) {
      next += 1;
    }

    if (next > 1) {
      next -= 1;
    }

    if (next < 1 / 6) {
      return p + (q - p) * 6 * next;
    }

    if (next < 1 / 2) {
      return q;
    }

    if (next < 2 / 3) {
      return p + (q - p) * (2 / 3 - next) * 6;
    }

    return p;
  };

  return [hueToRgb(normalizedHue + 1 / 3), hueToRgb(normalizedHue), hueToRgb(normalizedHue - 1 / 3)] as const;
}

function createMapNodeHoverDrawer(theme: "light" | "dark"): NodeHoverDrawingFunction {
  return (context, data) => {
    const labelColors = getReadableGraphLabelColors(theme);

    context.save();
    context.beginPath();
    context.arc(data.x, data.y, data.size + 5, 0, Math.PI * 2);
    context.fillStyle = theme === "dark" ? "rgba(2, 6, 23, 0.68)" : "rgba(255, 255, 255, 0.78)";
    context.fill();
    context.lineWidth = 2.25;
    context.strokeStyle = typeof data.color === "string" ? data.color : labelColors.fill;
    context.stroke();
    context.restore();
  };
}

function createMapNodeLabelDrawer(theme: "light" | "dark"): NodeLabelDrawingFunction {
  return (context, data, settings) => {
    const label = typeof data.label === "string" ? data.label.trim() : "";

    if (!label) {
      return;
    }

    const highlighted = Boolean((data as { highlighted?: boolean }).highlighted);
    const fontSize = Math.max(12, settings.labelSize + (highlighted ? 1 : 0));
    const labelColors = getReadableGraphLabelColors(theme);
    const labelGap = Math.max(7, fontSize * 0.45);
    const labelY = data.y - data.size - labelGap - fontSize / 2;

    drawMapGraphLabel(context, label, data.x, labelY, {
      align: "center",
      fill: labelColors.fill,
      font: settings.labelFont,
      halo: labelColors.halo,
      size: fontSize,
      weight: highlighted ? "700" : settings.labelWeight
    });
  };
}

function createMapEdgeLabelDrawer(theme: "light" | "dark"): EdgeLabelDrawingFunction {
  return (context, edgeData, sourceData, targetData, settings) => {
    const label = typeof edgeData.label === "string" ? edgeData.label.trim() : "";

    if (!label) {
      return;
    }

    const dx = targetData.x - sourceData.x;
    const dy = targetData.y - sourceData.y;
    const length = Math.hypot(dx, dy) || 1;
    const offset = Math.min(14, Math.max(8, edgeData.size * 4));
    const highlighted = Boolean((edgeData as { highlighted?: boolean }).highlighted);
    const fontSize = Math.max(11, settings.edgeLabelSize - 1 + (highlighted ? 1 : 0));
    const labelColors = getReadableGraphLabelColors(theme);

    drawMapGraphLabel(context, label, (sourceData.x + targetData.x) / 2 - (dy / length) * offset, (sourceData.y + targetData.y) / 2 + (dx / length) * offset, {
      align: "center",
      fill: labelColors.fill,
      font: settings.edgeLabelFont,
      halo: labelColors.halo,
      size: fontSize,
      weight: highlighted ? "700" : settings.edgeLabelWeight
    });
  };
}

function drawMapGraphLabel(
  context: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  options: {
    align: CanvasTextAlign;
    fill: string;
    font: string;
    halo: string;
    size: number;
    weight: string;
  }
) {
  context.save();
  context.font = `${options.weight} ${options.size}px ${options.font}`;
  context.textAlign = options.align;
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.miterLimit = 2;
  context.lineWidth = Math.max(3, options.size * 0.34);
  context.strokeStyle = options.halo;
  context.strokeText(label, x, y);
  context.fillStyle = options.fill;
  context.fillText(label, x, y);
  context.restore();
}

function getReadableGraphLabelColors(theme: "light" | "dark") {
  return {
    fill: theme === "dark" ? "#F8FAFC" : "#0F172A",
    halo: theme === "dark" ? "rgba(2, 6, 23, 0.78)" : "rgba(255, 255, 255, 0.82)"
  };
}

function hasCanvasWebglSupport(canvas: HTMLCanvasElement, contextNames: Array<"webgl2" | "webgl" | "experimental-webgl">) {
  if (typeof WebGLRenderingContext === "undefined" && typeof WebGL2RenderingContext === "undefined") {
    return false;
  }

  return contextNames.some((contextName) => {
    try {
      return Boolean(canvas.getContext(contextName));
    } catch {
      return false;
    }
  });
}

function formatEdgeEndpointLabel(nodeId: string, nodeNameById: Map<string, string>, t: (key: string, values?: Record<string, string | number>) => string) {
  return nodeNameById.get(nodeId) ?? nodeId ?? t("mapForm.none");
}

function clampMapDeriveMaxRounds(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(20, Math.max(1, Math.round(value)));
}

function clampMapImageNodeBatchSize(value: number) {
  if (!Number.isFinite(value)) {
    return 10;
  }

  return Math.min(100, Math.max(1, Math.round(value)));
}

function getGeoJsonSvgBbox(bbox: [number, number, number, number]) {
  const [minX, minY, maxX, maxY] = bbox;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const padding = Math.max(width, height) * 0.03;

  return {
    height: height + padding * 2,
    width: width + padding * 2,
    x: minX - padding,
    y: -maxY - padding
  };
}

function getGeoJsonFeatureColor(feature: WorkspaceMapGeoJsonFeature) {
  if (feature.properties.featureKind === "relation") {
    return { fill: "none", stroke: "#64748b" };
  }

  if (feature.properties.featureKind === "place") {
    return { fill: "#0f172a", stroke: "#334155" };
  }

  const colors: Partial<Record<WorkspaceMapMaterialNodeType, { fill: string; stroke: string }>> = {
    city: { fill: "#dbeafe", stroke: "#2563eb" },
    country: { fill: "#dcfce7", stroke: "#16a34a" },
    landmark: { fill: "#fef3c7", stroke: "#d97706" },
    region: { fill: "#f5e8ff", stroke: "#9333ea" },
    village: { fill: "#ffe4e6", stroke: "#e11d48" }
  };

  return colors[feature.properties.nodeType ?? "landmark"] ?? { fill: "#e2e8f0", stroke: "#475569" };
}

function getGeoJsonScaleBarLabel(geojson: MapGeoJsonDraft, scale: number) {
  const rawKm = Math.max(1, (geojson.scale.widthKm * 0.24) / Math.max(0.6, scale));
  const niceKm = getNiceScaleDistance(rawKm);

  return `${niceKm} km`;
}

function getNiceScaleDistance(value: number) {
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const normalized = value / base;
  const multiplier = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;

  return Math.round(multiplier * base);
}
