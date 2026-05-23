"use client";

import type { ElementType, ReactNode } from "react";
import { Loader2, RefreshCw, Save, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AiProviderView, ProviderModelOption } from "@/lib/ai/config-types";
import { cn } from "@/lib/utils";
import { resolveModelCatalogHint } from "./errors";
import type { ModelCatalogStatus } from "./types";

export function FormHeader({ icon: Icon, title }: { icon: ElementType; title: string }) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      {title}
    </h4>
  );
}

export function FormDialog({
  children,
  onClose,
  title
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  const t = useTranslations("home.settings.ai");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/18 p-3 backdrop-blur-sm">
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

export function ProviderSelect({
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

export function TextField({
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

export function ModelIdField({
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

export function NumberField({
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

export function CheckboxField({
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

export function SubmitButton({ disabled, label, loading }: { disabled?: boolean; label: string; loading: boolean }) {
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
