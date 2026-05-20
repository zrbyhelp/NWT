"use client";

import { SettingsDialog } from "@/components/settings-dialog";

export function HeaderActions() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <SettingsDialog />
    </div>
  );
}
