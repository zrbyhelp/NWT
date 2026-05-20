import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { routing, type Locale } from "@/i18n/routing";
import { getCurrentViewer } from "@/lib/auth";
import { localePath } from "@/lib/locale-path";

export default async function AdminLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  const t = await getTranslations("admin.shell");
  const viewer = await getCurrentViewer();

  if (!viewer) {
    redirect(`${localePath(locale as Locale, "/login")}?next=${encodeURIComponent(localePath(locale as Locale, "/admin"))}` as never);
  }

  return (
    <AdminShell
      locale={locale as Locale}
      copy={{
        brand: t("brand"),
        description: t("description"),
        backHome: t("backHome"),
        nav: {
          dashboard: t("nav.dashboard"),
          threads: t("nav.threads"),
          graph: t("nav.graph"),
          jobs: t("nav.jobs"),
          settings: t("nav.settings")
        }
      }}
    >
      {viewer.role === "ADMIN" ? (
        children
      ) : (
        <section className="rounded-md border border-border bg-background/82 p-8 shadow-sm">
          <p className="text-sm text-foreground/54">{t("noAccessKicker")}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal">{t("noAccessTitle")}</h2>
          <p className="mt-3 max-w-xl text-sm text-foreground/62">{t("noAccessDescription")}</p>
        </section>
      )}
    </AdminShell>
  );
}

