import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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
import { getRangeLevelIndex } from "./labels";

export { BodyTextField, ColorField, MaskRangeField, Metric };

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
