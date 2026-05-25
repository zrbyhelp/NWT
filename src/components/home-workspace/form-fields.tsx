import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
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

export { BodyTextField, ColorField, MaskRangeField, MaterialVisibilityField, Metric };

function BodyTextField<T extends string>({
  fieldId,
  inputMode,
  label,
  namespace = "maskForm",
  options,
  onChange,
  placeholder,
  t,
  unit,
  value
}: {
  fieldId: T;
  inputMode: "decimal" | "text";
  label: string;
  namespace?: string;
  options: string[];
  onChange: (fieldId: T, value: string) => void;
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
            aria-label={t(`${namespace}.openSuggestions`, { field: label })}
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
            <p className="px-3 py-2 text-xs text-foreground/45">{t(`${namespace}.suggestionsEmpty`)}</p>
          )}
        </div>
      ) : null}
      {options.length > 0 ? (
        <span className="block truncate text-xs text-foreground/42">
          {t(`${namespace}.suggestionsLabel`, { values: options.slice(0, 4).join(" / ") })}
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
  namespace = "maskForm",
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
  namespace?: string;
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
          <span className="font-medium text-foreground/58">{t(`${namespace}.lowValueLabel`)}</span>
          {lowLabel}
        </p>
        <p>
          <span className="font-medium text-foreground/58">{t(`${namespace}.highValueLabel`)}</span>
          {highLabel}
        </p>
      </div>
    </div>
  );
}

function ColorField<T extends string>({
  fieldId,
  label,
  namespace = "maskForm",
  onChange,
  palette,
  t,
  value
}: {
  fieldId: T;
  label: string;
  namespace?: string;
  onChange: (fieldId: T, value: string) => void;
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
            aria-label={t(`${namespace}.colorSwatchLabel`, { color, field: label })}
            title={color}
          />
        ))}
        <label className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs text-foreground/62">
          <span>{t(`${namespace}.pickColor`)}</span>
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(fieldId, event.target.value)}
            className="h-5 w-5 cursor-pointer rounded border-none bg-transparent p-0"
            aria-label={t(`${namespace}.colorPickerLabel`, { field: label })}
          />
        </label>
      </div>
    </div>
  );
}

function MaterialVisibilityField({
  checked,
  description,
  disabled,
  disabledLabel,
  enabledLabel,
  label,
  onChange
}: {
  checked: boolean;
  description?: string;
  disabled?: boolean;
  disabledLabel: string;
  enabledLabel: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const lockedChecked = true;
  const displayedChecked = lockedChecked || checked;
  const canToggle = !lockedChecked && !disabled;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/18 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground/72">
            <Globe2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </h3>
          {description ? <p className="mt-1 text-xs leading-5 text-foreground/48">{description}</p> : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-2">
          <span className="text-xs text-foreground/52">{displayedChecked ? enabledLabel : disabledLabel}</span>
          <button
            type="button"
            role="switch"
            aria-checked={displayedChecked}
            aria-label={label}
            disabled
            onClick={() => {
              if (canToggle) {
                onChange(!checked);
              }
            }}
            className={cn(
              "relative h-6 w-11 rounded-full border transition focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-55",
              displayedChecked ? "border-primary/70 bg-primary" : "border-foreground/28 bg-foreground/36"
            )}
          >
            <span className="absolute inset-0 rounded-full" aria-hidden="true">
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full border border-foreground/18 bg-white shadow-sm transition dark:bg-background",
                  displayedChecked ? "left-[1.375rem]" : "left-0.5"
                )}
              />
            </span>
          </button>
        </span>
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
