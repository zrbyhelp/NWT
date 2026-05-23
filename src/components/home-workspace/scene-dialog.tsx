import { useMemo, useRef, useState } from "react";
import { Images, Loader2, Plus, SendHorizontal, Sparkles, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ItemDraftPatch,
  ItemMaterialCreateInput,
  SceneDraftPatch,
  SceneMaterialCreateInput,
  WorkspaceItemMaterialMetadata,
  WorkspaceMaterial,
  WorkspaceMaterialCategory,
  WorkspaceMaterialMetadata,
  WorkspaceMaterialStyle,
  WorkspaceSceneMaterialMetadata,
  WorkspaceSceneScalePreset,
  WorkspaceScript
} from "@/lib/home-workspace";
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
  type ItemModelDraft,
  type ItemModelProgress,
  type ItemModelStreamEvent,
  type ItemTagFieldId,
  type ItemViewFace,
  type ItemViewImageDraft,
  type MaskAiMessage,
  type MaskBoardDrawingStyle,
  type MaskBoardImageSource,
  type MaskBodyFieldId,
  type MaskColorFieldId,
  type MaskCreateDraft,
  type MaskDraftPatch,
  type MaskPersonalityFieldId,
  type MaskVoiceFieldId,
  type MessageStreamEvent,
  type SceneAiMessage,
  type SceneBlockDraft,
  type SceneCreateDraft,
  type ScenePanoramaDraft,
  type ScenePanoramaDrawingStyle,
  type ScenePanoramaFace,
  type ScenePanoramaFaceDraft,
  type ScenePanoramaGenerationDraft,
  type ScenePanoramaMotherDraft,
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
import { getCompleteScenePanoramaFaceUrls, getScenePanoramaGenerationFaceUrls, isCompleteScenePanoramaFaceUrls } from "./drafts";
import { SceneEquirectangularPanoramaPreviewDialog, SceneEquirectangularPanoramaViewer, ScenePanoramaPreviewDialog, ScenePanoramaViewer } from "./viewers";

export { SceneCreateDialog };

function SceneCreateDialog({
  activeBlockId,
  aiInput,
  aiMessages,
  aiPending,
  aiReferenceImages,
  draft,
  description,
  isPending,
  panoramaGenerationByBlock,
  panoramaMaxRedrawAttempts,
  panoramaPendingBlockId,
  saveLabel,
  title,
  onAddAiReferenceImages,
  onAddBlock,
  onAddBlockReferenceImages,
  onCancel,
  onChangeActiveBlock,
  onChangeAiInput,
  onChangeBlock,
  onChangeDescription,
  onChangeName,
  onChangePanoramaMaxRedrawAttempts,
  onChangePanoramaDrawingStyle,
  onChangeStyle,
  onClearBlockPanorama,
  onGenerateMother,
  onGeneratePanorama,
  onRemoveAiReferenceImage,
  onRemoveBlock,
  onRemoveBlockReferenceImage,
  onSelectFace,
  onSendAiMessage,
  onSubmit,
  t
}: {
  activeBlockId: string;
  aiInput: string;
  aiMessages: SceneAiMessage[];
  aiPending: boolean;
  aiReferenceImages: SceneReferenceImageDraft[];
  draft: SceneCreateDraft;
  description: string;
  isPending: boolean;
  panoramaGenerationByBlock: Record<string, ScenePanoramaGenerationDraft>;
  panoramaMaxRedrawAttempts: number;
  panoramaPendingBlockId: string;
  saveLabel: string;
  title: string;
  onAddAiReferenceImages: (files: FileList | File[]) => void;
  onAddBlock: () => void;
  onAddBlockReferenceImages: (blockId: string, files: FileList | File[]) => void;
  onCancel: () => void;
  onChangeActiveBlock: (blockId: string) => void;
  onChangeAiInput: (value: string) => void;
  onChangeBlock: (blockId: string, patch: Partial<Pick<SceneBlockDraft, "name" | "description" | "scalePreset">>) => void;
  onChangeDescription: (value: string) => void;
  onChangeName: (value: string) => void;
  onChangePanoramaMaxRedrawAttempts: (value: number) => void;
  onChangePanoramaDrawingStyle: (style: ScenePanoramaDrawingStyle) => void;
  onChangeStyle: (style: WorkspaceMaterialStyle) => void;
  onClearBlockPanorama: (blockId: string) => void;
  onGenerateMother: (blockId: string) => void;
  onGeneratePanorama: (blockId: string) => void;
  onRemoveAiReferenceImage: (imageId: string) => void;
  onRemoveBlock: (blockId: string) => void;
  onRemoveBlockReferenceImage: (blockId: string, imageId: string) => void;
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
                    const generation = panoramaGenerationByBlock[block.id] ?? null;

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
                        <div className="grid gap-3 md:grid-cols-[13rem_12rem_minmax(0,1fr)]">
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
                            <span className="text-foreground/64">{t("sceneForm.blockScale")}</span>
                            <select
                              value={block.scalePreset}
                              onFocus={() => onChangeActiveBlock(block.id)}
                              onChange={(event) => onChangeBlock(block.id, { scalePreset: event.target.value as WorkspaceSceneScalePreset })}
                              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
                            >
                              {sceneScalePresets.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                  {t(`sceneForm.blockScalePresets.${preset.id}`, { meters: preset.meters })}
                                </option>
                              ))}
                            </select>
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
                          generation={generation}
                          isPending={panoramaPendingBlockId === block.id}
                          isBlocked={Boolean(panoramaPendingBlockId)}
                          maxRedrawAttempts={panoramaMaxRedrawAttempts}
                          referenceImages={block.referenceImages}
                          onAddReferenceImages={(files) => onAddBlockReferenceImages(block.id, files)}
                          onChangeMaxRedrawAttempts={onChangePanoramaMaxRedrawAttempts}
                          onClear={() => onClearBlockPanorama(block.id)}
                          onGenerateMother={() => {
                            onChangeActiveBlock(block.id);
                            onGenerateMother(block.id);
                          }}
                          onGenerate={() => {
                            onChangeActiveBlock(block.id);
                            onGeneratePanorama(block.id);
                          }}
                          onSelectFace={(face, file) => {
                            onChangeActiveBlock(block.id);
                            onSelectFace(block.id, face, file);
                          }}
                          onRemoveReferenceImage={(imageId) => onRemoveBlockReferenceImage(block.id, imageId)}
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
              referenceImages={aiReferenceImages}
              onAddReferenceImages={onAddAiReferenceImages}
              onChangeInput={onChangeAiInput}
              onRemoveReferenceImage={onRemoveAiReferenceImage}
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
  generation,
  isBlocked,
  isPending,
  maxRedrawAttempts,
  referenceImages,
  onAddReferenceImages,
  onChangeMaxRedrawAttempts,
  onClear,
  onGenerateMother,
  onGenerate,
  onRemoveReferenceImage,
  onSelectFace,
  t
}: {
  block: SceneBlockDraft;
  faces: Record<ScenePanoramaFace, string> | null;
  generation: ScenePanoramaGenerationDraft | null;
  isBlocked: boolean;
  isPending: boolean;
  maxRedrawAttempts: number;
  referenceImages: SceneReferenceImageDraft[];
  onAddReferenceImages: (files: FileList | File[]) => void;
  onChangeMaxRedrawAttempts: (value: number) => void;
  onClear: () => void;
  onGenerateMother: () => void;
  onGenerate: () => void;
  onRemoveReferenceImage: (imageId: string) => void;
  onSelectFace: (face: ScenePanoramaFace, file: File | null) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [motherPreviewOpen, setMotherPreviewOpen] = useState(false);
  const generationImages = generation?.faces ?? null;
  const generationFaces = useMemo(
    () => (generationImages ? getScenePanoramaGenerationFaceUrls(generationImages) : null),
    [generationImages]
  );
  const previewFaces = generationFaces ?? faces;
  const completePreviewFaces = previewFaces && isCompleteScenePanoramaFaceUrls(previewFaces) ? previewFaces : null;
  const isGenerating = generation ? !generation.completed && !generation.error : false;
  const motherUrl = generation?.motherImage?.dataUrl ?? block.panorama?.mother?.previewUrl ?? block.panorama?.mother?.storedUrl ?? "";
  const canGenerateFaces = Boolean(motherUrl);

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
          <label className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs text-foreground/60">
            <span>{t("sceneForm.panoramaIterationRounds")}</span>
            <input
              type="number"
              min={minScenePanoramaMaxRedrawAttempts}
              max={maxScenePanoramaMaxRedrawAttempts}
              value={maxRedrawAttempts}
              disabled={isBlocked}
              onChange={(event) => onChangeMaxRedrawAttempts(Number(event.target.value))}
              className="h-6 w-10 rounded border border-border bg-background px-1 text-center text-xs font-medium text-foreground outline-none focus:border-primary disabled:text-foreground/40"
              aria-label={t("sceneForm.panoramaIterationRounds")}
            />
          </label>
          <button
            type="button"
            onClick={onGenerateMother}
            disabled={isBlocked}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground/68 transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
          >
            {isPending && !canGenerateFaces ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Images className="h-3.5 w-3.5" aria-hidden="true" />}
            {t("sceneForm.generatePanoramaMother")}
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isBlocked || !canGenerateFaces}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            {t("sceneForm.generatePanorama")}
          </button>
        </div>
      </div>

      {generation ? (
        <div className="space-y-2 rounded-lg border border-border bg-background/70 p-2.5">
          <div className="flex items-center justify-between gap-3 text-xs text-foreground/56">
            <span>{t(generation.messageKey)}</span>
            <span>{generation.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${Math.max(0, Math.min(100, generation.progress))}%` }}
            />
          </div>
          {motherUrl ? (
            <div className="overflow-hidden rounded-md border border-border bg-muted/40">
              <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-foreground/52">
                <span>{t("sceneForm.panoramaMotherPreview")}</span>
                {isGenerating ? <span>{t("sceneForm.panoramaPreviewOnly")}</span> : null}
              </div>
              <SceneEquirectangularPanoramaViewer
                className="aspect-[2/1] rounded-none border-0"
                emptyLabel={t("sceneForm.panoramaMotherEmpty")}
                imageUrl={motherUrl}
                expandLabel={t("sceneForm.panoramaMotherPreviewOpen")}
                loadingLabel={t("sceneForm.panoramaPreviewLoading")}
                onExpand={() => setMotherPreviewOpen(true)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {!generation && motherUrl ? (
        <div className="overflow-hidden rounded-lg border border-border bg-background/70 p-2.5">
          <div className="flex items-center justify-between gap-2 pb-2 text-xs text-foreground/52">
            <span>{t("sceneForm.panoramaMotherPreview")}</span>
          </div>
          <SceneEquirectangularPanoramaViewer
            className="aspect-[2/1] rounded-md"
            emptyLabel={t("sceneForm.panoramaMotherEmpty")}
            imageUrl={motherUrl}
            expandLabel={t("sceneForm.panoramaMotherPreviewOpen")}
            loadingLabel={t("sceneForm.panoramaPreviewLoading")}
            onExpand={() => setMotherPreviewOpen(true)}
          />
        </div>
      ) : null}

      <SceneReferenceImageStrip
        addLabel={t("sceneForm.referenceImageAdd")}
        emptyLabel={t("sceneForm.panoramaReferenceEmpty")}
        images={referenceImages}
        isDisabled={isBlocked}
        removeLabel={t("sceneForm.referenceImageRemove")}
        title={t("sceneForm.panoramaReferenceImages")}
        onAddImages={onAddReferenceImages}
        onRemoveImage={onRemoveReferenceImage}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(16rem,1fr)]">
        <ScenePanoramaViewer
          faces={previewFaces}
          emptyLabel={t("sceneForm.panoramaEmpty")}
          expandLabel={t("sceneForm.panoramaPreviewOpen")}
          loadingLabel={t("sceneForm.panoramaPreviewLoading")}
          onExpand={completePreviewFaces ? () => setPreviewOpen(true) : undefined}
        />

        <div className="grid grid-cols-3 gap-2">
          {scenePanoramaFaces.map((face) => {
            const generatedImage = generation?.faces[face];
            const image = generatedImage
              ? {
                  previewUrl: generatedImage.dataUrl
                }
              : block.panorama?.faces[face];
            const isIterating = generation?.iteratingFaces.includes(face) ?? false;

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
                  <span className="relative block h-14 w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
                    {isIterating ? (
                      <span className="absolute inset-0 grid place-items-center bg-background/72 px-1 text-center text-[0.68rem] font-medium text-foreground backdrop-blur-sm">
                        {t("sceneForm.panoramaFaceIterating")}
                      </span>
                    ) : null}
                  </span>
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
      {previewOpen && completePreviewFaces ? (
        <ScenePanoramaPreviewDialog
          faces={completePreviewFaces}
          motherImageUrl={motherUrl || null}
          onClose={() => setPreviewOpen(false)}
          t={t}
        />
      ) : null}
      {motherPreviewOpen && motherUrl ? (
        <SceneEquirectangularPanoramaPreviewDialog
          imageUrl={motherUrl}
          onClose={() => setMotherPreviewOpen(false)}
          t={t}
        />
      ) : null}
    </section>
  );
}

function SceneReferenceImageStrip({
  addLabel,
  emptyLabel,
  images,
  isDisabled,
  removeLabel,
  title,
  onAddImages,
  onRemoveImage
}: {
  addLabel: string;
  emptyLabel: string;
  images: SceneReferenceImageDraft[];
  isDisabled?: boolean;
  removeLabel: string;
  title: string;
  onAddImages: (files: FileList | File[]) => void;
  onRemoveImage: (imageId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground/62">{title}</span>
        <label className={cn(
          "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border px-2 text-xs font-medium text-foreground/60 transition hover:bg-muted hover:text-foreground",
          isDisabled ? "pointer-events-none opacity-45" : ""
        )}>
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {addLabel}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={isDisabled}
            onChange={(event) => {
              if (event.target.files) {
                onAddImages(event.target.files);
              }

              event.target.value = "";
            }}
          />
        </label>
      </div>
      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {images.map((image) => (
            <div key={image.id} className="group relative overflow-hidden rounded-md border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.previewUrl} alt="" className="aspect-video w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemoveImage(image.id)}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/86 text-foreground/70 opacity-0 shadow-sm transition hover:text-foreground group-hover:opacity-100"
                aria-label={removeLabel}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span className="block truncate px-1.5 py-1 text-[0.68rem] text-foreground/50">{image.file.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border/75 px-3 py-2 text-xs text-foreground/42">{emptyLabel}</p>
      )}
    </div>
  );
}

function SceneAssistantPanel({
  input,
  isPending,
  messages,
  referenceImages,
  onAddReferenceImages,
  onChangeInput,
  onRemoveReferenceImage,
  onSend,
  t
}: {
  input: string;
  isPending: boolean;
  messages: SceneAiMessage[];
  referenceImages: SceneReferenceImageDraft[];
  onAddReferenceImages: (files: FileList | File[]) => void;
  onChangeInput: (value: string) => void;
  onRemoveReferenceImage: (imageId: string) => void;
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
      <div className="mt-3">
        <SceneReferenceImageStrip
          addLabel={t("sceneForm.referenceImageAdd")}
          emptyLabel={t("sceneForm.aiReferenceEmpty")}
          images={referenceImages}
          isDisabled={isPending}
          removeLabel={t("sceneForm.referenceImageRemove")}
          title={t("sceneForm.aiReferenceImages")}
          onAddImages={onAddReferenceImages}
          onRemoveImage={onRemoveReferenceImage}
        />
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
          disabled={(!input.trim() && referenceImages.length === 0) || isPending}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
          aria-label={t("sceneForm.aiSend")}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
}
