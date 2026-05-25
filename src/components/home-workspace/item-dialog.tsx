import { useEffect, useRef, useState } from "react";
import { Box, Image as ImageIcon, Loader2, SendHorizontal, Sparkles, Trash2, Upload, X } from "lucide-react";
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
  type ItemModelInputImageDraft,
  type ItemModelDraft,
  type ItemModelProgress,
  type ItemModelStreamEvent,
  type ItemTagFieldId,
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
import { isCompleteItemModelInputImageDraft } from "./drafts";
import { ReferenceImageStrip } from "./reference-image-strip";
import { ItemModelViewer } from "./viewers";
import { MaterialVisibilityField } from "./form-fields";

export { ItemCreateDialog };

function ItemCreateDialog({
  aiInput,
  aiPending,
  aiReferenceImages,
  boardPending,
  boardReferenceImages,
  draft,
  description,
  isPending,
  modelPending,
  modelProgress,
  saveLabel,
  title,
  modelInputPending,
  onCancel,
  onAddAiReferenceImages,
  onAddBoardReferenceImages,
  onChangeAiInput,
  onChangeBoardDrawingStyle,
  onChangeCommunityVisible,
  onChangeField,
  onChangeModelExtraParams,
  onChangeStyle,
  onChangeTags,
  onClearBoardImage,
  onClearModelInputImage,
  onGenerateBoard,
  onGenerateModel,
  onGenerateModelInputImage,
  onSelectBoardImage,
  onSelectModelInputImage,
  onRemoveAiReferenceImage,
  onRemoveBoardReferenceImage,
  onSendAiMessage,
  onSubmit,
  t
}: {
  aiInput: string;
  aiPending: boolean;
  aiReferenceImages: SceneReferenceImageDraft[];
  boardPending: boolean;
  boardReferenceImages: SceneReferenceImageDraft[];
  draft: ItemCreateDraft;
  description: string;
  isPending: boolean;
  modelPending: boolean;
  modelProgress: ItemModelProgress | null;
  saveLabel: string;
  title: string;
  modelInputPending: boolean;
  onCancel: () => void;
  onAddAiReferenceImages: (files: FileList | File[]) => void;
  onAddBoardReferenceImages: (files: FileList | File[]) => void;
  onChangeAiInput: (value: string) => void;
  onChangeBoardDrawingStyle: (style: MaskBoardDrawingStyle) => void;
  onChangeCommunityVisible: (checked: boolean) => void;
  onChangeField: (field: "brand" | "description" | "itemCategory" | "model" | "name" | "scaleHint", value: string) => void;
  onChangeModelExtraParams: (value: string) => void;
  onChangeStyle: (style: WorkspaceMaterialStyle) => void;
  onChangeTags: (field: ItemTagFieldId, tags: string[]) => void;
  onClearBoardImage: () => void;
  onClearModelInputImage: () => void;
  onGenerateBoard: () => void;
  onGenerateModel: () => void;
  onGenerateModelInputImage: () => void;
  onRemoveAiReferenceImage: (imageId: string) => void;
  onRemoveBoardReferenceImage: (imageId: string) => void;
  onSelectBoardImage: (file: File | null) => void;
  onSelectModelInputImage: (file: File | null) => void;
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

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(22rem,1fr)]">
          <form
            className="scrollbar-autohide min-h-0 overflow-y-auto px-5 py-5"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground/70">{t("itemForm.basicTitle")}</h3>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
                  <ItemTextField
                    label={t("itemForm.name")}
                    placeholder={t("itemForm.namePlaceholder")}
                    value={draft.name}
                    onChange={(value) => onChangeField("name", value)}
                  />
                  <ItemTextField
                    label={t("itemForm.category")}
                    placeholder={t("itemForm.categoryPlaceholder")}
                    value={draft.itemCategory}
                    onChange={(value) => onChangeField("itemCategory", value)}
                  />
                  <label className="block space-y-2 text-sm">
                    <span className="text-foreground/64">{t("itemForm.style")}</span>
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
                <label className="block space-y-2 text-sm">
                  <span className="text-foreground/64">{t("itemForm.itemDescription")}</span>
                  <textarea
                    value={draft.description}
                    onChange={(event) => onChangeField("description", event.target.value)}
                    placeholder={t("itemForm.descriptionPlaceholder")}
                    rows={5}
                    className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-foreground/38 focus:border-primary"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-3">
                  <ItemTextField
                    label={t("itemForm.brand")}
                    placeholder={t("itemForm.brandPlaceholder")}
                    value={draft.brand}
                    onChange={(value) => onChangeField("brand", value)}
                  />
                  <ItemTextField
                    label={t("itemForm.model")}
                    placeholder={t("itemForm.modelPlaceholder")}
                    value={draft.model}
                    onChange={(value) => onChangeField("model", value)}
                  />
                  <ItemTextField
                    label={t("itemForm.scaleHint")}
                    placeholder={t("itemForm.scaleHintPlaceholder")}
                    value={draft.scaleHint}
                    onChange={(value) => onChangeField("scaleHint", value)}
                  />
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
                <h3 className="text-sm font-semibold text-foreground/70">{t("itemForm.tagTitle")}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {itemTagFields.map((field) => (
                    <TagInput
                      key={field}
                      label={t(`itemForm.tagFields.${field}`)}
                      placeholder={t(`itemForm.tagPlaceholders.${field}`)}
                      values={draft[field]}
                      onChange={(values) => onChangeTags(field, values)}
                      removeLabel={t("itemForm.removeTag")}
                    />
                  ))}
                </div>
              </section>
            </div>
          </form>

          <aside className="scrollbar-autohide flex min-h-0 flex-col overflow-y-auto border-t border-border bg-muted/14 p-4 lg:border-l lg:border-t-0">
            <ItemAssistantPanel
              input={aiInput}
              isPending={aiPending}
              messages={draft.aiMessages}
              referenceImages={aiReferenceImages}
              onAddReferenceImages={onAddAiReferenceImages}
              onChangeInput={onChangeAiInput}
              onRemoveReferenceImage={onRemoveAiReferenceImage}
              onSend={onSendAiMessage}
              t={t}
            />
            <ItemBoardPanel
              draft={draft}
              isPending={boardPending}
              referenceImages={boardReferenceImages}
              onAddReferenceImages={onAddBoardReferenceImages}
              onChangeDrawingStyle={onChangeBoardDrawingStyle}
              onClearImage={onClearBoardImage}
              onGenerate={onGenerateBoard}
              onRemoveReferenceImage={onRemoveBoardReferenceImage}
              onSelectImage={onSelectBoardImage}
              t={t}
            />
            <ItemModelInputImagePanel
              draft={draft}
              isPending={modelInputPending}
              onClear={onClearModelInputImage}
              onGenerate={onGenerateModelInputImage}
              onSelectImage={onSelectModelInputImage}
              t={t}
            />
            <ItemModelPanel
              draft={draft}
              isPending={modelPending}
              progress={modelProgress}
              onChangeExtraParams={onChangeModelExtraParams}
              onGenerate={onGenerateModel}
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

function ItemTextField({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="text-foreground/64">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition placeholder:text-foreground/38 focus:border-primary"
      />
    </label>
  );
}

function TagInput({
  label,
  onChange,
  placeholder,
  removeLabel,
  values
}: {
  label: string;
  onChange: (values: string[]) => void;
  placeholder: string;
  removeLabel: string;
  values: string[];
}) {
  const [input, setInput] = useState("");

  function addTag(rawValue: string) {
    const value = rawValue.trim();

    if (!value) {
      return;
    }

    onChange(Array.from(new Set([...values, value])).slice(0, 30));
    setInput("");
  }

  return (
    <div className="space-y-2 text-sm">
      <label className="block text-foreground/64">{label}</label>
      <div className="min-h-11 rounded-md border border-border bg-background px-2 py-1.5 transition focus-within:border-primary">
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span key={value} className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-foreground/68">
              <span className="truncate">{value}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((item) => item !== value))}
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-foreground/45 transition hover:bg-background hover:text-foreground"
                aria-label={removeLabel}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onBlur={() => addTag(input)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "," || event.key === "，") {
                event.preventDefault();
                addTag(input);
              }

              if (event.key === "Backspace" && !input && values.length > 0) {
                onChange(values.slice(0, -1));
              }
            }}
            placeholder={values.length === 0 ? placeholder : ""}
            className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-foreground/38"
          />
        </div>
      </div>
    </div>
  );
}

function ItemAssistantPanel({
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
  messages: MaskAiMessage[];
  referenceImages: SceneReferenceImageDraft[];
  onAddReferenceImages: (files: FileList | File[]) => void;
  onChangeInput: (value: string) => void;
  onRemoveReferenceImage: (imageId: string) => void;
  onSend: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <section className="flex min-h-[14rem] flex-col border-b border-border/70 pb-4" aria-label={t("itemForm.aiTitle")}>
      <div className="scrollbar-autohide min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg bg-background/72 p-2">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-background/55 p-3 text-xs leading-5 text-foreground/48">
            {t("itemForm.aiEmpty")}
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
        <ReferenceImageStrip
          addLabel={t("itemForm.referenceImageAdd")}
          emptyLabel={t("itemForm.aiReferenceEmpty")}
          images={referenceImages}
          isDisabled={isPending}
          removeLabel={t("itemForm.referenceImageRemove")}
          title={t("itemForm.aiReferenceImages")}
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
          placeholder={t("itemForm.aiPlaceholder")}
          rows={2}
          className="min-h-11 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-5 outline-none transition placeholder:text-foreground/38 focus:border-primary"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={(!input.trim() && referenceImages.length === 0) || isPending}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
          aria-label={t("itemForm.aiSend")}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
}

function ItemBoardPanel({
  draft,
  isPending,
  referenceImages,
  onAddReferenceImages,
  onChangeDrawingStyle,
  onClearImage,
  onGenerate,
  onRemoveReferenceImage,
  onSelectImage,
  t
}: {
  draft: ItemCreateDraft;
  isPending: boolean;
  referenceImages: SceneReferenceImageDraft[];
  onAddReferenceImages: (files: FileList | File[]) => void;
  onChangeDrawingStyle: (style: MaskBoardDrawingStyle) => void;
  onClearImage: () => void;
  onGenerate: () => void;
  onRemoveReferenceImage: (imageId: string) => void;
  onSelectImage: (file: File | null) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <section className="border-b border-border/70 py-4" aria-label={t("itemForm.boardTitle")}>
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <select
          value={draft.boardDrawingStyle}
          onChange={(event) => onChangeDrawingStyle(event.target.value as MaskBoardDrawingStyle)}
          disabled={isPending}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary disabled:opacity-50"
          aria-label={t("itemForm.boardDrawingStyle")}
        >
          {maskBoardDrawingStyles.map((style) => (
            <option key={style} value={style}>
              {t(`maskForm.boardDrawingStyles.${style}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {t("itemForm.boardGenerate")}
        </button>
      </div>
      <div className="mb-3">
        <ReferenceImageStrip
          addLabel={t("itemForm.referenceImageAdd")}
          emptyLabel={t("itemForm.boardReferenceEmpty")}
          images={referenceImages}
          isDisabled={isPending}
          removeLabel={t("itemForm.referenceImageRemove")}
          title={t("itemForm.boardReferenceImages")}
          onAddImages={onAddReferenceImages}
          onRemoveImage={onRemoveReferenceImage}
        />
      </div>
      <label className="group relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background/70 text-left transition hover:border-primary/40">
        {draft.boardImagePreviewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.boardImagePreviewUrl} alt="" className="h-full w-full object-contain" />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onClearImage();
              }}
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground/68 shadow-sm transition hover:bg-background hover:text-foreground"
              aria-label={t("itemForm.boardRemove")}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          <span className="flex flex-col items-center gap-2 px-4 text-center text-sm text-foreground/52">
            <Upload className="h-5 w-5" aria-hidden="true" />
            {t("itemForm.boardEmpty")}
          </span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={t("itemForm.boardUpload")}
          onChange={(event) => {
            onSelectImage(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
      </label>
    </section>
  );
}

function ItemModelInputImagePanel({
  draft,
  isPending,
  onClear,
  onGenerate,
  onSelectImage,
  t
}: {
  draft: ItemCreateDraft;
  isPending: boolean;
  onClear: () => void;
  onGenerate: () => void;
  onSelectImage: (file: File | null) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const image = draft.modelInputImage;

  return (
    <section className="border-b border-border/70 py-4" aria-label={t("itemForm.modelInputTitle")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground/70">{t("itemForm.modelInputTitle")}</h3>
          <p className="mt-0.5 text-xs text-foreground/48">{t("itemForm.modelInputDescription")}</p>
        </div>
        <div className="flex gap-2">
          {image ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium text-foreground/68 transition hover:bg-muted"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("itemForm.clearModelInput")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onGenerate}
            disabled={isPending || !draft.boardImagePreviewUrl}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            {t("itemForm.modelInputGenerate")}
          </button>
        </div>
      </div>
      <label className="group flex min-h-52 cursor-pointer flex-col justify-between overflow-hidden rounded-lg border border-border bg-background/70 text-xs transition hover:border-primary/40">
        <span className="flex items-center justify-between gap-2 px-3 py-2 text-foreground/52">
          <span>{t("itemForm.modelInputUpload")}</span>
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        {image?.previewUrl ? (
          <span className="relative block h-44 w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.previewUrl} alt="" className="h-full w-full object-contain" />
          </span>
        ) : (
          <span className="flex h-44 items-center justify-center px-4 text-center text-foreground/38">
            {t("itemForm.modelInputEmpty")}
          </span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={t("itemForm.modelInputUpload")}
          onChange={(event) => {
            onSelectImage(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
      </label>
    </section>
  );
}

function ItemModelPanel({
  draft,
  isPending,
  onChangeExtraParams,
  onGenerate,
  progress,
  t
}: {
  draft: ItemCreateDraft;
  isPending: boolean;
  onChangeExtraParams: (value: string) => void;
  onGenerate: () => void;
  progress: ItemModelProgress | null;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const canGenerate = isCompleteItemModelInputImageDraft(draft.modelInputImage);

  return (
    <section className="py-4" aria-label={t("itemForm.modelTitle")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground/70">{t("itemForm.modelTitle")}</h3>
          <p className="mt-0.5 text-xs text-foreground/48">{t("itemForm.modelDescription")}</p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isPending || !canGenerate}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Box className="h-3.5 w-3.5" aria-hidden="true" />}
          {t("itemForm.modelGenerate")}
        </button>
      </div>
      <label className="mb-3 block space-y-1.5 text-xs text-foreground/58">
        <span>{t("itemForm.modelExtraParams")}</span>
        <textarea
          value={draft.modelExtraParams}
          onChange={(event) => onChangeExtraParams(event.target.value)}
          placeholder={t("itemForm.modelExtraParamsPlaceholder")}
          rows={2}
          className="min-h-16 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-5 text-foreground outline-none transition placeholder:text-foreground/38 focus:border-primary"
        />
      </label>
      {progress ? (
        <div className="mb-3 rounded-lg border border-border bg-background/70 p-2.5">
          <div className="flex items-center justify-between gap-3 text-xs text-foreground/56">
            <span>{t(progress.messageKey)}</span>
            <span>{progress.progress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.progress}%` }} />
          </div>
        </div>
      ) : null}
      <ItemModelViewer
        closeLabel={t("itemForm.modelPreviewClose")}
        emptyLabel={t("itemForm.modelEmpty")}
        expandLabel={t("itemForm.modelPreviewOpen")}
        loadingLabel={t("itemForm.modelPreviewLoading")}
        modelUrl={draft.model3d?.url ?? ""}
        title={draft.model3d?.fileName ?? t("itemForm.modelTitle")}
      />
    </section>
  );
}
