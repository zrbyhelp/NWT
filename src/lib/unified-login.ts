import "server-only";

export type UnifiedServiceUser = {
  account?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  id: string;
  name?: string | null;
  status?: string | null;
  username?: string | null;
};

export type ServiceAnnouncement = {
  content: string;
  createdAt: string | null;
  id: string;
  scope: "global" | "service";
  serviceId: string | null;
  sortOrder: number;
  title: string;
  updatedAt: string | null;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeString(value);

  return normalized || null;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeScope(value: unknown): ServiceAnnouncement["scope"] {
  return value === "service" ? "service" : "global";
}

export function normalizeServiceAnnouncement(input: unknown): ServiceAnnouncement | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const item = input as Record<string, unknown>;
  const id = normalizeString(item.id);

  if (!id) {
    return null;
  }

  return {
    id,
    title: normalizeString(item.title),
    content: normalizeString(item.content),
    scope: normalizeScope(item.scope),
    serviceId: normalizeNullableString(item.serviceId),
    sortOrder: normalizeNumber(item.sortOrder),
    createdAt: normalizeNullableString(item.createdAt),
    updatedAt: normalizeNullableString(item.updatedAt)
  };
}

export async function fetchServiceAnnouncements(input: {
  clientId: string;
  clientSecret: string;
  fetchImpl?: FetchLike;
  portalBaseUrl: string;
}) {
  const portalBaseUrl = input.portalBaseUrl.trim().replace(/\/+$/, "");
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();

  if (!portalBaseUrl || !clientId || !clientSecret) {
    return [];
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${portalBaseUrl}/api/service-auth/announcements`, {
    body: JSON.stringify({ clientId, clientSecret }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`公告获取失败：${message || response.statusText || response.status}`);
  }

  const payload = (await response.json()) as { announcements?: unknown };

  if (!Array.isArray(payload.announcements)) {
    return [];
  }

  return payload.announcements
    .map(normalizeServiceAnnouncement)
    .filter((item): item is ServiceAnnouncement => Boolean(item));
}
