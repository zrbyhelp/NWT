"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { ArrowLeftRight, Bot, Loader2, Pencil, SendHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MapCreateDraft, WorkspaceMapMaterialNodeType, WorkspaceMapMaterialRelationType, WorkspaceMaterialStyle } from "@/lib/home-workspace";
import { mapNodeTypes, mapRelationTypes } from "@/lib/home-workspace/map";
import { MaterialVisibilityField } from "./form-fields";
import { MapGraphEditor } from "./map-graph-editor";
import type { MapAiMessage, MapGeoJsonDraft, MapImageDraft, MapImageGenerationDraft, SceneReferenceImageDraft } from "./shared";

type MapNodeFormValue = {
  type: WorkspaceMapMaterialNodeType;
  name: string;
  description: string;
};

type MapEdgeFormValue = {
  relation: WorkspaceMapMaterialRelationType;
  source: string;
  target: string;
  description: string;
};

export function MapBasicInfoDialog({
  aiInput,
  aiMessages,
  aiPending,
  description,
  draft,
  isPending,
  saveLabel,
  title,
  onCancel,
  onChangeCommunityVisible,
  onChangeDescription,
  onChangeAiInput,
  onChangeName,
  onChangeStyle,
  onSendAiMessage,
  onSubmit,
  t
}: {
  aiInput: string;
  aiMessages: MapAiMessage[];
  aiPending: boolean;
  description: string;
  draft: MapCreateDraft;
  isPending: boolean;
  saveLabel: string;
  title: string;
  onCancel: () => void;
  onChangeCommunityVisible: (checked: boolean) => void;
  onChangeAiInput: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeName: (value: string) => void;
  onChangeStyle: (style: WorkspaceMaterialStyle) => void;
  onSendAiMessage: () => void;
  onSubmit: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const saveDisabled = !draft.name.trim() || !draft.description.trim();

  return (
    <MapDialogShell
      description={description}
      isPending={isPending}
      cancelLabel={t("cancel")}
      saveDisabled={saveDisabled}
      saveLabel={saveLabel}
      title={title}
      widthClassName="max-w-[80rem]"
      bodyClassName="flex min-h-0 flex-col p-0"
      onCancel={onCancel}
      onSubmit={onSubmit}
    >
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="scrollbar-autohide min-h-0 overflow-y-auto px-5 py-5">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
              <label className="block space-y-2 text-sm">
                <span className="text-foreground/64">{t("mapForm.name")}</span>
                <input
                  value={draft.name}
                  onChange={(event) => onChangeName(event.target.value)}
                  placeholder={t("mapForm.namePlaceholder")}
                  className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition placeholder:text-foreground/38 focus:border-primary"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="text-foreground/64">{t("mapForm.style")}</span>
                <select
                  value={draft.style}
                  onChange={(event) => onChangeStyle(event.target.value as WorkspaceMaterialStyle)}
                  className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
                >
                  {(["realistic", "fantasy", "sciFi", "mystery", "cyberpunk", "classical", "apocalyptic"] as const).map((style) => (
                    <option key={style} value={style}>
                      {t(`styles.${style}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-2 text-sm">
              <span className="text-foreground/64">{t("mapForm.mapDescription")}</span>
              <textarea
                value={draft.description}
                onChange={(event) => onChangeDescription(event.target.value)}
                placeholder={t("mapForm.descriptionPlaceholder")}
                rows={5}
                className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-foreground/38 focus:border-primary"
              />
            </label>

            <MaterialVisibilityField
              checked={draft.communityVisible}
              label={t("mapForm.communityVisible")}
              description={t("mapForm.communityVisibleDescription")}
              disabled={isPending}
              disabledLabel={t("mapForm.communityHidden")}
              enabledLabel={t("mapForm.communityShown")}
              onChange={onChangeCommunityVisible}
            />
          </div>
        </div>

        <aside className="flex min-h-0 flex-col border-t border-border bg-muted/14 p-4 lg:border-l lg:border-t-0">
          <MapAssistantPanel
            input={aiInput}
            isPending={aiPending}
            messages={aiMessages}
            onChangeInput={onChangeAiInput}
            onSend={onSendAiMessage}
            t={t}
          />
        </aside>
      </div>
    </MapDialogShell>
  );
}

export function MapGraphDialog({
  aiInput,
  aiMessages,
  aiPending,
  description,
  draft,
  connectSourceNodeId,
  deriveMaxRounds,
  derivePending,
  deriveRound,
  deriveStatus,
  isPending,
  mapGeoJsonDraft,
  mapImageDraft,
  mapImageGeneration,
  mapImageNodeBatchSize,
  mapImageReferenceImages,
  mapImageReferencePrompt,
  saveLabel,
  selectedEdgeId,
  selectedNodeId,
  title,
  onAddNode,
  onCancel,
  onChangeAiInput,
  onChangeDeriveMaxRounds,
  onChangeMapImageNodeBatchSize,
  onChangeMapImageReferencePrompt,
  onClearMapImage,
  onConnectNode,
  onEditEdge,
  onEditBasicInfo,
  onEditNode,
  onLayoutNodes,
  onMoveNode,
  onRemoveEdge,
  onRemoveNode,
  onSelectEdge,
  onSelectNode,
  onSendAiMessage,
  onAddMapImageReferenceImages,
  onGenerateMapGeoJson,
  onGenerateMapImage,
  onContinueMapImage,
  onRemoveMapImageReferenceImage,
  onSelectMapFinalImage,
  onStartDerive,
  onStopDerive,
  onSubmit,
  t
}: {
  aiInput: string;
  aiMessages: MapAiMessage[];
  aiPending: boolean;
  description: string;
  draft: MapCreateDraft;
  connectSourceNodeId: string;
  deriveMaxRounds: number;
  derivePending: boolean;
  deriveRound: number;
  deriveStatus: string;
  isPending: boolean;
  mapGeoJsonDraft: MapGeoJsonDraft | null;
  mapImageDraft: MapImageDraft | null;
  mapImageGeneration: MapImageGenerationDraft;
  mapImageNodeBatchSize: number;
  mapImageReferenceImages: SceneReferenceImageDraft[];
  mapImageReferencePrompt: string;
  saveLabel: string;
  selectedEdgeId: string;
  selectedNodeId: string;
  title: string;
  onAddNode: () => void;
  onCancel: () => void;
  onChangeAiInput: (value: string) => void;
  onChangeDeriveMaxRounds: (value: number) => void;
  onChangeMapImageNodeBatchSize: (value: number) => void;
  onChangeMapImageReferencePrompt: (value: string) => void;
  onClearMapImage: () => void;
  onConnectNode: (nodeId: string) => void;
  onEditEdge: (edgeId: string) => void;
  onEditBasicInfo: () => void;
  onEditNode: (nodeId: string) => void;
  onLayoutNodes: (updates: Array<Pick<MapCreateDraft["nodes"][number], "id" | "x" | "y">>) => void;
  onMoveNode?: (nodeId: string, x: number, y: number) => void;
  onRemoveEdge: (edgeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onSendAiMessage: () => void;
  onAddMapImageReferenceImages: (files: FileList | File[]) => void;
  onGenerateMapGeoJson: () => void;
  onGenerateMapImage: () => void;
  onContinueMapImage: () => void;
  onRemoveMapImageReferenceImage: (imageId: string) => void;
  onSelectMapFinalImage: (file: File | null) => void;
  onStartDerive: () => void;
  onStopDerive: () => void;
  onSubmit: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <MapDialogShell
      description={description}
      isPending={isPending}
      cancelLabel={t("cancel")}
      saveDisabled={derivePending}
      saveLabel={saveLabel}
      title={title}
      widthClassName="max-w-[88rem]"
      bodyClassName="flex min-h-0 flex-col p-0"
      onCancel={onCancel}
      onSubmit={onSubmit}
    >
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.55fr)_22rem]">
        <div className="relative flex min-h-0 min-w-0 overflow-hidden">
          <MapGraphEditor
            deriveMaxRounds={deriveMaxRounds}
            derivePending={derivePending}
            deriveRound={deriveRound}
            deriveStatus={deriveStatus}
            draft={draft}
            embedded
            mapGeoJsonDraft={mapGeoJsonDraft}
            mapImageDraft={mapImageDraft}
            mapImageGeneration={mapImageGeneration}
            mapImageNodeBatchSize={mapImageNodeBatchSize}
            mapImageReferenceImages={mapImageReferenceImages}
            mapImageReferencePrompt={mapImageReferencePrompt}
            onAddNode={onAddNode}
            onAddMapImageReferenceImages={onAddMapImageReferenceImages}
            onChangeDeriveMaxRounds={onChangeDeriveMaxRounds}
            onChangeMapImageNodeBatchSize={onChangeMapImageNodeBatchSize}
            onChangeMapImageReferencePrompt={onChangeMapImageReferencePrompt}
            onClearMapImage={onClearMapImage}
            onConnectNode={onConnectNode}
            onContinueMapImage={onContinueMapImage}
            onEditEdge={onEditEdge}
            onEditNode={onEditNode}
            onGenerateMapGeoJson={onGenerateMapGeoJson}
            onGenerateMapImage={onGenerateMapImage}
            onLayoutNodes={onLayoutNodes}
            onMoveNode={onMoveNode}
            onRemoveMapImageReferenceImage={onRemoveMapImageReferenceImage}
            onRemoveEdge={onRemoveEdge}
            onRemoveNode={onRemoveNode}
            onSelectMapFinalImage={onSelectMapFinalImage}
            onSelectEdge={onSelectEdge}
            onSelectNode={onSelectNode}
            onStartDerive={onStartDerive}
            onStopDerive={onStopDerive}
            readOnly={isPending || derivePending}
            relationLabel={(relation) => t(`mapForm.relationTypes.${relation}`)}
            selectedEdgeId={selectedEdgeId}
            selectedNodeId={selectedNodeId}
            connectSourceNodeId={connectSourceNodeId}
            showHeader={false}
            showSelectionPanel
            t={t}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-end px-4 pb-4">
            <button
              type="button"
              onClick={onEditBasicInfo}
              disabled={isPending || derivePending}
              className="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background/96 px-3 text-sm font-medium text-foreground shadow-lg shadow-foreground/10 backdrop-blur transition hover:bg-muted disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-foreground/44"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t("mapForm.editBasicInfo")}
            </button>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col border-t border-border bg-muted/14 p-4 lg:border-l lg:border-t-0">
          <MapAssistantPanel
            input={aiInput}
            isPending={aiPending}
            messages={aiMessages}
            onChangeInput={onChangeAiInput}
            onSend={onSendAiMessage}
            t={t}
          />
        </aside>
      </div>
    </MapDialogShell>
  );
}

export function MapNodeDialog({
  draft,
  editingNodeId,
  isPending,
  saveLabel,
  title,
  description,
  onCancel,
  onRemove,
  onSave,
  t
}: {
  draft: MapCreateDraft;
  editingNodeId: string;
  isPending: boolean;
  saveLabel: string;
  title: string;
  description: string;
  onCancel: () => void;
  onRemove?: (nodeId: string) => void;
  onSave: (value: MapNodeFormValue) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const initialValue = useMemo(() => getNodeFormValue(draft, editingNodeId), [draft, editingNodeId]);
  const [form, setForm] = useState<MapNodeFormValue>(initialValue);

  const saveDisabled = !form.name.trim();
  const canRemove = Boolean(editingNodeId && onRemove && draft.nodes.length > 0);

  return (
    <MapDialogShell
      description={description}
      isPending={isPending}
      cancelLabel={t("cancel")}
      saveDisabled={saveDisabled}
      saveLabel={saveLabel}
      title={title}
      widthClassName="max-w-2xl"
      footerExtras={
        canRemove ? (
          <button
            type="button"
            onClick={() => onRemove?.(editingNodeId)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
          >
            {t("mapForm.removeNode")}
          </button>
        ) : null
      }
      onCancel={onCancel}
      onSubmit={() => onSave(form)}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_11rem]">
          <label className="block space-y-2 text-sm">
            <span className="text-foreground/64">{t("mapForm.nodeName")}</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("mapForm.nodeNamePlaceholder")}
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition placeholder:text-foreground/38 focus:border-primary"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="text-foreground/64">{t("mapForm.nodeType")}</span>
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as WorkspaceMapMaterialNodeType }))}
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
            >
              {mapNodeTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`mapForm.nodeTypes.${type}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-2 text-sm">
          <span className="text-foreground/64">{t("mapForm.nodeDescription")}</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={4}
            placeholder={t("mapForm.nodeDescriptionPlaceholder")}
            className="min-h-24 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-foreground/38 focus:border-primary"
          />
        </label>

        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-xs leading-6 text-foreground/54">
          {t("mapForm.nodePositionAuto")}
        </div>
      </div>
    </MapDialogShell>
  );
}

export function MapEdgeDialog({
  draft,
  editingEdgeId,
  isPending,
  saveLabel,
  selectedNodeId,
  initialSourceNodeId,
  initialTargetNodeId,
  title,
  description,
  onCancel,
  onRemove,
  onSave,
  t
}: {
  draft: MapCreateDraft;
  editingEdgeId: string;
  isPending: boolean;
  saveLabel: string;
  selectedNodeId: string;
  initialSourceNodeId?: string;
  initialTargetNodeId?: string;
  title: string;
  description: string;
  onCancel: () => void;
  onRemove?: (edgeId: string) => void;
  onSave: (value: MapEdgeFormValue) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const initialValue = useMemo(
    () => getEdgeFormValue(draft, editingEdgeId, initialSourceNodeId ?? selectedNodeId, initialTargetNodeId),
    [draft, editingEdgeId, initialSourceNodeId, initialTargetNodeId, selectedNodeId]
  );
  const [form, setForm] = useState<MapEdgeFormValue>(initialValue);

  const canRemove = Boolean(editingEdgeId && onRemove);
  const saveDisabled = draft.nodes.length < 2 || !form.source || !form.target || form.source === form.target;
  const canSwapEndpoints = Boolean(form.source && form.target);
  const nodeNameById = useMemo(() => new Map(draft.nodes.map((node) => [node.id, node.name || t("mapForm.nodeUntitled")])), [draft.nodes, t]);

  return (
    <MapDialogShell
      description={description}
      isPending={isPending}
      cancelLabel={t("cancel")}
      saveDisabled={saveDisabled}
      saveLabel={saveLabel}
      title={title}
      widthClassName="max-w-2xl"
      footerExtras={
        canRemove ? (
          <button
            type="button"
            onClick={() => onRemove?.(editingEdgeId)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
          >
            {t("mapForm.removeEdge")}
          </button>
        ) : null
      }
      onCancel={onCancel}
      onSubmit={() => onSave(form)}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="block space-y-2 text-sm">
            <span className="text-foreground/64">{t("mapForm.relation")}</span>
            <select
              value={form.relation}
              onChange={(event) => setForm((current) => ({ ...current, relation: event.target.value as WorkspaceMapMaterialRelationType }))}
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
            >
              {mapRelationTypes.map((relation) => (
                <option key={relation} value={relation}>
                  {t(`mapForm.relationTypes.${relation}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span className="text-foreground/64">{t("mapForm.edgeDescription")}</span>
            <input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={t("mapForm.edgeDescriptionPlaceholder")}
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition placeholder:text-foreground/38 focus:border-primary"
            />
          </label>
        </div>

        <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <label className="block space-y-2 text-sm">
            <span className="text-foreground/64">{t("mapForm.source")}</span>
            <select
              value={form.source}
              onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
            >
              <option value="">{t("mapForm.none")}</option>
              {draft.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {nodeNameById.get(node.id) ?? t("mapForm.nodeUntitled")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setForm((current) => ({ ...current, source: current.target, target: current.source }))}
            disabled={!canSwapEndpoints}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-foreground/44"
            aria-label={t("mapForm.swapEdgeEndpoints")}
            title={t("mapForm.swapEdgeEndpoints")}
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            <span className="md:sr-only">{t("mapForm.swapEdgeEndpoints")}</span>
          </button>
          <label className="block space-y-2 text-sm">
            <span className="text-foreground/64">{t("mapForm.target")}</span>
            <select
              value={form.target}
              onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))}
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
            >
              <option value="">{t("mapForm.none")}</option>
              {draft.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {nodeNameById.get(node.id) ?? t("mapForm.nodeUntitled")}
                </option>
              ))}
            </select>
          </label>
        </div>
        {form.source && form.target && form.source === form.target ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
            {t("mapForm.edgeSameEndpoint")}
          </p>
        ) : null}
      </div>
    </MapDialogShell>
  );
}

function MapAssistantPanel({
  input,
  isPending,
  messages,
  onChangeInput,
  onSend,
  t
}: {
  input: string;
  isPending: boolean;
  messages: MapAiMessage[];
  onChangeInput: (value: string) => void;
  onSend: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={t("mapForm.aiTitle")}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground/70">
        <Bot className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{t("mapForm.aiTitle")}</span>
      </h3>
      <div className="scrollbar-autohide min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg bg-background/72 p-2">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-background/55 p-3 text-xs leading-5 text-foreground/48">
            {t("mapForm.aiEmpty")}
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
          placeholder={t("mapForm.aiPlaceholder")}
          rows={2}
          className="min-h-11 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-5 outline-none transition placeholder:text-foreground/38 focus:border-primary"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!input.trim() || isPending}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
          aria-label={t("mapForm.aiSend")}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
}

function MapDialogShell({
  bodyClassName,
  children,
  description,
  footerExtras,
  cancelLabel,
  isPending,
  saveDisabled = false,
  saveLabel,
  title,
  widthClassName = "max-w-2xl",
  onCancel,
  onSubmit
}: {
  bodyClassName?: string;
  children: ReactNode;
  description: string;
  footerExtras?: ReactNode;
  cancelLabel: string;
  isPending: boolean;
  saveDisabled?: boolean;
  saveLabel: string;
  title: string;
  widthClassName?: string;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const formId = useId();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm">
      <section className={cn("flex h-[50rem] max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl", widthClassName)}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
            <p className="mt-1 text-sm text-foreground/55">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/58 transition hover:bg-muted hover:text-foreground"
            aria-label={cancelLabel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <form
          id={formId}
          className={cn("scrollbar-autohide min-h-0 flex-1 overflow-y-auto px-5 py-5", bodyClassName)}
          onSubmit={(event) => {
            event.preventDefault();
            if (isPending || saveDisabled) {
              return;
            }

            onSubmit();
          }}
        >
          {children}
        </form>

        <footer className="shrink-0 border-t border-border bg-background px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">{footerExtras}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                {cancelLabel}
              </button>
              <button
                type="submit"
                form={formId}
                disabled={isPending || saveDisabled}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {saveLabel}
              </button>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}

function getNodeFormValue(draft: MapCreateDraft, editingNodeId: string): MapNodeFormValue {
  const editingNode = draft.nodes.find((node) => node.id === editingNodeId);

  if (editingNode) {
    return {
      type: editingNode.type,
      name: editingNode.name,
      description: editingNode.description
    };
  }

  return {
    type: "landmark",
    name: "",
    description: ""
  };
}

function getEdgeFormValue(
  draft: MapCreateDraft,
  editingEdgeId: string,
  selectedNodeId: string,
  targetNodeId = ""
): MapEdgeFormValue {
  const editingEdge = draft.edges.find((edge) => edge.id === editingEdgeId);

  if (editingEdge) {
    return {
      relation: editingEdge.relation,
      source: editingEdge.source,
      target: editingEdge.target,
      description: editingEdge.description
    };
  }

  const sourceNode = draft.nodes.find((node) => node.id === selectedNodeId) ?? draft.nodes[0] ?? null;
  const requestedTargetNode = targetNodeId ? draft.nodes.find((node) => node.id === targetNodeId) ?? null : null;
  const targetNode = requestedTargetNode && requestedTargetNode.id !== sourceNode?.id
    ? requestedTargetNode
    : draft.nodes.find((node) => node.id !== sourceNode?.id) ?? draft.nodes[1] ?? null;

  return {
    relation: "connects",
    source: sourceNode?.id ?? "",
    target: targetNode?.id ?? "",
    description: ""
  };
}
