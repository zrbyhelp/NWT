import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateDefaultItemBoardImage,
  generateDefaultMapImage,
  generateDefaultMaskBoardImage,
  generateDefaultScenePanorama,
  generateDefaultScenePanoramaMother
} from "@/lib/ai/image-runtime";
import { getScenePanoramaFaceSourceCoordinate, splitEquirectangularToCubemap } from "@/lib/ai/scene-panorama-projection";
import {
  analyzeScenePanoramaFaces,
  scenePanoramaPostprocessFaces,
  stabilizeScenePanoramaFaces
} from "@/lib/ai/scene-panorama-postprocess";
import { buildMapMaterialProjectionPayload } from "@/lib/graph/map-material";
import {
  deleteMaterialImagesByUrls,
  isValidScenePanoramaImageBytes,
  uploadCreatureBoardImage,
  uploadItemBoardImage,
  uploadItemModelBytes,
  uploadItemModelInputImage,
  uploadMaskBoardImage,
  uploadMaterialImageBytes
} from "@/lib/storage/material";
import type {
  CreatureMaterialCreateInput,
  ItemMaterialCreateInput,
  MapImageStreamEvent,
  MapMaterialCreateInput,
  MaskMaterialCreateInput,
  SceneMaterialCreateInput
} from "@/lib/home-workspace";
import {
  assistMapDraft,
  buildMapAssistMessages,
  buildMapDeriveRoundMessages,
  deriveMapGraphRound,
  sanitizeMapDeriveRoundPatch,
  sanitizeMapDraftPatch
} from "@/lib/home-workspace";
import {
  buildMapMaterialMetadata,
  buildMapGraphSignature,
  buildMapImageNodeBatches,
  createDefaultMapDraft,
  applyPatchToMapDraft,
  getMapGraphNodeBaseSize,
  layoutMapGraphNodes,
  normalizeMapImageNodeBatchSize,
  validateMapDraftForGraphSave,
  validateMapDraftForSave
} from "@/lib/home-workspace/map";
import { generateMapImageOutlinePreview } from "@/lib/home-workspace/map-image-outline";
import { formatMaterialMarkdown } from "@/lib/material-transfer/markdown";

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
  generateDefaultItemBoardImage: vi.fn(),
  generateDefaultMapImage: vi.fn(),
  generateDefaultMaskBoardImage: vi.fn(),
  generateDefaultScenePanorama: vi.fn(),
  generateDefaultScenePanoramaMother: vi.fn(),
  normalizeScenePanoramaMaxRedrawAttempts: vi.fn((value: unknown) => {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : 1;

    return Number.isFinite(parsed) ? Math.min(10, Math.max(1, Math.round(parsed))) : 1;
  }),
  scenePanoramaFaces: ["front", "back", "left", "right", "top", "bottom"],
  streamDefaultScenePanorama: vi.fn(),
  streamDefaultScenePanoramaMother: vi.fn()
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
  isValidMaterialImageBytes: vi.fn((bytes: Uint8Array, contentType: string, options: { allowOversize?: boolean } = {}) => {
    const normalizedContentType = contentType.toLowerCase().split(";")[0]?.trim();

    return ["image/jpeg", "image/png", "image/webp"].includes(normalizedContentType) &&
      bytes.byteLength > 0 &&
      (options.allowOversize || bytes.byteLength <= 10 * 1024 * 1024);
  }),
  isValidMaterialImageFile: vi.fn((file: File, options: { allowOversize?: boolean } = {}) => {
    const normalizedContentType = file.type.toLowerCase().split(";")[0]?.trim();

    return ["image/jpeg", "image/png", "image/webp"].includes(normalizedContentType) &&
      file.size > 0 &&
      (options.allowOversize || file.size <= 10 * 1024 * 1024);
  }),
  isValidScenePanoramaImageBytes: vi.fn((bytes: Uint8Array, contentType: string) => {
    const normalizedContentType = contentType.toLowerCase().split(";")[0]?.trim();

    return ["image/jpeg", "image/png", "image/webp"].includes(normalizedContentType) && bytes.byteLength > 0;
  }),
  isValidScenePanoramaImageFile: vi.fn((file: File, options: { allowOversize?: boolean } = {}) => {
    const normalizedContentType = file.type.toLowerCase().split(";")[0]?.trim();

    return ["image/jpeg", "image/png", "image/webp"].includes(normalizedContentType) &&
      file.size > 0 &&
      (options.allowOversize || file.size <= 10 * 1024 * 1024);
  }),
  isValidMaterialModelBytes: vi.fn((bytes: Uint8Array, contentType: string, fileName = "") => {
    const normalizedContentType = contentType.toLowerCase().split(";")[0]?.trim();

    return (normalizedContentType === "model/gltf-binary" || fileName.endsWith(".glb")) && bytes.byteLength > 0 && bytes.byteLength <= 100 * 1024 * 1024;
  }),
  deleteMaterialImagesByUrls: vi.fn(),
  uploadCreatureBoardImage: vi.fn(async () => "https://cdn.example.com/materials/creature-board.png"),
  uploadItemBoardImage: vi.fn(async () => "https://cdn.example.com/materials/item-board.png"),
  uploadItemModelBytes: vi.fn(async () => "https://cdn.example.com/materials/imported-model.glb"),
  uploadItemModelInputImage: vi.fn(async () => "https://cdn.example.com/materials/item-model-input.png"),
  uploadItemViewImage: vi.fn(async () => "https://cdn.example.com/materials/item-view.png"),
  uploadMapImage: vi.fn(async () => "https://cdn.example.com/materials/map-image.png"),
  uploadMaskBoardImage: vi.fn(async () => "https://cdn.example.com/materials/mask-board.png"),
  uploadScenePanoramaFaceImage: vi.fn(async () => "https://cdn.example.com/materials/scene-face.png"),
  uploadScenePanoramaMotherImage: vi.fn(async () => "https://cdn.example.com/materials/scene-mother.png"),
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
      communityVisible: true,
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
      communityVisible: true,
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
        communityVisible: true,
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
          communityVisible: true,
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
      communityVisible: true,
      inLibrary: true,
      librarySource: "SELF_CREATED",
      previewUrl: "https://cdn.example.com/materials/mask-board.png",
      style: "mystery",
      title: "银发旅人"
    });
  });

  it("creates a self-created creature material with full species metadata and a board image", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { createCreatureMaterial } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });

    const material = await createCreatureMaterial(
      createCreatureInput(),
      new File(["board"], "creature-board.png", { type: "image/png" }),
      "zh-CN"
    );

    expect(uploadCreatureBoardImage).toHaveBeenCalledWith("reader-id", expect.any(File), { allowOversize: true });
    expect(mocks.prisma.storyMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "CREATURE",
          communityVisible: true,
          descriptionZh: "雾卫兽是废墟边界的群居守卫生物，会通过低频鸣叫同步警戒。",
          metadata: expect.objectContaining({
            behavior: expect.objectContaining({
              alertness: 86,
              resourceGuarding: 78
            }),
            behaviorLogic: "发现陌生气味后先围绕观察；靠近巢穴时发出低频警告；持续逼近才集体驱赶。",
            boardImage: {
              source: "generated",
              url: "https://cdn.example.com/materials/creature-board.png"
            },
            kind: "creature",
            name: "雾卫兽",
            subject: "species",
            version: 1
          }),
          previewUrl: "https://cdn.example.com/materials/creature-board.png",
          style: "FANTASY",
          titleZh: "雾卫兽"
        })
      })
    );
    expect(material).toMatchObject({
      category: "creature",
      communityVisible: true,
      inLibrary: true,
      librarySource: "SELF_CREATED",
      previewUrl: "https://cdn.example.com/materials/creature-board.png",
      style: "fantasy",
      title: "雾卫兽"
    });
  });

  it("creates a self-created item material with generated board and model input metadata", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { createItemMaterial } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });

    const material = await createItemMaterial(
      createItemInput(),
      new File(["board"], "item-board.png", { type: "image/png" }),
      new File(["model-input"], "item-model-input.png", { type: "image/png" }),
      "zh-CN"
    );

    expect(uploadItemBoardImage).toHaveBeenCalledWith("reader-id", expect.any(File), { allowOversize: true });
    expect(uploadItemModelInputImage).toHaveBeenCalledWith("reader-id", expect.any(File), { allowOversize: true });
    expect(mocks.prisma.storyMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "ITEM",
          communityVisible: true,
          metadata: expect.objectContaining({
            boardImage: expect.objectContaining({
              source: "generated",
              url: "https://cdn.example.com/materials/item-board.png"
            }),
            kind: "item",
            modelInputImage: expect.objectContaining({
              source: "generated",
              url: "https://cdn.example.com/materials/item-model-input.png"
            }),
            version: 2
          }),
          previewUrl: "https://cdn.example.com/materials/item-board.png",
          titleZh: "灵犀扫描器"
        })
      })
    );
    expect(material).toMatchObject({
      category: "item",
      communityVisible: true,
      inLibrary: true,
      librarySource: "SELF_CREATED",
      previewUrl: "https://cdn.example.com/materials/item-board.png",
      title: "灵犀扫描器"
    });
  });

  it("cleans up uploaded item images when the item record cannot be saved", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { createItemMaterial } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });
    mocks.prisma.storyMaterial.create.mockRejectedValueOnce(Object.assign(new Error("Database is unreachable"), { code: "P1001" }));

    await expect(createItemMaterial(
      createItemInput(),
      new File(["board"], "item-board.png", { type: "image/png" }),
      new File(["model-input"], "item-model-input.png", { type: "image/png" }),
      "zh-CN"
    )).rejects.toThrow("ITEM_MATERIAL_DATABASE_FAILED");
    expect(deleteMaterialImagesByUrls).toHaveBeenCalledWith([
      "https://cdn.example.com/materials/item-board.png",
      "https://cdn.example.com/materials/item-model-input.png"
    ]);
  });

  it("reports item upload failures before writing the item record", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { createItemMaterial } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });
    vi.mocked(uploadItemBoardImage).mockRejectedValueOnce(new Error("AccessDenied"));

    await expect(createItemMaterial(
      createItemInput(),
      new File(["board"], "item-board.png", { type: "image/png" }),
      null,
      "zh-CN"
    )).rejects.toThrow("ITEM_MATERIAL_UPLOAD_FAILED");
    expect(mocks.prisma.storyMaterial.create).not.toHaveBeenCalled();
    expect(deleteMaterialImagesByUrls).not.toHaveBeenCalled();
  });

  it("assists an item draft from image-only references", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { generateDefaultLlmReply } = await import("@/lib/ai/runtime");
    const { assistItemDraft, prepareItemAssistReferenceImages } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });
    vi.mocked(generateDefaultLlmReply).mockResolvedValueOnce({
      content: JSON.stringify({
        message: "已根据参考图同步物品。",
        patch: {
          itemCategory: "设备",
          materials: ["半透明树脂"]
        }
      }),
      usage: { completionTokens: 0, estimated: true, promptTokens: 0 }
    });
    const referenceImages = await prepareItemAssistReferenceImages([
      new File(["reference"], "reference.png", { type: "image/png" })
    ]);

    const result = await assistItemDraft(createItemInput(), "", "zh-CN", referenceImages);
    const messages = vi.mocked(generateDefaultLlmReply).mock.calls[0][0];
    const userContent = messages[1].content;

    expect(Array.isArray(userContent)).toBe(true);
    expect(userContent).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "text" }),
      expect.objectContaining({ type: "image_url" })
    ]));
    expect(result.patch).toMatchObject({
      itemCategory: "设备",
      materials: ["半透明树脂"]
    });
  });

  it("limits item reference images to three and rejects invalid files", async () => {
    const { prepareItemAssistReferenceImages, prepareItemBoardReferenceImages } = await import("@/lib/home-workspace");
    const images = await prepareItemBoardReferenceImages([
      new File(["1"], "one.png", { type: "image/png" }),
      new File(["2"], "two.jpg", { type: "image/jpeg" }),
      new File(["3"], "three.webp", { type: "image/webp" }),
      new File(["4"], "four.png", { type: "image/png" })
    ]);

    expect(images).toHaveLength(3);
    expect(images.map((image) => image.fileName)).toEqual(["one.png", "two.jpg", "three.webp"]);
    await expect(prepareItemAssistReferenceImages([
      new File(["bad"], "bad.txt", { type: "text/plain" })
    ])).rejects.toThrow("INVALID_ITEM_REFERENCE_IMAGE_FILE");
  });

  it("passes item board reference images to the image runtime", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { generateItemBoard, prepareItemBoardReferenceImages } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });
    vi.mocked(generateDefaultItemBoardImage).mockResolvedValueOnce({
      contentType: "image/png",
      dataUrl: "data:image/png;base64,aXRlbS1ib2FyZA==",
      fileName: "item-board.png"
    });
    const referenceImages = await prepareItemBoardReferenceImages([
      new File(["reference"], "reference.png", { type: "image/png" })
    ]);

    await generateItemBoard(createItemInput(), "zh-CN", referenceImages);

    expect(generateDefaultItemBoardImage).toHaveBeenCalledWith(
      expect.stringContaining("如果提供了参考图"),
      "reader-id",
      expect.objectContaining({
        input: expect.objectContaining({ referenceImageCount: 1 })
      }),
      expect.objectContaining({
        referenceImages: [expect.objectContaining({ fileName: "reference.png" })]
      })
    );
  });

  it("sanitizes creature AI patches to the creature schema and safe ranges", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { generateDefaultLlmReply } = await import("@/lib/ai/runtime");
    const { assistCreatureDraft } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });
    vi.mocked(generateDefaultLlmReply).mockResolvedValueOnce({
      content: JSON.stringify({
        message: "已补全生物行为逻辑。",
        patch: {
          backgroundStory: "不应写入",
          description: "雾卫兽会用低频鸣叫同步警戒，并依靠气味判断入侵者。",
          style: "invalid-style",
          taxonomy: {
            creatureType: "雾生兽类",
            humanRole: "守卫"
          },
          colors: {
            primaryColor: "#12abef",
            glowColor: "cyan"
          },
          vocalization: {
            frequency: -20,
            volume: 160
          },
          senses: {
            sensoryAcuity: 101
          },
          ecology: {
            habitat: "废墟边界"
          },
          abilities: {
            powers: ["嗅出谎言", "嗅出谎言", ""],
            dangerNotes: ["靠近巢穴会被驱赶"]
          },
          behaviorLogic: "先围绕观察，确认威胁后低频警告，持续逼近才集体驱赶。",
          behavior: {
            alertness: 120,
            resourceGuarding: -5,
            romance: 88
          }
        }
      }),
      usage: { completionTokens: 0, estimated: true, promptTokens: 0 }
    });

    const result = await assistCreatureDraft(createCreatureInput(), "补全生态和行为逻辑", "zh-CN");
    const messages = vi.mocked(generateDefaultLlmReply).mock.calls[0][0];

    expect(String(messages[0].content)).toContain("species or population");
    expect(String(messages[0].content)).toContain("not a human facade");
    expect(result.message).toBe("已补全生物行为逻辑。");
    expect(result.patch).toMatchObject({
      abilities: {
        dangerNotes: ["靠近巢穴会被驱赶"],
        powers: ["嗅出谎言"]
      },
      behavior: {
        alertness: 100,
        resourceGuarding: 0
      },
      behaviorLogic: "先围绕观察，确认威胁后低频警告，持续逼近才集体驱赶。",
      colors: {
        primaryColor: "#12ABEF"
      },
      description: "雾卫兽会用低频鸣叫同步警戒，并依靠气味判断入侵者。",
      ecology: {
        habitat: "废墟边界"
      },
      senses: {
        sensoryAcuity: 100
      },
      taxonomy: {
        creatureType: "雾生兽类"
      },
      vocalization: {
        frequency: 0,
        volume: 100
      }
    });
    expect(result.patch).not.toHaveProperty("backgroundStory");
    expect(result.patch).not.toHaveProperty("style");
  });

  it("generates creature boards with species, morphology, habitat, and behavior prompt data", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { generateCreatureBoard } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });
    vi.mocked(generateDefaultMaskBoardImage).mockResolvedValueOnce({
      contentType: "image/png",
      dataUrl: "data:image/png;base64,Y3JlYXR1cmU=",
      fileName: "creature-board.png"
    });

    const result = await generateCreatureBoard(createCreatureInput(), "zh-CN");
    const prompt = vi.mocked(generateDefaultMaskBoardImage).mock.calls[0][0];

    expect(prompt).toContain("16:9 横版生物设定板");
    expect(prompt).toContain("物种/族群素材");
    expect(prompt).toContain("行为逻辑");
    expect(prompt).toContain("废墟边界");
    expect(prompt).toContain("形态/解剖标注");
    expect(result.fileName).toBe("creature-board.png");
  });

  it("creates a self-created scene material with panorama metadata and first block scene preview", async () => {
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

    const material = await createSceneMaterial(input, Object.values(input.blocks[0].panorama!.faces ?? {}), "zh-CN");

    expect(mocks.prisma.storyMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "SCENE",
          communityVisible: true,
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
          previewUrl: "https://cdn.example.com/scene/main-mother.png",
          style: "MYSTERY",
          titleZh: "废弃研究所"
        })
      })
    );
    expect(material).toMatchObject({
      category: "scene",
      previewUrl: "https://cdn.example.com/scene/main-mother.png",
      title: "废弃研究所"
    });
  });

  it("normalizes scene record failures while keeping uploaded face cleanup best-effort", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { createSceneMaterial } = await import("@/lib/home-workspace");
    const input = createSceneInput();
    const uploadedFaceUrls = Object.values(input.blocks[0].panorama!.faces ?? {});

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

    await generateSceneBlockPanorama(createSceneInput({ panoramaDrawingStyle: "guofeng" }), "block-main", "zh-CN", {
      motherImage: createSceneMotherReference()
    });

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
      }),
      expect.objectContaining({
        maxRedrawAttempts: 1,
        motherImage: expect.objectContaining({ fileName: "mother.png" })
      })
    );
  });

  it("generates a scene panorama mother separately with reference images", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { generateSceneBlockPanoramaMother } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });
    vi.mocked(generateDefaultScenePanoramaMother).mockResolvedValue({
      attempt: 1,
      mother: {
        contentType: "image/png",
        dataUrl: "data:image/png;base64,bW90aGVy",
        fileName: "mother.png"
      },
      quality: {
        bandDelta: 0,
        edgeDelta: 0,
        horizonPeakShiftRatio: 0,
        issues: [],
        lumaDelta: 0,
        passed: true,
        score: 0,
        seamComplexityRatio: 1,
        thresholds: {
          bandDelta: 28,
          edgeDelta: 18,
          horizonPeakShiftRatio: 0.06,
          lumaDelta: 18,
          seamComplexityRatio: 1.8
        }
      },
      qualityPassed: true,
      sizeProfile: "4k"
    });

    await generateSceneBlockPanoramaMother(createSceneInput({ panoramaDrawingStyle: "guofeng" }), "block-main", "zh-CN", {
      referenceImages: [createSceneMotherReference()]
    });

    expect(generateDefaultScenePanoramaMother).toHaveBeenCalledWith(
      expect.objectContaining({
        blockName: "主厅",
        panoramaDrawingStyle: "guofeng"
      }),
      "reader-id",
      expect.objectContaining({
        feature: "scene.block.panorama.mother.generate"
      }),
      expect.objectContaining({
        referenceImages: [expect.objectContaining({ fileName: "mother.png" })]
      })
    );
  });

  it("accepts generated panorama mother URLs above the normal 10MB image limit", async () => {
    const { prepareScenePanoramaMotherImage } = await import("@/lib/home-workspace");
    const bytes = Buffer.alloc(10 * 1024 * 1024 + 1, 7);
    const fetchMock = vi.fn(async () =>
      new Response(bytes, {
        headers: { "Content-Type": "image/webp" },
        status: 200
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await prepareScenePanoramaMotherImage(null, "https://cdn.example.com/panoramas/mother.webp", "https://app.example.com");

    expect(result).toMatchObject({
      contentType: "image/webp",
      fileName: "scene-panorama-mother.png"
    });
    expect(result.bytes.byteLength).toBe(bytes.byteLength);
    expect(isValidScenePanoramaImageBytes).toHaveBeenCalledWith(expect.any(Buffer), "image/webp");
  });

  it("accepts generated panorama mother files above the normal 10MB image limit", async () => {
    const { prepareScenePanoramaMotherImage } = await import("@/lib/home-workspace");
    const file = new File([Buffer.alloc(10 * 1024 * 1024 + 1, 3)], "mother.webp", { type: "image/webp" });

    const result = await prepareScenePanoramaMotherImage(file, null, "https://app.example.com", {
      allowOversizeFile: true
    });

    expect(result).toMatchObject({
      contentType: "image/webp",
      fileName: "mother.webp"
    });
    expect(result.bytes.byteLength).toBe(file.size);
  });

  it("passes the generated panorama oversize allowance to storage upload helpers", async () => {
    const { uploadScenePanoramaFace, uploadScenePanoramaMother } = await import("@/lib/home-workspace");
    const file = new File([Buffer.alloc(10 * 1024 * 1024 + 1, 5)], "panorama.webp", { type: "image/webp" });

    await uploadScenePanoramaFace("reader-id", file, { allowOversize: true });
    await uploadScenePanoramaMother("reader-id", file, { allowOversize: true });

    const { uploadScenePanoramaFaceImage, uploadScenePanoramaMotherImage } = await import("@/lib/storage/material");

    expect(uploadScenePanoramaFaceImage).toHaveBeenCalledWith("reader-id", file, { allowOversize: true });
    expect(uploadScenePanoramaMotherImage).toHaveBeenCalledWith("reader-id", file, { allowOversize: true });
  });

  it("streams scene panorama progress with the selected iteration count", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { streamDefaultScenePanorama } = await import("@/lib/ai/image-runtime");
    const { streamSceneBlockPanorama } = await import("@/lib/home-workspace");
    const events: Array<{ type: string; progress?: number }> = [];

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });
    vi.mocked(streamDefaultScenePanorama).mockImplementation(async (_input, _userId, onEvent) => {
      await onEvent({ messageKey: "sceneForm.panoramaProgressMother", progress: 8, stage: "mother-generating", type: "progress" });

      return {
        faces: createGeneratedSceneFaces(),
        mode: "enhanced",
        repaired: true
      };
    });

    await streamSceneBlockPanorama(
      createSceneInput({ panoramaDrawingStyle: "concept" }),
      "block-main",
      "zh-CN",
      (event) => {
        events.push(event);
      },
      { maxRedrawAttempts: 4, motherImage: createSceneMotherReference() }
    );

    expect(events).toContainEqual(expect.objectContaining({ progress: 8, type: "progress" }));
    expect(streamDefaultScenePanorama).toHaveBeenCalledWith(
      expect.objectContaining({ panoramaDrawingStyle: "concept" }),
      "reader-id",
      expect.any(Function),
      expect.objectContaining({
        feature: "scene.block.panorama.generate"
      }),
      expect.objectContaining({
        maxRedrawAttempts: 4
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

  it("updates only the current user's self-created creature material", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { updateCreatureMaterial } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });

    const existingMaterial = {
      ...createMaterial("creature-mistguard", "CREATURE", "雾卫兽", "Mistguard", "FANTASY"),
      id: "created-creature-id",
      previewUrl: "https://cdn.example.com/materials/old-creature-board.png",
      metadata: createCreatureMetadata()
    };

    mocks.prisma.storyMaterialLibraryEntry.findFirst.mockResolvedValue({
      id: "entry-id",
      userId: "reader-id",
      materialId: "created-creature-id",
      source: "SELF_CREATED",
      createdAt,
      updatedAt: createdAt,
      material: existingMaterial
    });

    const material = await updateCreatureMaterial(
      "created-creature-id",
      createCreatureInput({
        behaviorLogic: "改后逻辑：先远距离警戒，只在巢穴受威胁时群体驱赶。",
        name: "雾卫兽·改"
      }),
      null,
      "keep",
      "zh-CN"
    );

    expect(mocks.prisma.storyMaterial.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "created-creature-id" },
        data: expect.objectContaining({
          category: "CREATURE",
          metadata: expect.objectContaining({
            behaviorLogic: "改后逻辑：先远距离警戒，只在巢穴受威胁时群体驱赶。",
            boardImage: {
              source: "generated",
              url: "https://cdn.example.com/materials/old-creature-board.png"
            },
            kind: "creature",
            name: "雾卫兽·改",
            subject: "species"
          }),
          previewUrl: "https://cdn.example.com/materials/old-creature-board.png",
          titleZh: "雾卫兽·改"
        })
      })
    );
    expect(material).toMatchObject({
      category: "creature",
      id: "created-creature-id",
      librarySource: "SELF_CREATED",
      previewUrl: "https://cdn.example.com/materials/old-creature-board.png",
      title: "雾卫兽·改"
    });
  });

  it("rejects creature edits without a matching self-created library entry", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { updateCreatureMaterial } = await import("@/lib/home-workspace");

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });
    mocks.prisma.storyMaterialLibraryEntry.findFirst.mockResolvedValue(null);

    await expect(updateCreatureMaterial("community-creature-id", createCreatureInput(), null, "keep", "zh-CN")).rejects.toThrow(
      "MATERIAL_NOT_EDITABLE"
    );
    expect(mocks.prisma.storyMaterial.update).not.toHaveBeenCalled();
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

  it("keeps community sharing locked on for self-created materials", async () => {
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

    const material = await setMaterialCommunitySharing("created-mask-id", false, "zh-CN");

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

  it("exports creature material archives with creature data markdown", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { exportSelfCreatedMaterialsZip } = await import("@/lib/material-transfer");
    const existingMaterial = {
      ...createMaterial("creature-mistguard", "CREATURE", "雾卫兽", "Mistguard", "FANTASY"),
      id: "created-creature-id",
      descriptionZh: "雾卫兽是废墟边界的群居守卫生物，会通过低频鸣叫同步警戒。",
      previewUrl: "https://cdn.example.com/materials/old-creature-board.png",
      metadata: createCreatureMetadata()
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
      materialId: "created-creature-id",
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
      materialId: "created-creature-id",
      origin: "http://localhost:3000"
    });
    const zip = await JSZip.loadAsync(archive.bytes);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));
    const material = manifest.materials[0];
    const markdown = await zip.file("materials/creature-mistguard/material.md")!.async("text");

    expect(material).toMatchObject({
      category: "creature",
      image: expect.objectContaining({
        contentType: "image/png",
        path: expect.stringContaining("images/preview.png")
      }),
      metadata: expect.objectContaining({
        kind: "creature",
        subject: "species"
      })
    });
    expect(markdown).toContain("## 生物数据");
    expect(markdown).toContain("### 行为逻辑");
    expect(markdown).toContain("发现陌生气味后先围绕观察");
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
    expect(material.scenePanoramaMothers).toHaveLength(1);
    expect(material.scenePanoramaFaces.map((asset: { face: string }) => asset.face).sort()).toEqual(
      [...sceneFaceNames].sort()
    );
    expect(await zip.file(material.scenePanoramaFaces[0].image.path)!.async("uint8array")).toHaveLength(3);
    expect(await zip.file(material.scenePanoramaMothers[0].image.path)!.async("uint8array")).toHaveLength(3);
    expect(await zip.file("materials/scene-lab/material.md")!.async("text")).toContain("全景六面图");
    expect(await zip.file("materials/scene-lab/material.md")!.async("text")).toContain("全景母图");
  });

  it("exports item model input images, legacy six-view images, and GLB models", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { exportSelfCreatedMaterialsZip } = await import("@/lib/material-transfer");
    const existingMaterial = {
      ...createMaterial("item-scanner", "ITEM", "灵犀扫描器", "Scanner", "SCI_FI"),
      id: "created-item-id",
      previewUrl: "https://cdn.example.com/items/board.png",
      metadata: createItemMetadata()
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
      materialId: "created-item-id",
      source: "SELF_CREATED",
      createdAt,
      updatedAt: createdAt,
      material: existingMaterial
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith(".glb")) {
          return new Response(new Uint8Array([0x67, 0x6c, 0x54, 0x46]), { headers: { "Content-Type": "model/gltf-binary" } });
        }

        return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } });
      })
    );

    const archive = await exportSelfCreatedMaterialsZip({
      locale: "zh-CN",
      materialId: "created-item-id",
      origin: "http://localhost:3000"
    });
    const zip = await JSZip.loadAsync(archive.bytes);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));
    const material = manifest.materials[0];

    expect(material.itemModelInputImage).toBeTruthy();
    expect(material.itemViewImages).toHaveLength(6);
    expect(material.itemModel).toMatchObject({
      contentType: "model/gltf-binary",
      fileName: "scanner.glb"
    });
    expect(await zip.file(material.itemViewImages[0].image.path)!.async("uint8array")).toHaveLength(3);
    expect(await zip.file(material.itemModelInputImage.image.path)!.async("uint8array")).toHaveLength(3);
    expect(await zip.file(material.itemModel.path)!.async("uint8array")).toHaveLength(4);
    expect(await zip.file("materials/item-scanner/material.md")!.async("text")).toContain("模型输入图");
    expect(await zip.file("materials/item-scanner/material.md")!.async("text")).toContain("历史六视图");
    expect(await zip.file("materials/item-scanner/material.md")!.async("text")).toContain("3D 模型");
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
          communityVisible: true,
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

  it("imports creature archives and rewrites board image metadata urls", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { importMaterialsZip } = await import("@/lib/material-transfer");
    const archive = await createCreatureMaterialArchiveBytes();

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
    expect(mocks.prisma.storyMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "CREATURE",
          communityVisible: true,
          metadata: expect.objectContaining({
            boardImage: {
              source: "generated",
              url: "https://cdn.example.com/materials/imported-board.png"
            },
            kind: "creature",
            subject: "species"
          }),
          previewUrl: "https://cdn.example.com/materials/imported-board.png",
          slug: expect.not.stringMatching(/^creature-mistguard$/)
        })
      })
    );
    expect(result).toMatchObject({
      importedCount: 1,
      materials: [
        {
          category: "creature",
          inLibrary: true,
          librarySource: "SELF_CREATED",
          title: "雾卫兽"
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

    expect(uploadMaterialImageBytes).toHaveBeenCalledTimes(7);
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
                  }),
                  mother: {
                    source: "generated",
                    url: "https://cdn.example.com/materials/imported-board.png"
                  }
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

  it("imports item model input images, legacy six-view images, and GLB models", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { importMaterialsZip } = await import("@/lib/material-transfer");
    const archive = await createItemMaterialArchiveBytes();

    vi.mocked(requireAuth).mockResolvedValue({
      account: "reader",
      avatarUrl: null,
      displayName: "reader",
      id: "reader-id",
      role: "USER",
      showAiThinking: false
    });

    const result = await importMaterialsZip(archive, "zh-CN");

    expect(uploadMaterialImageBytes).toHaveBeenCalledTimes(8);
    expect(uploadItemModelBytes).toHaveBeenCalledWith(
      "reader-id",
      expect.any(Uint8Array),
      "model/gltf-binary",
      "scanner.glb"
    );
    expect(mocks.prisma.storyMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "ITEM",
          metadata: expect.objectContaining({
            kind: "item",
            model3d: expect.objectContaining({
              source: "instantmesh",
              url: "https://cdn.example.com/materials/imported-model.glb"
            }),
            modelInputImage: expect.objectContaining({
              url: "https://cdn.example.com/materials/imported-board.png"
            }),
            viewImages: expect.objectContaining({
              front: expect.objectContaining({
                url: "https://cdn.example.com/materials/imported-board.png"
              })
            })
          }),
          previewUrl: "https://cdn.example.com/materials/imported-board.png"
        })
      })
    );
    expect(result.importedCount).toBe(1);
  });

  it("anchors panorama face edge pixels to the mother reference while preserving the center", async () => {
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

    const stabilized = await stabilizeScenePanoramaFaces(referenceFaces, candidateFaces, { faceSize: 64 });
    const stabilizedEdgePixel = await readImagePixel(stabilized[0].bytes, 0, 0);
    const candidateEdgePixel = await readImagePixel(candidateFaces[0].bytes, 0, 0);
    const referenceEdgePixel = await readImagePixel(referenceFaces[0].bytes, 0, 0);
    const stabilizedCenterPixel = await readImagePixel(stabilized[0].bytes, 32, 32);
    const candidateCenterPixel = await readImagePixel(candidateFaces[0].bytes, 32, 32);

    expect(averageRgbDelta(stabilizedEdgePixel, referenceEdgePixel)).toBeLessThan(30);
    expect(averageRgbDelta(stabilizedEdgePixel, candidateEdgePixel)).toBeGreaterThan(40);
    expect(averageRgbDelta(stabilizedCenterPixel, candidateCenterPixel)).toBeLessThan(8);
    expect(stabilized.every((face) => face.contentType === "image/webp" && face.fileName.endsWith(".webp"))).toBe(true);
  });

  it("reports low edge and inner-band deltas for production-ready stabilized panorama faces", async () => {
    const referenceFaces = await Promise.all(
      scenePanoramaPostprocessFaces.map(async (face) => ({
        face,
        fileName: `${face}.png`,
        contentType: "image/png",
        bytes: await createSolidFacePng(96, 132, 168)
      }))
    );
    const candidateFaces = await Promise.all(
      scenePanoramaPostprocessFaces.map(async (face) => ({
        face,
        fileName: `${face}.png`,
        contentType: "image/png",
        bytes: await createSolidFacePng(200, 96, 72)
      }))
    );

    const stabilized = await stabilizeScenePanoramaFaces(referenceFaces, candidateFaces, { faceSize: 64 });
    const quality = await analyzeScenePanoramaFaces(stabilized, { faceSize: 64 });

    expect(quality.edgeDeltas).toHaveLength(12);
    expect(quality.innerBandDeltas).toHaveLength(12);
    expect(quality.maxEdgeDelta).toBeLessThan(4);
    expect(quality.maxInnerBandDelta).toBeLessThan(4);
    expect(quality.totalBytes).toBeGreaterThan(0);
  });

  it("rotates cubemap sampling so the back face center avoids the equirectangular seam", () => {
    const normalizedWidth = 4096;
    const normalizedHeight = 2048;
    const front = getScenePanoramaFaceSourceCoordinate("front", 0, 0, { normalizedHeight, normalizedWidth });
    const back = getScenePanoramaFaceSourceCoordinate("back", 0, 0, { normalizedHeight, normalizedWidth });
    const right = getScenePanoramaFaceSourceCoordinate("right", 0, 0, { normalizedHeight, normalizedWidth });
    const left = getScenePanoramaFaceSourceCoordinate("left", 0, 0, { normalizedHeight, normalizedWidth });

    expect(front.sourceX).toBeCloseTo(normalizedWidth * 0.625, 0);
    expect(right.sourceX).toBeCloseTo(normalizedWidth * 0.875, 0);
    expect(back.sourceX).toBeCloseTo(normalizedWidth * 0.125, 0);
    expect(left.sourceX).toBeCloseTo(normalizedWidth * 0.375, 0);
    expect(back.sourceX).toBeGreaterThan(normalizedWidth * 0.1);
    expect(back.sourceX).toBeLessThan(normalizedWidth * 0.15);
  });

  it("keeps cubemap adjacent edges continuous after yaw rotation", async () => {
    const mother = await createSmoothEquirectangularPng(256, 128);
    const faces = await splitEquirectangularToCubemap(mother, {
      faceSize: 64,
      normalizedHeight: 128,
      normalizedWidth: 256
    });
    const quality = await analyzeScenePanoramaFaces(faces, { faceSize: 64 });

    expect(quality.edgeDeltas).toHaveLength(12);
    expect(quality.maxEdgeDelta).toBeLessThan(12);
    expect(quality.edgeDeltas.find((edge) => edge.firstFace === "right" && edge.secondFace === "back")?.delta).toBeLessThan(12);
    expect(quality.edgeDeltas.find((edge) => edge.firstFace === "left" && edge.secondFace === "back")?.delta).toBeLessThan(12);
    expect(quality.edgeDeltas.find((edge) => edge.firstFace === "back" && edge.secondFace === "top")?.delta).toBeLessThan(12);
    expect(quality.edgeDeltas.find((edge) => edge.firstFace === "back" && edge.secondFace === "bottom")?.delta).toBeLessThan(12);
  });

  it("keeps AI face details away from the anchored stitching band", async () => {
    const candidateBytes = await createCheckerFacePng();
    const referenceBytes = await createCheckerFacePng({ edgeColor: [128, 128, 128], edgeWidth: 12 });
    const candidateFaces = scenePanoramaPostprocessFaces.map((face) => ({
      face,
      fileName: `${face}.png`,
      contentType: "image/png",
      bytes: candidateBytes
    }));
    const referenceFaces = scenePanoramaPostprocessFaces.map((face) => ({
      face,
      fileName: `${face}.png`,
      contentType: "image/png",
      bytes: referenceBytes
    }));

    const stabilized = await stabilizeScenePanoramaFaces(referenceFaces, candidateFaces, { faceSize: 1024 });
    const originalEdgePixel = await readImagePixel(candidateBytes, 4, 4);
    const stabilizedEdgePixel = await readImagePixel(stabilized[0].bytes, 4, 4);
    const referenceEdgePixel = await readImagePixel(referenceBytes, 4, 4);
    const originalCenterPixel = await readImagePixel(candidateBytes, 512, 512);
    const stabilizedCenterPixel = await readImagePixel(stabilized[0].bytes, 512, 512);

    expect(averageRgbDelta(referenceEdgePixel, stabilizedEdgePixel)).toBeLessThan(averageRgbDelta(referenceEdgePixel, originalEdgePixel));
    expect(averageRgbDelta(originalCenterPixel, stabilizedCenterPixel)).toBeLessThan(18);
  });

  it("uses pixel-faithful face prompts without mask or seam-protection wording", async () => {
    const source = await readFile("src/lib/ai/image-runtime/scene-panorama-prompts.ts", "utf8");
    const promptSource = source.slice(
      source.indexOf("function buildScenePanoramaFacePrompt"),
      source.indexOf("function getScenePanoramaFaceDescription")
    );

    expect(promptSource).not.toContain("mask");
    expect(promptSource).not.toContain("protected seam strip");
    expect(promptSource).not.toContain("outer 5%");
    expect(promptSource).not.toContain("透明中心区域");
    expect(promptSource).not.toContain("受保护接缝区");
    expect(promptSource).toContain("pixel-faithful image upscaling");
    expect(promptSource).toContain("same pixel positions");
    expect(promptSource).toContain("像素级忠实升级");
    expect(promptSource).toContain("高清恢复");
    expect(promptSource).toContain("相同像素位置");
    expect(promptSource).toContain("不要新增物体、删除物体、移动物体");
    expect(promptSource).toContain("边缘必须清晰、连续、可拼接");
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

describe("map materials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes map drafts and builds markdown and projection payloads", () => {
    const baseDraft = createDefaultMapDraft();
    const seededDraft = applyPatchToMapDraft(baseDraft, {
      addNodes: [
        {
          name: "悬空城",
          description: "城市核心",
          type: "country",
          x: -0.25,
          y: 0.1
        },
        {
          name: "北境行省",
          description: "主要行政区域",
          type: "region",
          x: 0.45,
          y: 0.2
        }
      ]
    });
    const patchedDraft = applyPatchToMapDraft(seededDraft, {
      name: "悬空城地图",
      description: "记录悬空城各层关系的地图素材。",
      communityVisible: true,
      style: "sciFi",
      addNodes: [
        {
          name: "风道",
          description: "贯穿城市的高空风道",
          type: "path",
          x: 1.25,
          y: 0.45
        }
      ],
      addEdges: [
        {
          source: seededDraft.nodes[0].id,
          target: seededDraft.nodes[1].id,
          relation: "connects",
          description: "主城连通行省"
        }
      ]
    });
    const metadata = buildMapMaterialMetadata(patchedDraft);

    expect(validateMapDraftForSave(patchedDraft)).toBe("");
    expect(validateMapDraftForGraphSave(patchedDraft)).toBe("");
    expect(validateMapDraftForSave({ ...patchedDraft, name: "" } as typeof patchedDraft)).toBe("mapForm.errors.nameRequired");
    expect(patchedDraft.nodes).toHaveLength(3);
    expect(patchedDraft.edges).toHaveLength(1);
    expect(metadata).toMatchObject({
      kind: "map",
      name: "悬空城地图",
      style: "sciFi"
    });

    const markdown = formatMaterialMarkdown(
      {
        slug: "floating-city-map",
        category: "map",
        style: "sciFi",
        titleZh: "悬空城地图",
        titleEn: "Floating City Map",
        descriptionZh: "记录悬空城各层关系的地图素材。",
        descriptionEn: "A map of the floating city.",
        metadata,
        image: null
      },
      "zh-CN"
    );
    const payload = buildMapMaterialProjectionPayload("map-city", metadata);

    expect(markdown).toContain("地图数据");
    expect(markdown).toContain("节点");
    expect(markdown).toContain("关系");
    expect(markdown).toContain("悬空城");
    expect(markdown).toContain("悬空城 (");
    expect(markdown).toContain("北境行省 (");
    expect(markdown).toContain("主城连通行省");
    expect(payload).toMatchObject({
      materialId: "map-city",
      name: "悬空城地图",
      description: "记录悬空城各层关系的地图素材。",
      style: "sciFi"
    });
    expect(payload.nodes).toHaveLength(3);
    expect(payload.edges).toHaveLength(1);

    expect(
      buildMapMaterialMetadata(patchedDraft, {
        edgeCount: patchedDraft.edges.length,
        generatedAt: "2026-05-27T00:00:00.000Z",
        graphSignature: "map-signature",
        iterationCount: 2,
        nodeBatchSize: 10,
        nodeCount: patchedDraft.nodes.length,
        referencePrompt: "沿用蓝色海岸和手绘地形符号",
        source: "generated",
        url: "https://cdn.example.com/materials/map-image.png"
      }).image
    ).toMatchObject({
      graphSignature: "map-signature",
      source: "generated",
      url: "https://cdn.example.com/materials/map-image.png"
    });
  });

  it("builds stable map image batches and graph signatures", () => {
    const input: MapMaterialCreateInput = {
      ...createDefaultMapDraft(),
      name: "批次地图",
      description: "用于测试地图图像逐轮生成。",
      nodes: [
        {
          id: "node-city",
          name: "王城",
          description: "",
          type: "city",
          x: 3,
          y: 3
        },
        {
          id: "node-country",
          name: "王国",
          description: "",
          type: "country",
          x: 1,
          y: 1
        },
        {
          id: "node-path",
          name: "旧路",
          description: "",
          type: "path",
          x: 4,
          y: 4
        },
        {
          id: "node-region",
          name: "北境",
          description: "",
          type: "region",
          x: 2,
          y: 2
        }
      ],
      edges: [
        {
          id: "edge-country-region",
          relation: "contains",
          source: "node-country",
          target: "node-region",
          description: "王国包含北境"
        },
        {
          id: "edge-region-city",
          relation: "contains",
          source: "node-region",
          target: "node-city",
          description: "北境包含王城"
        },
        {
          id: "edge-country-path",
          relation: "connects",
          source: "node-country",
          target: "node-path",
          description: "王国连接旧路"
        }
      ]
    };
    const batches = buildMapImageNodeBatches(input, 2);
    const reorderedInput: MapMaterialCreateInput = {
      ...input,
      nodes: [...input.nodes].reverse(),
      edges: [...input.edges].reverse()
    };

    expect(normalizeMapImageNodeBatchSize(undefined)).toBe(10);
    expect(normalizeMapImageNodeBatchSize(0)).toBe(1);
    expect(normalizeMapImageNodeBatchSize(150)).toBe(100);
    expect(batches.map((batch) => batch.nodes.map((node) => node.id))).toEqual([
      ["node-country", "node-region"],
      ["node-city", "node-path"]
    ]);
    expect(batches[0].edges.map((edge) => edge.id)).toEqual(["edge-country-region"]);
    expect(batches[1].edges.map((edge) => edge.id).sort()).toEqual(["edge-country-path", "edge-region-city"]);
    expect(buildMapGraphSignature(input)).toBe(buildMapGraphSignature(reorderedInput));
  });

  it("streams map image events and uses the previous image as the next reference", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { streamMapImage } = await import("@/lib/home-workspace");
    const input = createMapImageStreamInput();
    const events: MapImageStreamEvent[] = [];

    vi.mocked(generateDefaultMapImage).mockReset();
    vi.mocked(requireAuth).mockResolvedValue({
      id: "viewer-id"
    } as never);
    vi.mocked(generateDefaultMapImage)
      .mockResolvedValueOnce({
        contentType: "image/png",
        dataUrl: "data:image/png;base64,cm91bmQtMQ==",
        fileName: "round-1.png"
      })
      .mockResolvedValueOnce({
        contentType: "image/png",
        dataUrl: "data:image/png;base64,cm91bmQtMg==",
        fileName: "round-2.png"
      });

    const result = await streamMapImage(input, "zh-CN", (event) => {
      events.push(event);
    }, {
      nodeBatchSize: 1,
      referenceImages: [
        {
          bytes: Buffer.from("reference"),
          contentType: "image/png",
          fileName: "reference.png"
        }
      ],
      referencePrompt: "沿用参考图中的海岸线和手绘地图符号"
    });

    expect(events.map((event) => event.type)).toEqual(["progress", "image", "progress", "image", "done"]);
    expect(result.type).toBe("done");
    if (result.type !== "done") {
      throw new Error("Expected map image stream to finish.");
    }
    expect(result.image.dataUrl).toBe("data:image/png;base64,cm91bmQtMg==");
    expect(result.nodeBatchSize).toBe(1);
    expect(result.iterationCount).toBe(2);
    expect(result.referencePrompt).toBe("沿用参考图中的海岸线和手绘地图符号");
    expect(vi.mocked(generateDefaultMapImage)).toHaveBeenCalledTimes(2);
    const firstCallReferences = vi.mocked(generateDefaultMapImage).mock.calls[0][3]?.referenceImages ?? [];
    const secondCallReferences = vi.mocked(generateDefaultMapImage).mock.calls[1][3]?.referenceImages ?? [];

    expect(firstCallReferences).toHaveLength(1);
    expect(secondCallReferences).toHaveLength(2);
    expect(secondCallReferences[0]).toMatchObject({
      contentType: "image/png",
      fileName: "round-1.png"
    });
    expect(secondCallReferences[0]?.bytes.toString()).toBe("round-1");
    expect(secondCallReferences[1]).toMatchObject({
      contentType: "image/png",
      fileName: "reference.png"
    });
    expect(secondCallReferences[1]?.bytes.toString()).toBe("reference");
  });

  it("pauses map image generation after retries and keeps the last successful image", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { streamMapImage } = await import("@/lib/home-workspace");
    const input = createMapImageStreamInput();
    const events: MapImageStreamEvent[] = [];

    vi.mocked(generateDefaultMapImage).mockReset();
    vi.mocked(requireAuth).mockResolvedValue({
      id: "viewer-id"
    } as never);
    vi.mocked(generateDefaultMapImage)
      .mockResolvedValueOnce({
        contentType: "image/png",
        dataUrl: "data:image/png;base64,Zmlyc3Q=",
        fileName: "first.png"
      })
      .mockRejectedValueOnce(new Error("ROUND_FAILED"))
      .mockRejectedValueOnce(new Error("ROUND_FAILED"))
      .mockRejectedValueOnce(new Error("ROUND_FAILED"));

    const result = await streamMapImage(input, "zh-CN", (event) => {
      events.push(event);
    }, {
      nodeBatchSize: 1,
      referencePrompt: "保留上一轮地图结构"
    });

    expect(result.type).toBe("paused");
    if (result.type !== "paused") {
      throw new Error("Expected map image stream to pause.");
    }
    expect(result.failedRound).toBe(2);
    expect(result.image?.dataUrl).toBe("data:image/png;base64,Zmlyc3Q=");
    expect(result.completedNodeIds).toEqual(["node-country"]);
    expect(events.at(-1)).toMatchObject({
      type: "paused",
      failedRound: 2,
      image: expect.objectContaining({
        fileName: "first.png"
      })
    });
    expect(vi.mocked(generateDefaultMapImage)).toHaveBeenCalledTimes(4);
  });

  it("generates a pure outline preview from the final map image", async () => {
    const sourceBytes = await sharp({
      create: {
        background: { alpha: 1, b: 255, g: 255, r: 255 },
        channels: 4,
        height: 64,
        width: 64
      }
    })
      .composite([
        {
          input: Buffer.from('<svg width="64" height="64"><rect x="16" y="16" width="32" height="32" fill="black"/></svg>')
        }
      ])
      .png()
      .toBuffer();

    const outline = await generateMapImageOutlinePreview(sourceBytes);
    const outlineBytes = Buffer.from(outline.dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
    const { data } = await sharp(outlineBytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let blackPixelCount = 0;

    for (let index = 0; index < data.length; index += 4) {
      if (data[index] < 24 && data[index + 1] < 24 && data[index + 2] < 24) {
        blackPixelCount += 1;
      }
    }

    expect(outline).toMatchObject({
      contentType: "image/png",
      fileName: "map-outline.png",
      height: 64,
      width: 64
    });
    expect(outline.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(blackPixelCount).toBeGreaterThan(0);
  });

  it("lays out map graph nodes with stable finite coordinates", () => {
    const nodes: MapMaterialCreateInput["nodes"] = [
      {
        id: "node-city-b",
        type: "city",
        name: "乙城",
        description: "",
        x: 10,
        y: 10
      },
      {
        id: "node-country",
        type: "country",
        name: "王国",
        description: "",
        x: 10,
        y: 10
      },
      {
        id: "node-city-a",
        type: "city",
        name: "甲城",
        description: "",
        x: 10,
        y: 10
      }
    ];
    const edges: MapMaterialCreateInput["edges"] = [
      {
        id: "edge-a",
        relation: "contains",
        source: "node-country",
        target: "node-city-a",
        description: ""
      },
      {
        id: "edge-b",
        relation: "connects",
        source: "node-city-a",
        target: "node-city-b",
        description: ""
      }
    ];
    const first = layoutMapGraphNodes(nodes, edges);
    const second = layoutMapGraphNodes([...nodes].reverse(), [...edges].reverse());

    expect(layoutMapGraphNodes([], [])).toEqual([]);
    expect(layoutMapGraphNodes([nodes[0]], [])).toEqual([{ id: "node-city-b", x: 0, y: 0 }]);
    expect(first).toEqual(second);
    expect(first.map((node) => node.id).sort()).toEqual(["node-city-a", "node-city-b", "node-country"]);
    for (const node of first) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it("keeps formatted map graph nodes separated", () => {
    const nodes: MapMaterialCreateInput["nodes"] = Array.from({ length: 8 }, (_, index) => ({
      id: `node-${index}`,
      type: index === 0 ? "country" : index % 3 === 0 ? "region" : "city",
      name: `节点 ${index}`,
      description: "",
      x: 0,
      y: 0
    }));
    const edges: MapMaterialCreateInput["edges"] = nodes.slice(1).map((node, index) => ({
      id: `edge-${index}`,
      relation: index % 2 === 0 ? "contains" : "connects",
      source: "node-0",
      target: node.id,
      description: ""
    }));
    const layout = layoutMapGraphNodes(nodes, edges);
    const minDistance = layout.reduce((currentMin, left, leftIndex) => {
      const nextMin = layout.slice(leftIndex + 1).reduce(
        (innerMin, right) => Math.min(innerMin, Math.hypot(right.x - left.x, right.y - left.y)),
        currentMin
      );

      return nextMin;
    }, Number.POSITIVE_INFINITY);

    expect(minDistance).toBeGreaterThanOrEqual(2.4);
  });

  it("scales map graph node size by relation count first", () => {
    const isolatedCity = getMapGraphNodeBaseSize("city", 0);
    const connectedVillage = getMapGraphNodeBaseSize("village", 4);
    const connectedCountry = getMapGraphNodeBaseSize("country", 4);

    expect(connectedVillage).toBeGreaterThan(isolatedCity);
    expect(connectedCountry).toBeGreaterThan(connectedVillage);
    expect(getMapGraphNodeBaseSize("landmark", Number.NaN)).toBe(getMapGraphNodeBaseSize("landmark", 0));
  });

  it("builds and sanitizes map AI patches", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { generateDefaultLlmReply } = await import("@/lib/ai/runtime");

    vi.mocked(requireAuth).mockResolvedValue({
      id: "viewer-id"
    } as never);
    vi.mocked(generateDefaultLlmReply).mockResolvedValueOnce({
      content: JSON.stringify({
        message: "已补全图谱结构。",
        patch: {
          communityVisible: true,
          addNodes: [
            {
              id: "Wind Route",
              type: "path",
              name: " 风道 ",
              description: " 贯穿城内的高空风道 "
            }
          ],
          addEdges: [
            {
              id: "Route Link",
              relation: "connects",
              source: "Wind Route",
              target: "node-city",
              description: " 连接路径 "
            }
          ],
        }
      }),
      usage: {
        promptTokens: 12,
        completionTokens: 18,
        estimated: false
      }
    });

    const input: MapMaterialCreateInput = {
      ...createDefaultMapDraft(),
      name: "悬空城地图",
      description: "记录环层街区和风道关系。",
      style: "sciFi"
    };
    const messages = buildMapAssistMessages(input, "补充一个风道节点和关系", "zh-CN");
    const sanitized = sanitizeMapDraftPatch({
      addNodes: [
        {
          id: "Node 1",
          type: "not-a-type",
          name: "  观测塔  ",
          description: " 监测点 "
        }
      ],
      addEdges: [
        {
          id: "Edge 1",
          relation: "invalid",
          source: "Node 1",
          target: "node-city",
          description: "  连接 "
        }
      ],
      removeNodeIds: [" Node 1 "]
    });
    const result = await assistMapDraft(input, "补充一个风道节点和关系", "zh-CN");

    expect(messages[0].content).toContain("Node types must be one of country");
    expect(messages[0].content).not.toContain("communityVisible");
    expect(messages[1].content).toContain("补充一个风道节点和关系");
    expect(sanitized).toMatchObject({
      addNodes: [
        {
          id: "node-1",
          type: "landmark",
          name: "观测塔"
        }
      ],
      addEdges: [
        {
          id: "edge-1",
          relation: "connects",
          source: "node-1",
          target: "node-city"
        }
      ],
      removeNodeIds: ["node-1"]
    });
    expect(result).toMatchObject({
      message: "已补全图谱结构。",
      patch: {
        addNodes: [
          {
            id: "wind-route",
            type: "path",
            name: "风道"
          }
        ],
        addEdges: [
          {
            id: "route-link",
            relation: "connects",
            source: "wind-route",
            target: "node-city"
          }
        ]
      }
    });
  });

  it("builds derive round prompts and remaps conflicting ids", async () => {
    const { requireAuth } = await import("@/lib/auth");
    const { generateDefaultLlmReply } = await import("@/lib/ai/runtime");

    vi.mocked(requireAuth).mockResolvedValue({
      id: "viewer-id"
    } as never);
    vi.mocked(generateDefaultLlmReply).mockResolvedValueOnce({
      content: JSON.stringify({
        message: "已围绕王城继续生长。",
        addNodes: [
          {
            id: "node-city",
            type: "city",
            name: "王港",
            description: "从王城生长出的港湾节点。"
          },
          {
            id: "wind-route",
            type: "path",
            name: "风道",
            description: "贯穿城区上空的风道。"
          }
        ],
        addEdges: [
          {
            id: "node-city-link",
            relation: "connects",
            source: "node-city",
            target: "wind-route",
            description: "新旧节点相连"
          },
          {
            id: "wind-route-link",
            relation: "connects",
            source: "wind-route",
            target: "node-country",
            description: "风道接回旧城"
          },
          {
            id: "invalid-loop",
            relation: "invalid",
            source: "wind-route",
            target: "wind-route",
            description: "无效关系"
          }
        ],
        updateNodes: [
          {
            id: "node-city",
            name: "should drop"
          }
        ]
      }),
      usage: {
        promptTokens: 18,
        completionTokens: 22,
        estimated: false
      }
    });

    const input: MapMaterialCreateInput = {
      ...createDefaultMapDraft(),
      name: "悬空城地图",
      description: "记录环层街区和风道关系。",
      style: "sciFi",
      nodes: [
        {
          id: "node-country",
          type: "country",
          name: "悬空城",
          description: "环层都市的核心。",
          x: -0.2,
          y: -0.1
        },
        {
          id: "node-city",
          type: "city",
          name: "上层街区",
          description: "高空商业与居住区。",
          x: 0.8,
          y: 0.15
        }
      ],
      edges: [
        {
          id: "edge-connects",
          relation: "connects",
          source: "node-country",
          target: "node-city",
          description: "升降塔连接上下层"
        }
      ]
    };

    const prompt = buildMapDeriveRoundMessages(input, 2, 5, "zh-CN");
    const sanitized = sanitizeMapDeriveRoundPatch(
      {
        addNodes: [
          {
            id: "node-city",
            type: "city",
            name: "王港",
            description: "从王城生长出的港湾节点。"
          },
          {
            id: "wind-route",
            type: "path",
            name: "风道",
            description: "贯穿城区上空的风道。"
          }
        ],
        addEdges: [
          {
            id: "node-city-link",
            relation: "connects",
            source: "node-city",
            target: "wind-route",
            description: "新旧节点相连"
          },
          {
            id: "wind-route-link",
            relation: "connects",
            source: "wind-route",
            target: "node-country",
            description: "风道接回旧城"
          }
        ]
      },
      input
    );
    const result = await deriveMapGraphRound(input, 2, 5, "zh-CN");

    expect(prompt[0].content).toContain("Inspect the whole current map graph and choose the best growth direction yourself.");
    expect(prompt[1].content).toContain('"roundIndex":2');
    expect(prompt[1].content).toContain('"maxRounds":5');
    expect(prompt[1].content).toContain('"currentDraft"');
    expect(prompt[1].content).not.toContain("seedNodeId");
    expect(sanitized.addNodes).toHaveLength(2);
    expect(sanitized.addEdges).toHaveLength(2);
    expect(sanitized.addNodes?.[0]?.id).not.toBe("node-city");
    expect(sanitized.addEdges?.[0]).toMatchObject({
      source: sanitized.addNodes?.[0]?.id,
      target: sanitized.addNodes?.[1]?.id
    });
    expect(sanitizeMapDeriveRoundPatch({
      addNodes: [
        {
          id: "isolated",
          type: "landmark",
          name: "孤点",
          description: "没有接回旧节点。"
        }
      ],
      addEdges: []
    }, input)).toEqual({});
    expect(result).toMatchObject({
      message: "已围绕王城继续生长。",
      patch: {
        addNodes: expect.any(Array),
        addEdges: expect.any(Array)
      }
    });
    expect(result.patch.addNodes).toHaveLength(2);
    expect(result.patch.addEdges).toHaveLength(2);
  });
});

function createMapImageStreamInput(): MapMaterialCreateInput {
  return {
    ...createDefaultMapDraft(),
    name: "流式地图",
    description: "用于测试地图图像逐轮生成。",
    style: "sciFi",
    nodes: [
      {
        id: "node-country",
        name: "王国",
        description: "地图主体",
        type: "country",
        x: 0,
        y: 0
      },
      {
        id: "node-city",
        name: "王城",
        description: "核心城市",
        type: "city",
        x: 1,
        y: 1
      }
    ],
    edges: [
      {
        id: "edge-country-city",
        relation: "contains",
        source: "node-country",
        target: "node-city",
        description: "王国包含王城"
      }
    ]
  };
}

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

function createCreatureInput(overrides: Partial<CreatureMaterialCreateInput> = {}): CreatureMaterialCreateInput {
  return {
    name: "雾卫兽",
    description: "雾卫兽是废墟边界的群居守卫生物，会通过低频鸣叫同步警戒。",
    style: "fantasy",
    taxonomy: {
      creatureType: "雾生兽类"
    },
    morphology: {
      sizeClass: "中型",
      length: "2.4",
      weight: "120",
      limbStructure: "四足，前肢较长",
      bodyCovering: "雾化短毛",
      headFeature: "多眼冠状额骨",
      tailAppendage: "分叉尾",
      movement: "低伏奔跑",
      specialOrgans: "喉部低频共鸣囊"
    },
    colors: {
      primaryColor: "#2F5D46",
      secondaryColor: "#6E7F45",
      markingColor: "#FACC15",
      glowColor: "#67E8F9"
    },
    vocalization: {
      frequency: 50,
      rhythm: 50,
      volume: 50,
      emotionReadability: 50,
      mimicry: 20
    },
    senses: {
      sensoryAcuity: 55
    },
    ecology: {
      habitat: "废墟边界",
      diet: "杂食，偏食菌毯与小型腐食生物",
      activityCycle: "黄昏与雾夜活跃",
      socialStructure: "小群协作守巢",
      reproduction: "雾季分巢扩散"
    },
    abilities: {
      powers: ["嗅出谎言"],
      weaknesses: ["强光会打断雾化"],
      resourceNeeds: ["潮湿巢穴", "菌毯"],
      interactionUses: ["边界预警", "追踪陌生气味"],
      dangerNotes: ["靠近巢穴会被驱赶"],
      keywords: ["守卫", "低频鸣叫", "护巢"]
    },
    behaviorLogic: "发现陌生气味后先围绕观察；靠近巢穴时发出低频警告；持续逼近才集体驱赶。",
    behavior: {
      aggression: 45,
      sociability: 45,
      territoriality: 55,
      curiosity: 50,
      alertness: 86,
      stealth: 35,
      persistence: 55,
      adaptability: 50,
      tameability: 30,
      bonding: 35,
      threatResponse: 55,
      resourceGuarding: 78
    },
    boardDrawingStyle: "realistic",
    boardImageSource: "generated",
    ...overrides
  };
}

function createItemInput(overrides: Partial<ItemMaterialCreateInput> = {}): ItemMaterialCreateInput {
  return {
    name: "灵犀扫描器",
    itemCategory: "设备",
    description: "半透明的便携扫描装置。",
    traits: ["半透明外壳"],
    uses: ["医疗检查"],
    functions: ["扫描"],
    materials: ["半透明树脂"],
    colors: ["青色"],
    styles: ["赛博"],
    brand: "",
    model: "",
    keywords: ["扫描仪"],
    scaleHint: "约 18cm",
    style: "sciFi",
    boardDrawingStyle: "realistic",
    boardImageSource: "generated",
    modelInputImage: null,
    viewImages: {},
    model3d: null,
    ...overrides
  };
}

function createCreatureMetadata() {
  const input = createCreatureInput();

  return {
    kind: "creature",
    version: 1,
    subject: "species",
    name: input.name,
    description: input.description,
    style: input.style,
    taxonomy: input.taxonomy,
    morphology: input.morphology,
    colors: input.colors,
    vocalization: input.vocalization,
    senses: input.senses,
    ecology: input.ecology,
    abilities: input.abilities,
    behaviorLogic: input.behaviorLogic,
    behavior: input.behavior,
    boardDrawingStyle: input.boardDrawingStyle,
    boardImage: {
      source: "generated",
      url: "https://cdn.example.com/materials/old-creature-board.png"
    }
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
          }, {} as Record<(typeof sceneFaceNames)[number], string>),
          mother: {
            source: "generated",
            url: "https://cdn.example.com/scene/main-mother.png"
          }
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

function createSceneMotherReference() {
  return {
    bytes: Buffer.from("mother"),
    contentType: "image/png",
    fileName: "mother.png"
  };
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
          }, {} as Record<(typeof sceneFaceNames)[number], { url: string }>),
          mother: {
            source: "generated",
            url: "https://cdn.example.com/scene/main-mother.png"
          }
        }
      }
    ]
  };
}

function createItemMetadata() {
  return {
    kind: "item",
    version: 2,
    name: "灵犀扫描器",
    itemCategory: "设备",
    description: "半透明的便携扫描装置。",
    traits: ["半透明外壳"],
    uses: ["医疗检查"],
    functions: ["扫描"],
    materials: ["半透明树脂"],
    colors: ["青色"],
    styles: ["赛博"],
    brand: "",
    model: "",
    keywords: ["扫描仪"],
    scaleHint: "约 18cm",
    style: "sciFi",
    boardDrawingStyle: "realistic",
    boardImage: {
      source: "generated",
      url: "https://cdn.example.com/items/board.png"
    },
    modelInputImage: {
      source: "generated",
      url: "https://cdn.example.com/items/model-input.png"
    },
    viewImages: sceneFaceNames.reduce<Record<(typeof sceneFaceNames)[number], { source: "generated"; url: string }>>((views, face) => {
      views[face] = {
        source: "generated",
        url: `https://cdn.example.com/items/${face}.png`
      };

      return views;
    }, {} as Record<(typeof sceneFaceNames)[number], { source: "generated"; url: string }>),
    model3d: {
      byteSize: 4,
      contentType: "model/gltf-binary",
      fileName: "scanner.glb",
      source: "instantmesh",
      url: "https://cdn.example.com/items/scanner.glb"
    }
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

async function createSmoothEquirectangularPng(width: number, height: number) {
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const longitude = (x / width) * 2 * Math.PI - Math.PI;

      pixels[index] = Math.round(128 + 72 * Math.cos(longitude));
      pixels[index + 1] = Math.round(128 + 72 * Math.sin(longitude));
      pixels[index + 2] = Math.round(48 + (160 * y) / Math.max(1, height - 1));
      pixels[index + 3] = 255;
    }
  }

  return sharp(pixels, {
    raw: {
      channels: 4,
      height,
      width
    }
  })
    .png()
    .toBuffer();
}

async function createCheckerFacePng(options: { edgeColor?: [number, number, number]; edgeWidth?: number } = {}) {
  const size = 1024;
  const square = 16;
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const isEdge = options.edgeWidth
        ? x < options.edgeWidth || y < options.edgeWidth || x >= size - options.edgeWidth || y >= size - options.edgeWidth
        : false;
      const checker = (Math.floor(x / square) + Math.floor(y / square)) % 2 === 0;
      const color = isEdge && options.edgeColor
        ? options.edgeColor
        : checker
          ? [38, 72, 168]
          : [222, 234, 248];

      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = 255;
    }
  }

  return sharp(pixels, {
    raw: {
      channels: 4,
      height: size,
      width: size
    }
  })
    .png()
    .toBuffer();
}

async function readImagePixel(bytes: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const metadata = await sharp(bytes).metadata();
  const width = metadata.width ?? 0;
  const pixels = await sharp(bytes)
    .toColorspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer();
  const index = (y * width + x) * 4;

  return [pixels[index], pixels[index + 1], pixels[index + 2]];
}

function averageRgbDelta(first: [number, number, number], second: [number, number, number]) {
  return (
    Math.abs(first[0] - second[0]) +
    Math.abs(first[1] - second[1]) +
    Math.abs(first[2] - second[2])
  ) / 3;
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

async function createCreatureMaterialArchiveBytes() {
  const zip = new JSZip();
  const imagePath = "materials/creature-mistguard/images/preview.png";

  zip.file(imagePath, new Uint8Array([1, 2, 3]));
  zip.file(
    "manifest.json",
    JSON.stringify({
      exportedAt: "2026-05-21T00:00:00.000Z",
      format: "nwt.materials",
      version: 1,
      materials: [
        {
          slug: "creature-mistguard",
          category: "creature",
          style: "fantasy",
          titleZh: "雾卫兽",
          titleEn: "Mistguard",
          descriptionZh: "雾卫兽是废墟边界的群居守卫生物，会通过低频鸣叫同步警戒。",
          descriptionEn: "A social guardian species on ruin borders.",
          metadata: createCreatureMetadata(),
          image: {
            path: imagePath,
            fileName: "preview.png",
            contentType: "image/png",
            byteSize: 3
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
  const motherAsset = {
    blockId: "block-main",
    image: {
      path: "materials/scene-lab/panorama/block-main/mother.png",
      fileName: "mother.png",
      contentType: "image/png",
      byteSize: 3
    }
  };

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
          scenePanoramaFaces: faceAssets,
          scenePanoramaMothers: [motherAsset]
        }
      ]
    })
  );
  zip.file(motherAsset.image.path, new Uint8Array([1, 2, 3]));

  return zip.generateAsync({ type: "uint8array" });
}

async function createItemMaterialArchiveBytes() {
  const zip = new JSZip();
  const imagePath = "materials/item-scanner/images/preview.png";
  const modelInputImagePath = "materials/item-scanner/item-model-input/model-input.png";
  const viewAssets = sceneFaceNames.map((face) => {
    const path = `materials/item-scanner/item-views/${face}.png`;

    zip.file(path, new Uint8Array([1, 2, 3]));

    return {
      face,
      image: {
        path,
        fileName: `${face}.png`,
        contentType: "image/png",
        byteSize: 3
      }
    };
  });
  const modelPath = "materials/item-scanner/models/scanner.glb";

  zip.file(imagePath, new Uint8Array([1, 2, 3]));
  zip.file(modelInputImagePath, new Uint8Array([1, 2, 3]));
  zip.file(modelPath, new Uint8Array([0x67, 0x6c, 0x54, 0x46]));
  zip.file(
    "manifest.json",
    JSON.stringify({
      exportedAt: "2026-05-21T00:00:00.000Z",
      format: "nwt.materials",
      version: 1,
      materials: [
        {
          slug: "item-scanner",
          category: "item",
          style: "sciFi",
          titleZh: "灵犀扫描器",
          titleEn: "Scanner",
          descriptionZh: "半透明的便携扫描装置。",
          descriptionEn: "A translucent portable scanner.",
          metadata: createItemMetadata(),
          image: {
            path: imagePath,
            fileName: "preview.png",
            contentType: "image/png",
            byteSize: 3
          },
          itemModelInputImage: {
            image: {
              path: modelInputImagePath,
              fileName: "model-input.png",
              contentType: "image/png",
              byteSize: 3
            }
          },
          itemViewImages: viewAssets,
          itemModel: {
            path: modelPath,
            fileName: "scanner.glb",
            contentType: "model/gltf-binary",
            byteSize: 4
          }
        }
      ]
    })
  );

  return zip.generateAsync({ type: "uint8array" });
}
