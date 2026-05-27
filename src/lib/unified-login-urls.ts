export function buildUnifiedLoginUrl(input: {
  appUrl: string;
  clientId: string;
  portalBaseUrl: string;
  state: string;
}) {
  const portalBaseUrl = input.portalBaseUrl.trim().replace(/\/+$/, "");
  const appUrl = input.appUrl.trim().replace(/\/+$/, "");
  const clientId = input.clientId.trim();

  const url = new URL("/login", portalBaseUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("callback", `${appUrl}/api/auth/callback`);
  url.searchParams.set("state", input.state);

  return url.toString();
}

export function normalizeReturnTo(value: string | null | undefined) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : "/";

  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}
