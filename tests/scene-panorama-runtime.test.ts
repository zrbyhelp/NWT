import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDefaultScenePanorama } from "@/lib/ai/image-runtime";

const panoramaFaces = ["front", "back", "left", "right", "top", "bottom"] as const;

const runtimeMocks = vi.hoisted(() => ({
  edit: vi.fn(),
  generate: vi.fn(),
  splitEquirectangularToCubemap: vi.fn(),
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
  getDefaultImageRuntimeConfig: vi.fn(async () => ({
    apiKey: "test-key",
    baseUrl: "https://ai.example.test/v1",
    modelId: "test-image-model",
    providerName: "Test Image Provider"
  }))
}));

vi.mock("@/lib/ai/scene-panorama-projection", () => ({
  splitEquirectangularToCubemap: runtimeMocks.splitEquirectangularToCubemap
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
  beforeEach(async () => {
    vi.clearAllMocks();

    const motherBytes = await createSolidPng(32, 16, [90, 120, 150]);
    const referenceBytes = await createSolidPng(16, 16, [120, 140, 160]);

    runtimeMocks.generate.mockResolvedValue({
      data: [{ b64_json: motherBytes.toString("base64") }]
    });
    runtimeMocks.splitEquirectangularToCubemap.mockResolvedValue(
      panoramaFaces.map((face) => ({
        bytes: referenceBytes,
        contentType: "image/png",
        face,
        fileName: `scene-panorama-${face}.png`
      }))
    );
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

    expect(editPayloads).toHaveLength(6);
    expect(editPayloads.every((payload) => !Object.prototype.hasOwnProperty.call(payload, "mask"))).toBe(true);
    expect(editPayloads.map((payload) => String(payload.prompt))).toEqual(
      expect.arrayContaining([
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
      repaired: true
    });
  });

  it("fails clearly when the image model does not support reference-image editing", async () => {
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
