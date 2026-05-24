import { useEffect, useState } from "react";
import {
  Check,
  ClipboardList,
  Download,
  Loader2,
  Maximize2,
  Pencil,
  Plus,
  Trash2,
  X
} from "lucide-react";
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
  creatureAbilityFields,
  creatureBehaviorGroups,
  creatureColorFields,
  creatureEcologyFields,
  creatureMorphologyFields,
  creatureSenseFields,
  creatureTaxonomyFields,
  creatureVocalizationFields,
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
  type CreatureBehaviorFieldId,
  type CreatureSenseFieldId,
  type CreatureVocalizationFieldId,
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
import { getCreatureMaterialMetadata, getItemMaterialMetadata, getMaskMaterialMetadata, getNestedRecord, getSceneMaterialMetadata, isCompleteScenePanoramaFaceUrls, normalizeSceneScalePreset } from "./drafts";
import { getMaterialAccent, getScriptAccent, getScriptChats } from "./labels";
import { ItemModelViewer, ScenePanoramaPreviewDialog, ScenePanoramaViewer } from "./viewers";

export { MaterialDetailModal, MaterialExploreCard, ScriptExploreCard };

function ScriptExploreCard({
  isDefault,
  labels,
  librarySourceLabel,
  onOpen,
  rank,
  script,
  showJoined
}: {
  isDefault: boolean;
  labels: { chats: string; creator: string; default: string; joined: string };
  librarySourceLabel?: string;
  onOpen: () => void;
  rank: number;
  script: WorkspaceScript;
  showJoined: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 rounded-2xl bg-muted/34 p-4 text-left transition hover:bg-muted/58"
    >
      <span className={cn("relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-sm", getScriptAccent(script.slug))}>
        <ClipboardList className="h-8 w-8" aria-hidden="true" />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">
          #{rank}
        </span>
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-base font-semibold">{script.title}</span>
          {isDefault ? (
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] text-foreground/50">
              {labels.default}
            </span>
          ) : null}
          {librarySourceLabel ? (
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] text-foreground/50">
              {librarySourceLabel}
            </span>
          ) : null}
          {showJoined && script.inLibrary ? (
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] text-foreground/50">
              {labels.joined}
            </span>
          ) : null}
        </span>
        <span className="mt-1 line-clamp-3 text-sm text-foreground/62">{script.description}</span>
        <span className="mt-2 flex items-center justify-between gap-3 text-xs text-foreground/42">
          <span className="truncate">{labels.creator}</span>
          <span className="shrink-0">{getScriptChats(script.slug)} {labels.chats}</span>
        </span>
      </span>
    </button>
  );
}

function MaterialExploreCard({
  joinedLabel,
  librarySourceLabel,
  material,
  onOpen,
  showJoined,
  styleLabel,
  typeLabel
}: {
  joinedLabel: string;
  librarySourceLabel?: string;
  material: WorkspaceMaterial;
  onOpen: () => void;
  showJoined: boolean;
  styleLabel: string;
  typeLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid gap-4 rounded-2xl border border-border bg-background p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 sm:grid-cols-[8.5rem_minmax(0,1fr)]"
    >
      <MaterialPreview compact material={material} styleLabel={styleLabel} />
      <span className="flex min-h-28 min-w-0 flex-col py-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-base font-semibold">{material.title}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/58">
            {typeLabel}
          </span>
          {librarySourceLabel ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/50">
              {librarySourceLabel}
            </span>
          ) : null}
          {showJoined && material.inLibrary ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/56">
              <Check className="h-3 w-3" aria-hidden="true" />
              {joinedLabel}
            </span>
          ) : null}
        </span>
        <span className="mt-2 line-clamp-3 text-sm leading-6 text-foreground/64">{material.description}</span>
        <span className="mt-auto flex items-center justify-between gap-3 pt-3 text-xs text-foreground/42">
          <span className="truncate">{material.slug}</span>
        </span>
      </span>
    </button>
  );
}

function MaterialDetailModal({
  closeLabel,
  canDelete,
  canEdit,
  canExport,
  canShare,
  deleteLabel,
  editLabel,
  exportLabel,
  isCommunityView,
  isPending,
  joinedLabel,
  joinLabel,
  material,
  onClose,
  onDelete,
  onEdit,
  onExport,
  onJoin,
  onToggleShare,
  previewAlt,
  previewCloseLabel,
  previewOpenLabel,
  shareDisabledLabel,
  shareEnabledLabel,
  shareHint,
  shareLabel,
  sourceLabel,
  styleLabel,
  t,
  typeLabel
}: {
  closeLabel: string;
  canDelete: boolean;
  canEdit: boolean;
  canExport: boolean;
  canShare: boolean;
  deleteLabel: string;
  editLabel: string;
  exportLabel: string;
  isCommunityView: boolean;
  isPending: boolean;
  joinedLabel: string;
  joinLabel: string;
  material: WorkspaceMaterial;
  onClose: () => void;
  onDelete: (material: WorkspaceMaterial) => void;
  onEdit: (material: WorkspaceMaterial) => void;
  onExport: (material: WorkspaceMaterial) => void;
  onJoin: (materialId: string) => void;
  onToggleShare: (material: WorkspaceMaterial, shared: boolean) => void;
  previewAlt: string;
  previewCloseLabel: string;
  previewOpenLabel: string;
  shareDisabledLabel: string;
  shareEnabledLabel: string;
  shareHint: string;
  shareLabel: string;
  sourceLabel?: string;
  styleLabel: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  typeLabel: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const detailPreviewUrl = getMaterialDetailPreviewUrl(material);

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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm">
      <section
        className={cn(
          "flex h-[53rem] max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl",
          material.category === "item" ? "max-w-4xl" : "max-w-xl"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex h-12 shrink-0 justify-end px-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/58 transition hover:bg-muted hover:text-foreground"
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="scrollbar-autohide min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <MaterialPreview
            fit="contain"
            material={material}
            previewUrl={detailPreviewUrl}
            previewAlt={previewAlt}
            previewOpenLabel={previewOpenLabel}
            styleLabel={styleLabel}
            onPreviewOpen={detailPreviewUrl ? () => setPreviewOpen(true) : undefined}
          />
          <div className="mx-auto mt-5 max-w-md text-center">
            <h2 className="text-2xl font-semibold tracking-normal">{material.title}</h2>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/58">
                {styleLabel}
              </span>
              <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/58">
                {typeLabel}
              </span>
              {sourceLabel ? (
                <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/58">
                  {sourceLabel}
                </span>
              ) : null}
              {material.inLibrary ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/58">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {joinedLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-5 text-sm leading-7 text-foreground/72">{material.description}</p>
            <p className="mt-4 text-xs text-foreground/42">{material.slug}</p>
          </div>
          {material.category === "mask" ? <MaskMaterialDetail metadata={material.metadata} t={t} /> : null}
          {material.category === "creature" ? <CreatureMaterialDetail metadata={material.metadata} t={t} /> : null}
          {material.category === "item" ? <ItemMaterialDetail metadata={material.metadata} t={t} /> : null}
          {material.category === "scene" ? <SceneMaterialDetail key={material.id} metadata={material.metadata} t={t} /> : null}
        </div>

        <div className="shrink-0 border-t border-border bg-background px-4 py-3">
          {isCommunityView ? (
            <button
              type="button"
              onClick={() => onJoin(material.id)}
              disabled={isPending || material.inLibrary}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/44"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : material.inLibrary ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              {material.inLibrary ? joinedLabel : joinLabel}
            </button>
          ) : (
            <div className="space-y-2">
              {canShare ? (
                <label className="flex cursor-pointer items-center justify-between gap-3 px-1 py-1.5 text-left">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground/76">{shareLabel}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-foreground/48">{shareHint}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-2">
                    <span className="text-xs text-foreground/52">
                      {material.communityVisible ? shareEnabledLabel : shareDisabledLabel}
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={material.communityVisible}
                      disabled={isPending}
                      onChange={(event) => onToggleShare(material, event.target.checked)}
                      className="peer sr-only"
                      aria-label={shareLabel}
                    />
                    <span
                      className="relative h-6 w-11 rounded-full bg-muted transition after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-background after:shadow-sm after:transition peer-checked:bg-foreground peer-checked:after:translate-x-5 peer-disabled:opacity-45"
                      aria-hidden="true"
                    />
                  </span>
                </label>
              ) : null}
              {canEdit || canDelete || canExport ? (
                <div className="flex flex-wrap gap-2">
                  {canExport ? (
                    <button
                      type="button"
                      onClick={() => onExport(material)}
                      disabled={isPending}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-foreground/44"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      {exportLabel}
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(material)}
                      disabled={isPending}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-foreground/44"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      {editLabel}
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(material)}
                      disabled={isPending}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-foreground/44"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      {deleteLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {previewOpen && detailPreviewUrl ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/32 p-4 backdrop-blur-sm">
            <section className="relative max-h-[92vh] max-w-[92vw]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={detailPreviewUrl}
                alt={previewAlt}
                className="max-h-[92vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl shadow-foreground/30"
              />
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/90 text-foreground/68 shadow-sm transition hover:bg-background hover:text-foreground"
                aria-label={previewCloseLabel}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MaskMaterialDetail({
  metadata,
  t
}: {
  metadata: WorkspaceMaterialMetadata | undefined | null;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const record = getMaskMaterialMetadata(metadata);

  if (!record || record.kind !== "mask") {
    return null;
  }

  const body = getNestedRecord(record.body);
  const colors = getNestedRecord(record.colors);
  const voice = getNestedRecord(record.voice);
  const personality = getNestedRecord(record.personality);

  return (
    <div className="mx-auto mt-8 max-w-md space-y-6 text-left">
      <MaskDetailTextBlock title={t("maskForm.intro")} value={record.intro} />
      <MaskDetailTextBlock title={t("maskForm.features")} value={record.features} preserveLines />
      <MaskDetailKeyValues
        title={t("maskForm.bodyTitle")}
        entries={maskBodyFields.map((field) => ({
          label: t(`maskForm.bodyFields.${field.id}.label`),
          value: getRecordString(body, field.id)
        }))}
      />
      <MaskDetailColors
        title={t("maskForm.colorTitle")}
        entries={maskColorFields.map((field) => ({
          label: t(`maskForm.colorFields.${field.id}.label`),
          value: getRecordString(colors, field.id)
        }))}
      />
      <MaskDetailKeyValues
        title={t("maskForm.voiceTitle")}
        entries={maskVoiceFields.map((field) => ({
          label: t(`maskForm.voiceFields.${field.id}.label`),
          value: getRecordNumber(voice, field.id) === null ? "" : getMaskVoiceDetailLabel(field.id, getRecordNumber(voice, field.id) ?? 0, t)
        }))}
      />
      <MaskDetailKeyValues
        title={t("maskForm.personalityTitle")}
        entries={maskPersonalityGroups.flatMap((group) =>
          group.fields.map((fieldId) => ({
            label: t(`maskForm.personalityFields.${fieldId}.label`),
            value:
              getRecordNumber(personality, fieldId) === null
                ? ""
                : getMaskPersonalityDetailLabel(fieldId, getRecordNumber(personality, fieldId) ?? 0, t)
          }))
        )}
      />
    </div>
  );
}

function CreatureMaterialDetail({
  metadata,
  t
}: {
  metadata: WorkspaceMaterialMetadata | undefined | null;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const record = getCreatureMaterialMetadata(metadata);

  if (!record || record.kind !== "creature") {
    return null;
  }

  const taxonomy = getNestedRecord(record.taxonomy);
  const morphology = getNestedRecord(record.morphology);
  const colors = getNestedRecord(record.colors);
  const vocalization = getNestedRecord(record.vocalization);
  const senses = getNestedRecord(record.senses);
  const ecology = getNestedRecord(record.ecology);
  const behavior = getNestedRecord(record.behavior);

  return (
    <div className="mx-auto mt-8 max-w-md space-y-6 text-left">
      <MaskDetailTextBlock title={t("creatureForm.fullDefinition")} value={record.description} preserveLines />
      <MaskDetailKeyValues
        title={t("creatureForm.taxonomyTitle")}
        entries={[
          ...creatureTaxonomyFields.map((field) => ({
            label: t(`creatureForm.taxonomyFields.${field.id}.label`),
            value: getRecordString(taxonomy, field.id)
          })),
          ...creatureEcologyFields.map((field) => ({
            label: t(`creatureForm.ecologyFields.${field.id}.label`),
            value: getRecordString(ecology, field.id)
          }))
        ]}
      />
      <MaskDetailKeyValues
        title={t("creatureForm.morphologyTitle")}
        entries={creatureMorphologyFields.map((field) => ({
          label: t(`creatureForm.morphologyFields.${field.id}.label`),
          value: getRecordString(morphology, field.id)
        }))}
      />
      <MaskDetailColors
        title={t("creatureForm.colorTitle")}
        entries={creatureColorFields.map((field) => ({
          label: t(`creatureForm.colorFields.${field.id}.label`),
          value: getRecordString(colors, field.id)
        }))}
      />
      <MaskDetailKeyValues
        title={t("creatureForm.vocalTitle")}
        entries={[
          ...creatureVocalizationFields.map((field) => ({
            label: t(`creatureForm.vocalFields.${field.id}.label`),
            value:
              getRecordNumber(vocalization, field.id) === null
                ? ""
                : getCreatureVocalDetailLabel(field.id, getRecordNumber(vocalization, field.id) ?? 0, t)
          })),
          ...creatureSenseFields.map((field) => ({
            label: t(`creatureForm.senseFields.${field.id}.label`),
            value:
              getRecordNumber(senses, field.id) === null
                ? ""
                : getCreatureSenseDetailLabel(field.id, getRecordNumber(senses, field.id) ?? 0, t)
          }))
        ]}
      />
      <CreatureDetailTags
        title={t("creatureForm.abilityTitle")}
        groups={creatureAbilityFields.map((field) => ({
          label: t(`creatureForm.abilityFields.${field}`),
          values: record.abilities[field]
        }))}
      />
      <MaskDetailTextBlock title={t("creatureForm.behaviorLogicTitle")} value={record.behaviorLogic} preserveLines />
      <MaskDetailKeyValues
        title={t("creatureForm.behaviorTendencyTitle")}
        entries={creatureBehaviorGroups.flatMap((group) =>
          group.fields.map((fieldId) => ({
            label: t(`creatureForm.behaviorFields.${fieldId}.label`),
            value:
              getRecordNumber(behavior, fieldId) === null
                ? ""
                : getCreatureBehaviorDetailLabel(fieldId, getRecordNumber(behavior, fieldId) ?? 0, t)
          }))
        )}
      />
      {record.boardImage?.url ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground/72">{t("creatureForm.boardTitle")}</h3>
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={record.boardImage.url} alt="" loading="lazy" decoding="async" className="aspect-video w-full object-contain" />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ItemMaterialDetail({
  metadata,
  t
}: {
  metadata: WorkspaceMaterialMetadata | undefined | null;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const record = getItemMaterialMetadata(metadata);
  const modelInputImageUrl = record?.modelInputImage?.url?.trim() ?? "";
  const viewImages = record
    ? scenePanoramaFaces.reduce<Partial<Record<ItemViewFace, string>>>((result, face) => {
        const url = record.viewImages?.[face]?.url ?? "";

        if (url) {
          result[face] = url;
        }

        return result;
      }, {})
    : {};
  const hasViews = scenePanoramaFaces.some((face) => Boolean(viewImages[face]));

  if (!record || record.kind !== "item") {
    return null;
  }

  return (
    <div className="mx-auto mt-8 max-w-3xl space-y-6 text-left">
      <MaskDetailTextBlock title={t("itemForm.itemDescription")} value={record.description} preserveLines />
      <MaskDetailKeyValues
        title={t("itemForm.basicTitle")}
        entries={[
          { label: t("itemForm.category"), value: record.itemCategory },
          { label: t("itemForm.brand"), value: record.brand },
          { label: t("itemForm.model"), value: record.model },
          { label: t("itemForm.scaleHint"), value: record.scaleHint }
        ]}
      />
      <ItemDetailTags
        groups={itemTagFields.map((field) => ({
          label: t(`itemForm.tagFields.${field}`),
          values: record[field]
        }))}
      />
      {record.boardImage?.url ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground/72">{t("itemForm.boardTitle")}</h3>
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={record.boardImage.url} alt="" loading="lazy" decoding="async" className="aspect-video w-full object-contain" />
          </div>
        </section>
      ) : null}
      {modelInputImageUrl ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground/72">{t("itemForm.modelInputTitle")}</h3>
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={modelInputImageUrl} alt="" loading="lazy" decoding="async" className="aspect-square w-full object-contain" />
          </div>
        </section>
      ) : null}
      {hasViews ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground/72">{t("itemForm.legacyViewsTitle")}</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
            {scenePanoramaFaces.map((face) => (
              <div key={face} className="overflow-hidden rounded-lg border border-border bg-background">
                <div className="flex items-center justify-between px-2 py-1.5 text-xs text-foreground/52">
                  <span>{t(`itemForm.faces.${face}`)}</span>
                </div>
                {viewImages[face] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={viewImages[face]} alt="" loading="lazy" decoding="async" className="aspect-square w-full object-contain" />
                ) : (
                  <div className="grid aspect-square place-items-center bg-muted/40 px-3 text-center text-xs text-foreground/38">
                    {t("itemForm.viewEmpty")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {record.model3d?.url ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground/72">{t("itemForm.modelTitle")}</h3>
          <div className="mt-3">
            <ItemModelViewer
              closeLabel={t("itemForm.modelPreviewClose")}
              emptyLabel={t("itemForm.modelEmpty")}
              expandLabel={t("itemForm.modelPreviewOpen")}
              loadingLabel={t("itemForm.modelPreviewLoading")}
              modelUrl={record.model3d.url}
              title={record.model3d.fileName ?? t("itemForm.modelTitle")}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ItemDetailTags({
  groups
}: {
  groups: Array<{ label: string; values: string[] }>;
}) {
  const visibleGroups = groups.filter((group) => group.values.length > 0);

  if (visibleGroups.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      {visibleGroups.map((group) => (
        <div key={group.label}>
          <h3 className="text-sm font-semibold text-foreground/72">{group.label}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {group.values.map((value) => (
              <span key={value} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/58">
                {value}
              </span>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function CreatureDetailTags({
  groups,
  title
}: {
  groups: Array<{ label: string; values: string[] }>;
  title: string;
}) {
  const visibleGroups = groups.filter((group) => group.values.length > 0);

  if (visibleGroups.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground/72">{title}</h3>
      <div className="mt-3 space-y-3">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="text-xs text-foreground/42">{group.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {group.values.map((value) => (
                <span key={value} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/58">
                  {value}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SceneMaterialDetail({
  metadata,
  t
}: {
  metadata: WorkspaceMaterialMetadata | undefined | null;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const record = getSceneMaterialMetadata(metadata);
  const [activeBlockId, setActiveBlockId] = useState(record?.blocks[0]?.id ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!record || record.kind !== "scene") {
    return null;
  }

  const activeBlock = record.blocks.find((block) => block.id === activeBlockId) ?? record.blocks[0];
  const faces = activeBlock?.panorama
    ? scenePanoramaFaces.reduce<Record<ScenePanoramaFace, string>>((result, face) => {
        result[face] = activeBlock.panorama?.faces?.[face]?.url ?? "";

        return result;
      }, {} as Record<ScenePanoramaFace, string>)
    : null;
  const completeFaces = faces && isCompleteScenePanoramaFaceUrls(faces) ? faces : null;

  return (
    <div className="mx-auto mt-8 max-w-md space-y-6 text-left">
      <MaskDetailTextBlock title={t("sceneForm.sceneDescription")} value={record.description} preserveLines />
      <section>
        <div className="mb-3 flex flex-wrap gap-2">
          {record.blocks.map((block) => (
            <button
              key={block.id}
              type="button"
              onClick={() => setActiveBlockId(block.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                block.id === activeBlock?.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-foreground/58 hover:bg-muted"
              )}
            >
              {block.name}
            </button>
          ))}
        </div>
        {activeBlock ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground/72">{activeBlock.name}</h3>
              <p className="mt-1 text-xs text-foreground/48">
                {t("sceneForm.blockScaleDetail", {
                  scale: t(`sceneForm.blockScalePresets.${normalizeSceneScalePreset(activeBlock.scalePreset)}`, {
                    meters: sceneScalePresets.find((preset) => preset.id === normalizeSceneScalePreset(activeBlock.scalePreset))?.meters ?? 25
                  })
                })}
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-foreground/68">{activeBlock.description}</p>
            </div>
            <ScenePanoramaViewer
              faces={completeFaces}
              emptyLabel={t("sceneForm.panoramaEmpty")}
              expandLabel={t("sceneForm.panoramaPreviewOpen")}
              loadingLabel={t("sceneForm.panoramaPreviewLoading")}
              onExpand={completeFaces ? () => setPreviewOpen(true) : undefined}
            />
          </div>
        ) : null}
      </section>
      {previewOpen && completeFaces ? (
        <ScenePanoramaPreviewDialog
          faces={completeFaces}
          onClose={() => setPreviewOpen(false)}
          t={t}
        />
      ) : null}
    </div>
  );
}

function MaskDetailTextBlock({
  preserveLines,
  title,
  value
}: {
  preserveLines?: boolean;
  title: string;
  value: unknown;
}) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground/72">{title}</h3>
      <p className={cn("mt-2 text-sm leading-7 text-foreground/68", preserveLines ? "whitespace-pre-line" : "")}>
        {value.trim()}
      </p>
    </section>
  );
}

function getRecordString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];

  return typeof value === "string" ? value : "";
}

function getRecordNumber(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getMaskVoiceDetailLabel(
  fieldId: MaskVoiceFieldId,
  value: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return t(`maskForm.voiceFields.${fieldId}.ticks.${getTraitTickKey(value, getMaskVoiceRange(fieldId))}`);
}

function getMaskPersonalityDetailLabel(
  fieldId: MaskPersonalityFieldId,
  value: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  const level = getTraitLevel(value);

  if (level === "balanced") {
    return t("maskForm.detailTraitLevels.balanced");
  }

  const direction = level === "veryLow" || level === "low" ? "low" : "high";

  return t(`maskForm.detailTraitLevels.${level}`, {
    description: t(`maskForm.personalityFields.${fieldId}.${direction}`)
  });
}

function getCreatureVocalDetailLabel(
  fieldId: CreatureVocalizationFieldId,
  value: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return t(`creatureForm.vocalFields.${fieldId}.ticks.${getTraitTickKey(value, getCreatureVocalRange(fieldId))}`);
}

function getCreatureSenseDetailLabel(
  fieldId: CreatureSenseFieldId,
  value: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return t(`creatureForm.senseFields.${fieldId}.ticks.${getTraitTickKey(value, getCreatureSenseRange(fieldId))}`);
}

function getCreatureBehaviorDetailLabel(
  fieldId: CreatureBehaviorFieldId,
  value: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  const level = getTraitLevel(value);

  if (level === "balanced") {
    return t("creatureForm.detailTraitLevels.balanced");
  }

  const direction = level === "veryLow" || level === "low" ? "low" : "high";

  return t(`creatureForm.detailTraitLevels.${level}`, {
    description: t(`creatureForm.behaviorFields.${fieldId}.${direction}`)
  });
}

function getMaskVoiceRange(fieldId: MaskVoiceFieldId) {
  return maskVoiceFields.find((field) => field.id === fieldId) ?? { min: 0, max: 100 };
}

function getCreatureVocalRange(fieldId: CreatureVocalizationFieldId) {
  return creatureVocalizationFields.find((field) => field.id === fieldId) ?? { min: 0, max: 100 };
}

function getCreatureSenseRange(fieldId: CreatureSenseFieldId) {
  return creatureSenseFields.find((field) => field.id === fieldId) ?? { min: 0, max: 100 };
}

function getTraitTickKey(value: number, range: { min: number; max: number }) {
  const normalizedValue = getNormalizedTraitValue(value, range);

  if (normalizedValue <= 20) {
    return "first";
  }

  if (normalizedValue <= 40) {
    return "second";
  }

  if (normalizedValue <= 60) {
    return "third";
  }

  if (normalizedValue <= 80) {
    return "fourth";
  }

  return "fifth";
}

function getTraitLevel(value: number) {
  const normalizedValue = getNormalizedTraitValue(value, { min: 0, max: 100 });

  if (normalizedValue <= 15) {
    return "veryLow";
  }

  if (normalizedValue <= 35) {
    return "low";
  }

  if (normalizedValue < 65) {
    return "balanced";
  }

  if (normalizedValue < 85) {
    return "high";
  }

  return "veryHigh";
}

function getNormalizedTraitValue(value: number, range: { min: number; max: number }) {
  if (range.max <= range.min) {
    return 50;
  }

  return Math.min(100, Math.max(0, ((value - range.min) / (range.max - range.min)) * 100));
}

function MaskDetailKeyValues({
  entries,
  title
}: {
  entries: Array<{ label: string; value: string | number }>;
  title: string;
}) {
  const visibleEntries = entries.filter((entry) => String(entry.value).trim());

  if (visibleEntries.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground/72">{title}</h3>
      <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {visibleEntries.map((entry) => (
          <div key={entry.label} className="min-w-0">
            <dt className="text-xs text-foreground/42">{entry.label}</dt>
            <dd className="mt-0.5 break-words text-sm text-foreground/72">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MaskDetailColors({
  entries,
  title
}: {
  entries: Array<{ label: string; value: string }>;
  title: string;
}) {
  const visibleEntries = entries.filter((entry) => /^#[0-9a-f]{6}$/i.test(entry.value));

  if (visibleEntries.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground/72">{title}</h3>
      <dl className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {visibleEntries.map((entry) => (
          <div key={entry.label} className="flex min-w-0 items-center gap-2">
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-border shadow-sm"
              style={{ backgroundColor: entry.value }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="text-xs text-foreground/42">{entry.label}</dt>
              <dd className="text-sm font-medium text-foreground/72">{entry.value.toUpperCase()}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MaterialPreview({
  compact,
  fit = "cover",
  material,
  onPreviewOpen,
  previewUrl,
  previewAlt,
  previewOpenLabel,
  styleLabel
}: {
  compact?: boolean;
  fit?: "cover" | "contain";
  material: WorkspaceMaterial;
  onPreviewOpen?: () => void;
  previewUrl?: string | null;
  previewAlt?: string;
  previewOpenLabel?: string;
  styleLabel: string;
}) {
  const Icon = materialIcons[material.category];
  const previewClassName = fit === "contain" ? "object-contain" : "object-cover";
  const resolvedPreviewUrl = previewUrl === undefined ? material.previewUrl : previewUrl;
  const hasPreview = Boolean(resolvedPreviewUrl);

  return (
    <span
      className={cn(
        "relative flex w-full shrink-0 items-center justify-center overflow-hidden rounded-xl",
        compact ? "h-28" : "aspect-video",
        hasPreview
          ? "bg-muted/25 text-foreground shadow-sm ring-1 ring-border/70"
          : cn("text-white shadow-inner", getMaterialAccent(material.category))
      )}
    >
      {resolvedPreviewUrl ? (
        onPreviewOpen ? (
          <button
            type="button"
            onClick={onPreviewOpen}
            className="group relative h-full w-full cursor-zoom-in overflow-hidden"
            aria-label={previewOpenLabel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolvedPreviewUrl} alt="" className={cn("h-full w-full bg-background", previewClassName)} />
            <span className="absolute inset-0 bg-foreground/0 transition group-hover:bg-foreground/5" aria-hidden="true" />
            <span className="absolute right-2 top-2 rounded-full bg-background/88 p-1.5 text-foreground shadow-sm">
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </button>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={resolvedPreviewUrl} alt={previewAlt ?? ""} className={cn("h-full w-full bg-background", previewClassName)} />
        )
      ) : (
        <>
          <span
            className="absolute inset-0 opacity-25 [background-image:linear-gradient(135deg,hsl(var(--background)/0.22)_0_25%,transparent_25%_50%,hsl(var(--background)/0.22)_50%_75%,transparent_75%)] [background-size:1.1rem_1.1rem]"
            aria-hidden="true"
          />
          <Icon className={cn("relative drop-shadow", compact ? "h-9 w-9" : "h-14 w-14")} aria-hidden="true" />
        </>
      )}
      <span className="absolute left-2 top-2 rounded-full bg-background/88 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm">
        {styleLabel}
      </span>
    </span>
  );
}

function getMaterialDetailPreviewUrl(material: WorkspaceMaterial) {
  if (material.category === "item") {
    const item = getItemMaterialMetadata(material.metadata);
    const boardUrl = item?.boardImage?.url?.trim();
    const modelInputUrl = item?.modelInputImage?.url?.trim();
    const frontUrl = item?.viewImages?.front?.url?.trim();

    return boardUrl || modelInputUrl || frontUrl || (item ? null : material.previewUrl);
  }

  if (material.category === "creature") {
    const creature = getCreatureMaterialMetadata(material.metadata);
    const boardUrl = creature?.boardImage?.url?.trim();

    return boardUrl || material.previewUrl;
  }

  if (material.category !== "scene") {
    return material.previewUrl;
  }

  const scene = getSceneMaterialMetadata(material.metadata);
  const firstBlockPanorama = scene?.blocks[0]?.panorama;
  const motherUrl = firstBlockPanorama?.mother?.url?.trim();
  const frontUrl = firstBlockPanorama?.faces?.front?.url?.trim();

  return motherUrl || frontUrl || (scene ? null : material.previewUrl);
}
