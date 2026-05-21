import type { NodeSDK } from "@opentelemetry/sdk-node";

declare global {
  var __nwtLangfuseOtelSdk: NodeSDK | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "test") {
    return;
  }

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey || globalThis.__nwtLangfuseOtelSdk) {
    return;
  }

  const [{ LangfuseSpanProcessor }, { NodeSDK }] = await Promise.all([
    import("@langfuse/otel"),
    import("@opentelemetry/sdk-node")
  ]);
  const sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        baseUrl: process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_BASEURL,
        publicKey,
        secretKey
      })
    ]
  });

  sdk.start();
  globalThis.__nwtLangfuseOtelSdk = sdk;
}
