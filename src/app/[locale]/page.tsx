import { HomeWorkspace } from "@/components/home-workspace";
import type { Locale } from "@/i18n/routing";
import { getHomeWorkspaceData } from "@/lib/home-workspace";

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const data = await getHomeWorkspaceData(locale);

  return (
    <main className="min-h-screen bg-background">
      <HomeWorkspace key={data.viewer?.id ?? "anonymous"} data={data} />
    </main>
  );
}
