"use client";

import { Bell, Radio, X } from "lucide-react";
import type { WorkspaceAnnouncement } from "@/lib/home-workspace";

export function NotificationPanel({
  announcements,
  labels,
  onClose,
  open,
}: {
  announcements: WorkspaceAnnouncement[];
  labels: {
    announcementFallbackTitle: string;
    announcementsTitle: string;
    close: string;
    empty: string;
    title: string;
  };
  onClose: () => void;
  open: boolean;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/16 p-3 backdrop-blur-sm">
      <section className="ml-auto flex h-full w-full max-w-[32rem] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-medium text-foreground/82">{labels.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/58 transition hover:bg-muted hover:text-foreground"
            aria-label={labels.close}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="scrollbar-autohide min-h-0 flex-1 overflow-y-auto p-4">
          <section className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-xs font-medium text-foreground/52">
              <Radio className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {labels.announcementsTitle}
            </div>
            {announcements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-foreground/46">
                {labels.empty}
              </div>
            ) : (
              announcements.map((announcement) => (
                <article key={announcement.id} className="rounded-xl border border-border bg-background px-3 py-3">
                  <p className="text-sm font-medium text-foreground/82">
                    {announcement.title || labels.announcementFallbackTitle}
                  </p>
                  {announcement.content ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/58">{announcement.content}</p>
                  ) : null}
                  {announcement.createdAt ? (
                    <p className="mt-2 text-[11px] text-foreground/38">
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short"
                      }).format(new Date(announcement.createdAt))}
                    </p>
                  ) : null}
                </article>
              ))
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
