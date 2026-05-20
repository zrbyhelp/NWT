import { ArrowLeft, Bot, GitBranch, LayoutDashboard, ListChecks, Settings, Workflow } from "lucide-react";
import type { ReactNode } from "react";
import { localePath } from "@/lib/locale-path";
import type { Locale } from "@/i18n/routing";

const navItems = [
  { key: "dashboard", icon: LayoutDashboard },
  { key: "threads", icon: Bot },
  { key: "graph", icon: GitBranch },
  { key: "jobs", icon: ListChecks },
  { key: "settings", icon: Settings }
] as const;

type AdminCopy = {
  brand: string;
  description: string;
  backHome: string;
  nav: Record<(typeof navItems)[number]["key"], string>;
};

export function AdminShell({ children, copy, locale }: { children: ReactNode; copy: AdminCopy; locale: Locale }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/0.62))] text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-0 px-4 py-4 md:grid-cols-[248px_1fr] md:px-6">
        <aside className="rounded-md border border-border bg-background/82 p-4 shadow-sm backdrop-blur md:sticky md:top-4 md:h-[calc(100vh-2rem)]">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white">
              <Workflow className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="font-semibold">{copy.brand}</h1>
              <p className="text-xs text-foreground/58">{copy.description}</p>
            </div>
          </div>

          <nav className="mt-4 space-y-1">
            {navItems.map(({ key, icon: Icon }) => (
              <a
                key={key}
                href={localePath(locale, "/admin")}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/72 transition hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {copy.nav[key]}
              </a>
            ))}
          </nav>

          <a
            href={localePath(locale)}
            className="mt-6 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground/70 transition hover:border-primary/50 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {copy.backHome}
          </a>
        </aside>

        <section className="min-w-0 py-4 md:px-6 md:py-0">{children}</section>
      </div>
    </main>
  );
}

