export function resolveErrorMessage(error: unknown, t: (key: string) => string) {
  if (error instanceof Error && error.message.includes("AI_CONFIG_ENCRYPTION_KEY")) {
    return t("errors.missingEncryptionKey");
  }

  if (error instanceof Error && (error.message.includes("forbidden") || error.message.includes("FORBIDDEN"))) {
    return t("errors.forbidden");
  }

  return t("errors.save");
}

export function resolveModelCatalogHint({
  empty,
  error,
  loading,
  providerSelected,
  t
}: {
  empty: boolean;
  error: boolean;
  loading: boolean;
  providerSelected: boolean;
  t: (key: string) => string;
}) {
  if (!providerSelected) {
    return t("modelCatalog.waitingProvider");
  }

  if (loading) {
    return t("modelCatalog.loading");
  }

  if (error) {
    return t("modelCatalog.error");
  }

  if (empty) {
    return t("modelCatalog.empty");
  }

  return t("modelCatalog.ready");
}
