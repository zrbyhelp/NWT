import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadMaskBoardImage } from "@/lib/storage/material";
import type { MaskMaterialCreateInput } from "@/lib/home-workspace";

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

type MaterialRecord = {
  id: string;
  slug: string;
  category: string;
  style: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  previewUrl: string | null;
  metadata?: unknown;
  communityVisible: boolean;
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
    storyMaterial: {
      create: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    storyMaterialLibraryEntry: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      findFirst: vi.fn()
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

vi.mock("@/lib/storage/material", () => ({
  uploadMaskBoardImage: vi.fn(async () => "https://cdn.example.com/materials/mask-board.png")
}));

const createdAt = new Date("2026-05-20T00:00:00.000Z");
const baseScript = createScript("base-ai-script", "基础 AI 剧本", "Base AI Script");
const worldScript = createScript("world-architect", "世界观架构师", "World Architect");
const echoMaskMaterial = createMaterial("echo-mask", "MASK", "回声假面", "Echo Mask");
const nightInkMaterial = createMaterial("night-ink-vial", "ITEM", "夜墨瓶", "Night Ink Vial", "MYSTERY");

describe("home workspace data", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.prisma.storyScript.upsert.mockImplementation(async (args: { create: Omit<ScriptRecord, "id" | "createdAt" | "updatedAt"> }) => ({
      id: `${args.create.slug}-id`,
      ...args.create,
      createdAt,
      updatedAt: createdAt
    }));
    mocks.prisma.storyMaterial.upsert.mockImplementation(async (args: { create: Omit<MaterialRecord, "id" | "createdAt" | "updatedAt" | "previewUrl" | "communityVisible"> & { communityVisible?: boolean; previewUrl?: string | null } }) => ({
      id: `${args.create.slug}-id`,
      ...args.create,
      communityVisible: args.create.communityVisible ?? true,
      previewUrl: args.create.previewUrl ?? null,
      createdAt,
      updatedAt: createdAt
    }));
    mocks.prisma.storyMaterial.create.mockImplementation(async (args: { data: Omit<MaterialRecord, "id" | "createdAt" | "updatedAt"> }) => ({
      id: "created-mask-id",
      ...args.data,
      createdAt,
      updatedAt: createdAt
    }));
    mocks.prisma.storyMaterial.update.mockImplementation(async (args: { where: { id: string }; data: Partial<MaterialRecord> }) => ({
      id: args.where.id,
      slug: "mask-silver",
      category: "MASK",
      style: "MYSTERY",
      titleZh: "银发旅人",
      titleEn: "银发旅人",
      descriptionZh: "银发旅人描述",
      descriptionEn: "银发旅人描述",
      previewUrl: null,
      communityVisible: false,
      createdAt,
      updatedAt: createdAt,
      ...args.data
    }));
    mocks.prisma.storyMaterial.delete.mockImplementation(async (args: { where: { id: string } }) => ({
      id: args.where.id,
      slug: "mask-silver",
      category: "MASK",
      style: "MYSTERY",
      titleZh: "银发旅人",
      titleEn: "银发旅人",
      descriptionZh: "银发旅人描述",
      descriptionEn: "银发旅人描述",
      previewUrl: null,
      communityVisible: false,
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
    mocks.prisma.storyMaterialLibraryEntry.upsert.mockResolvedValue({
      id: "default-local-material",
      userId: "default-local",
      materialId: echoMaskMaterial.id,
      source: "COMMUNITY_ADDED",
      createdAt,
      updatedAt: createdAt
    });
    mocks.prisma.storyScript.findMany.mockResolvedValue([baseScript, worldScript]);
    mocks.prisma.storyMaterial.findMany.mockResolvedValue([echoMaskMaterial, nightInkMaterial]);
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
    mocks.prisma.storyMaterialLibraryEntry.findMany.mockResolvedValue([
      {
        id: "default-local-echo-mask",
        userId: "default-local",
        materialId: echoMaskMaterial.id,
        source: "COMMUNITY_ADDED",
        createdAt,
        updatedAt: createdAt,
        material: echoMaskMaterial
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
    expect(mocks.prisma.storyMaterial.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "echo-mask" }
      })
    );
    expect(mocks.prisma.storyMaterialLibraryEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_materialId: {
            userId: "default-local",
            materialId: "echo-mask-id"
          }
        }
      })
    );
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
    expect(data.myMaterials).toHaveLength(1);
    expect(data.myMaterials[0]).toMatchObject({
      slug: "echo-mask",
      category: "mask",
      style: "realistic",
      inLibrary: true,
      librarySource: "COMMUNITY_ADDED"
    });
    expect(data.communityMaterials.map((material) => material.slug)).toEqual(["echo-mask", "night-ink-vial"]);
    expect(data.communityMaterials[1]).toMatchObject({
      slug: "night-ink-vial",
      category: "item",
      style: "mystery",
      inLibrary: false
    });
  });

  it("creates a self-created mask material with metadata and a board image", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { createMaskMaterial } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });

    const material = await createMaskMaterial(
      {
        name: "银发旅人",
        intro: "疏离冷静，说话简短。",
        style: "mystery",
        body: {
          ageStage: "青年",
          bodyType: "轻盈",
          browShape: "平眉",
          earShape: "圆耳",
          eyeShape: "细长眼",
          faceShape: "鹅蛋脸",
          gender: "女性",
          hairStyle: "银色长发",
          height: "168",
          mouthShape: "薄唇",
          noseType: "直鼻",
          weight: "52"
        },
        boardDrawingStyle: "guofeng",
        boardImageSource: "uploaded",
        colors: {
          browColor: "#5C4033",
          eyeColor: "#3D6EA8",
          hairColor: "#F2F0E8",
          skinColor: "#D8AA78"
        },
        personality: {
          action: 50,
          affinity: 50,
          aggression: 50,
          boundaries: 50,
          confidence: 50,
          coquetry: 50,
          curiosity: 50,
          dependency: 50,
          dominance: 50,
          emotionalStability: 70,
          extroversion: 30,
          humor: 40,
          loyalty: 60,
          performative: 20,
          politeness: 80,
          possessiveness: 40,
          proactiveCare: 45,
          rationality: 80,
          sensitivity: 60,
          sharingDesire: 20
        },
        voice: {
          breathiness: 50,
          emotionExposure: 35,
          intonation: 35,
          nasalResonance: 20,
          pitch: 65,
          speechSpeed: 150,
          volume: 40
        }
      },
      new File(["board"], "board.png", { type: "image/png" }),
      "zh-CN"
    );

    expect(uploadMaskBoardImage).toHaveBeenCalledWith("reader-id", expect.any(File));
    expect(mocks.prisma.storyMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "MASK",
          communityVisible: false,
          descriptionZh: "疏离冷静，说话简短。",
          metadata: expect.objectContaining({
            boardImage: expect.objectContaining({ source: "uploaded" }),
            boardDrawingStyle: "guofeng",
            kind: "mask",
            style: "mystery"
          }),
          previewUrl: "https://cdn.example.com/materials/mask-board.png",
          style: "MYSTERY",
          titleZh: "银发旅人"
        })
      })
    );
    expect(material).toMatchObject({
      category: "mask",
      communityVisible: false,
      inLibrary: true,
      librarySource: "SELF_CREATED",
      previewUrl: "https://cdn.example.com/materials/mask-board.png",
      style: "mystery",
      title: "银发旅人"
    });
  });

  it("updates a self-created mask material in place with metadata and keeps its board image when requested", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { updateMaskMaterial } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });

    const existingMaterial = {
      ...createMaterial("mask-silver", "MASK", "银发旅人", "Silver Traveler", "MYSTERY"),
      id: "created-mask-id",
      previewUrl: "https://cdn.example.com/materials/old-board.png",
      metadata: {
        kind: "mask",
        version: 1,
        name: "银发旅人",
        intro: "疏离冷静，说话简短。",
        style: "mystery",
        body: {
          ageStage: "青年",
          bodyType: "轻盈",
          browShape: "平眉",
          earShape: "圆耳",
          eyeShape: "细长眼",
          faceShape: "鹅蛋脸",
          gender: "女性",
          hairStyle: "银色长发",
          height: "168",
          mouthShape: "薄唇",
          noseType: "直鼻",
          weight: "52"
        },
        boardDrawingStyle: "guofeng",
        boardImage: {
          source: "generated",
          url: "https://cdn.example.com/materials/old-board.png"
        },
        colors: {
          browColor: "#5C4033",
          eyeColor: "#3D6EA8",
          hairColor: "#F2F0E8",
          skinColor: "#D8AA78"
        },
        personality: {
          action: 50,
          affinity: 50,
          aggression: 50,
          boundaries: 50,
          confidence: 50,
          coquetry: 50,
          curiosity: 50,
          dependency: 50,
          dominance: 50,
          emotionalStability: 70,
          extroversion: 30,
          humor: 40,
          loyalty: 60,
          performative: 20,
          politeness: 80,
          possessiveness: 40,
          proactiveCare: 45,
          rationality: 80,
          sensitivity: 60,
          sharingDesire: 20
        },
        voice: {
          breathiness: 50,
          emotionExposure: 35,
          intonation: 35,
          nasalResonance: 20,
          pitch: 65,
          speechSpeed: 150,
          volume: 40
        }
      }
    };

    mocks.prisma.storyMaterialLibraryEntry.findFirst.mockResolvedValue({
      id: "entry-id",
      userId: "reader-id",
      materialId: "created-mask-id",
      source: "SELF_CREATED",
      createdAt,
      updatedAt: createdAt,
      material: existingMaterial
    });

    const material = await updateMaskMaterial("created-mask-id", createMaskInput({ name: "银发旅人·改", intro: "更冷淡，语气更克制。" }), null, "keep", "zh-CN");

    expect(mocks.prisma.storyMaterial.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "created-mask-id" },
        data: expect.objectContaining({
          descriptionZh: "更冷淡，语气更克制。",
          previewUrl: "https://cdn.example.com/materials/old-board.png",
          titleZh: "银发旅人·改",
          metadata: expect.objectContaining({
            boardImage: expect.objectContaining({
              source: "generated",
              url: "https://cdn.example.com/materials/old-board.png"
            }),
            intro: "更冷淡，语气更克制。",
            name: "银发旅人·改"
          })
        })
      })
    );
    expect(material).toMatchObject({
      id: "created-mask-id",
      librarySource: "SELF_CREATED",
      previewUrl: "https://cdn.example.com/materials/old-board.png",
      title: "银发旅人·改"
    });
  });

  it("deletes a self-created material after ownership is confirmed", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { deleteSelfCreatedMaterial } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });

    mocks.prisma.storyMaterialLibraryEntry.findFirst.mockResolvedValue({
      id: "entry-id",
      userId: "reader-id",
      materialId: "created-mask-id",
      source: "SELF_CREATED",
      createdAt,
      updatedAt: createdAt,
      material: {
        ...createMaterial("mask-silver", "MASK", "银发旅人", "Silver Traveler", "MYSTERY"),
        id: "created-mask-id"
      }
    });

    const result = await deleteSelfCreatedMaterial("created-mask-id", "zh-CN");

    expect(mocks.prisma.storyMaterial.delete).toHaveBeenCalledWith({
      where: { id: "created-mask-id" }
    });
    expect(result).toEqual({ id: "created-mask-id" });
  });

  it("toggles community sharing only for self-created materials", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { setMaterialCommunitySharing } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });

    mocks.prisma.storyMaterialLibraryEntry.findFirst.mockResolvedValue({
      id: "entry-id",
      userId: "reader-id",
      materialId: "created-mask-id",
      source: "SELF_CREATED",
      createdAt,
      updatedAt: createdAt,
      material: {
        ...createMaterial("mask-silver", "MASK", "银发旅人", "Silver Traveler", "MYSTERY"),
        id: "created-mask-id",
        communityVisible: false
      }
    });

    const material = await setMaterialCommunitySharing("created-mask-id", true, "zh-CN");

    expect(mocks.prisma.storyMaterial.update).toHaveBeenCalledWith({
      where: { id: "created-mask-id" },
      data: { communityVisible: true }
    });
    expect(material).toMatchObject({
      communityVisible: true,
      id: "created-mask-id",
      librarySource: "SELF_CREATED"
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

function createMaterial(
  slug: string,
  category: string,
  titleZh: string,
  titleEn: string,
  style = "REALISTIC"
): MaterialRecord {
  return {
    id: `${slug}-id`,
    slug,
    category,
    style,
    titleZh,
    titleEn,
    descriptionZh: `${titleZh}描述`,
    descriptionEn: `${titleEn} description`,
    previewUrl: null,
    communityVisible: true,
    createdAt,
    updatedAt: createdAt
  };
}

function createMaskInput(overrides: Partial<MaskMaterialCreateInput> = {}): MaskMaterialCreateInput {
  return {
    name: "银发旅人",
    intro: "疏离冷静，说话简短。",
    style: "mystery",
    body: {
      ageStage: "青年",
      bodyType: "轻盈",
      browShape: "平眉",
      earShape: "圆耳",
      eyeShape: "细长眼",
      faceShape: "鹅蛋脸",
      gender: "女性",
      hairStyle: "银色长发",
      height: "168",
      mouthShape: "薄唇",
      noseType: "直鼻",
      weight: "52"
    },
    boardDrawingStyle: "guofeng",
    boardImageSource: "uploaded",
    colors: {
      browColor: "#5C4033",
      eyeColor: "#3D6EA8",
      hairColor: "#F2F0E8",
      skinColor: "#D8AA78"
    },
    personality: {
      action: 50,
      affinity: 50,
      aggression: 50,
      boundaries: 50,
      confidence: 50,
      coquetry: 50,
      curiosity: 50,
      dependency: 50,
      dominance: 50,
      emotionalStability: 70,
      extroversion: 30,
      humor: 40,
      loyalty: 60,
      performative: 20,
      politeness: 80,
      possessiveness: 40,
      proactiveCare: 45,
      rationality: 80,
      sensitivity: 60,
      sharingDesire: 20
    },
    voice: {
      breathiness: 50,
      emotionExposure: 35,
      intonation: 35,
      nasalResonance: 20,
      pitch: 65,
      speechSpeed: 150,
      volume: 40
    },
    ...overrides
  };
}
