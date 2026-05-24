import { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizontal, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceMaterialStyle } from "@/lib/home-workspace";
import {
  creatureAbilityFields,
  creatureBehaviorGroups,
  creatureColorFields,
  creatureEcologyFields,
  creatureMorphologyFields,
  creatureSenseFields,
  creatureTaxonomyFields,
  creatureVocalizationFields,
  maskBoardDrawingStyles,
  materialStyles,
  type CreatureAbilityFieldId,
  type CreatureBehaviorFieldId,
  type CreatureColorFieldId,
  type CreatureCreateDraft,
  type CreatureEcologyFieldId,
  type CreatureMorphologyFieldId,
  type CreatureSenseFieldId,
  type CreatureTaxonomyFieldId,
  type CreatureVocalizationFieldId,
  type MaskAiMessage,
  type MaskBoardDrawingStyle,
  type MaskBoardImageSource
} from "./shared";
import { BodyTextField, ColorField, MaskRangeField } from "./form-fields";

export { CreatureCreateDialog };

function CreatureCreateDialog({
  aiInput,
  aiPending,
  boardPending,
  description,
  draft,
  isPending,
  onCancel,
  onChangeAbilityTags,
  onChangeAiInput,
  onChangeBehaviorField,
  onChangeBehaviorLogic,
  onChangeBoardDrawingStyle,
  onChangeColorField,
  onChangeDescription,
  onChangeEcologyField,
  onChangeMorphologyField,
  onChangeName,
  onChangeSenseField,
  onChangeStyle,
  onChangeTaxonomyField,
  onChangeVocalizationField,
  onClearBoardImage,
  onGenerateBoard,
  onSelectBoardImage,
  onSendAiMessage,
  onSubmit,
  saveLabel,
  t,
  title
}: {
  aiInput: string;
  aiPending: boolean;
  boardPending: boolean;
  description: string;
  draft: CreatureCreateDraft;
  isPending: boolean;
  onCancel: () => void;
  onChangeAbilityTags: (fieldId: CreatureAbilityFieldId, values: string[]) => void;
  onChangeAiInput: (value: string) => void;
  onChangeBehaviorField: (fieldId: CreatureBehaviorFieldId, value: number) => void;
  onChangeBehaviorLogic: (value: string) => void;
  onChangeBoardDrawingStyle: (style: MaskBoardDrawingStyle) => void;
  onChangeColorField: (fieldId: CreatureColorFieldId, value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeEcologyField: (fieldId: CreatureEcologyFieldId, value: string) => void;
  onChangeMorphologyField: (fieldId: CreatureMorphologyFieldId, value: string) => void;
  onChangeName: (value: string) => void;
  onChangeSenseField: (fieldId: CreatureSenseFieldId, value: number) => void;
  onChangeStyle: (style: WorkspaceMaterialStyle) => void;
  onChangeTaxonomyField: (fieldId: CreatureTaxonomyFieldId, value: string) => void;
  onChangeVocalizationField: (fieldId: CreatureVocalizationFieldId, value: number) => void;
  onClearBoardImage: () => void;
  onGenerateBoard: () => void;
  onSelectBoardImage: (file: File | null) => void;
  onSendAiMessage: () => void;
  onSubmit: () => void;
  saveLabel: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  title: string;
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
                <h3 className="text-sm font-semibold text-foreground/70">{t("creatureForm.basicTitle")}</h3>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
                  <label className="block space-y-2 text-sm">
                    <span className="text-foreground/64">{t("creatureForm.name")}</span>
                    <input
                      value={draft.name}
                      onChange={(event) => onChangeName(event.target.value)}
                      placeholder={t("creatureForm.namePlaceholder")}
                      className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition placeholder:text-foreground/38 focus:border-primary"
                    />
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span className="text-foreground/64">{t("creatureForm.style")}</span>
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
                  <label htmlFor="creature-description" className="block text-foreground/64">
                    {t("creatureForm.fullDefinition")}
                  </label>
                  <textarea
                    id="creature-description"
                    value={draft.description}
                    onChange={(event) => onChangeDescription(event.target.value)}
                    placeholder={t("creatureForm.fullDefinitionPlaceholder")}
                    rows={5}
                    className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-foreground/38 focus:border-primary"
                  />
                  <span className="block text-xs text-foreground/42">{t("creatureForm.fullDefinitionHint")}</span>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground/70">{t("creatureForm.taxonomyTitle")}</h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {creatureTaxonomyFields.map((field) => (
                    <BodyTextField
                      key={field.id}
                      fieldId={field.id}
                      inputMode="text"
                      label={t(`creatureForm.taxonomyFields.${field.id}.label`)}
                      namespace="creatureForm"
                      options={field.options.map((option) => t(`creatureForm.options.${field.id}.${option}`))}
                      placeholder={t("creatureForm.inputPlaceholder")}
                      value={draft.taxonomy[field.id]}
                      onChange={onChangeTaxonomyField}
                      t={t}
                    />
                  ))}
                  {creatureEcologyFields.map((field) => (
                    <BodyTextField
                      key={field.id}
                      fieldId={field.id}
                      inputMode="text"
                      label={t(`creatureForm.ecologyFields.${field.id}.label`)}
                      namespace="creatureForm"
                      options={field.options.map((option) => t(`creatureForm.options.${field.id}.${option}`))}
                      placeholder={t("creatureForm.inputPlaceholder")}
                      value={draft.ecology[field.id]}
                      onChange={onChangeEcologyField}
                      t={t}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground/70">{t("creatureForm.morphologyTitle")}</h3>
                <p className="text-xs text-foreground/48">{t("creatureForm.morphologyDescription")}</p>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {creatureMorphologyFields.map((field) => {
                    const unit = "unit" in field ? t(`creatureForm.units.${field.unit}`) : undefined;

                    return (
                      <BodyTextField
                        key={field.id}
                        fieldId={field.id}
                        inputMode={unit ? "decimal" : "text"}
                        label={t(`creatureForm.morphologyFields.${field.id}.label`)}
                        namespace="creatureForm"
                        options={field.options.map((option) => t(`creatureForm.options.${field.id}.${option}`))}
                        placeholder={unit ? t("creatureForm.numericPlaceholder") : t("creatureForm.inputPlaceholder")}
                        unit={unit}
                        value={draft.morphology[field.id]}
                        onChange={onChangeMorphologyField}
                        t={t}
                      />
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground/70">{t("creatureForm.colorTitle")}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {creatureColorFields.map((field) => (
                    <ColorField
                      key={field.id}
                      fieldId={field.id}
                      label={t(`creatureForm.colorFields.${field.id}.label`)}
                      namespace="creatureForm"
                      palette={field.swatches}
                      value={draft.colors[field.id]}
                      onChange={onChangeColorField}
                      t={t}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground/70">{t("creatureForm.vocalTitle")}</h3>
                <div className="grid gap-4 xl:grid-cols-2">
                  {creatureVocalizationFields.map((field) => (
                    <MaskRangeField
                      key={field.id}
                      description={t(`creatureForm.vocalFields.${field.id}.description`)}
                      displayValue={t("creatureForm.scoreValue", { value: draft.vocalization[field.id] })}
                      highLabel={t(`creatureForm.vocalFields.${field.id}.high`)}
                      id={`creature-vocal-${field.id}`}
                      label={t(`creatureForm.vocalFields.${field.id}.label`)}
                      lowLabel={t(`creatureForm.vocalFields.${field.id}.low`)}
                      max={field.max}
                      min={field.min}
                      namespace="creatureForm"
                      ticks={["first", "second", "third", "fourth", "fifth"].map((tick) =>
                        t(`creatureForm.vocalFields.${field.id}.ticks.${tick}`)
                      )}
                      value={draft.vocalization[field.id]}
                      onChange={(value) => onChangeVocalizationField(field.id, value)}
                      t={t}
                    />
                  ))}
                  {creatureSenseFields.map((field) => (
                    <MaskRangeField
                      key={field.id}
                      description={t(`creatureForm.senseFields.${field.id}.description`)}
                      displayValue={t("creatureForm.scoreValue", { value: draft.senses[field.id] })}
                      highLabel={t(`creatureForm.senseFields.${field.id}.high`)}
                      id={`creature-sense-${field.id}`}
                      label={t(`creatureForm.senseFields.${field.id}.label`)}
                      lowLabel={t(`creatureForm.senseFields.${field.id}.low`)}
                      max={field.max}
                      min={field.min}
                      namespace="creatureForm"
                      ticks={["first", "second", "third", "fourth", "fifth"].map((tick) =>
                        t(`creatureForm.senseFields.${field.id}.ticks.${tick}`)
                      )}
                      value={draft.senses[field.id]}
                      onChange={(value) => onChangeSenseField(field.id, value)}
                      t={t}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground/70">{t("creatureForm.abilityTitle")}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {creatureAbilityFields.map((field) => (
                    <TagInput
                      key={field}
                      label={t(`creatureForm.abilityFields.${field}`)}
                      placeholder={t(`creatureForm.abilityPlaceholders.${field}`)}
                      values={draft.abilities[field]}
                      removeLabel={t("creatureForm.removeTag")}
                      onChange={(values) => onChangeAbilityTags(field, values)}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground/70">{t("creatureForm.behaviorLogicTitle")}</h3>
                <textarea
                  value={draft.behaviorLogic}
                  onChange={(event) => onChangeBehaviorLogic(event.target.value)}
                  placeholder={t("creatureForm.behaviorLogicPlaceholder")}
                  rows={5}
                  className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-foreground/38 focus:border-primary"
                  aria-label={t("creatureForm.behaviorLogicTitle")}
                />
                <div className="space-y-5">
                  {creatureBehaviorGroups.map((group) => (
                    <div key={group.id} className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/48">
                        {t(`creatureForm.behaviorGroups.${group.id}`)}
                      </h4>
                      <div className="grid gap-4 xl:grid-cols-2">
                        {group.fields.map((fieldId) => (
                          <MaskRangeField
                            key={fieldId}
                            displayValue={t("creatureForm.scoreValue", { value: draft.behavior[fieldId] })}
                            highLabel={t(`creatureForm.behaviorFields.${fieldId}.high`)}
                            id={`creature-behavior-${fieldId}`}
                            label={t(`creatureForm.behaviorFields.${fieldId}.label`)}
                            lowLabel={t(`creatureForm.behaviorFields.${fieldId}.low`)}
                            max={100}
                            min={0}
                            namespace="creatureForm"
                            value={draft.behavior[fieldId]}
                            onChange={(value) => onChangeBehaviorField(fieldId, value)}
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
            <CreatureAssistantPanel
              input={aiInput}
              isPending={aiPending}
              messages={draft.aiMessages}
              onChangeInput={onChangeAiInput}
              onSend={onSendAiMessage}
              t={t}
            />
            <CreatureBoardPanel
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

function CreatureAssistantPanel({
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
    <section className="flex min-h-[18rem] flex-1 flex-col border-b border-border/70 pb-4" aria-label={t("creatureForm.aiTitle")}>
      <div className="scrollbar-autohide min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg bg-background/72 p-2">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-background/55 p-3 text-xs leading-5 text-foreground/48">
            {t("creatureForm.aiEmpty")}
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
          placeholder={t("creatureForm.aiPlaceholder")}
          rows={2}
          className="min-h-11 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-5 outline-none transition placeholder:text-foreground/38 focus:border-primary"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!input.trim() || isPending}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
          aria-label={t("creatureForm.aiSend")}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
}

function CreatureBoardPanel({
  draft,
  isPending,
  onClearImage,
  onChangeDrawingStyle,
  onGenerate,
  onSelectImage,
  t
}: {
  draft: CreatureCreateDraft;
  isPending: boolean;
  onClearImage: () => void;
  onChangeDrawingStyle: (style: MaskBoardDrawingStyle) => void;
  onGenerate: () => void;
  onSelectImage: (file: File | null) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceLabel = draft.boardImageSource ? t(`creatureForm.boardSource.${draft.boardImageSource}`) : "";
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
    <section className="pt-4" aria-label={t("creatureForm.boardTitle")}>
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <label className="block">
          <span className="sr-only">{t("creatureForm.boardDrawingStyle")}</span>
          <select
            value={draft.boardDrawingStyle}
            onChange={(event) => onChangeDrawingStyle(event.target.value as MaskBoardDrawingStyle)}
            className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary"
            aria-label={t("creatureForm.boardDrawingStyle")}
          >
            {maskBoardDrawingStyles.map((style) => (
              <option key={style} value={style}>
                {t(`creatureForm.boardDrawingStyles.${style}`)}
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
          {t("creatureForm.boardGenerate")}
        </button>
      </div>

      <div className="relative">
        {draft.boardImagePreviewUrl ? (
          <>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="group relative flex aspect-video w-full overflow-hidden rounded-xl border border-border bg-background/70 text-left transition hover:border-primary/40"
              aria-label={t("creatureForm.boardPreviewOpen")}
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
              aria-label={t("creatureForm.boardRemove")}
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
              {t("creatureForm.boardEmpty")}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={t("creatureForm.boardUpload")}
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
              alt={t("creatureForm.boardPreviewAlt")}
              className="max-h-[92vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl shadow-foreground/30"
            />
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/90 text-foreground/68 shadow-sm transition hover:bg-background hover:text-foreground"
              aria-label={t("creatureForm.boardPreviewClose")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </section>
        </div>
      ) : null}
    </section>
  );
}
