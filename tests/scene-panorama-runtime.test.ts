import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDefaultMaskBoardImage, generateDefaultScenePanorama, streamDefaultScenePanorama } from "@/lib/ai/image-runtime";

const panoramaFaces = ["front", "back", "left", "right", "top", "bottom"] as const;

const runtimeMocks = vi.hoisted(() => ({
  analyzeScenePanoramaFaces: vi.fn(),
  edit: vi.fn(),
  generate: vi.fn(),
  getDefaultImageRuntimeConfig: vi.fn(),
  harmonizeScenePanoramaFaceColors: vi.fn(),
  splitEquirectangularToCubemap: vi.fn(),
  stabilizeScenePanoramaFaces: vi.fn(),
  toFile: vi.fn(async (_bytes: Buffer, fileName: string, options?: { type?: string }) => ({
    fileName,
    type: options?.type ?? "application/octet-stream"
  })),
  updateAiObservation: vi.fn()
}));

vi.mock("openai", () => ({
  default: vi.fn(function OpenAI() {
    return {
      images: {
        edit: runtimeMocks.edit,
        generate: runtimeMocks.generate
      }
    };
  }),
  toFile: runtimeMocks.toFile
}));

vi.mock("@/lib/ai/model-config", () => ({
  getDefaultImageRuntimeConfig: runtimeMocks.getDefaultImageRuntimeConfig
}));

vi.mock("@/lib/ai/scene-panorama-projection", () => ({
  splitEquirectangularToCubemap: runtimeMocks.splitEquirectangularToCubemap
}));

vi.mock("@/lib/ai/scene-panorama-postprocess", () => ({
  analyzeScenePanoramaFaces: runtimeMocks.analyzeScenePanoramaFaces,
  harmonizeScenePanoramaFaceColors: runtimeMocks.harmonizeScenePanoramaFaceColors,
  stabilizeScenePanoramaFaces: runtimeMocks.stabilizeScenePanoramaFaces
}));

vi.mock("@/lib/observability/langfuse", () => ({
  updateAiObservation: runtimeMocks.updateAiObservation,
  withAiObservation: async (
    _traceName: string,
    _context: unknown,
    handler: (span: unknown) => Promise<unknown>
  ) => handler({})
}));

describe("scene panorama runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const motherBytes = await createSolidPng(32, 16, [90, 120, 150]);
    const referenceBytes = await createSolidPng(16, 16, [120, 140, 160]);

    runtimeMocks.generate.mockResolvedValue({
      data: [{ b64_json: motherBytes.toString("base64") }]
    });
    runtimeMocks.getDefaultImageRuntimeConfig.mockResolvedValue({
      apiKey: "test-key",
      baseUrl: "https://ai.example.test/v1",
      modelId: "test-image-model",
      providerName: "Test Image Provider"
    });
    runtimeMocks.splitEquirectangularToCubemap.mockResolvedValue(
      panoramaFaces.map((face) => ({
        bytes: referenceBytes,
        contentType: "image/png",
        face,
        fileName: `scene-panorama-${face}.png`
      }))
    );
    runtimeMocks.stabilizeScenePanoramaFaces.mockImplementation(async (
      _referenceFaces: unknown,
      candidateFaces: Array<{ contentType: string; fileName: string }>
    ) =>
      candidateFaces.map((face: { contentType: string; fileName: string }) => ({
        ...face,
        contentType: "image/webp",
        fileName: face.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
      }))
    );
    runtimeMocks.harmonizeScenePanoramaFaceColors.mockImplementation(async (
      _referenceFaces: unknown,
      candidateFaces: Array<{ contentType: string; fileName: string }>
    ) => ({
      faces: candidateFaces.map((face: { contentType: string; fileName: string }) => ({
        ...face,
        contentType: "image/webp",
        fileName: face.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
      })),
      report: {
        averageReferenceColorDelta: 2,
        colorAdjusted: true,
        faceDeltas: [],
        maxFaceColorDelta: 3
      }
    }));
    runtimeMocks.analyzeScenePanoramaFaces.mockResolvedValue(createQualityReport(4, 4));
  });

  it("starts all six reference repaint calls without sending a mask", async () => {
    const enhancedBytes = await createSolidPng(16, 16, [180, 120, 96]);
    const pendingEdits: Array<{ resolve: (value: { data: Array<{ b64_json: string }> }) => void }> = [];

    runtimeMocks.edit.mockImplementation(
      () =>
        new Promise((resolve: (value: { data: Array<{ b64_json: string }> }) => void) => {
          pendingEdits.push({ resolve });
        })
    );

    const generation = generateDefaultScenePanorama(createGenerationInput(), "reader-id");

    await waitForMockCalls(runtimeMocks.edit, 6);

    const editPayloads = runtimeMocks.edit.mock.calls.map(([payload]) => payload as Record<string, unknown>);

    const generatePayload = runtimeMocks.generate.mock.calls[0][0] as Record<string, unknown>;

    expect(generatePayload).toMatchObject({ size: "4096x2048" });
    expect(String(generatePayload.prompt)).toContain("4096x2048");
    expect(runtimeMocks.splitEquirectangularToCubemap).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        faceSize: 4096,
        normalizedHeight: 2048,
        normalizedWidth: 4096
      })
    );
    expect(editPayloads).toHaveLength(6);
    expect(editPayloads.every((payload) => !Object.prototype.hasOwnProperty.call(payload, "mask"))).toBe(true);
    expect(editPayloads.every((payload) => payload.size === "4096x4096")).toBe(true);
    expect(editPayloads.map((payload) => String(payload.prompt))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("4096x4096"),
        expect.stringContaining("像素级忠实升级"),
        expect.stringContaining("相同像素位置"),
        expect.stringContaining("不要新增物体、删除物体、移动物体"),
        expect.stringContaining("边缘必须清晰、连续、可拼接"),
        expect.stringContaining("front.left 接 left.right"),
        expect.stringContaining("right.right 接 back.left")
      ])
    );

    pendingEdits.forEach(({ resolve }) => {
      resolve({ data: [{ b64_json: enhancedBytes.toString("base64") }] });
    });

    await expect(generation).resolves.toMatchObject({
      mode: "enhanced",
      repaired: true,
      sizeProfile: "4k"
    });
  });

  it("requests mask board images with the generic 4k preset and puts the target in the prompt", async () => {
    await generateDefaultMaskBoardImage("生成角色设定板", "reader-id");

    const payload = runtimeMocks.generate.mock.calls[0][0] as Record<string, unknown>;

    expect(payload).toMatchObject({ size: "3840x2160" });
    expect(String(payload.prompt)).toContain("3840x2160");
  });

  it("uses Doubao-compatible generation calls with reference images for panorama faces", async () => {
    runtimeMocks.getDefaultImageRuntimeConfig.mockResolvedValueOnce({
      apiKey: "test-key",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      modelId: "doubao-seedream-4-0",
      providerName: "豆包"
    });

    const result = await generateDefaultScenePanorama(createGenerationInput(), "reader-id");
    const generatePayloads = runtimeMocks.generate.mock.calls.map(([payload]) => payload as Record<string, unknown>);
    const facePayloads = generatePayloads.slice(1);

    expect(result.mode).toBe("enhanced");
    expect(runtimeMocks.edit).not.toHaveBeenCalled();
    expect(generatePayloads[0]).toMatchObject({ size: "4096x2048" });
    expect(facePayloads).toHaveLength(6);
    expect(facePayloads.every((payload) => payload.size === "4096x4096")).toBe(true);
    expect(facePayloads.every((payload) => String(payload.image).startsWith("data:image/png;base64,"))).toBe(true);
  });

  it("streams mother, preview faces, quality, and final faces in order", async () => {
    const enhancedBytes = await createSolidPng(16, 16, [180, 120, 96]);
    const events: Array<{ type: string; phase?: string; face?: string; faces?: string[]; qualityBestEffort?: boolean }> = [];

    runtimeMocks.edit.mockResolvedValue({
      data: [{ b64_json: enhancedBytes.toString("base64") }]
    });

    const result = await streamDefaultScenePanorama(createGenerationInput(), "reader-id", (event) => {
      events.push(event);
    });
    const motherIndex = events.findIndex((event) => event.type === "mother");
    const firstPreviewIndex = events.findIndex((event) => event.type === "face" && event.phase === "preview");
    const qualityIndex = events.findIndex((event) => event.type === "quality");
    const firstFinalIndex = events.findIndex((event) => event.type === "face" && event.phase === "final");
    const doneIndex = events.findIndex((event) => event.type === "done");

    expect(result.qualityPassed).toBe(true);
    expect(motherIndex).toBeGreaterThanOrEqual(0);
    expect(firstPreviewIndex).toBeGreaterThan(motherIndex);
    expect(qualityIndex).toBeGreaterThan(firstPreviewIndex);
    expect(firstFinalIndex).toBeGreaterThan(qualityIndex);
    expect(doneIndex).toBeGreaterThan(firstFinalIndex);
    expect(events.filter((event) => event.type === "face" && event.phase === "preview")).toHaveLength(6);
    expect(events.filter((event) => event.type === "face" && event.phase === "final")).toHaveLength(6);
  });

  it("streams iterating faces when quality checks retry and still returns best effort", async () => {
    const firstRoundBytes = await createSolidPng(16, 16, [10, 10, 10]);
    const secondRoundBytes = await createSolidPng(16, 16, [120, 120, 120]);
    const events: Array<{ type: string; phase?: string; face?: string; faces?: string[]; qualityBestEffort?: boolean }> = [];
    let editIndex = 0;

    runtimeMocks.edit.mockImplementation(async () => {
      editIndex += 1;

      return {
        data: [{ b64_json: (editIndex <= 6 ? firstRoundBytes : secondRoundBytes).toString("base64") }]
      };
    });
    runtimeMocks.analyzeScenePanoramaFaces
      .mockResolvedValueOnce(createQualityReport(72, 72))
      .mockResolvedValueOnce(createQualityReport(64, 64));

    const result = await streamDefaultScenePanorama(
      createGenerationInput(),
      "reader-id",
      (event) => {
        events.push(event);
      },
      undefined,
      { maxRedrawAttempts: 2 }
    );
    const iterating = events.find((event) => event.type === "iterating");

    expect(iterating?.faces).toEqual(expect.arrayContaining(["front", "left"]));
    expect(result.qualityBestEffort).toBe(true);
    expect(result.qualityPassed).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: "progress" });
    expect(events.some((event) => event.type === "done" && event.qualityBestEffort)).toBe(true);
  });

  it("streams final faces from the best attempt when a later retry gets worse", async () => {
    const attemptBytes = await Promise.all([
      createSolidPng(16, 16, [30, 30, 30]),
      createSolidPng(16, 16, [120, 120, 120]),
      createSolidPng(16, 16, [250, 40, 40])
    ]);
    const events: Array<{
      accepted?: boolean;
      attempt?: number;
      bestAttempt?: number;
      earlyStopped?: boolean;
      phase?: string;
      type: string;
    }> = [];
    let editIndex = 0;

    runtimeMocks.edit.mockImplementation(async () => {
      const bytes = editIndex < 6 ? attemptBytes[0] : editIndex < 8 ? attemptBytes[1] : attemptBytes[2];

      editIndex += 1;

      return {
        data: [{ b64_json: bytes.toString("base64") }]
      };
    });
    runtimeMocks.analyzeScenePanoramaFaces
      .mockResolvedValueOnce(createQualityReport(96, 96))
      .mockResolvedValueOnce(createQualityReport(40, 40))
      .mockResolvedValueOnce(createQualityReport(72, 72));

    const result = await streamDefaultScenePanorama(
      createGenerationInput(),
      "reader-id",
      (event) => {
        events.push(event);
      },
      undefined,
      { maxRedrawAttempts: 4 }
    );
    const qualityEvents = events.filter((event) => event.type === "quality");
    const finalEvents = events.filter((event) => event.type === "face" && event.phase === "final");
    const doneEvent = events.find((event) => event.type === "done");

    expect(qualityEvents.map((event) => event.accepted)).toEqual([true, true, false]);
    expect(finalEvents).toHaveLength(6);
    expect(finalEvents.every((event) => event.attempt === 2)).toBe(true);
    expect(result.bestAttempt).toBe(2);
    expect(result.earlyStopped).toBe(true);
    expect(result.quality?.maxEdgeDelta).toBe(40);
    expect(doneEvent).toMatchObject({ bestAttempt: 2, earlyStopped: true });
  });

  it("harmonizes final face colors toward the mother reference after iteration", async () => {
    const postprocess = await vi.importActual<typeof import("@/lib/ai/scene-panorama-postprocess")>(
      "@/lib/ai/scene-panorama-postprocess"
    );
    const referenceFaces = await createSolidFaces([90, 120, 150]);
    const candidateFaces = await createSolidFaces([190, 70, 55]);

    const result = await postprocess.harmonizeScenePanoramaFaceColors(referenceFaces, candidateFaces, { faceSize: 16 });

    expect(result.report.colorAdjusted).toBe(true);
    expect(result.report.faceDeltas.every((delta) => delta.afterDelta < delta.beforeDelta)).toBe(true);
    expect(result.faces).toHaveLength(6);
    expect(result.faces.every((face) => face.contentType === "image/webp")).toBe(true);
  });

  it("uses Gemini native generateContent image options when the provider is not OpenAI-compatible", async () => {
    const geminiBytes = await createSolidPng(16, 9, [80, 90, 100]);
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inline_data: {
                      data: geminiBytes.toString("base64"),
                      mime_type: "image/png"
                    }
                  }
                ]
              }
            }
          ]
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    );

    vi.stubGlobal("fetch", fetchMock);
    runtimeMocks.getDefaultImageRuntimeConfig.mockResolvedValueOnce({
      apiKey: "test-key",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      modelId: "gemini-3-pro-image-preview",
      providerName: "Gemini"
    });

    await generateDefaultMaskBoardImage("生成角色设定板", "reader-id");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      generationConfig: { responseFormat: { image: { aspectRatio: string; imageSize?: string } } };
    };

    expect(runtimeMocks.generate).not.toHaveBeenCalled();
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent");
    expect(body.generationConfig.responseFormat.image).toMatchObject({ aspectRatio: "16:9", imageSize: "4K" });
  });

  it("routes Gemini OpenAI-compatible base URLs through native generateContent for images", async () => {
    const geminiBytes = await createSolidPng(16, 9, [80, 90, 100]);
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inline_data: {
                      data: geminiBytes.toString("base64"),
                      mime_type: "image/png"
                    }
                  }
                ]
              }
            }
          ]
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    );

    vi.stubGlobal("fetch", fetchMock);
    runtimeMocks.getDefaultImageRuntimeConfig.mockResolvedValueOnce({
      apiKey: "test-key",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      modelId: "gemini-3-pro-image-preview",
      providerName: "gemini"
    });

    await generateDefaultMaskBoardImage("生成角色设定板", "reader-id");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      generationConfig: { responseFormat: { image: { aspectRatio: string; imageSize?: string } } };
    };

    expect(runtimeMocks.generate).not.toHaveBeenCalled();
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent");
    expect(body.generationConfig.responseFormat.image).toMatchObject({ aspectRatio: "16:9", imageSize: "4K" });
  });

  it("fails clearly when the image model does not support reference-image editing", async () => {
    runtimeMocks.getDefaultImageRuntimeConfig.mockResolvedValueOnce({
      apiKey: "test-key",
      baseUrl: "https://api.openai.com/v1",
      modelId: "gpt-image-1",
      providerName: "OpenAI"
    });
    runtimeMocks.edit.mockRejectedValue(Object.assign(new Error("images.edit unsupported"), { status: 404 }));

    await expect(generateDefaultScenePanorama(createGenerationInput(), "reader-id")).rejects.toThrow(
      "SCENE_PANORAMA_REFERENCE_EDIT_UNSUPPORTED"
    );
  });

  it("returns the best available panorama when the last seam quality retry still fails", async () => {
    const firstRoundColors: Array<[number, number, number]> = [
      [0, 0, 0],
      [220, 220, 220],
      [0, 0, 0],
      [220, 220, 220],
      [0, 0, 0],
      [220, 220, 220]
    ];
    const secondRoundColors: Array<[number, number, number]> = [
      [100, 100, 100],
      [110, 110, 110],
      [120, 120, 120],
      [130, 130, 130],
      [140, 140, 140],
      [150, 150, 150]
    ];
    const finalRoundColors: Array<[number, number, number]> = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
      [255, 0, 255],
      [0, 255, 255]
    ];
    const colors = [...firstRoundColors, ...secondRoundColors, ...finalRoundColors];
    let editIndex = 0;

    runtimeMocks.edit.mockImplementation(async () => {
      const color = colors[Math.min(editIndex, colors.length - 1)];

      editIndex += 1;

      return {
        data: [{ b64_json: (await createSolidPng(16, 16, color)).toString("base64") }]
      };
    });
    runtimeMocks.analyzeScenePanoramaFaces
      .mockResolvedValueOnce(createQualityReport(96, 96))
      .mockResolvedValueOnce(createQualityReport(40, 40))
      .mockResolvedValueOnce(createQualityReport(72, 72));

    const result = await generateDefaultScenePanorama(createGenerationInput(), "reader-id");

    expect(runtimeMocks.edit.mock.calls.length).toBeGreaterThan(6);
    expect(result.qualityBestEffort).toBe(true);
    expect(result.qualityPassed).toBe(false);
    expect(result.quality?.maxEdgeDelta).toBeGreaterThan(18);
    expect(result.quality?.maxEdgeDelta).toBeLessThan(80);
    expect(result.faces.front.contentType).toBe("image/webp");
  });
});

function createGenerationInput() {
  return {
    blockDescription: "坍塌的接待区，玻璃幕墙漏入冷光。",
    blockName: "主厅",
    locale: "zh-CN" as const,
    panoramaDrawingStyle: "realistic",
    sceneDescription: "一座被雨水和藤蔓侵蚀的旧研究所。",
    sceneName: "废弃研究所",
    style: "mystery"
  };
}

async function createSolidPng(width: number, height: number, color: [number, number, number]) {
  const pixels = Buffer.alloc(width * height * 4);

  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
    pixels[index + 3] = 255;
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

async function createSolidFaces(color: [number, number, number]) {
  const bytes = await createSolidPng(16, 16, color);

  return panoramaFaces.map((face) => ({
    bytes,
    contentType: "image/png",
    face,
    fileName: `scene-panorama-${face}.png`
  }));
}

async function waitForMockCalls(mock: { mock: { calls: unknown[] } }, count: number) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (mock.mock.calls.length >= count) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  throw new Error(`Expected ${count} mock calls, received ${mock.mock.calls.length}.`);
}

function createQualityReport(maxEdgeDelta: number, maxInnerBandDelta: number) {
  const faceByteSizes = panoramaFaces.reduce<Record<(typeof panoramaFaces)[number], number>>((result, face) => {
    result[face] = 1024;

    return result;
  }, {} as Record<(typeof panoramaFaces)[number], number>);
  const edgeDeltas = [
    {
      delta: maxEdgeDelta,
      firstEdge: "left" as const,
      firstFace: "front" as const,
      reversed: false,
      secondEdge: "right" as const,
      secondFace: "left" as const
    }
  ];
  const innerBandDeltas = [
    {
      bandWidth: 32,
      delta: maxInnerBandDelta,
      firstEdge: "left" as const,
      firstFace: "front" as const,
      reversed: false,
      secondEdge: "right" as const,
      secondFace: "left" as const
    }
  ];

  return {
    averageEdgeDelta: maxEdgeDelta,
    averageInnerBandDelta: maxInnerBandDelta,
    edgeDeltas,
    faceByteSizes,
    innerBandDeltas,
    largestFaceBytes: 1024,
    maxEdgeDelta,
    maxInnerBandDelta,
    totalBytes: panoramaFaces.length * 1024
  };
}
