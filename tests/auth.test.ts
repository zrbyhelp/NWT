import { beforeEach, describe, expect, it, vi } from "vitest";
import { authRequiredCode } from "@/lib/auth-types";

const mocks = vi.hoisted(() => {
  let cookieValue = "";

  return {
    cookieStore: {
      delete: vi.fn(() => {
        cookieValue = "";
      }),
      get: vi.fn(() => (cookieValue ? { name: "nwt_session", value: cookieValue } : undefined)),
      set: vi.fn((_name: string, value: string) => {
        cookieValue = value;
      })
    },
    prisma: {
      appUser: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn()
      },
      authSession: {
        create: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        findUnique: vi.fn()
      }
    },
    resetCookie: () => {
      cookieValue = "";
    }
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieStore)
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma
}));

describe("password auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetCookie();
    delete process.env.ADMIN_ACCOUNT;
    delete process.env.ADMIN_PASSWORD;

    mocks.prisma.appUser.upsert.mockResolvedValue({});
    mocks.prisma.authSession.create.mockResolvedValue({});
  });

  it("registers a user with a hashed password and USER role", async () => {
    mocks.prisma.appUser.findUnique.mockResolvedValue(null);
    mocks.prisma.appUser.create.mockImplementation(async ({ data }) => ({
      id: "user-id",
      ...data
    }));

    const { registerWithPassword } = await import("@/lib/auth");
    const result = await registerWithPassword({ account: "Reader", password: "secret123" });

    expect(mocks.prisma.appUser.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        account: "reader",
        displayName: "reader",
        role: "USER",
        slug: expect.stringMatching(/^user-/)
      })
    });
    const passwordHash = mocks.prisma.appUser.create.mock.calls[0][0].data.passwordHash as string;
    expect(passwordHash).toMatch(/^scrypt\$/);
    expect(passwordHash).not.toContain("secret123");
    expect(mocks.prisma.authSession.create).toHaveBeenCalled();
    expect(mocks.cookieStore.set).toHaveBeenCalledWith("nwt_session", expect.any(String), expect.objectContaining({ httpOnly: true }));
    expect(result.viewer).toMatchObject({ account: "reader", role: "USER" });
  });

  it("lets a migrated placeholder account set its first password", async () => {
    mocks.prisma.appUser.findUnique.mockResolvedValue({
      account: "q19946502",
      displayName: "q19946502",
      id: "ai-config-owner-q19946502",
      passwordHash: null,
      role: "USER"
    });
    mocks.prisma.appUser.update.mockImplementation(async ({ data }) => ({
      account: "q19946502",
      displayName: "q19946502",
      id: "ai-config-owner-q19946502",
      role: "USER",
      ...data
    }));

    const { registerWithPassword } = await import("@/lib/auth");
    const result = await registerWithPassword({ account: "q19946502", password: "secret123" });

    expect(mocks.prisma.appUser.create).not.toHaveBeenCalled();
    expect(mocks.prisma.appUser.update).toHaveBeenCalledWith({
      where: { id: "ai-config-owner-q19946502" },
      data: expect.objectContaining({
        passwordHash: expect.stringMatching(/^scrypt\$/)
      })
    });
    expect(result.viewer).toMatchObject({ account: "q19946502", role: "USER" });
  });

  it("creates or updates the configured admin account", async () => {
    process.env.ADMIN_ACCOUNT = "Root";
    process.env.ADMIN_PASSWORD = "admin-secret";

    const { ensureConfiguredAdminUser } = await import("@/lib/auth");
    await ensureConfiguredAdminUser();

    expect(mocks.prisma.appUser.upsert).toHaveBeenCalledWith({
      where: { account: "root" },
      update: expect.objectContaining({
        displayName: "root",
        role: "ADMIN"
      }),
      create: expect.objectContaining({
        account: "root",
        displayName: "root",
        role: "ADMIN"
      })
    });
  });

  it("treats ADMIN_ACCOUNT as admin even when the database role is USER", async () => {
    process.env.ADMIN_ACCOUNT = "Root";
    mocks.prisma.appUser.findUnique.mockResolvedValue(null);
    mocks.prisma.appUser.create.mockImplementation(async ({ data }) => ({
      id: "user-id",
      ...data
    }));

    const { loginWithPassword, registerWithPassword, requireAdmin } = await import("@/lib/auth");
    await registerWithPassword({ account: "reader", password: "secret123" });
    const passwordHash = mocks.prisma.appUser.create.mock.calls[0][0].data.passwordHash as string;

    mocks.prisma.appUser.findUnique.mockResolvedValue({
      account: "root",
      displayName: "root",
      id: "admin-id",
      passwordHash,
      role: "USER"
    });

    await expect(loginWithPassword({ account: "ROOT", password: "secret123" })).resolves.toMatchObject({
      viewer: { account: "root", role: "ADMIN" }
    });

    mocks.prisma.authSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "session-id",
      user: {
        account: "root",
        avatarUrl: null,
        displayName: "root",
        id: "admin-id",
        role: "USER",
        showAiThinking: false
      }
    });

    await expect(requireAdmin()).resolves.toMatchObject({ account: "root", role: "ADMIN" });
  });

  it("rejects database ADMIN role when the account does not match ADMIN_ACCOUNT", async () => {
    process.env.ADMIN_ACCOUNT = "root";
    mocks.cookieStore.set("nwt_session", "token");
    mocks.prisma.authSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "session-id",
      user: {
        account: "reader",
        avatarUrl: null,
        displayName: "reader",
        id: "user-id",
        role: "ADMIN",
        showAiThinking: false
      }
    });

    const { requireAdmin } = await import("@/lib/auth");

    await expect(requireAdmin()).rejects.toThrow("FORBIDDEN");
  });

  it("logs in with the correct password and rejects a bad password", async () => {
    mocks.prisma.appUser.findUnique.mockResolvedValue(null);
    mocks.prisma.appUser.create.mockImplementation(async ({ data }) => ({
      id: "user-id",
      ...data
    }));

    const { loginWithPassword, registerWithPassword } = await import("@/lib/auth");
    await registerWithPassword({ account: "reader", password: "secret123" });
    const passwordHash = mocks.prisma.appUser.create.mock.calls[0][0].data.passwordHash as string;

    mocks.prisma.appUser.findUnique.mockResolvedValue({
      account: "reader",
      displayName: "reader",
      id: "user-id",
      passwordHash,
      role: "USER"
    });

    await expect(loginWithPassword({ account: "reader", password: "bad-pass" })).rejects.toThrow("INVALID_CREDENTIALS");
    await expect(loginWithPassword({ account: "reader", password: "secret123" })).resolves.toMatchObject({
      viewer: { account: "reader", role: "USER" }
    });
  });

  it("requires a valid session for protected actions", async () => {
    const { requireAuth } = await import("@/lib/auth");

    await expect(requireAuth()).rejects.toThrow(authRequiredCode);
  });
});
