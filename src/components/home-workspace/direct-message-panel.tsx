"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageCircle, SendHorizontal, X } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { WorkspaceDirectMessageThread } from "@/lib/home-workspace";

export function DirectMessagePanel({
  activeThreadId,
  isPending,
  labels,
  onClose,
  onSelectThread,
  onSend,
  open,
  threads
}: {
  activeThreadId: string;
  isPending: boolean;
  labels: {
    close: string;
    empty: string;
    emptyBody: string;
    messageTime: string;
    noMessages: string;
    replyPlaceholder: string;
    send: string;
    threadList: string;
    title: string;
    unread: string;
  };
  onClose: () => void;
  onSelectThread: (threadId: string) => void;
  onSend: (recipientId: string, content: string) => Promise<void>;
  open: boolean;
  threads: WorkspaceDirectMessageThread[];
}) {
  const [draft, setDraft] = useState("");
  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads]
  );

  if (!open) {
    return null;
  }

  async function handleSend() {
    if (!activeThread || !draft.trim() || isPending) {
      return;
    }

    const content = draft.trim();
    setDraft("");
    await onSend(activeThread.otherUser.id, content);
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/16 p-3 backdrop-blur-sm">
      <section className="ml-auto flex h-full w-full max-w-[64rem] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
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

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="scrollbar-autohide min-h-0 border-b border-border lg:border-b-0 lg:border-r">
            <div className="border-b border-border px-4 py-3 text-xs font-medium text-foreground/52">
              {labels.threadList}
            </div>
            <div className="scrollbar-autohide min-h-0 overflow-y-auto p-2">
              {threads.length === 0 ? (
                <div className="rounded-xl px-3 py-4 text-sm text-foreground/52">
                  <p>{labels.empty}</p>
                  <p className="mt-1 text-xs leading-5 text-foreground/42">{labels.emptyBody}</p>
                </div>
              ) : (
                threads.map((thread) => {
                  const active = thread.id === activeThreadId;

                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => onSelectThread(thread.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",
                        active ? "bg-muted/70" : "hover:bg-muted/42"
                      )}
                    >
                      <div className="relative shrink-0">
                        <UserAvatar
                          avatarUrl={thread.otherUser.avatarUrl}
                          name={thread.otherUser.displayName || thread.otherUser.account}
                          className="h-10 w-10"
                        />
                        {thread.unreadCount > 0 ? (
                          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                            {thread.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground/82">
                            {thread.otherUser.displayName || thread.otherUser.account}
                          </p>
                          {thread.unreadCount > 0 ? (
                            <span className="shrink-0 text-[11px] text-rose-600">{labels.unread}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-foreground/46">
                          {thread.lastMessage?.content ?? labels.noMessages}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <main className="flex min-h-0 flex-col">
            {activeThread ? (
              <>
                <div className="shrink-0 border-b border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      avatarUrl={activeThread.otherUser.avatarUrl}
                      name={activeThread.otherUser.displayName || activeThread.otherUser.account}
                      className="h-10 w-10"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground/82">
                        {activeThread.otherUser.displayName || activeThread.otherUser.account}
                      </p>
                      <p className="truncate text-xs text-foreground/46">{activeThread.otherUser.account ?? ""}</p>
                    </div>
                  </div>
                </div>

                <div className="scrollbar-autohide min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {activeThread.messages.length === 0 ? (
                    <p className="py-16 text-center text-sm text-foreground/48">{labels.noMessages}</p>
                  ) : (
                    activeThread.messages.map((message) => (
                      <div key={message.id} className={cn("flex", message.isMine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm",
                            message.isMine ? "bg-foreground text-background" : "bg-muted/70 text-foreground"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          <p className={cn("mt-1 text-[11px]", message.isMine ? "text-background/60" : "text-foreground/42")}>
                            {new Intl.DateTimeFormat(undefined, {
                              hour: "2-digit",
                              minute: "2-digit"
                            }).format(new Date(message.createdAt))}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="shrink-0 border-t border-border p-3">
                  <label className="block">
                    <span className="sr-only">{labels.replyPlaceholder}</span>
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                      placeholder={labels.replyPlaceholder}
                      rows={3}
                      className="min-h-24 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-foreground/36 focus:border-primary"
                    />
                  </label>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-foreground/42">{labels.messageTime}</p>
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={isPending || !draft.trim()}
                      className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/88 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground/42"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-4 w-4" aria-hidden="true" />}
                      {labels.send}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
                <div className="max-w-sm">
                  <p className="text-sm font-medium text-foreground/76">{labels.empty}</p>
                  <p className="mt-2 text-sm leading-6 text-foreground/46">{labels.emptyBody}</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}
