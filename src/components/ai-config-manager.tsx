"use client";

import {
  Bot,
  CheckCircle2,
  DatabaseZap,
  Edit3,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
  XCircle
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteHomeAiProvider,
  deleteHomeLlmModel,
  deleteHomeVectorModel,
  getHomeAiConfig,
  saveHomeAiProvider,
  saveHomeLlmModel,
  saveHomeVectorModel
} from "@/app/[locale]/actions";
import type {
  AiConfigSnapshot,
  AiProviderInput,
  AiProviderView,
  LlmModelInput,
  LlmModelView,
  VectorModelInput,
  VectorModelView
} from "@/lib/ai/config-types";
import { cn } from "@/lib/utils";

type AiConfigMode = "providers" | "llm" | "vectors";

type ProviderForm = AiProviderInput & {
  id?: string;
};

type LlmForm = LlmModelInput & {
  id?: string;
};

type VectorForm = VectorModelInput & {
  id?: string;
};

const emptyProviderForm: ProviderForm = {
  name: "",
  slug: "",
  baseUrl: "",
  apiKey: "",
  clearApiKey: false,
  enabled: true
};

const emptyLlmForm: LlmForm = {
  providerId: "",
  displayName: "",
  modelId: "",
  contextWindow: 128000,
  temperature: 0.7,
  enabled: true,
  isDefault: false
};

const emptyVectorForm: VectorForm = {
  providerId: "",
  displayName: "",
  modelId: "",
  dimensions: 1536,
  maxInputTokens: 8192,
  enabled: true,
  isDefault: false
};

export function AiConfigManager({ mode }: { mode: AiConfigMode }) {
  const t = useTranslations("home.settings.ai");
  const [config, setConfig] = useState<AiConfigSnapshot | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [providerForm, setProviderForm] = useState<ProviderForm>(emptyProviderForm);
  const [llmForm, setLlmForm] = useState<LlmForm>(emptyLlmForm);
  const [vectorForm, setVectorForm] = useState<VectorForm>(emptyVectorForm);
  const [formDialog, setFormDialog] = useState<AiConfigMode | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeProviders = useMemo(() => config?.providers.filter((provider) => provider.enabled) ?? [], [config]);

  function applyConfigSnapshot(snapshot: AiConfigSnapshot) {
    const firstProviderId = snapshot.providers[0]?.id ?? "";

    setConfig(snapshot);

    if (firstProviderId) {
      setLlmForm((current) => (current.providerId ? current : { ...current, providerId: firstProviderId }));
      setVectorForm((current) => (current.providerId ? current : { ...current, providerId: firstProviderId }));
    }
  }

  useEffect(() => {
    let mounted = true;

    getHomeAiConfig()
      .then((snapshot) => {
        if (!mounted) {
          return;
        }

        applyConfigSnapshot(snapshot);
        setLoadError(false);
      })
      .catch(() => {
        if (mounted) {
          setLoadError(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  function runAction(action: () => Promise<AiConfigSnapshot>, successMessage: string, onSuccess?: () => void) {
    startTransition(async () => {
      try {
        const snapshot = await action();
        applyConfigSnapshot(snapshot);
        toast.success(successMessage);
        onSuccess?.();
      } catch (error) {
        toast.error(resolveErrorMessage(error, t));
      }
    });
  }

  function resetProviderForm() {
    setProviderForm(emptyProviderForm);
  }

  function resetLlmForm() {
    setLlmForm({ ...emptyLlmForm, providerId: config?.providers[0]?.id ?? "" });
  }

  function resetVectorForm() {
    setVectorForm({ ...emptyVectorForm, providerId: config?.providers[0]?.id ?? "" });
  }

  if (loadError) {
    return (
      <EmptyState
        icon={XCircle}
        title={t("errors.loadTitle")}
        description={t("errors.loadDescription")}
      />
    );
  }

  if (!config) {
    return (
      <div className="flex min-h-72 items-center justify-center text-sm text-foreground/58">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        {t("common.loading")}
      </div>
    );
  }

  if (mode === "providers") {
    return (
      <>
        <AiConfigLayout
          eyebrow={t("providers.eyebrow")}
          title={t("providers.title")}
          description={t("providers.description")}
          actionLabel={t("providers.createTitle")}
          onCreate={() => {
            resetProviderForm();
            setFormDialog("providers");
          }}
          list={
            config.providers.length === 0 ? (
              <EmptyState icon={KeyRound} title={t("providers.emptyTitle")} description={t("providers.emptyDescription")} />
            ) : (
              <div className="divide-y divide-border/70 border-y border-border/70">
                {config.providers.map((provider) => (
                  <ProviderRow
                    key={provider.id}
                    provider={provider}
                    onEdit={() => {
                      setProviderForm({
                        id: provider.id,
                        name: provider.name,
                        slug: provider.slug,
                        baseUrl: provider.baseUrl,
                        apiKey: "",
                        clearApiKey: false,
                        enabled: provider.enabled
                      });
                      setFormDialog("providers");
                    }}
                    onDelete={() => {
                      if (provider.modelCount > 0) {
                        toast.error(t("errors.providerHasModels"));
                        return;
                      }

                      if (!window.confirm(t("providers.deleteConfirm", { name: provider.name }))) {
                        return;
                      }

                      runAction(() => deleteHomeAiProvider(provider.id), t("common.deleted"));
                    }}
                  />
                ))}
              </div>
            )
          }
        />
        {formDialog === "providers" ? (
          <FormDialog
            title={providerForm.id ? t("providers.editTitle") : t("providers.createTitle")}
            onClose={() => {
              resetProviderForm();
              setFormDialog(null);
            }}
          >
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                runAction(() => saveHomeAiProvider(providerForm), t("common.saved"), () => {
                  resetProviderForm();
                  setFormDialog(null);
                });
              }}
            >
              <FormHeader icon={providerForm.id ? Edit3 : Plus} title={providerForm.id ? t("providers.editTitle") : t("providers.createTitle")} />
              <TextField label={t("fields.name")} value={providerForm.name} onChange={(value) => setProviderForm((current) => ({ ...current, name: value }))} required />
              <TextField label={t("fields.slug")} value={providerForm.slug} onChange={(value) => setProviderForm((current) => ({ ...current, slug: value }))} required />
              <TextField
                label={t("fields.baseUrl")}
                value={providerForm.baseUrl}
                onChange={(value) => setProviderForm((current) => ({ ...current, baseUrl: value }))}
                placeholder="https://api.example.com/v1"
                required
              />
              <TextField
                label={t("fields.apiKey")}
                type="password"
                value={providerForm.apiKey ?? ""}
                onChange={(value) => setProviderForm((current) => ({ ...current, apiKey: value, clearApiKey: false }))}
                placeholder={providerForm.id ? t("providers.apiKeyPlaceholder") : ""}
              />
              {providerForm.id ? (
                <CheckboxField
                  label={t("fields.clearApiKey")}
                  checked={providerForm.clearApiKey}
                  onChange={(checked) => setProviderForm((current) => ({ ...current, clearApiKey: checked, apiKey: checked ? "" : current.apiKey }))}
                />
              ) : null}
              <CheckboxField
                label={t("fields.enabled")}
                checked={providerForm.enabled}
                onChange={(checked) => setProviderForm((current) => ({ ...current, enabled: checked }))}
              />
              <SubmitButton loading={isPending} label={t("common.save")} />
            </form>
          </FormDialog>
        ) : null}
      </>
    );
  }

  if (mode === "llm") {
    return (
      <>
        <AiConfigLayout
          eyebrow={t("llm.eyebrow")}
          title={t("llm.title")}
          description={t("llm.description")}
          actionLabel={t("llm.createTitle")}
          onCreate={() => {
            resetLlmForm();
            setFormDialog("llm");
          }}
          list={
          config.llmModels.length === 0 ? (
            <EmptyState icon={Bot} title={t("llm.emptyTitle")} description={t("llm.emptyDescription")} />
          ) : (
            <div className="divide-y divide-border/70 border-y border-border/70">
              {config.llmModels.map((model) => (
                <LlmRow
                  key={model.id}
                  model={model}
                  onEdit={() => {
                    setLlmForm({
                      id: model.id,
                      providerId: model.providerId,
                      displayName: model.displayName,
                      modelId: model.modelId,
                      contextWindow: model.contextWindow,
                      temperature: model.temperature,
                      enabled: model.enabled,
                      isDefault: model.isDefault
                    });
                    setFormDialog("llm");
                  }}
                  onDelete={() => {
                    if (!window.confirm(t("llm.deleteConfirm", { name: model.displayName }))) {
                      return;
                    }

                    runAction(() => deleteHomeLlmModel(model.id), t("common.deleted"));
                  }}
                />
              ))}
            </div>
          )
        }
        />
        {formDialog === "llm" ? (
          <FormDialog
            title={llmForm.id ? t("llm.editTitle") : t("llm.createTitle")}
            onClose={() => {
              resetLlmForm();
              setFormDialog(null);
            }}
          >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction(() => saveHomeLlmModel(llmForm), t("common.saved"), () => {
                resetLlmForm();
                setFormDialog(null);
              });
            }}
          >
            <FormHeader icon={llmForm.id ? Edit3 : Plus} title={llmForm.id ? t("llm.editTitle") : t("llm.createTitle")} />
            <ProviderSelect providers={config.providers} value={llmForm.providerId} onChange={(value) => setLlmForm((current) => ({ ...current, providerId: value }))} />
            <TextField label={t("fields.displayName")} value={llmForm.displayName} onChange={(value) => setLlmForm((current) => ({ ...current, displayName: value }))} required />
            <TextField label={t("fields.modelId")} value={llmForm.modelId} onChange={(value) => setLlmForm((current) => ({ ...current, modelId: value }))} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label={t("fields.contextWindow")} value={llmForm.contextWindow} min={1} onChange={(value) => setLlmForm((current) => ({ ...current, contextWindow: value }))} />
              <NumberField label={t("fields.temperature")} value={llmForm.temperature} min={0} max={2} step={0.1} onChange={(value) => setLlmForm((current) => ({ ...current, temperature: value }))} />
            </div>
            <CheckboxField label={t("fields.enabled")} checked={llmForm.enabled} onChange={(checked) => setLlmForm((current) => ({ ...current, enabled: checked }))} />
            <CheckboxField label={t("fields.isDefault")} checked={llmForm.isDefault} onChange={(checked) => setLlmForm((current) => ({ ...current, isDefault: checked }))} />
            {activeProviders.length === 0 ? <p className="text-xs text-accent">{t("errors.noEnabledProvider")}</p> : null}
            <SubmitButton loading={isPending} label={t("common.save")} disabled={config.providers.length === 0} />
          </form>
          </FormDialog>
        ) : null}
      </>
    );
  }

  return (
    <>
      <AiConfigLayout
        eyebrow={t("vectors.eyebrow")}
        title={t("vectors.title")}
        description={t("vectors.description")}
        actionLabel={t("vectors.createTitle")}
        onCreate={() => {
          resetVectorForm();
          setFormDialog("vectors");
        }}
        list={
        config.vectorModels.length === 0 ? (
          <EmptyState icon={DatabaseZap} title={t("vectors.emptyTitle")} description={t("vectors.emptyDescription")} />
        ) : (
          <div className="divide-y divide-border/70 border-y border-border/70">
            {config.vectorModels.map((model) => (
              <VectorRow
                key={model.id}
                model={model}
                onEdit={() => {
                  setVectorForm({
                    id: model.id,
                    providerId: model.providerId,
                    displayName: model.displayName,
                    modelId: model.modelId,
                    dimensions: model.dimensions,
                    maxInputTokens: model.maxInputTokens,
                    enabled: model.enabled,
                    isDefault: model.isDefault
                  });
                  setFormDialog("vectors");
                }}
                onDelete={() => {
                  if (!window.confirm(t("vectors.deleteConfirm", { name: model.displayName }))) {
                    return;
                  }

                  runAction(() => deleteHomeVectorModel(model.id), t("common.deleted"));
                }}
              />
            ))}
          </div>
        )
      }
      />
      {formDialog === "vectors" ? (
        <FormDialog
          title={vectorForm.id ? t("vectors.editTitle") : t("vectors.createTitle")}
          onClose={() => {
            resetVectorForm();
            setFormDialog(null);
          }}
        >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(() => saveHomeVectorModel(vectorForm), t("common.saved"), () => {
              resetVectorForm();
              setFormDialog(null);
            });
          }}
        >
          <FormHeader icon={vectorForm.id ? Edit3 : Plus} title={vectorForm.id ? t("vectors.editTitle") : t("vectors.createTitle")} />
          <ProviderSelect providers={config.providers} value={vectorForm.providerId} onChange={(value) => setVectorForm((current) => ({ ...current, providerId: value }))} />
          <TextField label={t("fields.displayName")} value={vectorForm.displayName} onChange={(value) => setVectorForm((current) => ({ ...current, displayName: value }))} required />
          <TextField label={t("fields.modelId")} value={vectorForm.modelId} onChange={(value) => setVectorForm((current) => ({ ...current, modelId: value }))} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label={t("fields.dimensions")} value={vectorForm.dimensions} min={1} onChange={(value) => setVectorForm((current) => ({ ...current, dimensions: value }))} />
            <NumberField label={t("fields.maxInputTokens")} value={vectorForm.maxInputTokens} min={1} onChange={(value) => setVectorForm((current) => ({ ...current, maxInputTokens: value }))} />
          </div>
          <CheckboxField label={t("fields.enabled")} checked={vectorForm.enabled} onChange={(checked) => setVectorForm((current) => ({ ...current, enabled: checked }))} />
          <CheckboxField label={t("fields.isDefault")} checked={vectorForm.isDefault} onChange={(checked) => setVectorForm((current) => ({ ...current, isDefault: checked }))} />
          {activeProviders.length === 0 ? <p className="text-xs text-accent">{t("errors.noEnabledProvider")}</p> : null}
          <SubmitButton loading={isPending} label={t("common.save")} disabled={config.providers.length === 0} />
        </form>
        </FormDialog>
      ) : null}
    </>
  );
}

function AiConfigLayout({
  actionLabel,
  description,
  eyebrow,
  list,
  onCreate,
  title
}: {
  actionLabel: string;
  description: string;
  eyebrow: string;
  list: React.ReactNode;
  onCreate: () => void;
  title: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-semibold tracking-normal">{title}</h3>
          <p className="mt-1 max-w-2xl text-sm text-foreground/58">{description}</p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {actionLabel}
        </button>
      </div>
      <div className="min-h-0">{list}</div>
    </div>
  );
}

function ProviderRow({
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

function LlmRow({ model, onDelete, onEdit }: { model: LlmModelView; onDelete: () => void; onEdit: () => void }) {
  const t = useTranslations("home.settings.ai");

  return (
    <ModelRow
      title={model.displayName}
      subtitle={`${model.providerName} / ${model.modelId}`}
      meta={t("llm.meta", { context: model.contextWindow, temperature: model.temperature })}
      enabled={model.enabled && model.providerEnabled}
      providerEnabled={model.providerEnabled}
      isDefault={model.isDefault}
      onDelete={onDelete}
      onEdit={onEdit}
    />
  );
}

function VectorRow({ model, onDelete, onEdit }: { model: VectorModelView; onDelete: () => void; onEdit: () => void }) {
  const t = useTranslations("home.settings.ai");

  return (
    <ModelRow
      title={model.displayName}
      subtitle={`${model.providerName} / ${model.modelId}`}
      meta={t("vectors.meta", { dimensions: model.dimensions, tokens: model.maxInputTokens })}
      enabled={model.enabled && model.providerEnabled}
      providerEnabled={model.providerEnabled}
      isDefault={model.isDefault}
      onDelete={onDelete}
      onEdit={onEdit}
    />
  );
}

function ModelRow({
  enabled,
  isDefault,
  meta,
  onDelete,
  onEdit,
  providerEnabled,
  subtitle,
  title
}: {
  enabled: boolean;
  isDefault: boolean;
  meta: string;
  onDelete: () => void;
  onEdit: () => void;
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
            <StatusBadge active={enabled} activeText={t("common.enabled")} inactiveText={t("common.disabled")} />
          </div>
          <p className="mt-1 truncate text-xs text-foreground/46">{subtitle}</p>
          <p className="mt-2 text-sm text-foreground/62">{meta}</p>
          {!providerEnabled ? <p className="mt-2 text-xs text-accent">{t("common.providerDisabled")}</p> : null}
        </div>
        <RowActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </article>
  );
}

function RowActions({ onDelete, onEdit }: { onDelete: () => void; onEdit: () => void }) {
  const t = useTranslations("home.settings.ai");

  return (
    <div className="flex shrink-0 gap-1">
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

function FormHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      {title}
    </h4>
  );
}

function FormDialog({
  children,
  onClose,
  title
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  const t = useTranslations("home.settings.ai");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm" onClick={onClose}>
      <section
        className="flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/58 transition hover:bg-muted hover:text-foreground"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="scrollbar-autohide min-h-0 overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  );
}

function ProviderSelect({
  onChange,
  providers,
  value
}: {
  onChange: (value: string) => void;
  providers: AiProviderView[];
  value: string;
}) {
  const t = useTranslations("home.settings.ai");

  return (
    <label className="space-y-1.5 text-sm">
      <span className="text-foreground/64">{t("fields.provider")}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
      >
        <option value="" disabled>
          {t("fields.providerPlaceholder")}
        </option>
        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "password" | "text";
  value: string;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="text-foreground/64">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition placeholder:text-foreground/34 focus:border-primary"
      />
    </label>
  );
}

function NumberField({
  label,
  max,
  min,
  onChange,
  step,
  value
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="text-foreground/64">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
      />
    </label>
  );
}

function CheckboxField({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary"
      />
      {label}
    </label>
  );
}

function SubmitButton({ disabled, label, loading }: { disabled?: boolean; label: string; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/38"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
      {label}
    </button>
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

function EmptyState({
  description,
  icon: Icon,
  title
}: {
  description: string;
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed border-border p-6 text-center">
      <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
      <h4 className="mt-3 text-sm font-semibold">{title}</h4>
      <p className="mt-1 max-w-sm text-sm text-foreground/56">{description}</p>
    </div>
  );
}

function resolveErrorMessage(error: unknown, t: (key: string) => string) {
  if (error instanceof Error && error.message.includes("AI_CONFIG_ENCRYPTION_KEY")) {
    return t("errors.missingEncryptionKey");
  }

  return t("errors.save");
}
