import "server-only";

export function getUnifiedLoginConfig() {
  const portalBaseUrl = (process.env.PORTAL_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const clientId = (process.env.SERVICE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.SERVICE_CLIENT_SECRET ?? "").trim();
  const feedbackServiceSlug = (process.env.FEEDBACK_SERVICE_SLUG ?? "").trim();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");

  return {
    appUrl: appUrl || "http://localhost:3000",
    clientId,
    clientSecret,
    feedbackServiceSlug,
    portalBaseUrl
  };
}
