"use client";

import {
  Bot,
  Box,
  DatabaseZap,
  Edit3,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Mic,
  Plus,
  XCircle
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteHomeAiProvider,
  deleteHomeImageModel,
  deleteHomeInstantMeshConfig,
  deleteHomeLlmModel,
  deleteHomeVoiceModel,
  deleteHomeVectorModel,
  fetchHomeProviderModels,
  getHomeAiConfig,
  saveHomeAiProvider,
  saveHomeImageModel,
  saveHomeInstantMeshConfig,
  saveHomeLlmModel,
  saveHomeVoiceModel,
  saveHomeVectorModel
} from "@/app/[locale]/actions";
import { requestClientAuth } from "@/lib/auth-client";
import { isAuthRequiredError, type AuthViewer } from "@/lib/auth-types";
import type {
  AiConfigSnapshot,
  ProviderModelOption,
} from "@/lib/ai/config-types";
import {
  emptyImageForm,
  emptyInstantMeshForm,
  emptyLlmForm,
  emptyProviderForm,
  emptyVoiceForm,
  emptyVectorForm
} from "./defaults";
import { resolveErrorMessage } from "./errors";
import {
  CheckboxField,
  FormDialog,
  FormHeader,
  ModelIdField,
  NumberField,
  ProviderSelect,
  SubmitButton,
  TextField
} from "./fields";
import { AiConfigLayout, EmptyState } from "./layout";
import { filterProviderModelOptionsForMode } from "./model-options";
import { ImageRow, InstantMeshRow, LlmRow, ProviderRow, VectorRow, VoiceRow } from "./rows";
import type {
  AiConfigMode,
  ImageForm,
  InstantMeshForm,
  LlmForm,
  ModelCatalogStatus,
  ModelConfigMode,
  ProviderForm,
  VoiceForm,
  VectorForm
} from "./types";

export function AiConfigManager({ mode, viewer }: { mode: AiConfigMode; viewer?: AuthViewer | null }) {
  const t = useTranslations("home.settings.ai");
  const [config, setConfig] = useState<AiConfigSnapshot | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [providerForm, setProviderForm] = useState<ProviderForm>(emptyProviderForm);
  const [llmForm, setLlmForm] = useState<LlmForm>(emptyLlmForm);
  const [vectorForm, setVectorForm] = useState<VectorForm>(emptyVectorForm);
  const [imageForm, setImageForm] = useState<ImageForm>(emptyImageForm);
  const [voiceForm, setVoiceForm] = useState<VoiceForm>(emptyVoiceForm);
  const [instantMeshForm, setInstantMeshForm] = useState<InstantMeshForm>(emptyInstantMeshForm);
  const [formDialog, setFormDialog] = useState<AiConfigMode | null>(null);
  const [modelCatalog, setModelCatalog] = useState<Record<string, ProviderModelOption[]>>({});
  const [modelCatalogStatus, setModelCatalogStatus] = useState<Record<ModelConfigMode, ModelCatalogStatus>>({
    llm: { error: false, loading: false, providerId: "" },
    vectors: { error: false, loading: false, providerId: "" },
    images: { error: false, loading: false, providerId: "" },
    voices: { error: false, loading: false, providerId: "" }
  });
  const [isPending, startTransition] = useTransition();
  const activeProviders = useMemo(() => config?.providers.filter((provider) => provider.enabled) ?? [], [config]);
  const isAdmin = viewer?.role === "ADMIN";

  function canManageModel(model: { isGlobal: boolean; providerUserId: string }) {
    return !model.isGlobal || model.providerUserId === viewer?.id;
  }

  function applyConfigSnapshot(snapshot: AiConfigSnapshot) {
    const firstProviderId = snapshot.providers[0]?.id ?? "";

    setConfig(snapshot);

    if (firstProviderId) {
      setLlmForm((current) => (current.providerId ? current : { ...current, providerId: firstProviderId }));
      setVectorForm((current) => (current.providerId ? current : { ...current, providerId: firstProviderId }));
      setImageForm((current) => (current.providerId ? current : { ...current, providerId: firstProviderId }));
      setVoiceForm((current) => (current.providerId ? current : { ...current, providerId: firstProviderId }));
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

    return filterProviderModelOptionsForMode(mode, models);
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

    if (mode === "voices") {
      setVoiceForm((current) => ({
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

  function resetVoiceForm() {
    setVoiceForm({ ...emptyVoiceForm, providerId: config?.providers[0]?.id ?? "" });
  }

  function resetInstantMeshForm() {
    setInstantMeshForm(emptyInstantMeshForm);
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
                      isDefault: model.isDefault,
                      isGlobal: model.isGlobal
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
                          isDefault: true,
                          isGlobal: model.isGlobal
                        }),
                      t("common.saved")
                    );
                  }}
                  canManage={canManageModel(model)}
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
            {isAdmin ? (
              <CheckboxField label={t("fields.isGlobal")} checked={llmForm.isGlobal} onChange={(checked) => setLlmForm((current) => ({ ...current, isGlobal: checked }))} />
            ) : null}
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
                        isDefault: model.isDefault,
                        isGlobal: model.isGlobal
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
                            isDefault: true,
                            isGlobal: model.isGlobal
                          }),
                        t("common.saved")
                      );
                    }}
                    canManage={canManageModel(model)}
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
              {isAdmin ? (
                <CheckboxField label={t("fields.isGlobal")} checked={imageForm.isGlobal} onChange={(checked) => setImageForm((current) => ({ ...current, isGlobal: checked }))} />
              ) : null}
              {activeProviders.length === 0 ? <p className="text-xs text-accent">{t("errors.noEnabledProvider")}</p> : null}
              <SubmitButton loading={isPending} label={t("common.save")} disabled={config.providers.length === 0} />
            </form>
          </FormDialog>
        ) : null}
      </>
    );
  }

  if (mode === "voices") {
    return (
      <>
        <AiConfigLayout
          eyebrow={t("voices.eyebrow")}
          title={t("voices.title")}
          description={t("voices.description")}
          actionLabel={t("voices.createTitle")}
          onCreate={() => {
            const providerId = config.providers[0]?.id ?? "";
            setVoiceForm({ ...emptyVoiceForm, providerId });
            setFormDialog("voices");
            void loadProviderModels("voices", providerId);
          }}
          list={
            config.voiceModels.length === 0 ? (
              <EmptyState icon={Mic} title={t("voices.emptyTitle")} description={t("voices.emptyDescription")} />
            ) : (
              <div className="divide-y divide-border/70 border-y border-border/70">
                {config.voiceModels.map((model) => (
                  <VoiceRow
                    key={model.id}
                    model={model}
                    onEdit={() => {
                      setVoiceForm({
                        id: model.id,
                        providerId: model.providerId,
                        displayName: model.displayName,
                        modelId: model.modelId,
                        enabled: model.enabled,
                        isDefault: model.isDefault,
                        isGlobal: model.isGlobal
                      });
                      setFormDialog("voices");
                      void loadProviderModels("voices", model.providerId);
                    }}
                    onDelete={() => {
                      if (!window.confirm(t("voices.deleteConfirm", { name: model.displayName }))) {
                        return;
                      }

                      runAction(() => deleteHomeVoiceModel(model.id), t("common.deleted"));
                    }}
                    onSetDefault={() => {
                      runAction(
                        () =>
                          saveHomeVoiceModel({
                            id: model.id,
                            providerId: model.providerId,
                            displayName: model.displayName,
                            modelId: model.modelId,
                            enabled: model.enabled,
                            isDefault: true,
                            isGlobal: model.isGlobal
                          }),
                        t("common.saved")
                      );
                    }}
                    canManage={canManageModel(model)}
                  />
                ))}
              </div>
            )
          }
        />
        {formDialog === "voices" ? (
          <FormDialog
            title={voiceForm.id ? t("voices.editTitle") : t("voices.createTitle")}
            onClose={() => {
              resetVoiceForm();
              setFormDialog(null);
            }}
          >
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                runAction(() => saveHomeVoiceModel(voiceForm), t("common.saved"), () => {
                  resetVoiceForm();
                  setFormDialog(null);
                });
              }}
            >
              <FormHeader icon={voiceForm.id ? Edit3 : Plus} title={voiceForm.id ? t("voices.editTitle") : t("voices.createTitle")} />
              <ProviderSelect
                providers={config.providers}
                value={voiceForm.providerId}
                onChange={(value) => {
                  setVoiceForm((current) => ({ ...current, providerId: value }));
                  void loadProviderModels("voices", value);
                }}
              />
              <TextField label={t("fields.displayName")} value={voiceForm.displayName} onChange={(value) => setVoiceForm((current) => ({ ...current, displayName: value }))} required />
              <ModelIdField
                value={voiceForm.modelId}
                onChange={(value) => setVoiceForm((current) => ({ ...current, modelId: value }))}
                onRefresh={() => loadProviderModels("voices", voiceForm.providerId, true)}
                onSelect={(option) => applyModelOption("voices", option)}
                options={getModelOptions("voices", voiceForm.providerId)}
                providerSelected={Boolean(voiceForm.providerId)}
                status={getModelCatalogStatus("voices", voiceForm.providerId)}
              />
              <CheckboxField label={t("fields.enabled")} checked={voiceForm.enabled} onChange={(checked) => setVoiceForm((current) => ({ ...current, enabled: checked }))} />
              <CheckboxField label={t("fields.isDefault")} checked={voiceForm.isDefault} onChange={(checked) => setVoiceForm((current) => ({ ...current, isDefault: checked }))} />
              {isAdmin ? (
                <CheckboxField label={t("fields.isGlobal")} checked={voiceForm.isGlobal} onChange={(checked) => setVoiceForm((current) => ({ ...current, isGlobal: checked }))} />
              ) : null}
              {activeProviders.length === 0 ? <p className="text-xs text-accent">{t("errors.noEnabledProvider")}</p> : null}
              <SubmitButton loading={isPending} label={t("common.save")} disabled={config.providers.length === 0} />
            </form>
          </FormDialog>
        ) : null}
      </>
    );
  }

  if (mode === "instantMesh") {
    const instantMeshConfigs = config.instantMeshConfigs ?? [];

    return (
      <>
        <AiConfigLayout
          eyebrow={t("instantMesh.eyebrow")}
          title={t("instantMesh.title")}
          description={t("instantMesh.description")}
          actionLabel={t("instantMesh.createTitle")}
          onCreate={() => {
            setInstantMeshForm(emptyInstantMeshForm);
            setFormDialog("instantMesh");
          }}
          list={
            instantMeshConfigs.length === 0 ? (
              <EmptyState icon={Box} title={t("instantMesh.emptyTitle")} description={t("instantMesh.emptyDescription")} />
            ) : (
              <div className="divide-y divide-border/70 border-y border-border/70">
                {instantMeshConfigs.map((item) => (
                  <InstantMeshRow
                    key={item.id}
                    config={item}
                    onEdit={() => {
                      setInstantMeshForm({
                        id: item.id,
                        name: item.name,
                        baseUrl: item.baseUrl,
                        apiKey: "",
                        clearApiKey: false,
                        submitPath: item.submitPath,
                        statusPathTemplate: item.statusPathTemplate,
                        pollIntervalMs: item.pollIntervalMs,
                        timeoutSeconds: item.timeoutSeconds,
                        enabled: item.enabled,
                        isDefault: item.isDefault
                      });
                      setFormDialog("instantMesh");
                    }}
                    onDelete={() => {
                      if (!window.confirm(t("instantMesh.deleteConfirm", { name: item.name }))) {
                        return;
                      }

                      runAction(() => deleteHomeInstantMeshConfig(item.id), t("common.deleted"));
                    }}
                    onSetDefault={() => {
                      runAction(
                        () =>
                          saveHomeInstantMeshConfig({
                            id: item.id,
                            name: item.name,
                            baseUrl: item.baseUrl,
                            clearApiKey: false,
                            submitPath: item.submitPath,
                            statusPathTemplate: item.statusPathTemplate,
                            pollIntervalMs: item.pollIntervalMs,
                            timeoutSeconds: item.timeoutSeconds,
                            enabled: item.enabled,
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
        {formDialog === "instantMesh" ? (
          <FormDialog
            title={instantMeshForm.id ? t("instantMesh.editTitle") : t("instantMesh.createTitle")}
            onClose={() => {
              resetInstantMeshForm();
              setFormDialog(null);
            }}
          >
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                runAction(() => saveHomeInstantMeshConfig(instantMeshForm), t("common.saved"), () => {
                  resetInstantMeshForm();
                  setFormDialog(null);
                });
              }}
            >
              <FormHeader icon={instantMeshForm.id ? Edit3 : Plus} title={instantMeshForm.id ? t("instantMesh.editTitle") : t("instantMesh.createTitle")} />
              <TextField label={t("fields.name")} value={instantMeshForm.name} onChange={(value) => setInstantMeshForm((current) => ({ ...current, name: value }))} required />
              <TextField label={t("fields.baseUrl")} value={instantMeshForm.baseUrl} onChange={(value) => setInstantMeshForm((current) => ({ ...current, baseUrl: value }))} placeholder="https://instantmesh.example.com" required />
              <TextField label={t("fields.apiKey")} type="password" value={instantMeshForm.apiKey ?? ""} onChange={(value) => setInstantMeshForm((current) => ({ ...current, apiKey: value }))} placeholder={t("providers.apiKeyPlaceholder")} />
              {instantMeshForm.id ? (
                <CheckboxField label={t("fields.clearApiKey")} checked={instantMeshForm.clearApiKey ?? false} onChange={(checked) => setInstantMeshForm((current) => ({ ...current, clearApiKey: checked }))} />
              ) : null}
              <TextField label={t("fields.submitPath")} value={instantMeshForm.submitPath} onChange={(value) => setInstantMeshForm((current) => ({ ...current, submitPath: value }))} required />
              <TextField label={t("fields.statusPathTemplate")} value={instantMeshForm.statusPathTemplate} onChange={(value) => setInstantMeshForm((current) => ({ ...current, statusPathTemplate: value }))} required />
              <NumberField label={t("fields.pollIntervalMs")} value={instantMeshForm.pollIntervalMs} min={500} max={30000} step={100} onChange={(value) => setInstantMeshForm((current) => ({ ...current, pollIntervalMs: value }))} />
              <NumberField label={t("fields.timeoutSeconds")} value={instantMeshForm.timeoutSeconds} min={30} max={3600} step={30} onChange={(value) => setInstantMeshForm((current) => ({ ...current, timeoutSeconds: value }))} />
              <CheckboxField label={t("fields.enabled")} checked={instantMeshForm.enabled} onChange={(checked) => setInstantMeshForm((current) => ({ ...current, enabled: checked }))} />
              <CheckboxField label={t("fields.isDefault")} checked={instantMeshForm.isDefault} onChange={(checked) => setInstantMeshForm((current) => ({ ...current, isDefault: checked }))} />
              <SubmitButton loading={isPending} label={t("common.save")} />
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
                      isDefault: model.isDefault,
                      isGlobal: model.isGlobal
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
                        isDefault: true,
                        isGlobal: model.isGlobal
                      }),
                    t("common.saved")
                  );
                }}
                canManage={canManageModel(model)}
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
          {isAdmin ? (
            <CheckboxField label={t("fields.isGlobal")} checked={vectorForm.isGlobal} onChange={(checked) => setVectorForm((current) => ({ ...current, isGlobal: checked }))} />
          ) : null}
          {activeProviders.length === 0 ? <p className="text-xs text-accent">{t("errors.noEnabledProvider")}</p> : null}
          <SubmitButton loading={isPending} label={t("common.save")} disabled={config.providers.length === 0} />
        </form>
        </FormDialog>
      ) : null}
    </>
  );
}

