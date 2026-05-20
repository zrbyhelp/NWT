"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/theme-provider";
import { colorThemes, typographyPresets } from "@/lib/theme-options";
import { cn } from "@/lib/utils";

type PaletteId = (typeof colorThemes)[number]["id"];
type TypographyId = (typeof typographyPresets)[number]["id"];

export function ThemeControls() {
  const t = useTranslations("home.settings");
  const { setTheme, theme, resolvedTheme } = useAppTheme();
  const [palette, setPalette] = useState<PaletteId>(colorThemes[0].id);
  const [typography, setTypography] = useState<TypographyId>(typographyPresets[1].id);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
  }, [palette]);

  useEffect(() => {
    const preset = typographyPresets.find((item) => item.id === typography) ?? typographyPresets[1];
    document.documentElement.style.setProperty("--app-font-scale", String(preset.fontScale));
    document.documentElement.style.setProperty("--app-line-height", String(preset.lineHeight));
    document.documentElement.style.setProperty("--app-density", String(preset.density));
  }, [typography]);

  return (
    <div className="w-full rounded-md border border-border bg-background/86 p-5 shadow-sm backdrop-blur">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm text-foreground/62">{t("subtitle")}</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-foreground/72">{t("mode")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={cn(
              "rounded-md border px-3 py-3 text-left",
              theme === "light" && "border-primary text-primary"
            )}
          >
            <Sun className="mb-2 h-4 w-4" />
            浅色
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={cn(
              "rounded-md border px-3 py-3 text-left",
              theme === "dark" && "border-primary text-primary"
            )}
          >
            <Moon className="mb-2 h-4 w-4" />
            深色
          </button>
        </div>
        <p className="text-xs text-foreground/52">当前：{resolvedTheme === "dark" ? "深色" : "浅色"}</p>
      </section>

      <section className="mt-5 space-y-3">
        <h3 className="text-sm font-medium text-foreground/72">{t("palette")}</h3>
        <div className="grid grid-cols-2 gap-2">
          {colorThemes.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setPalette(item.id)}
              className={cn("rounded-md border px-3 py-3 text-left", palette === item.id && "border-primary")}
            >
              <span className="mb-3 flex gap-1">
                {item.swatches.map((swatch) => (
                  <span key={swatch} className="h-3 w-6 rounded-sm" style={{ background: swatch }} />
                ))}
              </span>
              {item.name}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 space-y-3">
        <h3 className="text-sm font-medium text-foreground/72">{t("typography")}</h3>
        <div className="grid grid-cols-3 gap-2">
          {typographyPresets.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setTypography(item.id)}
              className={cn("rounded-md border px-3 py-2", typography === item.id && "border-primary text-primary")}
            >
              {item.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
