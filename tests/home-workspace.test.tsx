import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import zhMessages from "../messages/zh-CN.json";
import {
  assistHomeCreatureDraft,
  assistHomeItemDraft,
  assistHomeItemDraftWithImages,
  assistHomeMapDraft,
  assistHomeMaskDraft,
  assistHomeSceneDraftWithImages,
  cleanupHomeUploadedMaterialImages,
  createHomeCreatureMaterial,
  createHomeItemMaterial,
  createHomeMapMaterial,
  createHomeMaskMaterial,
  createHomeSceneMaterial,
  deleteHomeMaterial,
  deriveHomeMapGraphRound,
  generateHomeCreatureBoard,
  generateHomeItemBoard,
  generateHomeItemBoardWithImages,
  generateHomeItemModelInputImage,
  generateHomeMaskBoard,
  joinHomeMaterial,
  updateHomeCreatureMaterial,
  updateHomeItemMaterial,
  updateHomeMapMaterial,
  updateHomeMaskMaterial,
  uploadHomeScenePanoramaFace,
  uploadHomeScenePanoramaMother
} from "@/app/[locale]/actions";
import {
  HomeWorkspace,
  clampScenePanoramaView
} from "@/components/home-workspace";
import { MapEdgeDialog, MapNodeDialog } from "@/components/home-workspace/map-dialog";
import { MapGraphEditor } from "@/components/home-workspace/map-graph-editor";
import { buildItemMaterialFormData, createDefaultItemDraft } from "@/components/home-workspace/drafts";
import type { WorkspaceConversation, WorkspaceData, WorkspaceMaterial, WorkspaceScript } from "@/lib/home-workspace";

vi.mock("next-intl", () => ({
  useLocale: () => "zh-CN",
  useTranslations: (namespace?: string) => {
    return (key: string, values?: Record<string, string | number>) => {
      const value = readMessage(namespace ? `${namespace}.${key}` : key);

      if (typeof value !== "string") {
        return key;
      }

      return Object.entries(values ?? {}).reduce(
        (text, [name, replacement]) => text.replace(`{${name}}`, String(replacement)),
        value
      );
    };
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

vi.mock("@/app/[locale]/actions", () => ({
  assistHomeCreatureDraft: vi.fn(),
  assistHomeItemDraft: vi.fn(),
  assistHomeItemDraftWithImages: vi.fn(),
  assistHomeMapDraft: vi.fn(),
  assistHomeMaskDraft: vi.fn(),
  assistHomeSceneDraft: vi.fn(),
  assistHomeSceneDraftWithImages: vi.fn(),
  cleanupHomeUploadedMaterialImages: vi.fn(),
  createHomeCreatureMaterial: vi.fn(),
  createHomeConversation: vi.fn(),
  createHomeItemMaterial: vi.fn(),
  createHomeMapMaterial: vi.fn(),
  createHomeMaskMaterial: vi.fn(),
  createHomeSceneMaterial: vi.fn(),
  deleteHomeConversation: vi.fn(),
  deleteHomeMaterial: vi.fn(),
  deriveHomeMapGraphRound: vi.fn(),
  generateHomeCreatureBoard: vi.fn(),
  generateHomeItemBoard: vi.fn(),
  generateHomeItemBoardWithImages: vi.fn(),
  generateHomeItemModelInputImage: vi.fn(),
  generateHomeMaskBoard: vi.fn(),
  generateHomeSceneBlockPanorama: vi.fn(),
  joinHomeMaterial: vi.fn(),
  loginHomeAccount: vi.fn(),
  logoutHomeAccount: vi.fn(),
  registerHomeAccount: vi.fn(),
  updateHomeCreatureMaterial: vi.fn(),
  updateHomeItemMaterial: vi.fn(),
  updateHomeMapMaterial: vi.fn(),
  updateHomeMaskMaterial: vi.fn(),
  updateHomeSceneMaterial: vi.fn(),
  uploadHomeScenePanoramaFace: vi.fn(),
  uploadHomeScenePanoramaMother: vi.fn()
}));

vi.mock("@/components/header-actions", () => ({
  HeaderActions: () => null
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn()
  }
}));

describe("HomeWorkspace script manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    class MockIntersectionObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    }
    class MockResizeObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    }

    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: MockIntersectionObserver
    });
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: MockResizeObserver
    });
    Element.prototype.scrollIntoView = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:mask-board");
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  it("clamps panorama viewer controls to stable ranges", () => {
    expect(clampScenePanoramaView({ fov: 120, lat: -120, lon: 200 })).toEqual({
      fov: 95,
      lat: -85,
      lon: -160
    });
  });

  it("hides map edge creation when the graph has no nodes", () => {
    render(
      <MapGraphEditor
        draft={{
          name: "空白地图",
          description: "尚未添加任何节点",
          communityVisible: true,
          style: "realistic",
          nodes: [],
          edges: []
        }}
        onAddNode={vi.fn()}
        onSelectNode={vi.fn()}
        onSelectEdge={vi.fn()}
        relationLabel={(relation) => readMaterialMessage(`mapForm.relationTypes.${relation}`)}
        selectedNodeId=""
        selectedEdgeId=""
        t={(key, values) => {
          return readMaterialMessage(key, values);
        }}
      />
    );

    expect(screen.getByRole("button", { name: "新增节点" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新增关系" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "最多衍生轮次" })).not.toBeInTheDocument();
  });

  it("blocks node and relation form submission when the save button is disabled", () => {
    const onNodeSave = vi.fn();
    const onEdgeSave = vi.fn();

    render(
      <div>
        <MapNodeDialog
          draft={{
            name: "空白地图",
            description: "尚未添加任何节点",
            communityVisible: true,
            style: "realistic",
            nodes: [],
            edges: []
          }}
          editingNodeId=""
          isPending={false}
          saveLabel="新增节点"
          title="新增节点"
          description="新增节点描述"
          onCancel={vi.fn()}
          onSave={onNodeSave}
          t={(key, values) => readMaterialMessage(key, values)}
        />
        <MapEdgeDialog
          draft={{
            name: "空白地图",
            description: "尚未添加任何节点",
            communityVisible: true,
            style: "realistic",
            nodes: [
              {
                id: "node-a",
                name: "节点 A",
                description: "",
                type: "landmark",
                x: 0,
                y: 0
              },
              {
                id: "node-b",
                name: "节点 B",
                description: "",
                type: "landmark",
                x: 1,
                y: 1
              }
            ],
            edges: [
              {
                id: "edge-invalid",
                relation: "connects",
                source: "node-a",
                target: "node-a",
                description: ""
              }
            ]
          }}
          editingEdgeId="edge-invalid"
          isPending={false}
          saveLabel="保存关系"
          selectedNodeId=""
          title="编辑关系"
          description="编辑关系描述"
          onCancel={vi.fn()}
          onSave={onEdgeSave}
          t={(key, values) => readMaterialMessage(key, values)}
        />
      </div>
    );

    expect(screen.getByRole("button", { name: "新增节点" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存关系" })).toBeDisabled();
    expect(screen.getByText("起点和终点不能是同一个节点。")).toBeInTheDocument();

    fireEvent.submit(screen.getByRole("heading", { name: "新增节点" }).closest("section")?.querySelector("form") as HTMLFormElement);
    fireEvent.submit(screen.getByRole("heading", { name: "编辑关系" }).closest("section")?.querySelector("form") as HTMLFormElement);

    expect(onNodeSave).not.toHaveBeenCalled();
    expect(onEdgeSave).not.toHaveBeenCalled();
  });

  it("shows graph toolbar controls, formats nodes, and filters visible content", async () => {
    const onLayoutNodes = vi.fn();
    const onChangeDeriveMaxRounds = vi.fn();
    const onStartDerive = vi.fn();
    const onStopDerive = vi.fn();

    render(
      <MapGraphEditor
        draft={{
          name: "工具栏地图",
          description: "用于测试图谱工具栏",
          communityVisible: true,
          style: "realistic",
          nodes: [
            {
              id: "node-country",
              name: "王国",
              description: "",
              type: "country",
              x: 0,
              y: 0
            },
            {
              id: "node-city",
              name: "王城",
              description: "",
              type: "city",
              x: 1,
              y: 1
            }
          ],
          edges: [
            {
              id: "edge-connects",
              relation: "connects",
              source: "node-country",
              target: "node-city",
              description: "王国连到王城"
            }
          ]
        }}
        onAddNode={vi.fn()}
        onChangeDeriveMaxRounds={onChangeDeriveMaxRounds}
        onLayoutNodes={onLayoutNodes}
        onSelectNode={vi.fn()}
        onSelectEdge={vi.fn()}
        onStartDerive={onStartDerive}
        onStopDerive={onStopDerive}
        relationLabel={(relation) => readMaterialMessage(`mapForm.relationTypes.${relation}`)}
        selectedNodeId=""
        selectedEdgeId=""
        t={(key, values) => readMaterialMessage(key, values)}
      />
    );

    expect(screen.getByRole("button", { name: "格式化" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拖动画布" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "筛选" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "最多衍生轮次" })).toHaveValue(3);

    fireEvent.click(screen.getByRole("button", { name: "格式化" }));

    await waitFor(() => {
      expect(onLayoutNodes).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: "node-country" }),
          expect.objectContaining({ id: "node-city" })
        ])
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "拖动画布" }));
    expect(screen.getByRole("button", { name: "拖动画布" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    expect(screen.getByText("按节点类型和关系类型控制画布显示。")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "国家" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "国家" }));

    await waitFor(() => {
      expect(screen.queryByText("王国")).not.toBeInTheDocument();
      expect(screen.queryByText("王国 → 王城")).not.toBeInTheDocument();
      expect(screen.getByText("王城")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("spinbutton", { name: "最多衍生轮次" }), { target: { value: "99" } });
    expect(onChangeDeriveMaxRounds).toHaveBeenLastCalledWith(20);
    expect(screen.getByRole("spinbutton", { name: "最多衍生轮次" })).toHaveValue(3);

    expect(onStartDerive).not.toHaveBeenCalled();
    expect(onStopDerive).not.toHaveBeenCalled();
  });

  it("shows map image controls for generated and manual final images", () => {
    const onChangeMapImageNodeBatchSize = vi.fn();
    const onChangeMapImageReferencePrompt = vi.fn();
    const onClearMapImage = vi.fn();
    const onGenerateMapImage = vi.fn();
    const onGenerateMapGeoJson = vi.fn();
    const onSelectMapFinalImage = vi.fn();

    render(
      <MapGraphEditor
        draft={{
          name: "图像地图",
          description: "用于测试最终地图图像入口",
          communityVisible: true,
          style: "realistic",
          nodes: [
            {
              id: "node-country",
              name: "王国",
              description: "",
              type: "country",
              x: 0,
              y: 0
            }
          ],
          edges: []
        }}
        mapGeoJsonDraft={{
          data: {
            bbox: [-100, -60, 100, 60],
            features: [
              {
                type: "Feature",
                id: "area-node-country",
                geometry: {
                  type: "Polygon",
                  coordinates: [[[-80, -40], [80, -40], [80, 40], [-80, 40], [-80, -40]]]
                },
                properties: {
                  featureKind: "area",
                  id: "area-node-country",
                  level: 0,
                  name: "王国",
                  nodeId: "node-country",
                  nodeType: "country"
                }
              },
              {
                type: "Feature",
                id: "place-node-city",
                geometry: {
                  type: "Point",
                  coordinates: [0, 0]
                },
                properties: {
                  featureKind: "place",
                  id: "place-node-city",
                  level: 3,
                  name: "王城",
                  nodeId: "node-city",
                  nodeType: "city",
                  parentId: "node-country"
                }
              }
            ],
            type: "FeatureCollection"
          },
          edgeCount: 0,
          generatedAt: "2026-05-27T00:00:00.000Z",
          graphSignature: "map-signature",
          nodeCount: 1,
          outlineBased: true,
          pending: false,
          scale: {
            heightKm: 120,
            metersPerUnit: 1000,
            unit: "km",
            widthKm: 200
          },
          source: "algorithm",
          stale: false
        }}
        mapImageDraft={{
          edgeCount: 0,
          file: null,
          generatedAt: "2026-05-27T00:00:00.000Z",
          graphSignature: "map-signature",
          iterationCount: 1,
          nodeBatchSize: 10,
          nodeCount: 1,
          outlineError: null,
          outlinePending: false,
          outlinePreviewUrl: "data:image/png;base64,b3V0bGluZQ==",
          previewUrl: "data:image/png;base64,bWFw",
          referencePrompt: "保留蓝色海岸线",
          source: "generated",
          stale: false,
          storedUrl: null
        }}
        mapImageGeneration={{
          completedNodeIds: [],
          error: null,
          failedRound: 0,
          paused: false,
          pending: false,
          progress: 0,
          relationSummary: "",
          round: 0,
          totalRounds: 0
        }}
        mapImageNodeBatchSize={10}
        mapImageReferenceImages={[]}
        mapImageReferencePrompt="保留蓝色海岸线"
        onAddNode={vi.fn()}
        onChangeMapImageNodeBatchSize={onChangeMapImageNodeBatchSize}
        onChangeMapImageReferencePrompt={onChangeMapImageReferencePrompt}
        onClearMapImage={onClearMapImage}
        onGenerateMapGeoJson={onGenerateMapGeoJson}
        onGenerateMapImage={onGenerateMapImage}
        onSelectMapFinalImage={onSelectMapFinalImage}
        onSelectNode={vi.fn()}
        onSelectEdge={vi.fn()}
        relationLabel={(relation) => readMaterialMessage(`mapForm.relationTypes.${relation}`)}
        selectedNodeId=""
        selectedEdgeId=""
        t={(key, values) => readMaterialMessage(key, values)}
      />
    );

    expect(screen.getByText("最终地图图像")).toBeInTheDocument();
    expect(screen.getByText("AI 生成")).toBeInTheDocument();
    expect(screen.getByText("纯边框图")).toBeInTheDocument();
    expect(screen.getByAltText("地图纯边框图")).toBeInTheDocument();
    expect(screen.getByText("地图数据 GeoJSON")).toBeInTheDocument();
    expect(screen.getByText("2 个要素")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "GeoJSON 地图预览" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "重新生成" })[0]);
    expect(onGenerateMapGeoJson).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole("spinbutton", { name: "每轮节点" }), { target: { value: "120" } });
    expect(onChangeMapImageNodeBatchSize).toHaveBeenCalledWith(100);
    fireEvent.change(screen.getByPlaceholderText("描述参考图中需要沿用的地貌、风格、色彩或地图符号"), {
      target: { value: "保留山脉色彩" }
    });
    expect(onChangeMapImageReferencePrompt).toHaveBeenCalledWith("保留山脉色彩");

    const uploadFile = new File(["map"], "map.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("上传最终图"), { target: { files: [uploadFile] } });
    expect(onSelectMapFinalImage).toHaveBeenCalledWith(uploadFile);

    fireEvent.click(screen.getAllByRole("button", { name: "重新生成" })[1]);
    expect(onGenerateMapImage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "清除图像" }));
    expect(onClearMapImage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "放大地图图像" }));
    expect(screen.getByRole("dialog", { name: "地图图像预览" })).toBeInTheDocument();
  });

  it("allows oversized generated item images when building the save payload", () => {
    const draft = createDefaultItemDraft();
    const boardImageFile = new File(["board"], "item-board.png", { type: "image/png" });
    const modelInputImageFile = new File(["model-input"], "item-model-input.png", { type: "image/png" });

    Object.defineProperty(boardImageFile, "size", { value: 10 * 1024 * 1024 + 1 });
    Object.defineProperty(modelInputImageFile, "size", { value: 10 * 1024 * 1024 + 1 });

    draft.boardImageSource = "generated";
    draft.boardImageFile = boardImageFile;
    draft.modelInputImage = {
      file: modelInputImageFile,
      previewUrl: "data:image/png;base64,bW9kZWw=",
      source: "generated",
      storedUrl: null
    };

    const formData = buildItemMaterialFormData(draft, false);

    expect(formData.get("boardImage")).toBe(boardImageFile);
    expect(formData.get("modelInputImage")).toBe(modelInputImageFile);
  });

  it("opens my scripts by default and can switch to community scripts", () => {
    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "剧本" }));

    expect(screen.getByRole("heading", { level: 1, name: "我的剧本" })).toBeInTheDocument();
    expect(screen.getByText("社区添加")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看社区剧本" })).toBeInTheDocument();
    expect(screen.queryByText("世界观架构师")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看社区剧本" }));

    expect(screen.getByRole("heading", { level: 1, name: "社区剧本" })).toBeInTheDocument();
    expect(screen.getAllByText("世界观架构师").length).toBeGreaterThan(0);
    expect(screen.getByText("已加入")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /加入我的剧本/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回我的剧本" }));

    expect(screen.getByRole("heading", { level: 1, name: "我的剧本" })).toBeInTheDocument();
    expect(screen.queryByText("世界观架构师")).not.toBeInTheDocument();
  });

  it("opens materials, shows community versions, and joins a material", async () => {
    vi.mocked(joinHomeMaterial).mockResolvedValue(joinedNightInkMaterial);
    vi.mocked(assistHomeMaskDraft).mockResolvedValue({
      message: "已自动调整假面。",
      patch: {
        intro: "银发旅人看起来疏离冷静，说话简短，动作习惯轻慢。",
        features: "标志动作：抬手整理银发\n口头禅：别靠太近",
        style: "mystery",
        voice: { pitch: 82 }
      }
    });
    vi.mocked(generateHomeMaskBoard).mockResolvedValue({
      contentType: "image/png",
      dataUrl: "data:image/png;base64,Ym9hcmQ=",
      fileName: "mask-board.png"
    });
    vi.mocked(assistHomeCreatureDraft).mockResolvedValue({
      message: "已完善生物行为逻辑。",
      patch: {
        description: "雾卫兽是废墟边界的群居守卫生物，会通过低频鸣叫同步警戒。",
        behaviorLogic: "发现陌生气味后先围绕观察；靠近巢穴时发出低频警告；持续逼近才集体驱赶。",
        ecology: { habitat: "废墟边界" },
        behavior: { alertness: 86, resourceGuarding: 78 }
      }
    });
    vi.mocked(generateHomeCreatureBoard).mockResolvedValue({
      contentType: "image/png",
      dataUrl: "data:image/png;base64,Y3JlYXR1cmU=",
      fileName: "creature-board.png"
    });
    vi.mocked(assistHomeMapDraft)
      .mockResolvedValueOnce({
        message: "已整理地图基础信息。",
        patch: {
          description: "AI 整理后的地图说明",
          style: "sciFi"
        }
      })
      .mockResolvedValueOnce({
        message: "已加入观测塔节点。",
        patch: {
          addNodes: [
            {
              id: "map-node-observatory",
              description: "监测风道与升降塔的高塔。",
              name: "观测塔",
              type: "landmark"
            }
          ]
        }
      });
    vi.mocked(deriveHomeMapGraphRound).mockResolvedValue({
      message: "已从悬空城衍生东港。",
      patch: {
        addNodes: [
          {
            id: "map-node-east-harbor",
            description: "环层街区东侧的空港节点。",
            name: "东港",
            type: "landmark"
          }
        ],
        addEdges: [
          {
            id: "map-edge-east-harbor",
            description: "升降塔与东港连接。",
            relation: "connects",
            source: "node-country",
            target: "map-node-east-harbor"
          }
        ]
      }
    });
    vi.mocked(createHomeMaskMaterial).mockResolvedValue(createdSilverMaskMaterial);
    vi.mocked(createHomeCreatureMaterial).mockResolvedValue(createdMistguardCreatureMaterial);
    vi.mocked(createHomeMapMaterial).mockResolvedValue(createdMapMaterial);
    vi.mocked(updateHomeCreatureMaterial).mockResolvedValue({
      ...createdMistguardCreatureMaterial,
      title: "雾卫兽·改"
    });
    vi.mocked(updateHomeMapMaterial).mockImplementation(async (_materialId, formData) => {
      const draft = JSON.parse(String(formData.get("draft"))) as {
        communityVisible: boolean;
        description: string;
        edges: unknown[];
        name: string;
        nodes: unknown[];
        style: WorkspaceMaterial["style"];
      };

      expect(draft).toMatchObject({
        description: "更新后的地图说明",
        communityVisible: true,
        name: "悬空城地图·改"
      });

      return {
        ...createdMapMaterial,
        description: draft.description,
        style: draft.style,
        title: draft.name,
        communityVisible: draft.communityVisible,
        metadata: {
          ...(createdMapMaterial.metadata as Record<string, unknown>),
          description: draft.description,
          name: draft.name,
          style: draft.style,
          nodes: draft.nodes,
          edges: draft.edges
        }
      };
    });
    vi.mocked(updateHomeMaskMaterial).mockImplementation(async (_materialId, formData) => {
      expect(formData.get("boardImageMode")).toBe("keep");
      expect(JSON.parse(String(formData.get("draft")))).toMatchObject({
        features: "改后特征：回答前会先短暂停顿。"
      });
      return updatedSilverMaskMaterial;
    });
    vi.mocked(deleteHomeMaterial).mockResolvedValue({ id: "silver-mask" });
    vi.spyOn(window, "confirm").mockImplementation((message) => String(message).includes("永久删除"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.startsWith("data:")) {
          return new Response("board", {
            headers: {
              "Content-Type": "image/png"
            }
          });
        }

        if (url.startsWith("/api/materials/import")) {
          return Response.json({
            importedCount: 1,
            materials: [importedSilverMaskMaterial]
          });
        }

        if (url.startsWith("/api/materials/export")) {
          return new Response("zip", {
            headers: {
              "Content-Type": "application/zip",
              "Content-Disposition": "attachment; filename=\"nwt-materials.zip\""
            }
          });
        }

        return new Response(null, { status: 404 });
      })
    );

    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));

    expect(screen.getByRole("heading", { level: 1, name: "我的素材" })).toBeInTheDocument();
    expect(screen.getByText("回声假面")).toBeInTheDocument();
    expect(screen.getAllByText("写实").length).toBeGreaterThan(0);
    expect(screen.getByText("假面")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "操作" }));

    expect(toast.info).not.toHaveBeenCalled();
    expect(screen.getByRole("menuitem", { name: "导入 ZIP" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "导出全部" })).toBeInTheDocument();
    expect(screen.getByText("选择类型")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "假面" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "地图" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "物品" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "生物" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "场景" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "导出全部" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/materials/export?locale=zh-CN");
      expect(toast.success).toHaveBeenCalledWith("素材 ZIP 已开始下载。");
    });

    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "导入 ZIP" }));
    fireEvent.change(screen.getByLabelText("导入 ZIP 文件"), {
      target: { files: [new File(["zip"], "materials.zip", { type: "application/zip" })] }
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/materials/import?locale=zh-CN", expect.objectContaining({ method: "POST" }));
      expect(toast.success).toHaveBeenCalledWith("已导入 1 个素材。");
    });
    expect(screen.getByText("导入旅人")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "操作" }));

    fireEvent.click(screen.getByRole("menuitem", { name: "假面" }));

    expect(screen.getByRole("heading", { name: "新建假面" })).toBeInTheDocument();
    expect(screen.queryByText("AI 辅助")).not.toBeInTheDocument();
    expect(screen.queryByText("角色设定板")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "AI 辅助" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "角色设定板" })).toBeInTheDocument();
    const saveMaskButton = screen.getByRole("button", { name: "保存假面" });
    expect(saveMaskButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("输入假面名称"), { target: { value: "银发旅人" } });
    expect(saveMaskButton).not.toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("例如：让她更冷淡、更像古风剑客，但不要写背景"), {
      target: { value: "让她更冷淡，风格偏悬疑" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送 AI 辅助消息" }));

    await waitFor(() => {
      expect(assistHomeMaskDraft).toHaveBeenCalled();
      expect(screen.getByLabelText("假面介绍")).toHaveValue("银发旅人看起来疏离冷静，说话简短，动作习惯轻慢。");
      expect(screen.getByLabelText("特征")).toHaveValue("标志动作：抬手整理银发\n口头禅：别靠太近");
    });
    expect(screen.getByText("已自动调整假面。")).toBeInTheDocument();
    expect(screen.getByLabelText("内容风格")).toHaveValue("mystery");

    fireEvent.change(screen.getByLabelText("身高"), { target: { value: "168" } });
    fireEvent.change(screen.getByLabelText("体重"), { target: { value: "52" } });
    fireEvent.change(screen.getByLabelText("发型"), { target: { value: "银色长发" } });
    fireEvent.change(screen.getByLabelText("体型"), { target: { value: "轻盈但有力量感" } });
    fireEvent.change(screen.getByLabelText("特征"), {
      target: { value: "标志动作：抬手整理银发\n说话习惯：句子短，停顿长" }
    });

    expect(screen.getByLabelText("假面介绍")).toHaveValue("银发旅人看起来疏离冷静，说话简短，动作习惯轻慢。");
    expect(screen.getByText("只写可被看见、听见或互动感知到的特征，不写背景经历。")).toBeInTheDocument();
    expect(screen.getByText("不要填写人物背景故事、身世经历或世界关系。")).toBeInTheDocument();
    expect(screen.getByLabelText("身高")).toHaveValue("168");
    expect(screen.getByLabelText("体重")).toHaveValue("52");
    expect(screen.getByLabelText("发型")).toHaveValue("银色长发");
    expect(screen.getByLabelText("体型")).toHaveValue("轻盈但有力量感");
    expect(screen.getByText("建议：短发 / 长发 / 束发 / 微卷发")).toBeInTheDocument();

    const uploadFile = new File(["board"], "board.png", { type: "image/png" });

    fireEvent.change(screen.getByLabelText("上传设定板"), { target: { files: [uploadFile] } });
    expect(createHomeMaskMaterial).not.toHaveBeenCalled();
    expect(screen.getByText("board.png")).toBeInTheDocument();
    expect(screen.getByText("上传图片")).toBeInTheDocument();
    expect(screen.queryByText("尚未选择设定板")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "删除设定板" }));

    expect(screen.queryByText("board.png")).not.toBeInTheDocument();
    expect(screen.getByText("点击上传横版设定板")).toBeInTheDocument();

    expect(screen.getByLabelText("绘制风格")).toHaveValue("realistic");
    expect(screen.getByRole("option", { name: "真人拍摄" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("绘制风格"), { target: { value: "photo" } });
    expect(screen.getByLabelText("绘制风格")).toHaveValue("photo");

    fireEvent.click(screen.getByRole("button", { name: "生成" }));

    await waitFor(() => {
      expect(generateHomeMaskBoard).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("角色设定板已生成。");
    });
    expect(generateHomeMaskBoard).toHaveBeenCalledWith(expect.objectContaining({ boardDrawingStyle: "photo" }), "zh-CN");
    expect(screen.getByText("mask-board.png")).toBeInTheDocument();
    expect(screen.getByText("AI 生成")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "放大设定板" }));
    expect(screen.getByAltText("设定板预览")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭预览" }));
    expect(screen.queryByAltText("设定板预览")).not.toBeInTheDocument();

    const pitchSlider = screen.getByRole("slider", { name: "音高" });
    const speedSlider = screen.getByRole("slider", { name: "语速" });
    const extroversionSlider = screen.getByRole("slider", { name: "外向度" });
    const performativeSlider = screen.getByRole("slider", { name: "表演欲" });

    expect(screen.getAllByRole("slider")).toHaveLength(27);
    expect(speedSlider).toHaveAttribute("min", "80");
    expect(speedSlider).toHaveAttribute("max", "220");
    expect(screen.getByText("基础人格")).toBeInTheDocument();
    expect(screen.getByText("社交表现")).toBeInTheDocument();
    expect(screen.getByText("情绪表现")).toBeInTheDocument();
    expect(screen.getByText("关系表现")).toBeInTheDocument();
    expect(screen.getByText("行为倾向")).toBeInTheDocument();

    fireEvent.change(pitchSlider, { target: { value: "82" } });
    fireEvent.change(speedSlider, { target: { value: "180" } });
    fireEvent.change(extroversionSlider, { target: { value: "70" } });
    fireEvent.change(performativeSlider, { target: { value: "15" } });

    expect(pitchSlider).toHaveValue("82");
    expect(speedSlider).toHaveValue("180");
    expect(extroversionSlider).toHaveValue("70");
    expect(performativeSlider).toHaveValue("15");
    expect(screen.getByText("82/100")).toBeInTheDocument();
    expect(screen.getByText("180 字/分钟")).toBeInTheDocument();
    expect(screen.getByText("70/100")).toBeInTheDocument();
    expect(screen.getByText("15/100")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "选择肤色 #B77955" }));
    expect(screen.getByText("#B77955")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("瞳色颜色选择器"), { target: { value: "#3f7a4b" } });
    expect(screen.getByText("#3F7A4B")).toBeInTheDocument();

    const createShareSwitch = screen.getByRole("switch", { name: "分享到社区" });

    expect(createShareSwitch).toBeChecked();
    expect(createShareSwitch).toBeDisabled();
    fireEvent.click(createShareSwitch);
    expect(createShareSwitch).toBeChecked();

    fireEvent.click(saveMaskButton);

    await waitFor(() => {
      expect(createHomeMaskMaterial).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("假面已创建并加入我的素材。");
    });
    expect(JSON.parse(String(vi.mocked(createHomeMaskMaterial).mock.calls[0][0].get("draft")))).toMatchObject({
      communityVisible: true,
      features: "标志动作：抬手整理银发\n说话习惯：句子短，停顿长"
    });
    expect(screen.queryByRole("heading", { name: "新建假面" })).not.toBeInTheDocument();
    expect(screen.getByText("银发旅人")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /银发旅人/ }));

    expect(screen.getByRole("button", { name: "放大素材图片" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "放大素材图片" }));
    expect(screen.getByAltText("素材图片预览")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭素材图片预览" }));
    expect(screen.queryByAltText("素材图片预览")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();
    expect(screen.queryByText("我的素材库")).not.toBeInTheDocument();
    expect(screen.getByText("身体信息收集")).toBeInTheDocument();
    expect(screen.getByText("身体颜色配置")).toBeInTheDocument();
    expect(screen.getByText("语音特征")).toBeInTheDocument();
    expect(screen.getByText("性格特征")).toBeInTheDocument();
    expect(screen.getByText("#F2F0E8")).toBeInTheDocument();
    expect(screen.getByText("正常")).toBeInTheDocument();
    expect(screen.getByText("偏高，分析型、冷静、结构化")).toBeInTheDocument();
    expect(screen.queryByText("80/100")).not.toBeInTheDocument();
    expect(screen.queryByText("150 字/分钟")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "导出" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/materials/export?locale=zh-CN&materialId=silver-mask");
      expect(toast.success).toHaveBeenCalledWith("素材 ZIP 已开始下载。");
    });

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    expect(screen.getByRole("heading", { name: "编辑假面" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入假面名称")).toHaveValue("银发旅人");
    expect(screen.getByLabelText("假面介绍")).toHaveValue("疏离冷静，说话简短。");
    expect(screen.getByLabelText("特征")).toHaveValue("标志动作：抬手整理银发\n说话习惯：句子短，停顿长");
    expect(screen.getByLabelText("内容风格")).toHaveValue("mystery");
    expect(screen.getByLabelText("身高")).toHaveValue("168");
    expect(screen.getByLabelText("绘制风格")).toHaveValue("guofeng");
    expect(screen.getByText("AI 生成")).toBeInTheDocument();

    const editDialog = screen.getByRole("heading", { name: "编辑假面" }).closest("section") as HTMLElement;
    const editShareSwitch = within(editDialog).getByRole("switch", { name: "分享到社区" });

    expect(editShareSwitch).toBeChecked();
    expect(editShareSwitch).toBeDisabled();
    fireEvent.click(editShareSwitch);
    expect(editShareSwitch).toBeChecked();

    fireEvent.change(screen.getByPlaceholderText("输入假面名称"), { target: { value: "银发旅人·改" } });
    fireEvent.change(screen.getByLabelText("假面介绍"), { target: { value: "更冷淡，语气更克制。" } });
    fireEvent.change(screen.getByLabelText("特征"), { target: { value: "改后特征：回答前会先短暂停顿。" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => {
      expect(updateHomeMaskMaterial).toHaveBeenCalledWith("silver-mask", expect.any(FormData), "zh-CN");
      expect(toast.success).toHaveBeenCalledWith("假面修改已保存。");
    });
    expect(JSON.parse(String(vi.mocked(updateHomeMaskMaterial).mock.calls[0][1].get("draft")))).toMatchObject({
      communityVisible: true,
      features: "改后特征：回答前会先短暂停顿。"
    });
    expect(screen.queryByRole("heading", { name: "编辑假面" })).not.toBeInTheDocument();
    expect(screen.getAllByText("银发旅人·改").length).toBeGreaterThan(0);
    expect(screen.getAllByText("银发旅人·改更冷淡，语气更克制。").length).toBeGreaterThan(0);

    const shareSwitch = screen.getByRole("switch", { name: "分享到社区" });

    expect(shareSwitch).toBeChecked();
    expect(shareSwitch).toBeDisabled();
    fireEvent.click(shareSwitch);
    expect(shareSwitch).toBeChecked();
    expect(screen.getByText("已开启")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "删除" })).not.toBeDisabled();
    });

    vi.stubGlobal("confirm", vi.fn(() => true));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(deleteHomeMaterial).toHaveBeenCalledWith("silver-mask", "zh-CN");
      expect(toast.success).toHaveBeenCalledWith("素材已删除。");
    });
    expect(screen.queryByText("银发旅人·改")).not.toBeInTheDocument();
    vi.stubGlobal("confirm", vi.fn((message: string) => String(message).includes("永久删除")));

    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "地图" }));

    expect(screen.getByRole("heading", { name: "新建地图" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI 辅助" })).toBeInTheDocument();
    expect(screen.queryByText("地图节点")).not.toBeInTheDocument();
    expect(screen.queryByText("关系")).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("例如：把它扩展成沿海王国、港口群和内陆荒原，并补全道路关系"),
      { target: { value: "补充地图基础信息" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "发送地图 AI 辅助消息" }));

    await waitFor(() => {
      expect(assistHomeMapDraft).toHaveBeenCalledTimes(1);
      expect(screen.getByText("已整理地图基础信息。")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("地图说明")).toHaveValue("AI 整理后的地图说明");

    fireEvent.change(screen.getByPlaceholderText("输入地图名称"), { target: { value: "悬空城地图" } });
    fireEvent.change(screen.getByLabelText("地图说明"), {
      target: { value: "记录环层街区、升降塔和风道关系的地图素材。" }
    });
    fireEvent.change(screen.getByLabelText("内容风格"), { target: { value: "sciFi" } });
    const mapShareSwitch = screen.getByRole("switch", { name: "分享到社区" });
    expect(mapShareSwitch).toBeChecked();
    expect(mapShareSwitch).toBeDisabled();
    fireEvent.click(mapShareSwitch);
    expect(mapShareSwitch).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "保存地图" }));

    await waitFor(() => {
      expect(createHomeMapMaterial).toHaveBeenCalledWith(expect.any(FormData), "zh-CN");
      expect(toast.success).toHaveBeenCalledWith("地图已创建并加入我的素材。");
      expect(window.confirm).toHaveBeenCalledWith("地图已保存。是否立即进入图谱编辑？");
    });
    const createdMapDraft = JSON.parse(String(vi.mocked(createHomeMapMaterial).mock.calls[0][0].get("draft")));

    expect(createdMapDraft).toMatchObject({
      communityVisible: true,
      description: "记录环层街区、升降塔和风道关系的地图素材。",
      name: "悬空城地图",
      style: "sciFi"
    });
    expect(createdMapDraft.nodes).toHaveLength(0);
    expect(createdMapDraft.edges).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "新建地图" })).not.toBeInTheDocument();
    expect(screen.getAllByText("悬空城地图").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /悬空城地图/ }));
    expect(screen.getAllByText("上层街区").length).toBeGreaterThan(0);
    expect(screen.getAllByText("悬空城 → 上层街区").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "编辑基础信息" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑图谱" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑图谱" }));
    expect(screen.getByRole("heading", { name: "地图图谱编辑" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI 辅助" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑基础信息" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新增关系" })).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("例如：把它扩展成沿海王国、港口群和内陆荒原，并补全道路关系"),
      { target: { value: "补充图谱节点" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "发送地图 AI 辅助消息" }));

    await waitFor(() => {
      expect(assistHomeMapDraft).toHaveBeenCalledTimes(2);
      expect(screen.getByText("已加入观测塔节点。")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("观测塔")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "编辑基础信息" }));
    expect(screen.getByRole("heading", { name: "编辑地图基础信息" })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("输入地图名称"), { target: { value: "悬空城地图·改" } });
    fireEvent.change(screen.getByLabelText("地图说明"), { target: { value: "更新后的地图说明" } });
    fireEvent.click(screen.getByRole("button", { name: "保存基础信息" }));

    await waitFor(() => {
      expect(updateHomeMapMaterial).toHaveBeenCalledWith("map-city", expect.any(FormData), "zh-CN");
      expect(toast.success).toHaveBeenCalledWith("地图修改已保存。");
    });
    expect(screen.queryByRole("heading", { name: "编辑地图基础信息" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑图谱" }));
    expect(screen.getByRole("heading", { name: "地图图谱编辑" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("观测塔").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByRole("button", { name: "新增节点" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "连线" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新增关系" })).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "最多衍生轮次" })).toHaveValue(3);
    fireEvent.change(screen.getByRole("spinbutton", { name: "最多衍生轮次" }), { target: { value: "1" } });
    expect(screen.getByRole("spinbutton", { name: "最多衍生轮次" })).toHaveValue(1);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "开始衍生" })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "开始衍生" }));

    await waitFor(() => {
      expect(deriveHomeMapGraphRound).toHaveBeenCalledTimes(1);
      expect(screen.getByText("开始逐轮衍生，共 1 轮，AI 将根据整张图自主判断增长方向。")).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes("已从悬空城衍生东港。"))).toBeInTheDocument();
      expect(screen.getAllByText("东港").length).toBeGreaterThan(0);
    });
    expect(deriveHomeMapGraphRound).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: "node-country",
            name: "悬空城"
          })
        ])
      }),
      1,
      1,
      "zh-CN"
    );
    expect(updateHomeMapMaterial).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole("button", { name: "新增节点" })[0]);
    const nodeDialog = screen.getByRole("heading", { name: "新增节点" }).closest("section") as HTMLElement;
    expect(within(nodeDialog).queryByText("横坐标")).not.toBeInTheDocument();
    expect(within(nodeDialog).queryByText("纵坐标")).not.toBeInTheDocument();
    fireEvent.change(within(nodeDialog).getByPlaceholderText("输入节点名称"), { target: { value: "外环港" } });
    fireEvent.click(within(nodeDialog).getByRole("button", { name: "新增节点" }));
    expect(screen.queryByRole("heading", { name: "新增节点" })).not.toBeInTheDocument();

    const graphDialog = screen.getByRole("heading", { name: "地图图谱编辑" }).closest("section") as HTMLElement;

    fireEvent.click(within(graphDialog).getAllByRole("button", { name: /悬空城国家/ })[0]);
    fireEvent.click(within(graphDialog).getByRole("button", { name: "连线" }));
    expect(screen.getByText("已从「悬空城」发起连线，请选择目标节点。")).toBeInTheDocument();
    fireEvent.click(within(graphDialog).getByRole("button", { name: /观测塔/ }));
    const edgeDialog = screen.getByRole("heading", { name: "新增关系" }).closest("section") as HTMLElement;
    expect(within(edgeDialog).getByRole("combobox", { name: "起点" })).toHaveValue("node-country");
    expect(within(edgeDialog).getByRole("combobox", { name: "终点" })).toHaveValue("map-node-observatory");
    fireEvent.click(within(edgeDialog).getByRole("button", { name: "互换起点终点" }));
    expect(within(edgeDialog).getByRole("combobox", { name: "起点" })).toHaveValue("map-node-observatory");
    expect(within(edgeDialog).getByRole("combobox", { name: "终点" })).toHaveValue("node-country");
    fireEvent.click(within(edgeDialog).getByRole("button", { name: "新增关系" }));
    await waitFor(() => {
      expect(screen.getAllByText("观测塔 → 悬空城").length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole("heading", { name: "新增关系" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "取消" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "关闭素材详情" }));

    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "生物" }));

    expect(screen.getByRole("heading", { name: "新建生物" })).toBeInTheDocument();
    const saveCreatureButton = screen.getByRole("button", { name: "保存生物" });
    expect(saveCreatureButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("输入生物名称"), { target: { value: "雾卫兽" } });
    fireEvent.change(screen.getByPlaceholderText("例如：把它改成废墟群居生物，强调警戒、护巢和可驯化边界"), {
      target: { value: "补全废墟群居与护巢行为" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送 AI 辅助消息" }));

    await waitFor(() => {
      expect(assistHomeCreatureDraft).toHaveBeenCalled();
      expect(screen.getByLabelText("完整定义")).toHaveValue("雾卫兽是废墟边界的群居守卫生物，会通过低频鸣叫同步警戒。");
      expect(screen.getByLabelText("行为逻辑")).toHaveValue("发现陌生气味后先围绕观察；靠近巢穴时发出低频警告；持续逼近才集体驱赶。");
    });
    expect(screen.getByText("已完善生物行为逻辑。")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "警觉性" })).toHaveValue("86");
    expect(screen.getByRole("slider", { name: "护食/护巢" })).toHaveValue("78");

    fireEvent.change(screen.getByLabelText("生物类型"), { target: { value: "雾生兽类" } });
    fireEvent.change(screen.getByLabelText("栖息地"), { target: { value: "废墟边界" } });
    fireEvent.change(screen.getByLabelText("身长/高度"), { target: { value: "2.4" } });
    fireEvent.change(screen.getByPlaceholderText("输入能力后回车"), { target: { value: "嗅出谎言" } });
    fireEvent.keyDown(screen.getByPlaceholderText("输入能力后回车"), { key: "Enter" });
    expect(screen.getByText("嗅出谎言")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "生成" }));

    await waitFor(() => {
      expect(generateHomeCreatureBoard).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("生物设定板已生成。");
    });
    expect(generateHomeCreatureBoard).toHaveBeenCalledWith(expect.objectContaining({ boardDrawingStyle: "realistic" }), "zh-CN");
    expect(screen.getByText("creature-board.png")).toBeInTheDocument();

    fireEvent.click(saveCreatureButton);

    await waitFor(() => {
      expect(createHomeCreatureMaterial).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("生物已创建并加入我的素材。");
    });
    expect(JSON.parse(String(vi.mocked(createHomeCreatureMaterial).mock.calls[0][0].get("draft")))).toMatchObject({
      behaviorLogic: "发现陌生气味后先围绕观察；靠近巢穴时发出低频警告；持续逼近才集体驱赶。",
      taxonomy: { creatureType: "雾生兽类" }
    });
    expect(screen.queryByRole("heading", { name: "新建生物" })).not.toBeInTheDocument();
    expect(screen.getByText("雾卫兽")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /雾卫兽/ }));
    expect(screen.getByText("行为逻辑")).toBeInTheDocument();
    expect(screen.getByText("发现陌生气味后先围绕观察；靠近巢穴时发出低频警告；持续逼近才集体驱赶。")).toBeInTheDocument();
    expect(screen.getByText("很高，高度警戒")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭素材详情" }));

    fireEvent.click(screen.getByRole("button", { name: "查看社区版本" }));

    expect(screen.getByRole("heading", { level: 1, name: "社区素材" })).toBeInTheDocument();
    expect(screen.getByText("夜墨瓶")).toBeInTheDocument();
    expect(screen.getAllByText("悬疑").length).toBeGreaterThan(0);
    expect(screen.getByText("物品")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("搜索素材"), { target: { value: "物品" } });

    expect(screen.getByText("夜墨瓶")).toBeInTheDocument();
    expect(screen.queryByText("回声假面")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("搜索素材"), { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: /夜墨瓶/ }));
    expect(screen.queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导出" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加入我的素材" }));

    await waitFor(() => {
      expect(joinHomeMaterial).toHaveBeenCalledWith("night-ink", "zh-CN");
      expect(toast.success).toHaveBeenCalledWith("素材已加入我的素材库。");
    });
    expect(screen.getByRole("button", { name: "已加入" })).toBeDisabled();
  }, 30000);

  it("creates an item with AI fields, one model input image, and an InstantMesh model", async () => {
    vi.mocked(assistHomeItemDraft).mockResolvedValue({
      message: "已补全物品。",
      patch: {
        colors: ["青色", "银白"],
        description: "半透明的便携扫描装置，边缘有细密发光刻线。",
        functions: ["扫描", "记录"],
        itemCategory: "设备",
        keywords: ["扫描仪", "赛博"],
        materials: ["半透明树脂", "金属"],
        scaleHint: "约 18cm，接近手持终端",
        style: "sciFi",
        traits: ["半透明外壳"],
        uses: ["医疗检查"]
      }
    });
    vi.mocked(generateHomeItemBoard).mockResolvedValue({
      contentType: "image/png",
      dataUrl: "data:image/png;base64,aXRlbS1ib2FyZA==",
      fileName: "item-board.png"
    });
    vi.mocked(generateHomeItemModelInputImage).mockResolvedValue({ image: createItemModelInputImage() });
    vi.mocked(createHomeItemMaterial).mockResolvedValue(createdScannerItemMaterial);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/materials/item-model/stream") {
          return new Response(createEventStreamBody([
            { type: "progress", progress: 20, stage: "submitted", messageKey: "itemForm.modelProgressSubmitted" },
            {
              type: "done",
              byteSize: 12,
              contentType: "model/gltf-binary",
              fileName: "scanner.glb",
              url: "https://cdn.example.com/models/scanner.glb"
            }
          ], new TextEncoder()), {
            headers: {
              "Content-Type": "text/event-stream"
            }
          });
        }

        return new Response(null, { status: 404 });
      })
    );

    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));
    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "物品" }));

    expect(screen.getByRole("heading", { name: "新建物品" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "AI 辅助" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "物品设定板" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "AI 模型输入图" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "InstantMesh GLB" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("输入物品名称"), { target: { value: "灵犀扫描器" } });
    fireEvent.change(screen.getByPlaceholderText("例如：把它改成赛博医疗道具，强调半透明材质和扫描功能"), {
      target: { value: "补全成赛博医疗扫描器" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送物品 AI 辅助消息" }));

    await waitFor(() => {
      expect(assistHomeItemDraft).toHaveBeenCalled();
      expect(screen.getByLabelText("描述")).toHaveValue("半透明的便携扫描装置，边缘有细密发光刻线。");
    });
    expect(screen.getByText("半透明外壳")).toBeInTheDocument();
    expect(screen.getByText("医疗检查")).toBeInTheDocument();
    expect(screen.getByLabelText("内容风格")).toHaveValue("sciFi");

    fireEvent.click(screen.getByRole("button", { name: "生成设定板" }));

    await waitFor(() => {
      expect(generateHomeItemBoard).toHaveBeenCalledWith(expect.objectContaining({ name: "灵犀扫描器" }), "zh-CN");
      expect(toast.success).toHaveBeenCalledWith("物品设定板已生成。");
    });

    fireEvent.click(screen.getByRole("button", { name: "生成输入图" }));

    await waitFor(() => {
      expect(generateHomeItemModelInputImage).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("物品模型输入图已生成。");
    });

    fireEvent.change(screen.getByPlaceholderText("JSON 或接口约定文本，可留空"), { target: { value: "{\"quality\":\"draft\"}" } });
    fireEvent.click(screen.getByRole("button", { name: "生成模型" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/materials/item-model/stream", expect.objectContaining({ method: "POST" }));
      expect(toast.success).toHaveBeenCalledWith("3D 模型已生成。");
    });

    fireEvent.click(screen.getByRole("button", { name: "保存物品" }));

    await waitFor(() => {
      expect(createHomeItemMaterial).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("物品已创建并加入我的素材。");
    });
    const formData = vi.mocked(createHomeItemMaterial).mock.calls[0][0];
    const savedDraft = JSON.parse(String(formData.get("draft")));

    expect(savedDraft).toMatchObject({
      itemCategory: "设备",
      model3d: {
        source: "instantmesh",
        url: "https://cdn.example.com/models/scanner.glb"
      },
      scaleHint: "约 18cm，接近手持终端"
    });
    expect(formData.get("modelInputImage")).toBeInstanceOf(File);
    expect(formData.get("frontImage")).toBeNull();
    expect(screen.queryByRole("heading", { name: "新建物品" })).not.toBeInTheDocument();
    expect(screen.getByText("灵犀扫描器")).toBeInTheDocument();
  }, 30000);

  it("sends item AI assist with an image-only reference and clears it after success", async () => {
    vi.mocked(assistHomeItemDraftWithImages).mockResolvedValue({
      message: "已根据参考图同步物品。",
      patch: {}
    });

    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));
    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "物品" }));
    const sendButton = screen.getByRole("button", { name: "发送物品 AI 辅助消息" });

    expect(sendButton).toBeDisabled();

    const aiReferenceGroup = screen.getByRole("group", { name: "物品 AI 参考图" });
    const aiReferenceInput = within(aiReferenceGroup).getByText("上传参考").closest("label")?.querySelector("input");

    expect(aiReferenceInput).toBeTruthy();
    fireEvent.change(aiReferenceInput as HTMLInputElement, {
      target: { files: [new File(["item-ai-reference"], "item-ai-reference.png", { type: "image/png" })] }
    });
    expect(sendButton).not.toBeDisabled();
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(assistHomeItemDraftWithImages).toHaveBeenCalledWith(expect.any(FormData), "zh-CN");
    });
    const formData = vi.mocked(assistHomeItemDraftWithImages).mock.calls[0][0] as FormData;

    expect(formData.get("instruction")).toBe("");
    expect(formData.getAll("referenceImages")).toHaveLength(1);
    expect(screen.getByText("根据参考图片同步完善物品草稿")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("item-ai-reference.png")).not.toBeInTheDocument();
    });
  });

  it("generates an item board with reference images and clears them after success", async () => {
    vi.mocked(generateHomeItemBoardWithImages).mockResolvedValue({
      contentType: "image/png",
      dataUrl: "data:image/png;base64,aXRlbS1ib2FyZA==",
      fileName: "item-board.png"
    });

    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));
    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "物品" }));
    fireEvent.change(screen.getByPlaceholderText("输入物品名称"), { target: { value: "灵犀扫描器" } });
    const boardReferenceGroup = screen.getByRole("group", { name: "设定板参考图" });
    const boardReferenceInput = within(boardReferenceGroup).getByText("上传参考").closest("label")?.querySelector("input");

    expect(boardReferenceInput).toBeTruthy();
    fireEvent.change(boardReferenceInput as HTMLInputElement, {
      target: { files: [new File(["item-board-reference"], "item-board-reference.png", { type: "image/png" })] }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成设定板" }));

    await waitFor(() => {
      expect(generateHomeItemBoardWithImages).toHaveBeenCalledWith(expect.any(FormData), "zh-CN");
      expect(toast.success).toHaveBeenCalledWith("物品设定板已生成。");
    });
    const formData = vi.mocked(generateHomeItemBoardWithImages).mock.calls[0][0] as FormData;

    expect(formData.getAll("referenceImages")).toHaveLength(1);
    expect(generateHomeItemBoard).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText("item-board-reference.png")).not.toBeInTheDocument();
    });
  });

  it("shows a concrete item record save error after item image upload succeeds", async () => {
    vi.mocked(createHomeItemMaterial).mockRejectedValue(new Error("ITEM_MATERIAL_DATABASE_FAILED"));

    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));
    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "物品" }));
    fireEvent.change(screen.getByPlaceholderText("输入物品名称"), { target: { value: "灵犀扫描器" } });
    fireEvent.click(screen.getByRole("button", { name: "保存物品" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "物品素材记录写入失败；若本次上传了图片，系统已尝试清理，请检查数据库连接或迁移后重试。"
      );
    });
  });

  it("keeps scene panorama generation type in the form and uploads faces on save", async () => {
    const fetchMock = mockScenePanoramaFetch(createSceneStreamFaces());

    vi.mocked(uploadHomeScenePanoramaFace).mockImplementation(async (formData) => {
      return {
        face: String(formData.get("face")),
        url: `https://cdn.example.com/materials/${String(formData.get("face"))}.png`
      };
    });
    vi.mocked(uploadHomeScenePanoramaMother).mockResolvedValue({ url: "https://cdn.example.com/materials/mother.png" });
    vi.mocked(createHomeSceneMaterial).mockImplementation(async (_formData) => createdSceneMaterial);

    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));
    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "场景" }));

    expect(screen.getByRole("heading", { name: "新建场景" })).toBeInTheDocument();
    expect(screen.getByLabelText("全景类型")).toHaveValue("realistic");
    expect(screen.getByLabelText("区块规模")).toHaveValue("mid");
    fireEvent.change(screen.getByLabelText("全景类型"), { target: { value: "photo" } });
    expect(screen.getByLabelText("全景类型")).toHaveValue("photo");
    fireEvent.change(screen.getByLabelText("区块规模"), { target: { value: "wide" } });
    expect(screen.getByLabelText("区块规模")).toHaveValue("wide");

    fireEvent.change(screen.getByLabelText("场景名称"), { target: { value: "废弃研究所" } });
    fireEvent.change(screen.getByLabelText("场景说明"), { target: { value: "一座被雨水和藤蔓侵蚀的旧研究所。" } });
    fireEvent.change(screen.getByLabelText("区块名称"), { target: { value: "主厅" } });
    fireEvent.change(screen.getByLabelText("区块说明"), { target: { value: "坍塌的接待区，玻璃幕墙漏入冷光。" } });
    fireEvent.change(screen.getByLabelText("最多迭代轮次"), { target: { value: "4" } });
    const blockReferenceInput = screen.getAllByText("上传参考")[0].closest("label")?.querySelector("input");
    const referenceFile = new File(["reference"], "reference.png", { type: "image/png" });

    expect(blockReferenceInput).toBeTruthy();
    fireEvent.change(blockReferenceInput as HTMLInputElement, { target: { files: [referenceFile] } });
    expect(screen.getByText("reference.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "生成母图" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/materials/scene-panorama/mother/stream", expect.any(Object));
    });
    const motherBody = fetchMock.mock.calls.find((call) => String(call[0]) === "/api/materials/scene-panorama/mother/stream")?.[1]?.body;
    expect(motherBody).toBeInstanceOf(FormData);
    expect((motherBody as FormData).getAll("referenceImages")).toHaveLength(1);

    await waitFor(() => {
      expect(screen.getByText("全景母图")).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith("全景母图已生成。");
    });

    fireEvent.click(screen.getByRole("button", { name: "生成六面图" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/materials/scene-panorama/stream", expect.any(Object));
    });
    const streamBody = fetchMock.mock.calls.find((call) => String(call[0]) === "/api/materials/scene-panorama/stream")?.[1]?.body;
    expect(streamBody).toBeInstanceOf(FormData);
    expect((streamBody as FormData).get("locale")).toBe("zh-CN");
    expect((streamBody as FormData).get("maxRedrawAttempts")).toBe("4");
    expect((streamBody as FormData).get("motherImage")).toBeInstanceOf(File);
    expect((streamBody as FormData).getAll("referenceImages")).toHaveLength(0);
    expect(JSON.parse(String((streamBody as FormData).get("draft")))).toMatchObject({
      panoramaDrawingStyle: "photo",
      blocks: [expect.objectContaining({ scalePreset: "wide" })]
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("区块全景已生成。");
      expect(screen.getByText("AI 辅助")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "放大全景预览" }));
    expect(screen.getByRole("heading", { name: "全景预览" })).toBeInTheDocument();
    expect(screen.getAllByText("全景母图").length).toBeGreaterThan(0);
    expect(screen.getByText("六面图全景")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭全景预览" }));

    fireEvent.click(screen.getByRole("button", { name: "保存场景" }));

    await waitFor(() => {
      expect(uploadHomeScenePanoramaMother).toHaveBeenCalledTimes(1);
      expect(uploadHomeScenePanoramaFace).toHaveBeenCalledTimes(6);
      expect(createHomeSceneMaterial).toHaveBeenCalledWith(
        expect.any(FormData),
        "zh-CN"
      );
      expect(toast.success).toHaveBeenCalledWith("场景已创建并加入我的素材。");
    });

    const draft = JSON.parse(String(vi.mocked(createHomeSceneMaterial).mock.calls[0][0].get("draft")));
    expect(draft).toMatchObject({
      panoramaDrawingStyle: "photo",
      blocks: [
        expect.objectContaining({
          scalePreset: "wide",
          panorama: {
            faceSource: "reference-repaint",
            faces: expect.objectContaining({
              front: "https://cdn.example.com/materials/front.png"
            }),
            mother: {
              source: "generated",
              url: "https://cdn.example.com/materials/mother.png"
            }
          }
        })
      ]
    });
  });

  it("uses the first block scene image in the scene detail header", () => {
    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));
    fireEvent.click(screen.getByRole("button", { name: "查看社区版本" }));
    fireEvent.click(screen.getByRole("button", { name: /废弃研究所/ }));

    const sceneHeaderImage = screen.getByRole("button", { name: "放大素材图片" }).querySelector("img");
    expect(sceneHeaderImage).toHaveAttribute("src", "https://cdn.example.com/scene/main-mother.png");
    fireEvent.click(screen.getByRole("button", { name: "放大素材图片" }));
    expect(screen.getByAltText("素材图片预览")).toHaveAttribute("src", "https://cdn.example.com/scene/main-mother.png");
    fireEvent.click(screen.getByRole("button", { name: "关闭素材图片预览" }));

    fireEvent.click(screen.getByRole("button", { name: "放大全景预览" }));

    expect(screen.getByRole("heading", { name: "全景预览" })).toBeInTheDocument();
    expect(screen.queryByText("六面图全景")).not.toBeInTheDocument();
    expect(screen.queryByText("全景母图")).not.toBeInTheDocument();
  });

  it("keeps the best-scored mother when quality fails and still lets cubemap generation continue", async () => {
    const fetchMock = mockScenePanoramaFetch(
      createSceneStreamFaces(),
      createScenePanoramaStreamEvents(createSceneStreamFaces()),
      createScenePanoramaMotherStreamEvents(false)
    );

    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));
    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "场景" }));
    fireEvent.change(screen.getByLabelText("场景名称"), { target: { value: "废弃研究所" } });
    fireEvent.change(screen.getByLabelText("场景说明"), { target: { value: "一座被雨水和藤蔓侵蚀的旧研究所。" } });
    fireEvent.change(screen.getByLabelText("区块名称"), { target: { value: "主厅" } });
    fireEvent.change(screen.getByLabelText("区块说明"), { target: { value: "坍塌的接待区，玻璃幕墙漏入冷光。" } });

    fireEvent.click(screen.getByRole("button", { name: "生成母图" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("全景母图环绕质检未通过，请调整描述或参考图后重新生成。");
      expect(screen.getByText("全景母图")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "生成六面图" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/materials/scene-panorama/stream", expect.any(Object));
      expect(toast.success).toHaveBeenCalledWith("区块全景已生成。");
    });
    expect(toast.error).not.toHaveBeenCalledWith("请先生成全景母图，再生成六面图。");
  });

  it("shows a concrete scene record save error after cubemap upload succeeds", async () => {
    mockScenePanoramaFetch(createSceneStreamFaces());
    vi.mocked(uploadHomeScenePanoramaFace).mockImplementation(async (formData) => ({
      face: String(formData.get("face")),
      url: `https://cdn.example.com/materials/${String(formData.get("face"))}.png`
    }));
    vi.mocked(uploadHomeScenePanoramaMother).mockResolvedValue({ url: "https://cdn.example.com/materials/mother.png" });
    vi.mocked(createHomeSceneMaterial).mockRejectedValue(new Error("SCENE_MATERIAL_DATABASE_FAILED"));

    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));
    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "场景" }));
    fireEvent.change(screen.getByLabelText("场景名称"), { target: { value: "废弃研究所" } });
    fireEvent.change(screen.getByLabelText("场景说明"), { target: { value: "一座被雨水和藤蔓侵蚀的旧研究所。" } });
    fireEvent.change(screen.getByLabelText("区块名称"), { target: { value: "主厅" } });
    fireEvent.change(screen.getByLabelText("区块说明"), { target: { value: "坍塌的接待区，玻璃幕墙漏入冷光。" } });

    fireEvent.click(screen.getByRole("button", { name: "生成母图" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("全景母图已生成。");
    });

    fireEvent.click(screen.getByRole("button", { name: "生成六面图" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("区块全景已生成。");
    });

    fireEvent.click(screen.getByRole("button", { name: "保存场景" }));

    await waitFor(() => {
      expect(uploadHomeScenePanoramaMother).toHaveBeenCalledTimes(1);
      expect(uploadHomeScenePanoramaFace).toHaveBeenCalledTimes(6);
      expect(cleanupHomeUploadedMaterialImages).toHaveBeenCalledWith([
        "https://cdn.example.com/materials/mother.png",
        "https://cdn.example.com/materials/front.png",
        "https://cdn.example.com/materials/back.png",
        "https://cdn.example.com/materials/left.png",
        "https://cdn.example.com/materials/right.png",
        "https://cdn.example.com/materials/top.png",
        "https://cdn.example.com/materials/bottom.png"
      ]);
      expect(toast.error).toHaveBeenCalledWith(
        "六面图上传完成，但场景记录写入失败；系统已尝试清理本次上传图片，请检查数据库连接或迁移后重试。"
      );
    });
  });

  it("shows a quality failure when panorama seam checks fail", async () => {
    mockScenePanoramaFetch(createSceneStreamFaces(), [{ type: "error", message: "SCENE_PANORAMA_QUALITY_FAILED" }]);

    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));
    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "场景" }));
    fireEvent.change(screen.getByLabelText("场景名称"), { target: { value: "废弃研究所" } });
    fireEvent.change(screen.getByLabelText("场景说明"), { target: { value: "一座被雨水和藤蔓侵蚀的旧研究所。" } });
    fireEvent.change(screen.getByLabelText("区块名称"), { target: { value: "主厅" } });
    fireEvent.change(screen.getByLabelText("区块说明"), { target: { value: "坍塌的接待区，玻璃幕墙漏入冷光。" } });

    fireEvent.click(screen.getByRole("button", { name: "生成母图" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("全景母图已生成。");
    });

    fireEvent.click(screen.getByRole("button", { name: "生成六面图" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("区块全景接缝质检未通过，请重新生成。");
    });
  });

  it("treats skipped panorama color harmonization as a completed generation", async () => {
    const faces = createSceneStreamFaces();
    const events = createScenePanoramaStreamEvents(faces).map((event) =>
      event.type === "done" ? { ...event, colorStatus: "skipped" } : event
    );

    mockScenePanoramaFetch(faces, events);

    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));
    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "场景" }));
    fireEvent.change(screen.getByLabelText("场景名称"), { target: { value: "废弃研究所" } });
    fireEvent.change(screen.getByLabelText("场景说明"), { target: { value: "一座被雨水和藤蔓侵蚀的旧研究所。" } });
    fireEvent.change(screen.getByLabelText("区块名称"), { target: { value: "主厅" } });
    fireEvent.change(screen.getByLabelText("区块说明"), { target: { value: "坍塌的接待区，玻璃幕墙漏入冷光。" } });

    fireEvent.click(screen.getByRole("button", { name: "生成母图" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("全景母图已生成。");
    });

    fireEvent.click(screen.getByRole("button", { name: "生成六面图" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("区块全景已生成；色彩和接缝后处理未完成，请放大预览后确认。");
    });
    expect(toast.error).not.toHaveBeenCalledWith("区块全景生成失败，请稍后再试。");
  });

  it("sends scene AI assist with an image-only reference", async () => {
    vi.mocked(assistHomeSceneDraftWithImages).mockResolvedValue({
      message: "已根据参考图同步场景。",
      patch: {}
    });

    render(<HomeWorkspace data={workspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "素材" }));
    fireEvent.click(screen.getByRole("button", { name: "操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "场景" }));
    const aiReferenceInput = screen.getAllByText("上传参考")[1].closest("label")?.querySelector("input");

    expect(aiReferenceInput).toBeTruthy();
    fireEvent.change(aiReferenceInput as HTMLInputElement, {
      target: { files: [new File(["ai-reference"], "ai-reference.png", { type: "image/png" })] }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送场景 AI 辅助消息" }));

    await waitFor(() => {
      expect(assistHomeSceneDraftWithImages).toHaveBeenCalledWith(expect.any(FormData), "zh-CN");
    });
    const formData = vi.mocked(assistHomeSceneDraftWithImages).mock.calls[0][0] as FormData;

    expect(formData.get("instruction")).toBe("");
    expect(formData.getAll("referenceImages")).toHaveLength(1);
    expect(screen.getByText("根据参考图片同步完善场景草稿")).toBeInTheDocument();
  });

  it("opens the login dialog when an anonymous user starts a protected action", () => {
    render(<HomeWorkspace data={{ ...workspaceData, conversations: [], viewer: null }} />);

    fireEvent.click(screen.getByRole("button", { name: "使用 基础 AI 剧本 剧本" }));

    expect(screen.getByRole("heading", { name: "登录新世界小说" })).toBeInTheDocument();
  });

  it("guides users to settings when no default LLM is configured", async () => {
    mockStreamError("missing-default-llm");

    render(<HomeWorkspace data={{ ...workspaceData, conversations: [conversation] }} />);

    fireEvent.change(screen.getByPlaceholderText("输入你想推进的角色、场景或冲突..."), {
      target: { value: "让角色进入图书馆" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("还没有可用的默认 LLM 模型，请前往右上角体验设置的 LLM 模型页添加并设为默认。");
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});

const baseScript: WorkspaceScript = {
  id: "base",
  slug: "base-ai-script",
  category: "featured",
  title: "基础 AI 剧本",
  description: "适合第一次进入新世界小说的通用互动剧本。",
  welcome: "已载入基础 AI 剧本。",
  inLibrary: true,
  librarySource: "COMMUNITY_ADDED"
};

const worldScript: WorkspaceScript = {
  id: "world",
  slug: "world-architect",
  category: "world",
  title: "世界观架构师",
  description: "搭建可长期演化的原创世界观。",
  welcome: "告诉我一个世界的核心规则。",
  inLibrary: false
};

const echoMaskMaterial: WorkspaceMaterial = {
  id: "echo-mask",
  slug: "echo-mask",
  category: "mask",
  style: "realistic",
  title: "回声假面",
  description: "可以记录并复现他人口吻的身份素材。",
  previewUrl: null,
  communityVisible: true,
  inLibrary: true,
  librarySource: "COMMUNITY_ADDED"
};

const nightInkMaterial: WorkspaceMaterial = {
  id: "night-ink",
  slug: "night-ink-vial",
  category: "item",
  style: "mystery",
  title: "夜墨瓶",
  description: "只在无光处显影的墨水素材。",
  previewUrl: null,
  communityVisible: true,
  inLibrary: false
};

const joinedNightInkMaterial: WorkspaceMaterial = {
  ...nightInkMaterial,
  inLibrary: true,
  librarySource: "COMMUNITY_ADDED"
};

const createdScannerItemMaterial: WorkspaceMaterial = {
  id: "scanner-item",
  slug: "item-scanner",
  category: "item",
  style: "sciFi",
  title: "灵犀扫描器",
  description: "半透明的便携扫描装置，边缘有细密发光刻线。",
  previewUrl: "https://cdn.example.com/items/scanner-board.png",
  communityVisible: true,
  metadata: {
    kind: "item",
    version: 2,
    name: "灵犀扫描器",
    itemCategory: "设备",
    description: "半透明的便携扫描装置，边缘有细密发光刻线。",
    traits: ["半透明外壳"],
    uses: ["医疗检查"],
    functions: ["扫描", "记录"],
    materials: ["半透明树脂", "金属"],
    colors: ["青色", "银白"],
    styles: [],
    brand: "",
    model: "",
    keywords: ["扫描仪", "赛博"],
    scaleHint: "约 18cm，接近手持终端",
    style: "sciFi",
    boardDrawingStyle: "realistic",
    boardImage: {
      source: "generated",
      url: "https://cdn.example.com/items/scanner-board.png"
    },
    modelInputImage: {
      source: "generated",
      url: "https://cdn.example.com/items/model-input.png"
    },
    viewImages: {
      front: { source: "generated", url: "https://cdn.example.com/items/front.png" },
      back: { source: "generated", url: "https://cdn.example.com/items/back.png" },
      left: { source: "generated", url: "https://cdn.example.com/items/left.png" },
      right: { source: "generated", url: "https://cdn.example.com/items/right.png" },
      top: { source: "generated", url: "https://cdn.example.com/items/top.png" },
      bottom: { source: "generated", url: "https://cdn.example.com/items/bottom.png" }
    },
    model3d: {
      byteSize: 12,
      contentType: "model/gltf-binary",
      fileName: "scanner.glb",
      source: "instantmesh",
      url: "https://cdn.example.com/models/scanner.glb"
    }
  },
  inLibrary: true,
  librarySource: "SELF_CREATED"
};

const createdMistguardCreatureMaterial: WorkspaceMaterial = {
  id: "mistguard-creature",
  slug: "creature-mistguard",
  category: "creature",
  style: "fantasy",
  title: "雾卫兽",
  description: "雾卫兽是废墟边界的群居守卫生物，会通过低频鸣叫同步警戒。",
  previewUrl: "https://cdn.example.com/creature-board.png",
  communityVisible: true,
  metadata: {
    kind: "creature",
    version: 1,
    subject: "species",
    name: "雾卫兽",
    description: "雾卫兽是废墟边界的群居守卫生物，会通过低频鸣叫同步警戒。",
    style: "fantasy",
    taxonomy: {
      creatureType: "雾生兽类"
    },
    morphology: {
      sizeClass: "",
      length: "2.4",
      weight: "",
      limbStructure: "",
      bodyCovering: "",
      headFeature: "",
      tailAppendage: "",
      movement: "",
      specialOrgans: ""
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
      diet: "",
      activityCycle: "",
      socialStructure: "",
      reproduction: ""
    },
    abilities: {
      powers: ["嗅出谎言"],
      weaknesses: [],
      resourceNeeds: [],
      interactionUses: [],
      dangerNotes: [],
      keywords: []
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
    boardImage: {
      source: "generated",
      url: "https://cdn.example.com/creature-board.png"
    }
  },
  inLibrary: true,
  librarySource: "SELF_CREATED"
};

const createdSilverMaskMaterial: WorkspaceMaterial = {
  id: "silver-mask",
  slug: "mask-silver",
  category: "mask",
  style: "mystery",
  title: "银发旅人",
  description: "银发旅人看起来疏离冷静，说话简短，动作习惯轻慢。",
  previewUrl: "https://cdn.example.com/mask-board.png",
  communityVisible: true,
  metadata: {
    kind: "mask",
    version: 1,
    name: "银发旅人",
    intro: "疏离冷静，说话简短。",
    features: "标志动作：抬手整理银发\n说话习惯：句子短，停顿长",
    style: "mystery",
    body: {
      ageStage: "青年",
      bodyType: "轻盈但有力量感",
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
      url: "https://cdn.example.com/mask-board.png"
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
  },
  inLibrary: true,
  librarySource: "SELF_CREATED"
};

const updatedSilverMaskMaterial: WorkspaceMaterial = {
  ...createdSilverMaskMaterial,
  title: "银发旅人·改",
  description: "银发旅人·改更冷淡，语气更克制。",
  metadata: {
    ...(createdSilverMaskMaterial.metadata as Record<string, unknown>),
    name: "银发旅人·改",
    intro: "更冷淡，语气更克制。",
    features: "改后特征：回答前会先短暂停顿。"
  }
};

const importedSilverMaskMaterial: WorkspaceMaterial = {
  ...createdSilverMaskMaterial,
  id: "imported-mask",
  slug: "mask-imported",
  title: "导入旅人",
  description: "从 ZIP 导入的假面素材。",
  librarySource: "SELF_CREATED",
  previewUrl: "https://cdn.example.com/imported-mask-board.png"
};

const createdSceneMaterial: WorkspaceMaterial = {
  id: "scene-lab",
  slug: "scene-lab",
  category: "scene",
  style: "mystery",
  title: "废弃研究所",
  description: "一座被雨水和藤蔓侵蚀的旧研究所。",
  previewUrl: "https://cdn.example.com/scene/first-uploaded-image.png",
  communityVisible: true,
  metadata: {
    kind: "scene",
    version: 1,
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
          faces: {
            front: { url: "https://cdn.example.com/scene/main-front.png" },
            back: { url: "https://cdn.example.com/scene/main-back.png" },
            left: { url: "https://cdn.example.com/scene/main-left.png" },
            right: { url: "https://cdn.example.com/scene/main-right.png" },
            top: { url: "https://cdn.example.com/scene/main-top.png" },
            bottom: { url: "https://cdn.example.com/scene/main-bottom.png" }
          },
          mother: {
            source: "generated",
            url: "https://cdn.example.com/scene/main-mother.png"
          }
        }
      }
    ]
  },
  inLibrary: true,
  librarySource: "SELF_CREATED"
};

const createdMapMaterial: WorkspaceMaterial = {
  id: "map-city",
  slug: "floating-city-map",
  category: "map",
  style: "sciFi",
  title: "悬空城地图",
  description: "记录环层街区、升降塔和风道关系的地图素材。",
  previewUrl: null,
  communityVisible: true,
  metadata: {
    kind: "map",
    version: 1,
    name: "悬空城地图",
    description: "记录环层街区、升降塔和风道关系的地图素材。",
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
  },
  inLibrary: true,
  librarySource: "SELF_CREATED"
};

const workspaceData: WorkspaceData = {
  viewer: {
    account: "reader",
    avatarUrl: null,
    displayName: "reader",
    id: "reader-id",
    role: "USER",
    showAiThinking: false
  },
  myScripts: [baseScript],
  communityScripts: [baseScript, worldScript],
  myMaterials: [echoMaskMaterial],
  communityMaterials: [echoMaskMaterial, nightInkMaterial, createdSceneMaterial],
  conversations: [],
  persistenceAvailable: true
};

const conversation: WorkspaceConversation = {
  id: "conversation-id",
  title: "基础 AI 剧本",
  scriptTitle: "基础 AI 剧本",
  scriptWelcome: "已载入基础 AI 剧本。",
  updatedAt: "2026-05-21T00:00:00.000Z",
  lastMessage: "已载入基础 AI 剧本。",
  tokenUsage: { downstream: 0, estimated: false, upstream: 0 },
  messages: []
};

function mockStreamError(message: string) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", message })}\n`));
      controller.close();
    }
  });

  vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
}

type TestScenePanoramaFace = "front" | "back" | "left" | "right" | "top" | "bottom";
type TestScenePanoramaFaceImage = {
  contentType: string;
  dataUrl: string;
  face: TestScenePanoramaFace;
  fileName: string;
};

function createSceneStreamFaces(): Record<TestScenePanoramaFace, TestScenePanoramaFaceImage> {
  return {
    front: { contentType: "image/png", dataUrl: "data:image/png;base64,Zm9udA==", face: "front", fileName: "front.png" },
    back: { contentType: "image/png", dataUrl: "data:image/png;base64,YmFjaw==", face: "back", fileName: "back.png" },
    left: { contentType: "image/png", dataUrl: "data:image/png;base64,bGVmdA==", face: "left", fileName: "left.png" },
    right: { contentType: "image/png", dataUrl: "data:image/png;base64,cmlnaHQ=", face: "right", fileName: "right.png" },
    top: { contentType: "image/png", dataUrl: "data:image/png;base64,dG9w", face: "top", fileName: "top.png" },
    bottom: { contentType: "image/png", dataUrl: "data:image/png;base64,Ym90dG9t", face: "bottom", fileName: "bottom.png" }
  };
}

function createItemModelInputImage() {
  return {
    contentType: "image/png",
    dataUrl: "data:image/png;base64,bW9kZWwtaW5wdXQ=",
    fileName: "item-model-input.png"
  };
}

function mockScenePanoramaFetch(
  faces: Record<TestScenePanoramaFace, TestScenePanoramaFaceImage>,
  events: Array<Record<string, unknown>> = createScenePanoramaStreamEvents(faces),
  motherEvents: Array<Record<string, unknown>> = createScenePanoramaMotherStreamEvents()
) {
  const encoder = new TextEncoder();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);

    if (url === "/api/materials/scene-panorama/mother/stream") {
      return new Response(createEventStreamBody(motherEvents, encoder), {
        headers: {
          "Content-Type": "text/event-stream"
        }
      });
    }

    if (url === "/api/materials/scene-panorama/stream") {
      return new Response(createEventStreamBody(events, encoder), {
        headers: {
          "Content-Type": "text/event-stream"
        }
      });
    }

    if (url.startsWith("data:")) {
      return new Response("face", {
        headers: {
          "Content-Type": "image/png"
        }
      });
    }

    return new Response(null, { status: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

function createEventStreamBody(events: Array<Record<string, unknown>>, encoder: TextEncoder) {
  return new ReadableStream({
    start(controller) {
      events.forEach((event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });
      controller.close();
    }
  });
}

function createScenePanoramaMotherStreamEvents(passed = true) {
  const image = { contentType: "image/png", dataUrl: "data:image/png;base64,bW90aGVy", fileName: "mother.png" };
  const quality = createTestMotherQuality(passed);

  return [
    { type: "progress", progress: 8, stage: "mother-generating", messageKey: "sceneForm.panoramaProgressMother" },
    { type: "mother", image },
    { type: "motherQuality", attempt: 1, passed, quality, score: quality.score },
    { type: "motherDone", attempt: 1, image, quality, qualityPassed: passed, sizeProfile: "4k" },
    {
      type: "progress",
      progress: 100,
      stage: passed ? "mother-ready" : "mother-quality-failed",
      messageKey: passed ? "sceneForm.panoramaProgressMotherReady" : "sceneForm.panoramaProgressMotherQualityFailed"
    }
  ];
}

function createTestMotherQuality(passed: boolean) {
  return {
    bandDelta: passed ? 4 : 64,
    edgeDelta: passed ? 4 : 72,
    horizonPeakShiftRatio: passed ? 0.01 : 0.12,
    issues: [],
    lumaDelta: passed ? 3 : 40,
    passed,
    score: passed ? 0.6 : 8,
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

function createScenePanoramaStreamEvents(faces: Record<TestScenePanoramaFace, TestScenePanoramaFaceImage>) {
  const faceList = Object.values(faces);

  return [
    { type: "progress", progress: 24, stage: "faces-generating", messageKey: "sceneForm.panoramaProgressFaces" },
    ...faceList.map((image) => ({ type: "face", attempt: 1, face: image.face, image, phase: "preview" })),
    { type: "quality", attempt: 1, failedFaces: [], passed: true, quality: {} },
    ...faceList.map((image) => ({ type: "face", attempt: 1, face: image.face, image, phase: "final" })),
    { type: "done", mode: "enhanced", qualityBestEffort: false, qualityPassed: true, repaired: true, sizeProfile: "4k" },
    { type: "progress", progress: 100, stage: "done", messageKey: "sceneForm.panoramaProgressDone" }
  ];
}

function readMessage(path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, zhMessages);
}

function readMaterialMessage(path: string, values?: Record<string, string | number>) {
  const value = readMessage(`home.materials.${path}`);

  if (typeof value !== "string") {
    return path;
  }

  return Object.entries(values ?? {}).reduce(
    (text, [name, replacement]) => text.replace(`{${name}}`, String(replacement)),
    value
  );
}
