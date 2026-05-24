import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDefaultMaskBoardImage, generateDefaultScenePanorama, streamDefaultScenePanorama } from "@/lib/ai/image-runtime";

const panoramaFaces = ["front", "back", "left", "right", "top", "bottom"] as const;

const runtimeMocks = vi.hoisted(() => ({
  analyzeScenePanoramaMotherImage: vi.fn(),
  analyzeScenePanoramaFaces: vi.fn(),
  edit: vi.fn(),
  generate: vi.fn(),
  getDefaultImageRuntimeConfig: vi.fn(),
  harmonizeScenePanoramaFaceColors: vi.fn(),
  measureFaceReferenceEdgeDelta: vi.fn(),
  repairScenePanoramaColorSeams: vi.fn(),
  splitEquirectangularToCubemap: vi.fn(),
  stabilizeScenePanoramaMotherImage: vi.fn(),
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
  analyzeScenePanoramaMotherImage: runtimeMocks.analyzeScenePanoramaMotherImage,
  analyzeScenePanoramaFaces: runtimeMocks.analyzeScenePanoramaFaces,
  harmonizeScenePanoramaFaceColors: runtimeMocks.harmonizeScenePanoramaFaceColors,
  measureFaceReferenceEdgeDelta: runtimeMocks.measureFaceReferenceEdgeDelta,
  repairScenePanoramaColorSeams: runtimeMocks.repairScenePanoramaColorSeams,
  stabilizeScenePanoramaMotherImage: runtimeMocks.stabilizeScenePanoramaMotherImage,
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
    runtimeMocks.stabilizeScenePanoramaMotherImage.mockImplementation(async (image: { bytes: Buffer; contentType: string; fileName: string }) => image);
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
        averageFaceColorDeltaAfter: 2,
        averageFaceColorDeltaBefore: 8,
        averageReferenceColorDelta: 2,
        colorAlgorithm: "candidate-preserving-color-match-v2",
        colorAdjusted: true,
        colorRejected: false,
        faceDeltas: [],
        maxFaceColorDelta: 3,
        maxFaceColorDeltaAfter: 3,
        maxFaceColorDeltaBefore: 10
      }
    }));
    runtimeMocks.analyzeScenePanoramaMotherImage.mockResolvedValue(createMotherQualityReport(true));
    runtimeMocks.analyzeScenePanoramaFaces.mockResolvedValue(createQualityReport(4, 4));
    runtimeMocks.measureFaceReferenceEdgeDelta.mockResolvedValue(4);
    runtimeMocks.repairScenePanoramaColorSeams.mockImplementation(async (
      _referenceFaces: unknown,
      candidateFaces: Array<{ contentType: string; fileName: string }>
    ) => ({
      applied: true,
      color: {
        averageFaceColorDeltaAfter: 2,
        averageFaceColorDeltaBefore: 8,
        averageReferenceColorDelta: 2,
        colorAlgorithm: "candidate-preserving-color-match-v2",
        colorAdjusted: true,
        colorRejected: false,
        faceDeltas: [],
        maxFaceColorDelta: 3,
        maxFaceColorDeltaAfter: 3,
        maxFaceColorDeltaBefore: 10
      },
      faces: candidateFaces,
      qualityAfter: createQualityReport(4, 4),
      qualityBefore: createQualityReport(72, 72)
    }));
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

  it("uses the gpt-image-2 panorama profile with high quality requests", async () => {
    const enhancedBytes = await createSolidPng(16, 16, [180, 120, 96]);

    runtimeMocks.getDefaultImageRuntimeConfig.mockResolvedValueOnce({
      apiKey: "test-key",
      baseUrl: "https://api.openai.com/v1",
      modelId: "gpt-image-2",
      providerName: "OpenAI"
    });
    runtimeMocks.edit.mockResolvedValue({
      data: [{ b64_json: enhancedBytes.toString("base64") }]
    });

    const result = await generateDefaultScenePanorama(createGenerationInput(), "reader-id");
    const generatePayload = runtimeMocks.generate.mock.calls[0][0] as Record<string, unknown>;
    const editPayloads = runtimeMocks.edit.mock.calls.map(([payload]) => payload as Record<string, unknown>);

    expect(generatePayload).toMatchObject({
      output_format: "png",
      quality: "high",
      size: "3840x1920"
    });
    expect(String(generatePayload.prompt)).toContain("3840x1920");
    expect(runtimeMocks.splitEquirectangularToCubemap).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        faceSize: 2880,
        normalizedHeight: 1920,
        normalizedWidth: 3840
      })
    );
    expect(editPayloads).toHaveLength(6);
    expect(editPayloads.every((payload) => payload.size === "2880x2880")).toBe(true);
    expect(editPayloads.every((payload) => payload.quality === "high")).toBe(true);
    expect(editPayloads.every((payload) => payload.output_format === "png")).toBe(true);
    expect(editPayloads.every((payload) => !Object.prototype.hasOwnProperty.call(payload, "input_fidelity"))).toBe(true);
    expect(editPayloads.map((payload) => String(payload.prompt))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("2880x2880"),
        expect.stringContaining("像素级忠实升级")
      ])
    );
    expect(result).toMatchObject({
      mode: "enhanced",
      repaired: true,
      sizeProfile: "gpt-image-2"
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

    const result = await generateDefaultScenePanorama(createGenerationInput(), "reader-id", undefined, { maxRedrawAttempts: 3 });
    const generatePayloads = runtimeMocks.generate.mock.calls.map(([payload]) => payload as Record<string, unknown>);
    const facePayloads = generatePayloads.slice(1);

    expect(result.mode).toBe("enhanced");
    expect(runtimeMocks.edit).not.toHaveBeenCalled();
    expect(generatePayloads[0]).toMatchObject({ size: "4096x2048" });
    expect(facePayloads).toHaveLength(6);
    expect(facePayloads.every((payload) => payload.size === "4096x4096")).toBe(true);
    expect(facePayloads.every((payload) => typeof payload.image === "string")).toBe(true);
    expect(facePayloads.every((payload) => String(payload.image).startsWith("data:image/png;base64,"))).toBe(true);
  });

  it("retries panorama mother generation before splitting cubemap faces", async () => {
    const enhancedBytes = await createSolidPng(16, 16, [180, 120, 96]);

    runtimeMocks.edit.mockResolvedValue({
      data: [{ b64_json: enhancedBytes.toString("base64") }]
    });
    runtimeMocks.analyzeScenePanoramaMotherImage
      .mockResolvedValueOnce(createMotherQualityReport(false, 8))
      .mockResolvedValueOnce(createMotherQualityReport(true, 0.5));

    const result = await generateDefaultScenePanorama(createGenerationInput(), "reader-id", undefined, { maxRedrawAttempts: 2 });

    expect(result.motherQualityPassed).toBe(true);
    expect(runtimeMocks.generate).toHaveBeenCalledTimes(2);
    expect(runtimeMocks.splitEquirectangularToCubemap).toHaveBeenCalledTimes(1);
  });

  it("continues with the best-scored panorama mother when the mother gate keeps failing", async () => {
    runtimeMocks.analyzeScenePanoramaMotherImage
      .mockResolvedValueOnce(createMotherQualityReport(false, 8))
      .mockResolvedValueOnce(createMotherQualityReport(false, 6));

    const result = await generateDefaultScenePanorama(createGenerationInput(), "reader-id", undefined, { maxRedrawAttempts: 2 });

    expect(result.motherQualityPassed).toBe(false);
    expect(result.motherQuality?.score).toBe(6);
    expect(runtimeMocks.generate).toHaveBeenCalledTimes(2);
    expect(runtimeMocks.splitEquirectangularToCubemap).toHaveBeenCalledTimes(1);
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

  it("retries transient face generation failures before failing the panorama stream", async () => {
    const enhancedBytes = await createSolidPng(16, 16, [180, 120, 96]);
    const events: Array<{ type: string; phase?: string }> = [];
    let editCalls = 0;

    runtimeMocks.edit.mockImplementation(async () => {
      editCalls += 1;

      if (editCalls === 1) {
        throw Object.assign(new Error("upstream bad gateway"), { status: 502 });
      }

      return {
        data: [{ b64_json: enhancedBytes.toString("base64") }]
      };
    });

    const result = await streamDefaultScenePanorama(createGenerationInput(), "reader-id", (event) => {
      events.push(event);
    });

    expect(result.mode).toBe("enhanced");
    expect(runtimeMocks.edit).toHaveBeenCalledTimes(7);
    expect(events.filter((event) => event.type === "face" && event.phase === "preview")).toHaveLength(6);
    expect(events.find((event) => event.type === "done")).toBeTruthy();
    expect(runtimeMocks.updateAiObservation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        level: "WARNING",
        metadata: expect.objectContaining({
          faceRequestAttempt: 1,
          nextFaceRequestAttempt: 2,
          retryError: "upstream bad gateway"
        })
      })
    );
  });

  it("keeps the panorama when color harmonization fails", async () => {
    const enhancedBytes = await createSolidPng(16, 16, [180, 120, 96]);
    const events: Array<{ type: string; phase?: string; colorStatus?: string }> = [];

    runtimeMocks.edit.mockResolvedValue({
      data: [{ b64_json: enhancedBytes.toString("base64") }]
    });
    runtimeMocks.harmonizeScenePanoramaFaceColors.mockRejectedValueOnce(new Error("sharp color failed"));

    const result = await streamDefaultScenePanorama(createGenerationInput(), "reader-id", (event) => {
      events.push(event);
    });

    expect(result.colorStatus).toBe("skipped");
    expect(result.colorError).toContain("sharp color failed");
    expect(events.filter((event) => event.type === "face" && event.phase === "final")).toHaveLength(6);
    expect(events.find((event) => event.type === "done")).toMatchObject({ colorStatus: "skipped" });
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
      .mockResolvedValueOnce(createQualityReport(64, 64))
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

  it("uses local color seam repair before spending another AI repaint attempt", async () => {
    const enhancedBytes = await createSolidPng(16, 16, [180, 120, 96]);

    runtimeMocks.edit.mockResolvedValue({
      data: [{ b64_json: enhancedBytes.toString("base64") }]
    });
    runtimeMocks.analyzeScenePanoramaFaces.mockResolvedValueOnce(createColorQualityReport(54, 58));

    const result = await generateDefaultScenePanorama(createGenerationInput(), "reader-id", undefined, { maxRedrawAttempts: 2 });

    expect(result.qualityPassed).toBe(true);
    expect(runtimeMocks.repairScenePanoramaColorSeams).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.edit).toHaveBeenCalledTimes(6);
  });

  it("redraws the more suspicious side of a geometry seam first", async () => {
    const firstRoundBytes = await createSolidPng(16, 16, [10, 10, 10]);
    const secondRoundBytes = await createSolidPng(16, 16, [120, 120, 120]);
    const events: Array<{ type: string; faces?: string[] }> = [];
    let editIndex = 0;

    runtimeMocks.edit.mockImplementation(async () => {
      editIndex += 1;

      return {
        data: [{ b64_json: (editIndex <= 6 ? firstRoundBytes : secondRoundBytes).toString("base64") }]
      };
    });
    runtimeMocks.analyzeScenePanoramaFaces
      .mockResolvedValueOnce(createGeometryQualityReport(72, 72))
      .mockResolvedValueOnce(createQualityReport(4, 4));
    runtimeMocks.measureFaceReferenceEdgeDelta
      .mockResolvedValueOnce(70)
      .mockResolvedValueOnce(8);

    const result = await streamDefaultScenePanorama(
      createGenerationInput(),
      "reader-id",
      (event) => {
        events.push(event);
      },
      undefined,
      { maxRedrawAttempts: 2 }
    );

    expect(events.find((event) => event.type === "iterating")?.faces).toEqual(["front"]);
    expect(runtimeMocks.edit).toHaveBeenCalledTimes(7);
    expect(result.qualityPassed).toBe(true);
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
      .mockResolvedValueOnce(createQualityReport(72, 72))
      .mockResolvedValueOnce(createQualityReport(40, 40));

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

    expect(result.report.colorAlgorithm).toBe("mother-guided-low-frequency-seam-v3");
    expect(result.report.colorAdjusted).toBe(true);
    expect(result.report.faceDeltas.every((delta) => delta.afterDelta < delta.beforeDelta)).toBe(true);
    expect(result.faces).toHaveLength(6);
    expect(result.faces.every((face) => face.contentType === "image/webp")).toBe(true);
  });

  it("harmonizes whole-face brightness and white balance across mismatched faces", async () => {
    const postprocess = await vi.importActual<typeof import("@/lib/ai/scene-panorama-postprocess")>(
      "@/lib/ai/scene-panorama-postprocess"
    );
    const referenceFaces = await createSolidFaces([92, 112, 130], 32);
    const candidateFaces = await createSolidFacesByColor([
      [170, 95, 75],
      [65, 105, 165],
      [45, 70, 82],
      [185, 170, 105],
      [110, 90, 145],
      [130, 120, 115]
    ], 32);

    const result = await postprocess.harmonizeScenePanoramaFaceColors(referenceFaces, candidateFaces, { faceSize: 32 });

    expect(result.report.averageFaceColorDeltaAfter).toBeLessThan(result.report.averageFaceColorDeltaBefore * 0.82);
    expect(result.report.maxFaceColorDeltaAfter).toBeLessThan(result.report.maxFaceColorDeltaBefore);
    expect(result.report.colorAdjusted).toBe(true);
  });

  it("uses robust whole-face statistics so highlights and black shadows do not dominate", async () => {
    const postprocess = await vi.importActual<typeof import("@/lib/ai/scene-panorama-postprocess")>(
      "@/lib/ai/scene-panorama-postprocess"
    );
    const referenceFaces = await createPatchedFaces([88, 108, 126], 32);
    const candidateFaces = await createPatchedFaces([132, 92, 76], 32);

    const result = await postprocess.harmonizeScenePanoramaFaceColors(referenceFaces, candidateFaces, { faceSize: 32 });

    expect(result.report.averageFaceColorDeltaAfter).toBeLessThan(result.report.averageFaceColorDeltaBefore);
    expect(result.report.maxFaceColorDeltaAfter).toBeLessThan(result.report.maxFaceColorDeltaBefore);
  });

  it("does not over-adjust faces that already share the same whole-face color", async () => {
    const postprocess = await vi.importActual<typeof import("@/lib/ai/scene-panorama-postprocess")>(
      "@/lib/ai/scene-panorama-postprocess"
    );
    const referenceFaces = await createPatchedFaces([88, 108, 126], 32);
    const candidateFaces = await createPatchedFaces([88, 108, 126], 32);

    const result = await postprocess.harmonizeScenePanoramaFaceColors(referenceFaces, candidateFaces, { faceSize: 32 });

    expect(result.report.colorAdjusted).toBe(false);
    expect(result.report.averageFaceColorDeltaBefore).toBeLessThan(0.1);
    expect(result.report.averageFaceColorDeltaAfter).toBeLessThan(3);
  });

  it("preserves candidate clarity while using the mother face for color matching and seam reduction", async () => {
    const postprocess = await vi.importActual<typeof import("@/lib/ai/scene-panorama-postprocess")>(
      "@/lib/ai/scene-panorama-postprocess"
    );
    const referenceFaces = await createGradientFaces([88, 118, 138], [168, 122, 96], 48);
    const candidateFaces = await createSeamShiftedFaces([
      [190, 86, 70],
      [72, 110, 172],
      [64, 78, 92],
      [202, 158, 92],
      [130, 92, 150],
      [138, 128, 112]
    ], 48);
    const beforeQuality = await postprocess.analyzeScenePanoramaFaces(candidateFaces, { faceSize: 48 });

    const result = await postprocess.harmonizeScenePanoramaFaceColors(referenceFaces, candidateFaces, { faceSize: 48 });
    const afterQuality = await postprocess.analyzeScenePanoramaFaces(result.faces, { faceSize: 48 });

    expect(result.report.colorAdjusted).toBe(true);
    expect(result.report.averageFaceColorDeltaAfter).toBeLessThan(result.report.averageFaceColorDeltaBefore * 0.55);
    expect(afterQuality.averageEdgeDelta).toBeLessThan(beforeQuality.averageEdgeDelta);
    expect(afterQuality.maxEdgeDelta).toBeLessThan(beforeQuality.maxEdgeDelta);
  });

  it("does not flatten high-frequency face detail when matching a soft mother reference", async () => {
    const postprocess = await vi.importActual<typeof import("@/lib/ai/scene-panorama-postprocess")>(
      "@/lib/ai/scene-panorama-postprocess"
    );
    const referenceFaces = await createSolidFaces([92, 112, 130], 64);
    const candidateFaces = await createCheckerFaces([130, 84, 70], [214, 160, 134], 64);
    const beforeDetail = await measureLumaStandardDeviation(candidateFaces[0].bytes, 64);

    const result = await postprocess.harmonizeScenePanoramaFaceColors(referenceFaces, candidateFaces, { faceSize: 64 });
    const afterDetail = await measureLumaStandardDeviation(result.faces[0].bytes, 64);

    expect(result.report.averageFaceColorDeltaAfter).toBeLessThanOrEqual(result.report.averageFaceColorDeltaBefore);
    expect(afterDetail).toBeGreaterThan(beforeDetail * 0.75);
  });

  it("stabilizes mother panorama horizontal wrap color before cubemap splitting", async () => {
    const postprocess = await vi.importActual<typeof import("@/lib/ai/scene-panorama-postprocess")>(
      "@/lib/ai/scene-panorama-postprocess"
    );
    const mother = await createWrapMismatchPng(96, 48);
    const beforeDelta = await measureHorizontalWrapDelta(mother, 96, 48);

    const stabilized = await postprocess.stabilizeScenePanoramaMotherImage({
      bytes: mother,
      contentType: "image/png",
      fileName: "mother.png"
    }, {
      normalizedHeight: 48,
      normalizedWidth: 96
    });
    const afterDelta = await measureHorizontalWrapDelta(stabilized.bytes, 96, 48);

    expect(stabilized.contentType).toBe("image/webp");
    expect(afterDelta).toBeLessThan(beforeDelta);
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
      .mockResolvedValueOnce(createQualityReport(72, 72))
      .mockResolvedValueOnce(createQualityReport(40, 40));

    const result = await generateDefaultScenePanorama(createGenerationInput(), "reader-id", undefined, { maxRedrawAttempts: 3 });

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

async function createSolidFaces(color: [number, number, number], size = 16) {
  const bytes = await createSolidPng(size, size, color);

  return panoramaFaces.map((face) => ({
    bytes,
    contentType: "image/png",
    face,
    fileName: `scene-panorama-${face}.png`
  }));
}

async function createSolidFacesByColor(colors: Array<[number, number, number]>, size = 16) {
  return Promise.all(
    panoramaFaces.map(async (face, index) => ({
      bytes: await createSolidPng(size, size, colors[index] ?? colors.at(-1) ?? [0, 0, 0]),
      contentType: "image/png",
      face,
      fileName: `scene-panorama-${face}.png`
    }))
  );
}

async function createPatchedFaces(baseColor: [number, number, number], size = 32) {
  const bytes = await createPatchedPng(size, size, baseColor);

  return panoramaFaces.map((face) => ({
    bytes,
    contentType: "image/png",
    face,
    fileName: `scene-panorama-${face}.png`
  }));
}

async function createGradientFaces(
  leftColor: [number, number, number],
  rightColor: [number, number, number],
  size = 48
) {
  return Promise.all(
    panoramaFaces.map(async (face) => ({
      bytes: await createGradientPng(size, size, leftColor, rightColor),
      contentType: "image/png",
      face,
      fileName: `scene-panorama-${face}.png`
    }))
  );
}

async function createSeamShiftedFaces(colors: Array<[number, number, number]>, size = 48) {
  return Promise.all(
    panoramaFaces.map(async (face, index) => ({
      bytes: await createSeamShiftedPng(size, size, colors[index] ?? colors.at(-1) ?? [0, 0, 0]),
      contentType: "image/png",
      face,
      fileName: `scene-panorama-${face}.png`
    }))
  );
}

async function createCheckerFaces(
  firstColor: [number, number, number],
  secondColor: [number, number, number],
  size = 64
) {
  return Promise.all(
    panoramaFaces.map(async (face) => ({
      bytes: await createCheckerPng(size, size, firstColor, secondColor),
      contentType: "image/png",
      face,
      fileName: `scene-panorama-${face}.png`
    }))
  );
}

async function createPatchedPng(width: number, height: number, baseColor: [number, number, number]) {
  const pixels = Buffer.alloc(width * height * 4);
  const brightPatchSize = Math.max(2, Math.floor(Math.min(width, height) / 5));
  const shadowPatchSize = Math.max(2, Math.floor(Math.min(width, height) / 4));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const inBrightPatch = x < brightPatchSize && y < brightPatchSize;
      const inShadowPatch = x >= width - shadowPatchSize && y >= height - shadowPatchSize;
      const color: [number, number, number] = inBrightPatch
        ? [248, 244, 226]
        : inShadowPatch
          ? [4, 5, 7]
          : baseColor;

      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
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

async function createCheckerPng(
  width: number,
  height: number,
  firstColor: [number, number, number],
  secondColor: [number, number, number]
) {
  const pixels = Buffer.alloc(width * height * 4);
  const cellSize = Math.max(2, Math.floor(Math.min(width, height) / 8));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const useFirst = (Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0;
      const color = useFirst ? firstColor : secondColor;

      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
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

async function createGradientPng(
  width: number,
  height: number,
  leftColor: [number, number, number],
  rightColor: [number, number, number]
) {
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const mix = x / Math.max(1, width - 1);
      const index = (y * width + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        pixels[index + channel] = Math.round(leftColor[channel] * (1 - mix) + rightColor[channel] * mix);
      }
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

async function createSeamShiftedPng(width: number, height: number, baseColor: [number, number, number]) {
  const pixels = Buffer.alloc(width * height * 4);
  const edgeWidth = Math.max(3, Math.round(width / 8));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const edgeBoost = x < edgeWidth || x >= width - edgeWidth ? 48 : 0;
      const localDetail = ((x + y) % 7) * 3;

      pixels[index] = Math.min(255, baseColor[0] + edgeBoost + localDetail);
      pixels[index + 1] = Math.max(0, baseColor[1] - edgeBoost / 3 + localDetail);
      pixels[index + 2] = Math.max(0, baseColor[2] - edgeBoost / 2 + localDetail);
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

async function createWrapMismatchPng(width: number, height: number) {
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const isLeftEdge = x < width * 0.1;
      const isRightEdge = x >= width * 0.9;
      const color: [number, number, number] = isLeftEdge
        ? [56, 86, 142]
        : isRightEdge
          ? [196, 118, 72]
          : [128, 112, 104];

      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
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

async function measureHorizontalWrapDelta(bytes: Buffer, width: number, height: number) {
  const pixels = await sharp(bytes)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();
  let total = 0;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    const leftIndex = y * width * 4;
    const rightIndex = (y * width + width - 1) * 4;

    for (let channel = 0; channel < 3; channel += 1) {
      total += Math.abs(pixels[leftIndex + channel] - pixels[rightIndex + channel]);
      count += 1;
    }
  }

  return total / Math.max(1, count);
}

async function measureLumaStandardDeviation(bytes: Buffer, size: number) {
  const pixels = await sharp(bytes)
    .resize(size, size, { fit: "fill" })
    .toColorspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer();
  const values: number[] = [];

  for (let index = 0; index < pixels.length; index += 3) {
    values.push(0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length);

  return Math.sqrt(variance);
}

async function waitForMockCalls(mock: { mock: { calls: unknown[] } }, count: number) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
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
    averageStructureDelta: 4,
    edgeDeltas,
    faceByteSizes,
    innerBandDeltas,
    issues: maxEdgeDelta > 18 || maxInnerBandDelta > 28
      ? [{
          delta: Math.max(maxEdgeDelta, maxInnerBandDelta),
          edgeDelta: maxEdgeDelta,
          firstEdge: "left" as const,
          firstFace: "front" as const,
          innerBandDelta: maxInnerBandDelta,
          kind: "geometry" as const,
          lumaDelta: maxEdgeDelta,
          reversed: false,
          secondEdge: "right" as const,
          secondFace: "left" as const,
          structureDelta: 24
        }]
      : [],
    largestFaceBytes: 1024,
    maxEdgeDelta,
    maxInnerBandDelta,
    maxStructureDelta: maxEdgeDelta > 18 || maxInnerBandDelta > 28 ? 24 : 4,
    structureDeltas: [
      {
        delta: maxEdgeDelta > 18 || maxInnerBandDelta > 28 ? 24 : 4,
        firstEdge: "left" as const,
        firstFace: "front" as const,
        reversed: false,
        secondEdge: "right" as const,
        secondFace: "left" as const
      }
    ],
    totalBytes: panoramaFaces.length * 1024
  };
}

function createColorQualityReport(maxEdgeDelta: number, maxInnerBandDelta: number) {
  return {
    ...createQualityReport(maxEdgeDelta, maxInnerBandDelta),
    issues: [
      {
        delta: Math.max(maxEdgeDelta, maxInnerBandDelta),
        edgeDelta: maxEdgeDelta,
        firstEdge: "left" as const,
        firstFace: "front" as const,
        innerBandDelta: maxInnerBandDelta,
        kind: "color" as const,
        lumaDelta: maxEdgeDelta,
        reversed: false,
        secondEdge: "right" as const,
        secondFace: "left" as const,
        structureDelta: 4
      }
    ],
    maxStructureDelta: 4,
    structureDeltas: [
      {
        delta: 4,
        firstEdge: "left" as const,
        firstFace: "front" as const,
        reversed: false,
        secondEdge: "right" as const,
        secondFace: "left" as const
      }
    ]
  };
}

function createGeometryQualityReport(maxEdgeDelta: number, maxInnerBandDelta: number) {
  return {
    ...createQualityReport(maxEdgeDelta, maxInnerBandDelta),
    issues: [
      {
        delta: Math.max(maxEdgeDelta, maxInnerBandDelta, 42),
        edgeDelta: maxEdgeDelta,
        firstEdge: "left" as const,
        firstFace: "front" as const,
        innerBandDelta: maxInnerBandDelta,
        kind: "geometry" as const,
        lumaDelta: maxEdgeDelta,
        reversed: false,
        secondEdge: "right" as const,
        secondFace: "left" as const,
        structureDelta: 42
      }
    ],
    maxStructureDelta: 42,
    structureDeltas: [
      {
        delta: 42,
        firstEdge: "left" as const,
        firstFace: "front" as const,
        reversed: false,
        secondEdge: "right" as const,
        secondFace: "left" as const
      }
    ]
  };
}

function createMotherQualityReport(passed: boolean, score = passed ? 0.6 : 7) {
  return {
    bandDelta: passed ? 4 : 64,
    edgeDelta: passed ? 4 : 72,
    horizonPeakShiftRatio: passed ? 0.01 : 0.12,
    issues: passed
      ? []
      : [
          { kind: "wrap-edge-color" as const, threshold: 18, value: 72 },
          { kind: "wrap-band-color" as const, threshold: 28, value: 64 }
        ],
    lumaDelta: passed ? 3 : 40,
    passed,
    score,
    seamComplexityRatio: passed ? 1.1 : 2.4,
    thresholds: {
      bandDelta: 28,
      edgeDelta: 18,
      horizonPeakShiftRatio: 0.06,
      lumaDelta: 18,
      seamComplexityRatio: 1.8
    }
  };
}
