import { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizontal, Trash2, Upload, X } from "lucide-react";
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
import { BodyTextField, ColorField, MaskRangeField, MaterialVisibilityField } from "./form-fields";
import { getMaskBodyOptionLabel, getMaskVoiceValueLabel } from "./labels";

export { MaskCreateDialog };

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
  onChangeCommunityVisible,
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
  onChangeCommunityVisible: (checked: boolean) => void;
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

              <MaterialVisibilityField
                checked={draft.communityVisible}
                description={t("shareHint")}
                disabled={isPending}
                disabledLabel={t("shareDisabled")}
                enabledLabel={t("shareEnabled")}
                label={t("shareToCommunity")}
                onChange={onChangeCommunityVisible}
              />

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
