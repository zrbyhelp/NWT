import { BrainCircuit, GitBranch, MessageSquareText, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { HeaderActions } from "@/components/header-actions";
import { ThemeControls } from "@/components/theme-controls";
import type { Locale } from "@/i18n/routing";
import { formatCount } from "@/lib/format";

const modules = [
  { icon: MessageSquareText, key: "dialogue" },
  { icon: GitBranch, key: "world" },
  { icon: BrainCircuit, key: "memory" }
] as const;

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations("home");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_36%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/0.56))]">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 md:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-border/70 pb-4">
          <div>
            <p className="text-sm text-primary">{t("kicker")}</p>
            <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">{t("title")}</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <HeaderActions />
            <div className="rounded-md border border-border bg-background/80 px-3 py-2 text-sm text-muted-foreground">
              {t("metric", { count: formatCount(42000, locale) })}
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="flex flex-col justify-center gap-7">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-primary/30 bg-background/72 px-3 py-2 text-sm text-primary">
                <Sparkles className="h-4 w-4" />
                {t("signal")}
              </div>
              <h2 className="text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
                {t("headline")}
              </h2>
              <p className="mt-5 max-w-2xl text-base text-foreground/72 md:text-lg">{t("description")}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {modules.map(({ icon: Icon, key }) => (
                <article key={key} className="rounded-md border border-border bg-background/76 p-4 shadow-sm">
                  <Icon className="mb-4 h-5 w-5 text-primary" />
                  <h3 className="font-medium">{t(`modules.${key}.title`)}</h3>
                  <p className="mt-2 text-sm text-foreground/66">{t(`modules.${key}.body`)}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="flex items-center">
            <ThemeControls />
          </aside>
        </div>
      </section>
    </main>
  );
}
