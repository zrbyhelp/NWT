import { z } from "zod";

export const defaultOutboundProxySettings = {
  enabled: false,
  httpProxy: "",
  httpsProxy: "",
  noProxy: "127.0.0.1,localhost"
} as const;

export const outboundProxyInputSchema = z.object({
  enabled: z.boolean(),
  httpProxy: z.string().trim(),
  httpsProxy: z.string().trim(),
  noProxy: z.string().trim()
}).superRefine((value, context) => {
  if (value.enabled && !value.httpProxy && !value.httpsProxy) {
    context.addIssue({
      code: "custom",
      message: "OUTBOUND_PROXY_URL_REQUIRED",
      path: ["httpProxy"]
    });
  }

  validateProxyUrl(value.httpProxy, ["httpProxy"], context);
  validateProxyUrl(value.httpsProxy, ["httpsProxy"], context);
});

export type OutboundProxySettings = z.infer<typeof outboundProxyInputSchema>;

export type AdminSystemSettings = {
  outboundProxy: OutboundProxySettings;
};

export function normalizeOutboundProxySettings(value: unknown): OutboundProxySettings {
  const record = value && typeof value === "object" ? value as Partial<OutboundProxySettings> : {};

  return outboundProxyInputSchema.parse({
    enabled: typeof record.enabled === "boolean" ? record.enabled : defaultOutboundProxySettings.enabled,
    httpProxy: typeof record.httpProxy === "string" ? record.httpProxy : defaultOutboundProxySettings.httpProxy,
    httpsProxy: typeof record.httpsProxy === "string" ? record.httpsProxy : defaultOutboundProxySettings.httpsProxy,
    noProxy: typeof record.noProxy === "string" ? record.noProxy : defaultOutboundProxySettings.noProxy
  });
}

function validateProxyUrl(value: string, path: string[], context: z.RefinementCtx) {
  if (!value) {
    return;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return;
    }
  } catch {
    // Report a single normalized error below.
  }

  context.addIssue({
    code: "custom",
    message: "OUTBOUND_PROXY_URL_INVALID",
    path
  });
}
