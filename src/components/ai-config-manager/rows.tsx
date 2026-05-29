"use client";

import { CheckCircle2, Edit3, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  AiProviderView,
  ImageModelView,
  InstantMeshConfigView,
  LlmModelView,
  VoiceModelView,
  VectorModelView
} from "@/lib/ai/config-types";
import { cn } from "@/lib/utils";

export function ProviderRow({
  onDelete,
  onEdit,
  provider
}: {
  onDelete: () => void;
  onEdit: () => void;
  provider: AiProviderView;
}) {
  const t = useTranslations("home.settings.ai");

  return (
    <article className="px-2 py-3 transition hover:bg-muted/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium">{provider.name}</h4>
            <StatusBadge active={provider.enabled} activeText={t("common.enabled")} inactiveText={t("common.disabled")} />
            <StatusBadge active={provider.hasApiKey} activeText={t("common.secretReady")} inactiveText={t("common.secretMissing")} />
          </div>
          <p className="mt-1 truncate text-xs text-foreground/46">{provider.slug}</p>
          <p className="mt-2 break-all text-sm text-foreground/62">{provider.baseUrl}</p>
          <p className="mt-2 text-xs text-foreground/46">{t("providers.modelCount", { count: provider.modelCount })}</p>
        </div>
        <RowActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </article>
  );
}

export function LlmRow({
  model,
  canManage,
  onDelete,
  onEdit,
  onSetDefault
}: {
  model: LlmModelView;
  canManage: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  const t = useTranslations("home.settings.ai");

  return (
    <ModelRow
      title={model.displayName}
      subtitle={`${model.providerName} / ${model.modelId}`}
      meta={t("llm.meta", { temperature: model.temperature })}
      enabled={model.enabled && model.providerEnabled}
      providerEnabled={model.providerEnabled}
      isDefault={model.isDefault}
      isGlobal={model.isGlobal}
      canManage={canManage}
      onDelete={onDelete}
      onEdit={onEdit}
      onSetDefault={onSetDefault}
    />
  );
}

export function VectorRow({
  model,
  canManage,
  onDelete,
  onEdit,
  onSetDefault
}: {
  model: VectorModelView;
  canManage: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  const t = useTranslations("home.settings.ai");

  return (
    <ModelRow
      title={model.displayName}
      subtitle={`${model.providerName} / ${model.modelId}`}
      meta={t("vectors.meta", { dimensions: model.dimensions, tokens: model.maxInputTokens })}
      enabled={model.enabled && model.providerEnabled}
      providerEnabled={model.providerEnabled}
      isDefault={model.isDefault}
      isGlobal={model.isGlobal}
      canManage={canManage}
      onDelete={onDelete}
      onEdit={onEdit}
      onSetDefault={onSetDefault}
    />
  );
}

export function ImageRow({
  model,
  canManage,
  onDelete,
  onEdit,
  onSetDefault
}: {
  model: ImageModelView;
  canManage: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  const t = useTranslations("home.settings.ai");

  return (
    <ModelRow
      title={model.displayName}
      subtitle={`${model.providerName} / ${model.modelId}`}
      meta={t("images.meta")}
      enabled={model.enabled && model.providerEnabled}
      providerEnabled={model.providerEnabled}
      isDefault={model.isDefault}
      isGlobal={model.isGlobal}
      canManage={canManage}
      onDelete={onDelete}
      onEdit={onEdit}
      onSetDefault={onSetDefault}
    />
  );
}

export function VoiceRow({
  model,
  canManage,
  onDelete,
  onEdit,
  onSetDefault
}: {
  model: VoiceModelView;
  canManage: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  const t = useTranslations("home.settings.ai");

  return (
    <ModelRow
      title={model.displayName}
      subtitle={`${model.providerName} / ${model.modelId}`}
      meta={t("voices.meta")}
      enabled={model.enabled && model.providerEnabled}
      providerEnabled={model.providerEnabled}
      isDefault={model.isDefault}
      isGlobal={model.isGlobal}
      canManage={canManage}
      onDelete={onDelete}
      onEdit={onEdit}
      onSetDefault={onSetDefault}
    />
  );
}

export function InstantMeshRow({
  config,
  onDelete,
  onEdit,
  onSetDefault
}: {
  config: InstantMeshConfigView;
  onDelete: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  const t = useTranslations("home.settings.ai");

  return (
    <ModelRow
      title={config.name}
      subtitle={`${config.baseUrl}${config.submitPath}`}
      meta={t("instantMesh.meta", { interval: config.pollIntervalMs, timeout: config.timeoutSeconds })}
      enabled={config.enabled}
      providerEnabled={config.enabled}
      isDefault={config.isDefault}
      isGlobal={false}
      canManage={true}
      onDelete={onDelete}
      onEdit={onEdit}
      onSetDefault={onSetDefault}
    />
  );
}

function ModelRow({
  enabled,
  canManage,
  isGlobal,
  isDefault,
  meta,
  onDelete,
  onEdit,
  onSetDefault,
  providerEnabled,
  subtitle,
  title
}: {
  enabled: boolean;
  canManage: boolean;
  isDefault: boolean;
  isGlobal: boolean;
  meta: string;
  onDelete: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
  providerEnabled: boolean;
  subtitle: string;
  title: string;
}) {
  const t = useTranslations("home.settings.ai");

  return (
    <article className="px-2 py-3 transition hover:bg-muted/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium">{title}</h4>
            {isDefault ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {t("common.default")}
              </span>
            ) : null}
            {isGlobal ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
                {t("common.global")}
              </span>
            ) : null}
            <StatusBadge active={enabled} activeText={t("common.enabled")} inactiveText={t("common.disabled")} />
          </div>
          <p className="mt-1 truncate text-xs text-foreground/46">{subtitle}</p>
          <p className="mt-2 text-sm text-foreground/62">{meta}</p>
          {!providerEnabled ? <p className="mt-2 text-xs text-accent">{t("common.providerDisabled")}</p> : null}
          {!canManage ? <p className="mt-2 text-xs text-foreground/46">{t("common.globalReadOnly")}</p> : null}
        </div>
        <RowActions
          canSetDefault={canManage && enabled && !isDefault}
          canManage={canManage}
          isDefault={isDefault}
          onDelete={onDelete}
          onEdit={onEdit}
          onSetDefault={onSetDefault}
        />
      </div>
    </article>
  );
}

function RowActions({
  canSetDefault,
  canManage,
  isDefault,
  onDelete,
  onEdit,
  onSetDefault
}: {
  canSetDefault?: boolean;
  canManage?: boolean;
  isDefault?: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onSetDefault?: () => void;
}) {
  const t = useTranslations("home.settings.ai");
  const defaultActionTitle = isDefault ? t("common.default") : canSetDefault ? t("common.setDefault") : t("common.defaultUnavailable");

  if (!canManage) {
    return null;
  }

  return (
    <div className="flex shrink-0 gap-1">
      {onSetDefault ? (
        <button
          type="button"
          onClick={onSetDefault}
          disabled={!canSetDefault}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-not-allowed",
            isDefault
              ? "bg-primary/10 text-primary"
              : "text-foreground/60 hover:bg-muted hover:text-primary disabled:bg-transparent disabled:text-foreground/28"
          )}
          title={defaultActionTitle}
          aria-label={defaultActionTitle}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 transition hover:bg-muted hover:text-foreground"
        title={t("common.edit")}
      >
        <Edit3 className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 transition hover:bg-muted hover:text-accent"
        title={t("common.delete")}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function StatusBadge({
  active,
  activeText,
  inactiveText
}: {
  active: boolean;
  activeText: string;
  inactiveText: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs",
        active ? "bg-primary/10 text-primary" : "bg-muted text-foreground/48"
      )}
    >
      {active ? activeText : inactiveText}
    </span>
  );
}
