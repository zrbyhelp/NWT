import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import type {
  AuthActionResult,
  AuthCredentialsInput,
  AuthPasswordInput,
  AuthPreferencesInput,
  AuthProfileInput,
  AuthViewer
} from "@/lib/auth-types";
import { authRequiredCode } from "@/lib/auth-types";
import { prisma } from "@/lib/prisma";

const scrypt = promisify(scryptCallback);
const sessionCookieName = "nwt_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const passwordHashPrefix = "scrypt";

export type UnifiedLoginUser = {
  account?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  id: string;
  name?: string | null;
  status?: string | null;
  username?: string | null;
};

export class AuthRequiredError extends Error {
  constructor() {
    super(authRequiredCode);
    this.name = "AuthRequiredError";
  }
}

export async function registerWithPassword(input: AuthCredentialsInput): Promise<AuthActionResult> {
  await ensureConfiguredAdminUser();

  const account = normalizeAccount(input.account);
  const password = input.password;

  validateCredentials(account, password);

  const existingUser = await prisma.appUser.findUnique({ where: { account } });

  if (existingUser?.passwordHash) {
    throw new Error("ACCOUNT_EXISTS");
  }

  const passwordHash = await hashPassword(password);
  const user = existingUser
    ? await prisma.appUser.update({
        where: { id: existingUser.id },
        data: {
          displayName: existingUser.displayName || account,
          passwordHash
        }
      })
    : await prisma.appUser.create({
        data: {
          account,
          displayName: account,
          passwordHash,
          role: "USER",
          slug: createUserSlug()
        }
      });

  return {
    viewer: await createSession(mapViewer(user))
  };
}

export async function loginWithPassword(input: AuthCredentialsInput): Promise<AuthActionResult> {
  await ensureConfiguredAdminUser();

  const account = normalizeAccount(input.account);
  const password = input.password;
  const user = await prisma.appUser.findUnique({ where: { account } });

  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return {
    viewer: await createSession(mapViewer(user))
  };
}

export async function logoutCurrentViewer() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (token) {
    await prisma.authSession.deleteMany({
      where: { tokenHash: hashToken(token) }
    });
  }

  cookieStore.delete(sessionCookieName);
}

export async function createSessionForUnifiedLogin(input: UnifiedLoginUser): Promise<AuthActionResult> {
  await ensureConfiguredAdminUser();

  const externalUserId = input.id.trim();

  if (!externalUserId) {
    throw new Error("UNIFIED_LOGIN_USER_REQUIRED");
  }

  const account = normalizeOptionalAccount(input.account) || normalizeOptionalAccount(input.username) || null;
  const email = normalizeOptionalEmail(input.email);
  const username = normalizeOptionalUsername(input.username);
  const displayName = normalizeDisplayName(input.name) || username || account || email || "用户";
  const avatarUrl = normalizeOptionalAvatarUrl(input.avatarUrl);
  const status = normalizeUnifiedStatus(input.status);
  const role = isConfiguredAdminIdentity(account, email) ? "ADMIN" : "USER";
  const existingUser = await findUnifiedLoginUser(externalUserId, account);
  const slug = createUnifiedUserSlug(externalUserId);

  const user = existingUser
    ? await prisma.appUser.update({
        where: { id: existingUser.id },
        data: {
          account: existingUser.account ?? account,
          avatarUrl,
          displayName,
          email,
          externalUserId,
          role,
          slug: existingUser.slug || slug,
          status,
          username
        }
      })
    : await prisma.appUser.create({
        data: {
          account,
          avatarUrl,
          displayName,
          email,
          externalUserId,
          role,
          slug,
          status,
          username
        }
      });

  return {
    viewer: await createSession(mapViewer(user))
  };
}

export async function updateCurrentViewerProfile(input: AuthProfileInput): Promise<AuthActionResult> {
  const viewer = await requireAuth();
  const displayName = input.displayName.trim();
  const avatarUrl = normalizeAvatarUrl(input.avatarUrl);

  if (displayName.length < 1 || displayName.length > 40) {
    throw new Error("INVALID_DISPLAY_NAME");
  }

  const user = await prisma.appUser.update({
    where: { id: viewer.id },
    data: {
      avatarUrl,
      displayName
    }
  });

  return { viewer: mapViewer(user) };
}

export async function changeCurrentViewerPassword(input: AuthPasswordInput) {
  const viewer = await requireAuth();
  const currentPassword = input.currentPassword;
  const newPassword = input.newPassword;

  validatePassword(newPassword);

  const user = await prisma.appUser.findUniqueOrThrow({ where: { id: viewer.id } });

  if (!user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new Error("INVALID_CURRENT_PASSWORD");
  }

  await prisma.appUser.update({
    where: { id: viewer.id },
    data: { passwordHash: await hashPassword(newPassword) }
  });

  return { ok: true };
}

export async function updateCurrentViewerPreferences(input: AuthPreferencesInput): Promise<AuthActionResult> {
  const viewer = await requireAuth();
  const user = await prisma.appUser.update({
    where: { id: viewer.id },
    data: {
      showAiThinking: Boolean(input.showAiThinking)
    }
  });

  return { viewer: mapViewer(user) };
}

export async function getCurrentViewer(): Promise<AuthViewer | null> {
  await ensureConfiguredAdminUser();

  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) {
      await prisma.authSession.delete({ where: { id: session.id } });
    }

    return null;
  }

  if (isBlockedUserStatus(session.user.status)) {
    await prisma.authSession.delete({ where: { id: session.id } });
    return null;
  }

  return mapViewer(session.user);
}

export async function requireAuth(): Promise<AuthViewer> {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    throw new AuthRequiredError();
  }

  return viewer;
}

export async function requireAdmin(): Promise<AuthViewer> {
  const viewer = await requireAuth();

  if (!isConfiguredAdminAccount(viewer.account)) {
    throw new Error("FORBIDDEN");
  }

  return viewer;
}

export function isConfiguredAdminAccount(account: string | null | undefined) {
  return isConfiguredAdminIdentity(account, null);
}

function isConfiguredAdminIdentity(account: string | null | undefined, email: string | null | undefined) {
  const normalizedAccount = normalizeOptionalAccount(account);
  const normalizedEmail = normalizeOptionalEmail(email);
  const adminAccounts = new Set([
    normalizeOptionalAccount(process.env.ADMIN_ACCOUNT),
    ...splitEnvList(process.env.ADMIN_ACCOUNTS).map(normalizeOptionalAccount)
  ].filter(Boolean));
  const adminEmails = new Set(splitEnvList(process.env.ADMIN_EMAILS).map(normalizeOptionalEmail).filter(Boolean));

  return Boolean(
    (normalizedAccount && adminAccounts.has(normalizedAccount)) ||
    (normalizedEmail && adminEmails.has(normalizedEmail))
  );
}

export async function ensureConfiguredAdminUser() {
  const account = normalizeOptionalAccount(process.env.ADMIN_ACCOUNT);
  const password = process.env.ADMIN_PASSWORD ?? "";

  if (!account || !password) {
    return;
  }

  validateCredentials(account, password);
  const passwordHash = await hashPassword(password);

  await prisma.appUser.upsert({
    where: { account },
    update: {
      displayName: account,
      passwordHash,
      role: "ADMIN"
    },
    create: {
      account,
      displayName: account,
      passwordHash,
      role: "ADMIN",
      slug: createUserSlug()
    }
  });
}

async function createSession(user: AuthViewer): Promise<AuthViewer> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000);
  const cookieStore = await cookies();

  await prisma.authSession.create({
    data: {
      expiresAt,
      tokenHash: hashToken(token),
      userId: user.id
    }
  });

  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return user;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = (await scrypt(password, salt, 64)) as Buffer;

  return `${passwordHashPrefix}$${salt}$${hash.toString("base64url")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, hash] = storedHash.split("$");

  if (prefix !== passwordHashPrefix || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeAccount(account: string) {
  return account.trim().toLowerCase();
}

function normalizeOptionalAccount(account: string | null | undefined) {
  return account ? normalizeAccount(account) : "";
}

function normalizeOptionalEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? "";

  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function normalizeOptionalUsername(username: string | null | undefined) {
  const normalized = username?.trim().slice(0, 191) ?? "";

  return normalized || null;
}

function normalizeDisplayName(name: string | null | undefined) {
  return name?.trim().slice(0, 40) ?? "";
}

function normalizeUnifiedStatus(status: string | null | undefined) {
  const normalized = status?.trim().toUpperCase().slice(0, 32) ?? "";

  return normalized || "ACTIVE";
}

function isBlockedUserStatus(status: string | null | undefined) {
  return ["BANNED", "DISABLED", "SUSPENDED"].includes(normalizeUnifiedStatus(status));
}

function normalizeOptionalAvatarUrl(avatarUrl: string | null | undefined) {
  if (!avatarUrl?.trim()) {
    return null;
  }

  try {
    return normalizeAvatarUrl(avatarUrl);
  } catch {
    return null;
  }
}

function splitEnvList(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function findUnifiedLoginUser(externalUserId: string, account: string | null) {
  const byExternalId = await prisma.appUser.findUnique({ where: { externalUserId } });

  if (byExternalId || !account) {
    return byExternalId;
  }

  return prisma.appUser.findUnique({ where: { account } });
}

function validateCredentials(account: string, password: string) {
  if (!/^[a-z0-9_.@-]{3,64}$/.test(account)) {
    throw new Error("INVALID_ACCOUNT");
  }

  validatePassword(password);
}

function validatePassword(password: string) {
  if (password.length < 6 || password.length > 128) {
    throw new Error("INVALID_PASSWORD");
  }
}

function normalizeAvatarUrl(avatarUrl: string | undefined) {
  const normalized = avatarUrl?.trim() ?? "";

  if (!normalized) {
    return null;
  }

  if (normalized.length > 2048) {
    throw new Error("INVALID_AVATAR_URL");
  }

  try {
    const url = new URL(normalized);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return normalized;
    }
  } catch {
    // Data URLs are handled below because URL parsing support varies by input shape.
  }

  if (normalized.startsWith("/api/storage/r2/")) {
    return normalized;
  }

  if (/^data:image\/(?:gif|png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(normalized)) {
    return normalized;
  }

  throw new Error("INVALID_AVATAR_URL");
}

function createUserSlug() {
  return `user-${randomBytes(8).toString("hex")}`;
}

function createUnifiedUserSlug(externalUserId: string) {
  const normalized = externalUserId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return normalized ? `portal-${normalized}` : createUserSlug();
}

function mapViewer(user: {
  account: string | null;
  avatarUrl?: string | null;
  displayName: string;
  email?: string | null;
  id: string;
  role: "USER" | "ADMIN";
  showAiThinking?: boolean;
  slug?: string;
  status?: string | null;
}): AuthViewer {
  return {
    account: user.account,
    avatarUrl: user.avatarUrl ?? null,
    displayName: user.displayName,
    email: user.email ?? null,
    id: user.id,
    role: isConfiguredAdminIdentity(user.account, user.email) ? "ADMIN" : "USER",
    showAiThinking: user.showAiThinking ?? false,
    slug: user.slug
  };
}
