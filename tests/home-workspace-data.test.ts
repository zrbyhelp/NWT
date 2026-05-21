import JSZip from "jszip";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDefaultScenePanorama } from "@/lib/ai/image-runtime";
import {
  analyzeScenePanoramaFaces,
  measureFaceEdgeDelta,
  scenePanoramaPostprocessFaces,
  stabilizeScenePanoramaFaces
} from "@/lib/ai/scene-panorama-postprocess";
import { deleteMaterialImagesByUrls, uploadMaskBoardImage, uploadMaterialImageBytes } from "@/lib/storage/material";
import type { MaskMaterialCreateInput, SceneMaterialCreateInput } from "@/lib/home-workspace";

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

vi.mock("@/lib/ai/image-runtime", () => ({
  generateDefaultMaskBoardImage: vi.fn(),
  generateDefaultScenePanorama: vi.fn(),
  scenePanoramaFaces: ["front", "back", "left", "right", "top", "bottom"]
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
  getMaterialImageExtension: vi.fn((contentType: string) => {
    const normalizedContentType = contentType.toLowerCase().split(";")[0]?.trim();

    return normalizedContentType === "image/jpeg"
      ? "jpg"
      : normalizedContentType === "image/png"
        ? "png"
        : normalizedContentType === "image/webp"
          ? "webp"
          : null;
  }),
  isValidMaterialImageBytes: vi.fn((bytes: Uint8Array, contentType: string) => {
    const normalizedContentType = contentType.toLowerCase().split(";")[0]?.trim();

    return ["image/jpeg", "image/png", "image/webp"].includes(normalizedContentType) && bytes.byteLength > 0 && bytes.byteLength <= 10 * 1024 * 1024;
  }),
  deleteMaterialImagesByUrls: vi.fn(),
  uploadMaskBoardImage: vi.fn(async () => "https://cdn.example.com/materials/mask-board.png"),
  uploadScenePanoramaFaceImage: vi.fn(async () => "https://cdn.example.com/materials/scene-face.png"),
  uploadMaterialImageBytes: vi.fn(async () => "https://cdn.example.com/materials/imported-board.png")
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
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.prisma) => unknown) => callback(mocks.prisma));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
        features: "标志动作：抬手整理银发\n说话习惯：句子短，停顿长",
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
        boardDrawingStyle: "photo",
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
            boardDrawingStyle: "photo",
            features: "标志动作：抬手整理银发\n说话习惯：句子短，停顿长",
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

  it("creates a self-created scene material with panorama metadata and front preview", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { createSceneMaterial } = await import("@/lib/home-workspace");
    const input = createSceneInput({ panoramaDrawingStyle: "photo" });

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });

    const material = await createSceneMaterial(input, Object.values(input.blocks[0].panorama!.faces), "zh-CN");

    expect(mocks.prisma.storyMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "SCENE",
          communityVisible: false,
          metadata: expect.objectContaining({
            kind: "scene",
            panoramaDrawingStyle: "photo",
            blocks: [
              expect.objectContaining({
                id: "block-main",
                name: "主厅",
                panorama: expect.objectContaining({
                  faceSource: "reference-repaint",
                  faces: expect.objectContaining({
                    front: { url: "https://cdn.example.com/scene/main-front.png" }
                  })
                })
              })
            ]
          }),
          previewUrl: "https://cdn.example.com/scene/main-front.png",
          style: "MYSTERY",
          titleZh: "废弃研究所"
        })
      })
    );
    expect(material).toMatchObject({
      category: "scene",
      previewUrl: "https://cdn.example.com/scene/main-front.png",
      title: "废弃研究所"
    });
  });

  it("normalizes scene record failures while keeping uploaded face cleanup best-effort", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { createSceneMaterial } = await import("@/lib/home-workspace");
    const input = createSceneInput();
    const uploadedFaceUrls = Object.values(input.blocks[0].panorama!.faces);

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });
    mocks.prisma.storyMaterial.create.mockRejectedValueOnce(
      Object.assign(new Error("Invalid value for enum StoryMaterialCategory: SCENE"), { code: "P2022" })
    );
    vi.mocked(deleteMaterialImagesByUrls).mockRejectedValueOnce(new Error("cleanup failed"));

    await expect(createSceneMaterial(input, uploadedFaceUrls, "zh-CN")).rejects.toThrow("SCENE_MATERIAL_CATEGORY_MIGRATION_REQUIRED");
    expect(deleteMaterialImagesByUrls).toHaveBeenCalledWith(uploadedFaceUrls);
  });

  it("passes the selected panorama type into scene panorama generation", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { generateSceneBlockPanorama } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });
    vi.mocked(generateDefaultScenePanorama).mockResolvedValue({
      faces: createGeneratedSceneFaces(),
      mode: "enhanced",
      repaired: true
    });

    await generateSceneBlockPanorama(createSceneInput({ panoramaDrawingStyle: "guofeng" }), "block-main", "zh-CN");

    expect(generateDefaultScenePanorama).toHaveBeenCalledWith(
      expect.objectContaining({
        blockDescription: "坍塌的接待区，玻璃幕墙漏入冷光。",
        blockName: "主厅",
        panoramaDrawingStyle: "guofeng",
        sceneDescription: "一座被雨水和藤蔓侵蚀的旧研究所。",
        sceneName: "废弃研究所"
      }),
      "reader-id",
      expect.objectContaining({
        feature: "scene.block.panorama.generate"
      })
    );
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
        features: "标志动作：抬手整理银发\n说话习惯：句子短，停顿长",
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

    const material = await updateMaskMaterial(
      "created-mask-id",
      createMaskInput({
        name: "银发旅人·改",
        intro: "更冷淡，语气更克制。",
        features: "改后特征：回答前会先短暂停顿。"
      }),
      null,
      "keep",
      "zh-CN"
    );

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
            features: "改后特征：回答前会先短暂停顿。",
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

  it("exports a self-created material archive with manifest, markdown, and image", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { exportSelfCreatedMaterialsZip } = await import("@/lib/material-transfer");
    const existingMaterial = {
      ...createMaterial("mask-silver", "MASK", "银发旅人", "Silver Traveler", "MYSTERY"),
      id: "created-mask-id",
      previewUrl: "https://cdn.example.com/materials/old-board.png",
      metadata: {
        kind: "mask",
        version: 1,
        name: "银发旅人",
        intro: "疏离冷静，说话简短。",
        features: "标志动作：抬手整理银发",
        boardImage: {
          source: "uploaded",
          url: "https://cdn.example.com/materials/old-board.png"
        }
      }
    };

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
      material: existingMaterial
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } }))
    );

    const archive = await exportSelfCreatedMaterialsZip({
      locale: "zh-CN",
      materialId: "created-mask-id",
      origin: "http://localhost:3000"
    });
    const zip = await JSZip.loadAsync(archive.bytes);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));
    const material = manifest.materials[0];

    expect(manifest).toMatchObject({
      format: "nwt.materials",
      version: 1
    });
    expect(material).toMatchObject({
      category: "mask",
      image: expect.objectContaining({
        contentType: "image/png",
        path: expect.stringContaining("images/preview.png")
      }),
      slug: "mask-silver",
      titleZh: "银发旅人"
    });
    expect(await zip.file("materials/mask-silver/material.md")!.async("text")).toContain("# 银发旅人");
    expect(await zip.file(material.image.path)!.async("uint8array")).toHaveLength(3);
  });

  it("exports all and queries only self-created materials", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { exportSelfCreatedMaterialsZip } = await import("@/lib/material-transfer");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });
    mocks.prisma.storyMaterialLibraryEntry.findMany.mockResolvedValue([
      {
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
      }
    ]);

    const archive = await exportSelfCreatedMaterialsZip({
      locale: "zh-CN",
      origin: "http://localhost:3000"
    });
    const zip = await JSZip.loadAsync(archive.bytes);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));

    expect(mocks.prisma.storyMaterialLibraryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source: "SELF_CREATED",
          userId: "reader-id"
        }
      })
    );
    expect(manifest.materials).toHaveLength(1);
    expect(manifest.materials[0].slug).toBe("mask-silver");
  });

  it("exports scene panorama faces without duplicating the preview image", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { exportSelfCreatedMaterialsZip } = await import("@/lib/material-transfer");
    const existingMaterial = {
      ...createMaterial("scene-lab", "SCENE", "废弃研究所", "Abandoned Lab", "MYSTERY"),
      id: "created-scene-id",
      previewUrl: "https://cdn.example.com/scene/main-front.png",
      metadata: createSceneMetadata("concept")
    };

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
      materialId: "created-scene-id",
      source: "SELF_CREATED",
      createdAt,
      updatedAt: createdAt,
      material: existingMaterial
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } }))
    );

    const archive = await exportSelfCreatedMaterialsZip({
      locale: "zh-CN",
      materialId: "created-scene-id",
      origin: "http://localhost:3000"
    });
    const zip = await JSZip.loadAsync(archive.bytes);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));
    const material = manifest.materials[0];

    expect(material.image).toBeNull();
    expect(material.scenePanoramaFaces).toHaveLength(6);
    expect(material.scenePanoramaFaces.map((asset: { face: string }) => asset.face).sort()).toEqual(
      [...sceneFaceNames].sort()
    );
    expect(await zip.file(material.scenePanoramaFaces[0].image.path)!.async("uint8array")).toHaveLength(3);
    expect(await zip.file("materials/scene-lab/material.md")!.async("text")).toContain("全景六面图");
  });

  it("imports a material archive as a private self-created copy with a re-uploaded image", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { importMaterialsZip } = await import("@/lib/material-transfer");
    const archive = await createMaterialArchiveBytes({
      imageContentType: "image/png",
      imageBytes: new Uint8Array([1, 2, 3])
    });

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });

    const result = await importMaterialsZip(archive, "zh-CN");

    expect(uploadMaterialImageBytes).toHaveBeenCalledWith("reader-id", expect.any(Uint8Array), "image/png", "imports");
    expect(mocks.prisma.storyMaterial.update).not.toHaveBeenCalled();
    expect(mocks.prisma.storyMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "MASK",
          communityVisible: false,
          libraryEntries: {
            create: {
              source: "SELF_CREATED",
              userId: "reader-id"
            }
          },
          metadata: expect.objectContaining({
            boardImage: {
              source: "uploaded",
              url: "https://cdn.example.com/materials/imported-board.png"
            }
          }),
          previewUrl: "https://cdn.example.com/materials/imported-board.png",
          slug: expect.not.stringMatching(/^mask-silver$/)
        })
      })
    );
    expect(result).toMatchObject({
      importedCount: 1,
      materials: [
        {
          inLibrary: true,
          librarySource: "SELF_CREATED",
          title: "银发旅人"
        }
      ]
    });
  });

  it("imports scene panorama faces and rewrites metadata urls", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { importMaterialsZip } = await import("@/lib/material-transfer");
    const archive = await createSceneMaterialArchiveBytes();

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });

    const result = await importMaterialsZip(archive, "zh-CN");

    expect(uploadMaterialImageBytes).toHaveBeenCalledTimes(6);
    expect(mocks.prisma.storyMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "SCENE",
          metadata: expect.objectContaining({
            kind: "scene",
            panoramaDrawingStyle: "concept",
            blocks: [
              expect.objectContaining({
                id: "block-main",
                panorama: expect.objectContaining({
                  faces: expect.objectContaining({
                    front: { url: "https://cdn.example.com/materials/imported-board.png" }
                  })
                })
              })
            ]
          }),
          previewUrl: "https://cdn.example.com/materials/imported-board.png"
        })
      })
    );
    expect(result.importedCount).toBe(1);
  });

  it("stabilizes panorama faces and reduces edge color mismatch", async () => {
    const referenceFaces = await Promise.all(
      scenePanoramaPostprocessFaces.map(async (face, index) => ({
        face,
        fileName: `${face}.png`,
        contentType: "image/png",
        bytes: await createSolidFacePng(80 + index * 10, 110 + index * 6, 160 + index * 4)
      }))
    );
    const candidateFaces = await Promise.all(
      scenePanoramaPostprocessFaces.map(async (face, index) => ({
        face,
        fileName: `${face}.png`,
        contentType: "image/png",
        bytes: await createSolidFacePng(210 - index * 8, 70 + index * 9, 40 + index * 7)
      }))
    );

    const before = await measureFaceEdgeDelta(candidateFaces[4].bytes, candidateFaces[5].bytes, "right");
    const stabilized = await stabilizeScenePanoramaFaces(referenceFaces, candidateFaces);
    const after = await measureFaceEdgeDelta(stabilized[4].bytes, stabilized[5].bytes, "right");
    const quality = await analyzeScenePanoramaFaces(stabilized);

    expect(after).toBeLessThan(before);
    expect(after).toBeLessThan(8);
    expect(stabilized.every((face) => face.contentType === "image/webp" && face.fileName.endsWith(".webp"))).toBe(true);
    expect(quality.largestFaceBytes).toBeLessThan(10 * 1024 * 1024);
  });

  it("reports low edge deltas for production-ready stabilized panorama faces", async () => {
    const referenceFaces = await Promise.all(
      scenePanoramaPostprocessFaces.map(async (face) => ({
        face,
        fileName: `${face}.png`,
        contentType: "image/png",
        bytes: await createSolidFacePng(96, 132, 168)
      }))
    );
    const candidateFaces = await Promise.all(
      scenePanoramaPostprocessFaces.map(async (face, index) => ({
        face,
        fileName: `${face}.png`,
        contentType: "image/png",
        bytes: await createSolidFacePng(200 - index * 12, 60 + index * 8, 48 + index * 5)
      }))
    );

    const stabilized = await stabilizeScenePanoramaFaces(referenceFaces, candidateFaces);
    const quality = await analyzeScenePanoramaFaces(stabilized);

    expect(quality.edgeDeltas).toHaveLength(12);
    expect(quality.maxEdgeDelta).toBeLessThan(4);
    expect(quality.totalBytes).toBeLessThan(10 * 1024 * 1024);
  });

  it("rejects invalid material archives", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { importMaterialsZip } = await import("@/lib/material-transfer");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });

    await expect(importMaterialsZip(new TextEncoder().encode("not a zip"), "zh-CN")).rejects.toThrow("INVALID_MATERIAL_ZIP");
    await expect(importMaterialsZip(await new JSZip().generateAsync({ type: "uint8array" }), "zh-CN")).rejects.toThrow(
      "MATERIAL_MANIFEST_REQUIRED"
    );
    await expect(
      importMaterialsZip(
        await createMaterialArchiveBytes({
          imageBytes: new Uint8Array([1, 2, 3]),
          imageContentType: "image/gif"
        }),
        "zh-CN"
      )
    ).rejects.toThrow("INVALID_MATERIAL_IMAGE_FILE");
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
    features: "标志动作：抬手整理银发\n说话习惯：句子短，停顿长",
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

const sceneFaceNames = ["front", "back", "left", "right", "top", "bottom"] as const;

function createSceneInput(overrides: Partial<SceneMaterialCreateInput> = {}): SceneMaterialCreateInput {
  return {
    name: "废弃研究所",
    description: "一座被雨水和藤蔓侵蚀的旧研究所。",
    style: "mystery",
    panoramaDrawingStyle: "realistic",
    blocks: [
      {
        id: "block-main",
        name: "主厅",
        description: "坍塌的接待区，玻璃幕墙漏入冷光。",
        panorama: {
          faceSource: "reference-repaint",
          faces: sceneFaceNames.reduce<Record<(typeof sceneFaceNames)[number], string>>((faces, face) => {
            faces[face] = `https://cdn.example.com/scene/main-${face}.png`;

            return faces;
          }, {} as Record<(typeof sceneFaceNames)[number], string>)
        }
      }
    ],
    ...overrides
  };
}

function createGeneratedSceneFaces() {
  return sceneFaceNames.reduce<Record<(typeof sceneFaceNames)[number], {
    contentType: string;
    dataUrl: string;
    face: (typeof sceneFaceNames)[number];
    fileName: string;
  }>>((faces, face) => {
    faces[face] = {
      contentType: "image/png",
      dataUrl: `data:image/png;base64,${Buffer.from(face).toString("base64")}`,
      face,
      fileName: `scene-${face}.png`
    };

    return faces;
  }, {} as Record<(typeof sceneFaceNames)[number], {
    contentType: string;
    dataUrl: string;
    face: (typeof sceneFaceNames)[number];
    fileName: string;
  }>);
}

function createSceneMetadata(panoramaDrawingStyle = "realistic") {
  return {
    kind: "scene",
    version: 1,
    name: "废弃研究所",
    description: "一座被雨水和藤蔓侵蚀的旧研究所。",
    style: "mystery",
    panoramaDrawingStyle,
    blocks: [
      {
        id: "block-main",
        name: "主厅",
        description: "坍塌的接待区，玻璃幕墙漏入冷光。",
        panorama: {
          faceSource: "reference-repaint",
          faces: sceneFaceNames.reduce<Record<(typeof sceneFaceNames)[number], { url: string }>>((faces, face) => {
            faces[face] = { url: `https://cdn.example.com/scene/main-${face}.png` };

            return faces;
          }, {} as Record<(typeof sceneFaceNames)[number], { url: string }>)
        }
      }
    ]
  };
}

async function createSolidFacePng(red: number, green: number, blue: number) {
  return sharp({
    create: {
      channels: 4,
      height: 64,
      width: 64,
      background: { alpha: 1, b: blue, g: green, r: red }
    }
  })
    .png()
    .toBuffer();
}

async function createMaterialArchiveBytes({
  imageBytes,
  imageContentType
}: {
  imageBytes: Uint8Array;
  imageContentType: string;
}) {
  const zip = new JSZip();
  const imagePath = "materials/mask-silver/images/preview.png";

  zip.file(imagePath, imageBytes);
  zip.file(
    "manifest.json",
    JSON.stringify({
      exportedAt: "2026-05-21T00:00:00.000Z",
      format: "nwt.materials",
      version: 1,
      materials: [
        {
          slug: "mask-silver",
          category: "mask",
          style: "mystery",
          titleZh: "银发旅人",
          titleEn: "Silver Traveler",
          descriptionZh: "疏离冷静，说话简短。",
          descriptionEn: "Distant and restrained.",
          metadata: {
            kind: "mask",
            version: 1,
            name: "银发旅人",
            intro: "疏离冷静，说话简短。",
            features: "标志动作：抬手整理银发",
            boardImage: {
              source: "uploaded",
              url: "https://cdn.example.com/materials/old-board.png"
            }
          },
          image: {
            path: imagePath,
            fileName: "preview.png",
            contentType: imageContentType,
            byteSize: imageBytes.byteLength
          }
        }
      ]
    })
  );

  return zip.generateAsync({ type: "uint8array" });
}

async function createSceneMaterialArchiveBytes() {
  const zip = new JSZip();
  const faceAssets = sceneFaceNames.map((face) => {
    const path = `materials/scene-lab/panorama/block-main/${face}.png`;

    zip.file(path, new Uint8Array([1, 2, 3]));

    return {
      blockId: "block-main",
      face,
      image: {
        path,
        fileName: `${face}.png`,
        contentType: "image/png",
        byteSize: 3
      }
    };
  });

  zip.file(
    "manifest.json",
    JSON.stringify({
      exportedAt: "2026-05-21T00:00:00.000Z",
      format: "nwt.materials",
      version: 1,
      materials: [
        {
          slug: "scene-lab",
          category: "scene",
          style: "mystery",
          titleZh: "废弃研究所",
          titleEn: "Abandoned Lab",
          descriptionZh: "一座被雨水和藤蔓侵蚀的旧研究所。",
          descriptionEn: "An old research lab covered by rain and vines.",
          metadata: createSceneMetadata("concept"),
          image: null,
          scenePanoramaFaces: faceAssets
        }
      ]
    })
  );

  return zip.generateAsync({ type: "uint8array" });
}
