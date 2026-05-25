"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Graph, { MultiDirectedGraph } from "graphology";
import { Link2, Loader2, Move, Network, Pencil, Plus, Sparkles, SquareDashedMousePointer, StopCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MapCreateDraft,
  WorkspaceMapMaterialNodeType,
  WorkspaceMapMaterialRelationType
} from "@/lib/home-workspace";
import { mapNodeTypes, mapRelationTypes } from "@/lib/home-workspace/map";

export function MapGraphEditor({
  deriveMaxRounds = 3,
  derivePending = false,
  deriveRound = 0,
  deriveStatus = "",
  draft,
  embedded = false,
  connectSourceNodeId = "",
  readOnly = false,
  onAddNode,
  onChangeDeriveMaxRounds,
  onConnectNode,
  onEditEdge,
  onEditNode,
  onRemoveEdge,
  onRemoveNode,
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
  connectSourceNodeId?: string;
  readOnly?: boolean;
  onAddNode?: () => void;
  onChangeDeriveMaxRounds?: (value: number) => void;
  onConnectNode?: (nodeId: string) => void;
  onEditEdge?: (edgeId: string) => void;
  onEditNode?: (nodeId: string) => void;
  onRemoveEdge?: (edgeId: string) => void;
  onRemoveNode?: (nodeId: string) => void;
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
  const callbacksRef = useRef({
    onMoveNode,
    onSelectEdge,
    onSelectNode,
    readOnly
  });
  const [graph] = useState(() => new MultiDirectedGraph());
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [failureReason, setFailureReason] = useState<"webgl" | "init" | null>(null);

  useEffect(() => {
    callbacksRef.current = {
      onMoveNode,
      onSelectEdge,
      onSelectNode,
      readOnly
    };
  }, [onMoveNode, onSelectEdge, onSelectNode, readOnly]);

  useEffect(() => {
    syncGraphToDraft(graph, draft, selectedNodeId, selectedEdgeId, relationLabel);

    if (rendererRef.current) {
      rendererRef.current.refresh?.();
    }
  }, [draft, graph, relationLabel, selectedEdgeId, selectedNodeId]);

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

        const canvas = document.createElement("canvas");
        const hasWebgl = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));

        if (!hasWebgl) {
          markFallback("webgl");
          return;
        }

        const { default: Sigma } = await import("sigma");
        const renderer = new Sigma(graph, container, {
          renderEdgeLabels: true,
          renderLabels: true,
          labelColor: { color: getCanvasThemeColor(container, "--foreground", "#111827") },
          labelRenderedSizeThreshold: 6,
          labelWeight: "600",
          edgeLabelColor: { color: getCanvasThemeColor(container, "--foreground", "#475569", 0.72) },
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
          if (callbacksRef.current.readOnly) {
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

  const nodeCount = draft.nodes.length;
  const edgeCount = draft.edges.length;
  const selectedNode = draft.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = draft.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const nodeNameById = useMemo(
    () => new Map(draft.nodes.map((node) => [node.id, node.name || t("mapForm.nodeUntitled")])),
    [draft.nodes, t]
  );
  const showAddNodeControl = !readOnly && Boolean(onAddNode);
  const showEditControls = showAddNodeControl;
  const showDeriveControls = nodeCount >= 1 && Boolean(onStartDerive || onStopDerive || onChangeDeriveMaxRounds);
  const showTopControls = showEditControls || showDeriveControls;

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
          {showTopControls ? (
            <div className="absolute left-4 top-4 z-20 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 rounded-2xl border border-border bg-background/95 p-1.5 shadow-lg shadow-foreground/8 backdrop-blur">
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
                      onChange={(event) => onChangeDeriveMaxRounds?.(Number.parseInt(event.target.value, 10) || 1)}
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
          ) : null}

          {!readOnly && showSelectionPanel && (selectedNode || selectedEdge) ? (
            <div className="absolute bottom-4 left-4 z-20 max-w-[22rem] rounded-2xl border border-border bg-background/96 p-3 shadow-lg shadow-foreground/10 backdrop-blur">
              {selectedNode ? (
                <div className="space-y-2">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-foreground/38">{t("mapForm.selection.node")}</p>
                    <p className="truncate text-sm font-semibold text-foreground/76">{selectedNode.name || t("mapForm.nodeUntitled")}</p>
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
                </div>
              ) : selectedEdge ? (
                <div className="space-y-2">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-foreground/38">{t("mapForm.selection.edge")}</p>
                    <p className="truncate text-sm font-semibold text-foreground/76">{relationLabel(selectedEdge.relation)}</p>
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
                    {t("mapForm.canvasEmpty")}
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {draft.nodes.map((node) => (
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
                          selectedNodeId === node.id ? "border-primary bg-primary/8" : "border-border bg-background"
                        )}
                      >
                        <span className="block text-sm font-medium text-foreground/72">{node.name || t("mapForm.nodeUntitled")}</span>
                        <span className="mt-1 block text-xs text-foreground/46">{t(`mapForm.nodeTypes.${node.type}`)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {edgeCount > 0 ? (
                  <div className="mt-4 space-y-2">
                    {draft.edges.map((edge) => (
                      <button
                        key={edge.id}
                        type="button"
                        onClick={() => {
                          onSelectEdge(edge.id);
                          onSelectNode("");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:border-primary/35 hover:bg-muted/40",
                          selectedEdgeId === edge.id ? "border-primary bg-primary/8" : "border-border bg-background"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground/72">{relationLabel(edge.relation)}</span>
                          <span className="mt-0.5 block truncate text-xs text-foreground/46">
                            {formatEdgeEndpointLabel(edge.source, nodeNameById, t)} → {formatEdgeEndpointLabel(edge.target, nodeNameById, t)}
                          </span>
                        </span>
                        <Move className="h-4 w-4 shrink-0 text-foreground/32" aria-hidden="true" />
                      </button>
                    ))}
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

function syncGraphToDraft(
  graph: Graph,
  draft: MapCreateDraft,
  selectedNodeId: string,
  selectedEdgeId: string,
  relationLabel: (relation: WorkspaceMapMaterialRelationType) => string
) {
  const nextNodeIds = new Set(draft.nodes.map((node) => node.id));
  const nextEdgeIds = new Set(draft.edges.map((edge) => edge.id));

  for (const nodeId of graph.nodes()) {
    if (!nextNodeIds.has(nodeId)) {
      graph.dropNode(nodeId);
    }
  }

  for (const node of draft.nodes) {
    const selected = node.id === selectedNodeId;
    const attributes = {
      color: getNodeColor(node.type, selected),
      highlighted: selected,
      label: node.name || " ",
      size: getNodeSize(node.type, selected),
      mapType: node.type,
      type: "circle",
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
    const attributes = {
      color: selected ? "#111827" : "#9ca3af",
      description: edge.description,
      highlighted: selected,
      label: relationLabel(edge.relation),
      relation: edge.relation,
      size: selected ? 2.2 : 1.1
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

function getNodeColor(type: WorkspaceMapMaterialNodeType, selected: boolean) {
  const palette: Record<WorkspaceMapMaterialNodeType, string> = {
    country: selected ? "#1D4ED8" : "#3B82F6",
    region: selected ? "#047857" : "#10B981",
    city: selected ? "#BE123C" : "#F43F5E",
    village: selected ? "#B45309" : "#F59E0B",
    landmark: selected ? "#6D28D9" : "#8B5CF6",
    path: selected ? "#0F172A" : "#475569"
  };

  return palette[type];
}

function getNodeSize(type: WorkspaceMapMaterialNodeType, selected: boolean) {
  const sizes: Record<WorkspaceMapMaterialNodeType, number> = {
    country: 16,
    region: 14,
    city: 13,
    village: 11,
    landmark: 12,
    path: 10
  };

  return (sizes[type] ?? 11) + (selected ? 3 : 0);
}

function getCanvasThemeColor(container: HTMLElement, variable: string, fallback: string, alpha?: number) {
  const value = getComputedStyle(container).getPropertyValue(variable).trim();

  if (!value) {
    return fallback;
  }

  return `hsl(${value}${typeof alpha === "number" ? ` / ${alpha}` : ""})`;
}

function formatEdgeEndpointLabel(nodeId: string, nodeNameById: Map<string, string>, t: (key: string, values?: Record<string, string | number>) => string) {
  return nodeNameById.get(nodeId) ?? nodeId ?? t("mapForm.none");
}
