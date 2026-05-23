import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDefaultScenePanorama, generateDefaultScenePanoramaMother } from "@/lib/ai/image-runtime";
import { getScenePanoramaFaceSourceCoordinate, splitEquirectangularToCubemap } from "@/lib/ai/scene-panorama-projection";
import {
  analyzeScenePanoramaFaces,
  scenePanoramaPostprocessFaces,
  stabilizeScenePanoramaFaces
} from "@/lib/ai/scene-panorama-postprocess";
import {
  deleteMaterialImagesByUrls,
  isValidScenePanoramaImageBytes,
  uploadItemModelBytes,
  uploadMaskBoardImage,
  uploadMaterialImageBytes
} from "@/lib/storage/material";
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
  isValidMaterialImageBytes: vi.fn((bytes: Uint8Array, contentType: string) => {
    const normalizedContentType = contentType.toLowerCase().split(";")[0]?.trim();

    return ["image/jpeg", "image/png", "image/webp"].includes(normalizedContentType) && bytes.byteLength > 0 && bytes.byteLength <= 10 * 1024 * 1024;
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
  uploadItemBoardImage: vi.fn(async () => "https://cdn.example.com/materials/item-board.png"),
  uploadItemModelBytes: vi.fn(async () => "https://cdn.example.com/materials/imported-model.glb"),
  uploadItemModelInputImage: vi.fn(async () => "https://cdn.example.com/materials/item-model-input.png"),
  uploadItemViewImage: vi.fn(async () => "https://cdn.example.com/materials/item-view.png"),
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

  it("stabilizes panorama faces without copying reference pixels back into AI output", async () => {
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
    const stabilizedPixel = await readImagePixel(stabilized[0].bytes, 0, 0);
    const candidatePixel = await readImagePixel(candidateFaces[0].bytes, 0, 0);
    const referencePixel = await readImagePixel(referenceFaces[0].bytes, 0, 0);

    expect(averageRgbDelta(stabilizedPixel, candidatePixel)).toBeLessThan(8);
    expect(averageRgbDelta(stabilizedPixel, referencePixel)).toBeGreaterThan(40);
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

  it("preserves AI face details during stabilization instead of blending reference seams", async () => {
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

    expect(averageRgbDelta(originalEdgePixel, stabilizedEdgePixel)).toBeLessThan(35);
    expect(averageRgbDelta(referenceEdgePixel, stabilizedEdgePixel)).toBeGreaterThan(35);
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
