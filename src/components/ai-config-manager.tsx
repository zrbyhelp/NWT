"use client";

import {
  Bot,
  CheckCircle2,
  DatabaseZap,
  Edit3,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
  XCircle
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteHomeAiProvider,
  deleteHomeImageModel,
  deleteHomeLlmModel,
  deleteHomeVectorModel,
  fetchHomeProviderModels,
  getHomeAiConfig,
  saveHomeAiProvider,
  saveHomeImageModel,
  saveHomeLlmModel,
  saveHomeVectorModel
} from "@/app/[locale]/actions";
import { requestClientAuth } from "@/lib/auth-client";
import { isAuthRequiredError } from "@/lib/auth-types";
import type {
  AiConfigSnapshot,
  AiProviderInput,
  AiProviderView,
  ImageModelInput,
  ImageModelView,
  LlmModelInput,
  LlmModelView,
  ProviderModelOption,
  VectorModelInput,
  VectorModelView
} from "@/lib/ai/config-types";
import { cn } from "@/lib/utils";

type AiConfigMode = "providers" | "llm" | "vectors" | "images";
type ModelConfigMode = "llm" | "vectors" | "images";
type ModelCatalogStatus = {
  error: boolean;
  loading: boolean;
  providerId: string;
};

type ProviderForm = AiProviderInput & {
  id?: string;
};

type LlmForm = LlmModelInput & {
  id?: string;
};

type VectorForm = VectorModelInput & {
  id?: string;
};

type ImageForm = ImageModelInput & {
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

const emptyImageForm: ImageForm = {
  providerId: "",
  displayName: "",
  modelId: "",
  enabled: true,
  isDefault: false
};

export function AiConfigManager({ mode }: { mode: AiConfigMode }) {
  const t = useTranslations("home.settings.ai");
  const [config, setConfig] = useState<AiConfigSnapshot | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [providerForm, setProviderForm] = useState<ProviderForm>(emptyProviderForm);
  const [llmForm, setLlmForm] = useState<LlmForm>(emptyLlmForm);
  const [vectorForm, setVectorForm] = useState<VectorForm>(emptyVectorForm);
  const [imageForm, setImageForm] = useState<ImageForm>(emptyImageForm);
  const [formDialog, setFormDialog] = useState<AiConfigMode | null>(null);
  const [modelCatalog, setModelCatalog] = useState<Record<string, ProviderModelOption[]>>({});
  const [modelCatalogStatus, setModelCatalogStatus] = useState<Record<ModelConfigMode, ModelCatalogStatus>>({
    llm: { error: false, loading: false, providerId: "" },
    vectors: { error: false, loading: false, providerId: "" },
    images: { error: false, loading: false, providerId: "" }
  });
  const [isPending, startTransition] = useTransition();
  const activeProviders = useMemo(() => config?.providers.filter((provider) => provider.enabled) ?? [], [config]);

  function applyConfigSnapshot(snapshot: AiConfigSnapshot) {
    const firstProviderId = snapshot.providers[0]?.id ?? "";

    setConfig(snapshot);

    if (firstProviderId) {
      setLlmForm((current) => (current.providerId ? current : { ...current, providerId: firstProviderId }));
      setVectorForm((current) => (current.providerId ? current : { ...current, providerId: firstProviderId }));
      setImageForm((current) => (current.providerId ? current : { ...current, providerId: firstProviderId }));
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
      .catch((error) => {
        if (mounted) {
          if (isAuthRequiredError(error)) {
            setAuthRequired(true);
            requestClientAuth();
            return;
          }

          setLoadError(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const loadProviderModels = useCallback(
    async (mode: ModelConfigMode, providerId: string, force = false) => {
      if (!providerId) {
        return;
      }

      if (!force && modelCatalog[providerId]) {
        return;
      }

      setModelCatalogStatus((current) => ({
        ...current,
        [mode]: { error: false, loading: true, providerId }
      }));

      try {
        const models = await fetchHomeProviderModels(providerId);
        setModelCatalog((current) => ({ ...current, [providerId]: models }));
        setModelCatalogStatus((current) => ({
          ...current,
          [mode]: { error: false, loading: false, providerId }
        }));
      } catch {
        setModelCatalogStatus((current) => ({
          ...current,
          [mode]: { error: true, loading: false, providerId }
        }));
      }
    },
    [modelCatalog]
  );

  function runAction(action: () => Promise<AiConfigSnapshot>, successMessage: string, onSuccess?: () => void) {
    startTransition(async () => {
      try {
        const snapshot = await action();
        applyConfigSnapshot(snapshot);
        toast.success(successMessage);
        onSuccess?.();
      } catch (error) {
        if (isAuthRequiredError(error)) {
          requestClientAuth();
          toast.error(t("errors.authRequired"));
          return;
        }

        toast.error(resolveErrorMessage(error, t));
      }
    });
  }

  function getModelOptions(mode: ModelConfigMode, providerId: string) {
    const models = modelCatalog[providerId] ?? [];

    return models.filter((model) => {
      if (mode === "llm") {
        return model.kind !== "embedding" && model.kind !== "image";
      }

      if (mode === "images") {
        return model.kind !== "llm" && model.kind !== "embedding";
      }

      return model.kind !== "llm" && model.kind !== "image";
    });
  }

  function getModelCatalogStatus(mode: ModelConfigMode, providerId: string): ModelCatalogStatus {
    const status = modelCatalogStatus[mode];

    if (status.providerId !== providerId) {
      return { error: false, loading: false, providerId };
    }

    return status;
  }

  function applyModelOption(mode: ModelConfigMode, option: ProviderModelOption) {
    if (mode === "llm") {
      setLlmForm((current) => ({
        ...current,
        displayName: current.displayName && current.displayName !== current.modelId ? current.displayName : option.displayName,
        modelId: option.id
      }));
      return;
    }

    if (mode === "images") {
      setImageForm((current) => ({
        ...current,
        displayName: current.displayName && current.displayName !== current.modelId ? current.displayName : option.displayName,
        modelId: option.id
      }));
      return;
    }

    setVectorForm((current) => ({
      ...current,
      displayName: current.displayName && current.displayName !== current.modelId ? current.displayName : option.displayName,
      modelId: option.id
    }));
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

  function resetImageForm() {
    setImageForm({ ...emptyImageForm, providerId: config?.providers[0]?.id ?? "" });
  }

  if (authRequired) {
    return (
      <EmptyState
        icon={KeyRound}
        title={t("errors.authRequired")}
        description={t("errors.authRequired")}
      />
    );
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
            const providerId = config.providers[0]?.id ?? "";
            setLlmForm({ ...emptyLlmForm, providerId });
            setFormDialog("llm");
            void loadProviderModels("llm", providerId);
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
                      temperature: model.temperature,
                      enabled: model.enabled,
                      isDefault: model.isDefault
                    });
                    setFormDialog("llm");
                    void loadProviderModels("llm", model.providerId);
                  }}
                  onDelete={() => {
                    if (!window.confirm(t("llm.deleteConfirm", { name: model.displayName }))) {
                      return;
                    }

                    runAction(() => deleteHomeLlmModel(model.id), t("common.deleted"));
                  }}
                  onSetDefault={() => {
                    runAction(
                      () =>
                        saveHomeLlmModel({
                          id: model.id,
                          providerId: model.providerId,
                          displayName: model.displayName,
                          modelId: model.modelId,
                          temperature: model.temperature,
                          enabled: model.enabled,
                          isDefault: true
                        }),
                      t("common.saved")
                    );
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
            <ProviderSelect
              providers={config.providers}
              value={llmForm.providerId}
              onChange={(value) => {
                setLlmForm((current) => ({ ...current, providerId: value }));
                void loadProviderModels("llm", value);
              }}
            />
            <TextField label={t("fields.displayName")} value={llmForm.displayName} onChange={(value) => setLlmForm((current) => ({ ...current, displayName: value }))} required />
            <ModelIdField
              value={llmForm.modelId}
              onChange={(value) => setLlmForm((current) => ({ ...current, modelId: value }))}
              onRefresh={() => loadProviderModels("llm", llmForm.providerId, true)}
              onSelect={(option) => applyModelOption("llm", option)}
              options={getModelOptions("llm", llmForm.providerId)}
              providerSelected={Boolean(llmForm.providerId)}
              status={getModelCatalogStatus("llm", llmForm.providerId)}
            />
            <NumberField label={t("fields.temperature")} value={llmForm.temperature} min={0} max={2} step={0.1} onChange={(value) => setLlmForm((current) => ({ ...current, temperature: value }))} />
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

  if (mode === "images") {
    return (
      <>
        <AiConfigLayout
          eyebrow={t("images.eyebrow")}
          title={t("images.title")}
          description={t("images.description")}
          actionLabel={t("images.createTitle")}
          onCreate={() => {
            const providerId = config.providers[0]?.id ?? "";
            setImageForm({ ...emptyImageForm, providerId });
            setFormDialog("images");
            void loadProviderModels("images", providerId);
          }}
          list={
            config.imageModels.length === 0 ? (
              <EmptyState icon={ImageIcon} title={t("images.emptyTitle")} description={t("images.emptyDescription")} />
            ) : (
              <div className="divide-y divide-border/70 border-y border-border/70">
                {config.imageModels.map((model) => (
                  <ImageRow
                    key={model.id}
                    model={model}
                    onEdit={() => {
                      setImageForm({
                        id: model.id,
                        providerId: model.providerId,
                        displayName: model.displayName,
                        modelId: model.modelId,
                        enabled: model.enabled,
                        isDefault: model.isDefault
                      });
                      setFormDialog("images");
                      void loadProviderModels("images", model.providerId);
                    }}
                    onDelete={() => {
                      if (!window.confirm(t("images.deleteConfirm", { name: model.displayName }))) {
                        return;
                      }

                      runAction(() => deleteHomeImageModel(model.id), t("common.deleted"));
                    }}
                    onSetDefault={() => {
                      runAction(
                        () =>
                          saveHomeImageModel({
                            id: model.id,
                            providerId: model.providerId,
                            displayName: model.displayName,
                            modelId: model.modelId,
                            enabled: model.enabled,
                            isDefault: true
                          }),
                        t("common.saved")
                      );
                    }}
                  />
                ))}
              </div>
            )
          }
        />
        {formDialog === "images" ? (
          <FormDialog
            title={imageForm.id ? t("images.editTitle") : t("images.createTitle")}
            onClose={() => {
              resetImageForm();
              setFormDialog(null);
            }}
          >
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                runAction(() => saveHomeImageModel(imageForm), t("common.saved"), () => {
                  resetImageForm();
                  setFormDialog(null);
                });
              }}
            >
              <FormHeader icon={imageForm.id ? Edit3 : Plus} title={imageForm.id ? t("images.editTitle") : t("images.createTitle")} />
              <ProviderSelect
                providers={config.providers}
                value={imageForm.providerId}
                onChange={(value) => {
                  setImageForm((current) => ({ ...current, providerId: value }));
                  void loadProviderModels("images", value);
                }}
              />
              <TextField label={t("fields.displayName")} value={imageForm.displayName} onChange={(value) => setImageForm((current) => ({ ...current, displayName: value }))} required />
              <ModelIdField
                value={imageForm.modelId}
                onChange={(value) => setImageForm((current) => ({ ...current, modelId: value }))}
                onRefresh={() => loadProviderModels("images", imageForm.providerId, true)}
                onSelect={(option) => applyModelOption("images", option)}
                options={getModelOptions("images", imageForm.providerId)}
                providerSelected={Boolean(imageForm.providerId)}
                status={getModelCatalogStatus("images", imageForm.providerId)}
              />
              <CheckboxField label={t("fields.enabled")} checked={imageForm.enabled} onChange={(checked) => setImageForm((current) => ({ ...current, enabled: checked }))} />
              <CheckboxField label={t("fields.isDefault")} checked={imageForm.isDefault} onChange={(checked) => setImageForm((current) => ({ ...current, isDefault: checked }))} />
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
          const providerId = config.providers[0]?.id ?? "";
          setVectorForm({ ...emptyVectorForm, providerId });
          setFormDialog("vectors");
          void loadProviderModels("vectors", providerId);
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
                  void loadProviderModels("vectors", model.providerId);
                }}
                onDelete={() => {
                  if (!window.confirm(t("vectors.deleteConfirm", { name: model.displayName }))) {
                    return;
                  }

                  runAction(() => deleteHomeVectorModel(model.id), t("common.deleted"));
                }}
                onSetDefault={() => {
                  runAction(
                    () =>
                      saveHomeVectorModel({
                        id: model.id,
                        providerId: model.providerId,
                        displayName: model.displayName,
                        modelId: model.modelId,
                        dimensions: model.dimensions,
                        maxInputTokens: model.maxInputTokens,
                        enabled: model.enabled,
                        isDefault: true
                      }),
                    t("common.saved")
                  );
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
          <ProviderSelect
            providers={config.providers}
            value={vectorForm.providerId}
            onChange={(value) => {
              setVectorForm((current) => ({ ...current, providerId: value }));
              void loadProviderModels("vectors", value);
            }}
          />
          <TextField label={t("fields.displayName")} value={vectorForm.displayName} onChange={(value) => setVectorForm((current) => ({ ...current, displayName: value }))} required />
          <ModelIdField
            value={vectorForm.modelId}
            onChange={(value) => setVectorForm((current) => ({ ...current, modelId: value }))}
            onRefresh={() => loadProviderModels("vectors", vectorForm.providerId, true)}
            onSelect={(option) => applyModelOption("vectors", option)}
            options={getModelOptions("vectors", vectorForm.providerId)}
            providerSelected={Boolean(vectorForm.providerId)}
            status={getModelCatalogStatus("vectors", vectorForm.providerId)}
          />
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

function LlmRow({
  model,
  onDelete,
  onEdit,
  onSetDefault
}: {
  model: LlmModelView;
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
      onDelete={onDelete}
      onEdit={onEdit}
      onSetDefault={onSetDefault}
    />
  );
}

function VectorRow({
  model,
  onDelete,
  onEdit,
  onSetDefault
}: {
  model: VectorModelView;
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
      onDelete={onDelete}
      onEdit={onEdit}
      onSetDefault={onSetDefault}
    />
  );
}

function ImageRow({
  model,
  onDelete,
  onEdit,
  onSetDefault
}: {
  model: ImageModelView;
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
      onDelete={onDelete}
      onEdit={onEdit}
      onSetDefault={onSetDefault}
    />
  );
}

function ModelRow({
  enabled,
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
  isDefault: boolean;
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
            <StatusBadge active={enabled} activeText={t("common.enabled")} inactiveText={t("common.disabled")} />
          </div>
          <p className="mt-1 truncate text-xs text-foreground/46">{subtitle}</p>
          <p className="mt-2 text-sm text-foreground/62">{meta}</p>
          {!providerEnabled ? <p className="mt-2 text-xs text-accent">{t("common.providerDisabled")}</p> : null}
        </div>
        <RowActions
          canSetDefault={enabled && !isDefault}
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
  isDefault,
  onDelete,
  onEdit,
  onSetDefault
}: {
  canSetDefault?: boolean;
  isDefault?: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onSetDefault?: () => void;
}) {
  const t = useTranslations("home.settings.ai");
  const defaultActionTitle = isDefault ? t("common.default") : canSetDefault ? t("common.setDefault") : t("common.defaultUnavailable");

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

function ModelIdField({
  onChange,
  onRefresh,
  onSelect,
  options,
  providerSelected,
  status,
  value
}: {
  onChange: (value: string) => void;
  onRefresh: () => void;
  onSelect: (option: ProviderModelOption) => void;
  options: ProviderModelOption[];
  providerSelected: boolean;
  status: ModelCatalogStatus;
  value: string;
}) {
  const t = useTranslations("home.settings.ai");

  return (
    <div className="space-y-2">
      <TextField
        label={t("fields.modelId")}
        value={value}
        onChange={onChange}
        placeholder={t("fields.modelIdPlaceholder")}
        required
      />
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="sr-only" htmlFor="provider-model-select">
          {t("modelCatalog.selectLabel")}
        </label>
        <select
          id="provider-model-select"
          value=""
          onChange={(event) => {
            const option = options.find((model) => model.id === event.target.value);

            if (option) {
              onSelect(option);
            }
          }}
          disabled={!providerSelected || status.loading || options.length === 0}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/38"
        >
          <option value="">{t("modelCatalog.selectPlaceholder")}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.ownedBy ? `${option.id} · ${option.ownedBy}` : option.id}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRefresh}
          disabled={!providerSelected || status.loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground/70 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-foreground/38"
        >
          <RefreshCw className={cn("h-4 w-4", status.loading ? "animate-spin" : "")} aria-hidden="true" />
          {t("modelCatalog.refresh")}
        </button>
      </div>
      <p className={cn("text-xs", status.error ? "text-accent" : "text-foreground/50")}>
        {resolveModelCatalogHint({
          empty: options.length === 0,
          error: status.error,
          loading: status.loading,
          providerSelected,
          t
        })}
      </p>
    </div>
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

function resolveModelCatalogHint({
  empty,
  error,
  loading,
  providerSelected,
  t
}: {
  empty: boolean;
  error: boolean;
  loading: boolean;
  providerSelected: boolean;
  t: (key: string) => string;
}) {
  if (!providerSelected) {
    return t("modelCatalog.waitingProvider");
  }

  if (loading) {
    return t("modelCatalog.loading");
  }

  if (error) {
    return t("modelCatalog.error");
  }

  if (empty) {
    return t("modelCatalog.empty");
  }

  return t("modelCatalog.ready");
}
