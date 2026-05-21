"use client";

import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function CommandMenu() {
  const t = useTranslations("home.command");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (isTyping) {
        return;
      }

      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || event.key === "/") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/55 p-4 backdrop-blur-sm">
      <Command
        className="mx-auto mt-24 w-full max-w-xl overflow-hidden rounded-md border border-border bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-foreground/48" />
          <Command.Input className="h-12 flex-1 bg-transparent outline-none" placeholder={t("placeholder")} />
        </div>
        <Command.List className="p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-foreground/58">{t("empty")}</Command.Empty>
          {[t("openSettings"), t("newThread"), t("worldGraph")].map((label) => (
            <Command.Item
              key={label}
              className="cursor-pointer rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
              onSelect={() => {
                toast.info(label);
                setOpen(false);
              }}
            >
              {label}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
