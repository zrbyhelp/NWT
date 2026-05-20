export type DefaultCandidate = {
  id: string;
  enabled: boolean;
  isDefault: boolean;
  providerEnabled: boolean;
  createdAt: Date | string;
};

export function canUseModelAsDefault(model: Pick<DefaultCandidate, "enabled" | "providerEnabled">) {
  return model.enabled && model.providerEnabled;
}

export function chooseDefaultModel<T extends DefaultCandidate>(models: T[]) {
  const usableModels = models
    .filter(canUseModelAsDefault)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const currentDefault = usableModels.find((model) => model.isDefault);

  return currentDefault ?? usableModels[0] ?? null;
}

export function shouldMakeSavedModelDefault({
  enabled,
  hasUsableDefault,
  providerEnabled,
  requestedDefault
}: {
  enabled: boolean;
  hasUsableDefault: boolean;
  providerEnabled: boolean;
  requestedDefault: boolean;
}) {
  return enabled && providerEnabled && (requestedDefault || !hasUsableDefault);
}
