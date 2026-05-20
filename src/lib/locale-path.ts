import { routing, type Locale } from "@/i18n/routing";

export function switchLocalePath(pathname: string, nextLocale: Locale) {
  const segments = pathname.split("/");
  const currentLocale = segments[1];

  if (routing.locales.includes(currentLocale as Locale)) {
    segments[1] = nextLocale;
    return segments.join("/") || `/${nextLocale}`;
  }

  return `/${nextLocale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function localePath(locale: Locale, path = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalizedPath === "/" ? "" : normalizedPath}`;
}

