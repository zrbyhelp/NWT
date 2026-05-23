"use client";

import type { ElementType, ReactNode } from "react";
import { Plus } from "lucide-react";

export function AiConfigLayout({
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
  list: ReactNode;
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

export function EmptyState({
  description,
  icon: Icon,
  title
}: {
  description: string;
  icon: ElementType;
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
