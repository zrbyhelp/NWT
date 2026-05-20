import { beforeEach, describe, expect, it, vi } from "vitest";

type ScriptRecord = {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  welcomeZh: string;
  welcomeEn: string;
  createdAt: Date;
  updatedAt: Date;
};

const mocks = vi.hoisted(() => ({
  prisma: {
    appUser: {
      upsert: vi.fn()
    },
    storyScript: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      upsert: vi.fn()
    },
    storyScriptLibraryEntry: {
      findMany: vi.fn(),
      upsert: vi.fn()
    },
    conversation: {
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    chatMessage: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/ai/runtime", () => ({
  generateDefaultLlmReply: vi.fn(),
  streamDefaultLlmReply: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  ensureConfiguredAdminUser: vi.fn(),
  getCurrentViewer: vi.fn(async () => null),
  requireAuth: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma
}));

const createdAt = new Date("2026-05-20T00:00:00.000Z");
const baseScript = createScript("base-ai-script", "基础 AI 剧本", "Base AI Script");
const worldScript = createScript("world-architect", "世界观架构师", "World Architect");

describe("home workspace data", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.prisma.storyScript.upsert.mockImplementation(async (args: { create: Omit<ScriptRecord, "id" | "createdAt" | "updatedAt"> }) => ({
      id: `${args.create.slug}-id`,
      ...args.create,
      createdAt,
      updatedAt: createdAt
    }));
    mocks.prisma.appUser.upsert.mockResolvedValue({
      id: "default-local",
      slug: "default-local",
      displayName: "本地默认用户",
      createdAt,
      updatedAt: createdAt
    });
    mocks.prisma.storyScriptLibraryEntry.upsert.mockResolvedValue({
      id: "default-local-base",
      userId: "default-local",
      scriptId: baseScript.id,
      source: "COMMUNITY_ADDED",
      createdAt,
      updatedAt: createdAt
    });
    mocks.prisma.storyScript.findMany.mockResolvedValue([baseScript, worldScript]);
    mocks.prisma.storyScriptLibraryEntry.findMany.mockResolvedValue([
      {
        id: "default-local-base",
        userId: "default-local",
        scriptId: baseScript.id,
        source: "COMMUNITY_ADDED",
        createdAt,
        updatedAt: createdAt,
        script: baseScript
      }
    ]);
    mocks.prisma.conversation.findMany.mockResolvedValue([]);
  });

  it("creates the default local user and initializes the base script library entry", async () => {
    const { getHomeWorkspaceData } = await import("@/lib/home-workspace");

    const data = await getHomeWorkspaceData("zh-CN");

    expect(mocks.prisma.appUser.upsert).toHaveBeenCalledWith({
      where: { slug: "default-local" },
      update: {},
      create: {
        id: "default-local",
        slug: "default-local",
        displayName: "本地默认用户"
      }
    });
    expect(mocks.prisma.storyScript.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "base-ai-script" }
      })
    );
    expect(mocks.prisma.storyScriptLibraryEntry.upsert).toHaveBeenCalledWith({
      where: {
        userId_scriptId: {
          userId: "default-local",
          scriptId: "base-ai-script-id"
        }
      },
      update: {},
      create: {
        userId: "default-local",
        scriptId: "base-ai-script-id",
        source: "COMMUNITY_ADDED"
      }
    });
    expect(mocks.prisma.conversation.findMany).not.toHaveBeenCalled();
    expect(data.persistenceAvailable).toBe(true);
    expect(data.viewer).toBeNull();
  });

  it("returns only the base script in my scripts while keeping community scripts available", async () => {
    const { getHomeWorkspaceData } = await import("@/lib/home-workspace");

    const data = await getHomeWorkspaceData("zh-CN");

    expect(data.myScripts).toHaveLength(1);
    expect(data.myScripts[0]).toMatchObject({
      slug: "base-ai-script",
      inLibrary: true,
      librarySource: "COMMUNITY_ADDED"
    });
    expect(data.communityScripts.map((script) => script.slug)).toEqual(["base-ai-script", "world-architect"]);
    expect(data.communityScripts[0]).toMatchObject({
      slug: "base-ai-script",
      inLibrary: true,
      librarySource: "COMMUNITY_ADDED"
    });
    expect(data.communityScripts[1]).toMatchObject({
      slug: "world-architect",
      inLibrary: false
    });
  });
});

function createScript(slug: string, titleZh: string, titleEn: string): ScriptRecord {
  return {
    id: `${slug}-id`,
    slug,
    titleZh,
    titleEn,
    descriptionZh: `${titleZh}描述`,
    descriptionEn: `${titleEn} description`,
    welcomeZh: `${titleZh}欢迎语`,
    welcomeEn: `${titleEn} welcome`,
    createdAt,
    updatedAt: createdAt
  };
}
