import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { routing, type Locale } from "@/i18n/routing";

export default async function LoginPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  const t = await getTranslations("home.auth");
  const successPath = typeof next === "string" && next.startsWith(`/${locale}`) ? next : undefined;

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <AuthPanel successPath={successPath} variant="page" />
        </section>
        <p className="mt-4 text-center text-xs text-foreground/42">{t("pageHint")}</p>
      </div>
    </main>
  );
}
