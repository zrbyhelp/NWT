import { Activity, BrainCircuit, DatabaseZap, GitBranch, RadioTower, Settings2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

const statKeys = ["threads", "jobs", "graph", "models"] as const;
const sectionKeys = ["dialogue", "memory", "operations"] as const;
const icons = {
  threads: RadioTower,
  jobs: Activity,
  graph: GitBranch,
  models: BrainCircuit,
  dialogue: BrainCircuit,
  memory: DatabaseZap,
  operations: Settings2
} as const;

export default async function AdminPage() {
  const t = await getTranslations("admin.dashboard");

  return (
    <div className="space-y-6">
      <header className="rounded-md border border-border bg-background/78 p-5 shadow-sm backdrop-blur">
        <p className="text-sm text-primary">{t("kicker")}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal">{t("title")}</h2>
        <p className="mt-3 max-w-3xl text-sm text-foreground/66">{t("description")}</p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {statKeys.map((key) => {
          const Icon = icons[key];
          return (
            <article key={key} className="rounded-md border border-border bg-background/80 p-4 shadow-sm">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-4 text-sm text-foreground/58">{t(`stats.${key}.label`)}</p>
              <p className="mt-1 text-2xl font-semibold">{t(`stats.${key}.value`)}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {sectionKeys.map((key) => {
          const Icon = icons[key];
          return (
            <article key={key} className="rounded-md border border-border bg-background/82 p-5 shadow-sm">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold">{t(`sections.${key}.title`)}</h3>
              <p className="mt-2 text-sm text-foreground/64">{t(`sections.${key}.body`)}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}

