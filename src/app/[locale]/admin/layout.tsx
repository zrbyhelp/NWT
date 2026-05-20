import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { routing, type Locale } from "@/i18n/routing";

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
      {children}
    </AdminShell>
  );
}

