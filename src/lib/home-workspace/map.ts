import type {
  MapCreateDraft,
  MapDraftPatch,
  MapMaterialCreateInput,
  WorkspaceMapMaterialEdge,
  WorkspaceMapMaterialMetadata,
  WorkspaceMapMaterialNode,
  WorkspaceMapMaterialNodeType,
  WorkspaceMapMaterialRelationType,
  WorkspaceMaterial,
  WorkspaceMaterialStyle
} from "./types";

export const mapNodeTypes = ["country", "region", "city", "village", "landmark", "path"] as const;
export const mapRelationTypes = [
  "contains",
  "belongs_to",
  "adjacent",
  "connects",
  "through",
  "north_of",
  "south_of",
  "east_of",
  "west_of"
] as const;

export function createDefaultMapDraft(): MapCreateDraft {
  return {
    name: "",
    description: "",
    communityVisible: true,
    style: "realistic",
    nodes: [],
    edges: []
  };
}

export function createMapNode(
  type: WorkspaceMapMaterialNodeType = "landmark",
  index = 0,
  overrides: Partial<Omit<WorkspaceMapMaterialNode, "type">> = {}
): WorkspaceMapMaterialNode {
  const position = getDefaultMapNodePosition(index);

  return {
    id: typeof overrides.id === "string" && overrides.id.trim()
      ? normalizeId(overrides.id, createMapId("map-node"))
      : createMapId("map-node"),
    type,
    name: overrides.name ?? getDefaultMapNodeName(type, index),
    description: overrides.description ?? "",
    x: typeof overrides.x === "number" && Number.isFinite(overrides.x) ? overrides.x : position.x,
    y: typeof overrides.y === "number" && Number.isFinite(overrides.y) ? overrides.y : position.y
  };
}

export function createMapEdge(
  source: string,
  target: string,
  relation: WorkspaceMapMaterialRelationType = "connects",
  overrides: Partial<Omit<WorkspaceMapMaterialEdge, "source" | "target" | "relation">> = {}
): WorkspaceMapMaterialEdge {
  return {
    id: typeof overrides.id === "string" && overrides.id.trim()
      ? normalizeId(overrides.id, createMapId("map-edge"))
      : createMapId("map-edge"),
    relation,
    source,
    target,
    description: overrides.description ?? ""
  };
}

export function createDefaultMapNodes() {
  return [
    createMapNode("country", 0, { name: "中央王国", description: "地图的最高层级区域" }),
    createMapNode("region", 1, { name: "北境行省", description: "主要行政区域" }),
    createMapNode("city", 2, { name: "王城", description: "故事的核心城市" }),
    createMapNode("landmark", 3, { name: "白塔", description: "可识别的地标节点" })
  ];
}

export function createDefaultMapEdges(nodes = createDefaultMapNodes()) {
  if (nodes.length < 4) {
    return [];
  }

  return [
    createMapEdge(nodes[0].id, nodes[1].id, "contains", {
      description: "王国包含行省"
    }),
    createMapEdge(nodes[1].id, nodes[2].id, "contains", {
      description: "行省包含王城"
    }),
    createMapEdge(nodes[2].id, nodes[3].id, "connects", {
      description: "王城通往地标"
    })
  ];
}

export function layoutMapGraphNodes(
  nodes: WorkspaceMapMaterialNode[],
  edges: WorkspaceMapMaterialEdge[]
): Array<Pick<WorkspaceMapMaterialNode, "id" | "x" | "y">> {
  if (nodes.length === 0) {
    return [];
  }

  if (nodes.length === 1) {
    return [{ id: nodes[0].id, x: 0, y: 0 }];
  }

  const degreeByNodeId = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    if (degreeByNodeId.has(edge.source)) {
      degreeByNodeId.set(edge.source, (degreeByNodeId.get(edge.source) ?? 0) + 1);
    }

    if (degreeByNodeId.has(edge.target)) {
      degreeByNodeId.set(edge.target, (degreeByNodeId.get(edge.target) ?? 0) + 1);
    }
  }

  const nodesByType = mapNodeTypes.reduce<Record<WorkspaceMapMaterialNodeType, WorkspaceMapMaterialNode[]>>((result, type) => {
    result[type] = [];
    return result;
  }, {} as Record<WorkspaceMapMaterialNodeType, WorkspaceMapMaterialNode[]>);

  for (const node of nodes) {
    const type = isMapNodeType(node.type) ? node.type : "landmark";

    nodesByType[type].push(node);
  }

  const activeTypes = mapNodeTypes.filter((type) => nodesByType[type].length > 0);
  const rowSpacing = 1.45;
  const columnSpacing = 1.65;
  const firstRowY = -((activeTypes.length - 1) * rowSpacing) / 2;
  const updates: Array<Pick<WorkspaceMapMaterialNode, "id" | "x" | "y">> = [];

  activeTypes.forEach((type, rowIndex) => {
    const rowNodes = [...nodesByType[type]].sort((a, b) => {
      const degreeDelta = (degreeByNodeId.get(b.id) ?? 0) - (degreeByNodeId.get(a.id) ?? 0);

      if (degreeDelta !== 0) {
        return degreeDelta;
      }

      return `${a.name || ""}:${a.id}`.localeCompare(`${b.name || ""}:${b.id}`, "zh-CN");
    });
    const firstColumnX = -((rowNodes.length - 1) * columnSpacing) / 2;
    const y = roundMapLayoutCoordinate(firstRowY + rowIndex * rowSpacing);

    rowNodes.forEach((node, columnIndex) => {
      updates.push({
        id: node.id,
        x: roundMapLayoutCoordinate(firstColumnX + columnIndex * columnSpacing),
        y
      });
    });
  });

  return updates;
}

export function createMapDraftFromMaterial(material: WorkspaceMaterial): MapCreateDraft {
  const metadata = getMapMaterialMetadata(material.metadata);

  if (!metadata) {
    return {
      ...createDefaultMapDraft(),
      name: material.title,
      description: material.description,
      style: material.style,
      communityVisible: true
    };
  }

  const normalized = normalizeMapMaterialInput({
    name: metadata.name || material.title,
    description: metadata.description || material.description,
    communityVisible: true,
    style: isWorkspaceMaterialStyle(metadata.style) ? metadata.style : material.style,
    nodes: metadata.nodes,
    edges: metadata.edges
  });

  return {
    ...normalized,
    communityVisible: true
  };
}

export function serializeMapDraft(draft: MapCreateDraft): MapMaterialCreateInput {
  return normalizeMapMaterialInput({
    name: draft.name,
    description: draft.description,
    communityVisible: true,
    style: draft.style,
    nodes: draft.nodes,
    edges: draft.edges
  });
}

export function applyPatchToMapDraft(draft: MapCreateDraft, patch: MapDraftPatch): MapCreateDraft {
  const nextNodes = [...draft.nodes];
  const nextEdges = [...draft.edges];
  const removeNodeIds = new Set(patch.removeNodeIds ?? []);
  const removeEdgeIds = new Set(patch.removeEdgeIds ?? []);

  const filteredNodes = nextNodes.filter((node) => !removeNodeIds.has(node.id));
  const filteredEdges = nextEdges.filter((edge) => !removeEdgeIds.has(edge.id) && !removeNodeIds.has(edge.source) && !removeNodeIds.has(edge.target));

  for (const nodePatch of patch.updateNodes ?? []) {
    const index = filteredNodes.findIndex((node) => node.id === nodePatch.id);

    if (index === -1) {
      continue;
    }

    filteredNodes[index] = {
      ...filteredNodes[index],
      ...(nodePatch.type && isMapNodeType(nodePatch.type) ? { type: nodePatch.type } : {}),
      ...(typeof nodePatch.name === "string" ? { name: nodePatch.name } : {}),
      ...(typeof nodePatch.description === "string" ? { description: nodePatch.description } : {}),
      ...(typeof nodePatch.x === "number" && Number.isFinite(nodePatch.x) ? { x: nodePatch.x } : {}),
      ...(typeof nodePatch.y === "number" && Number.isFinite(nodePatch.y) ? { y: nodePatch.y } : {})
    };
  }

  for (const edgePatch of patch.updateEdges ?? []) {
    const index = filteredEdges.findIndex((edge) => edge.id === edgePatch.id);

    if (index === -1) {
      continue;
    }

    filteredEdges[index] = {
      ...filteredEdges[index],
      ...(edgePatch.relation && isMapRelationType(edgePatch.relation) ? { relation: edgePatch.relation } : {}),
      ...(typeof edgePatch.source === "string" ? { source: edgePatch.source } : {}),
      ...(typeof edgePatch.target === "string" ? { target: edgePatch.target } : {}),
      ...(typeof edgePatch.description === "string" ? { description: edgePatch.description } : {})
    };
  }

  for (const nodePatch of patch.addNodes ?? []) {
    filteredNodes.push(
      createMapNode(
        nodePatch.type && isMapNodeType(nodePatch.type) ? nodePatch.type : "landmark",
        filteredNodes.length,
        {
          ...(typeof nodePatch.id === "string" ? { id: nodePatch.id } : {}),
          name: typeof nodePatch.name === "string" ? nodePatch.name : "",
          description: typeof nodePatch.description === "string" ? nodePatch.description : "",
          x: typeof nodePatch.x === "number" && Number.isFinite(nodePatch.x) ? nodePatch.x : undefined,
          y: typeof nodePatch.y === "number" && Number.isFinite(nodePatch.y) ? nodePatch.y : undefined
        }
      )
    );
  }

  for (const edgePatch of patch.addEdges ?? []) {
    filteredEdges.push(
      createMapEdge(
        edgePatch.source,
        edgePatch.target,
        edgePatch.relation && isMapRelationType(edgePatch.relation) ? edgePatch.relation : "connects",
        {
          ...(typeof edgePatch.id === "string" ? { id: edgePatch.id } : {}),
          description: typeof edgePatch.description === "string" ? edgePatch.description : ""
        }
      )
    );
  }

  const nextDraft = normalizeMapMaterialInput({
    name: typeof patch.name === "string" ? patch.name : draft.name,
    description: typeof patch.description === "string" ? patch.description : draft.description,
    communityVisible: true,
    style: patch.style && isWorkspaceMaterialStyle(patch.style) ? patch.style : draft.style,
    nodes: filteredNodes,
    edges: filteredEdges
  });

  return {
    ...nextDraft,
    communityVisible: true
  };
}

export function validateMapDraftForSave(draft: MapCreateDraft) {
  if (!draft.name.trim()) {
    return "mapForm.errors.nameRequired";
  }

  if (!draft.description.trim()) {
    return "mapForm.errors.descriptionRequired";
  }

  return "";
}

export function validateMapDraftForGraphSave(draft: MapCreateDraft) {
  try {
    validateMapMaterialInput({
      name: draft.name,
      description: draft.description,
      communityVisible: draft.communityVisible,
      style: draft.style,
      nodes: draft.nodes,
      edges: draft.edges
    });
    return "";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("MAP_NAME_REQUIRED")) {
      return "mapForm.errors.nameRequired";
    }

    if (message.includes("MAP_DESCRIPTION_REQUIRED")) {
      return "mapForm.errors.descriptionRequired";
    }

    if (message.includes("MAP_NODE_REQUIRED")) {
      return "mapForm.errors.nodeRequired";
    }

    if (message.includes("MAP_NODE_NAME_REQUIRED")) {
      return "mapForm.errors.nodeNameRequired";
    }

    if (message.includes("MAP_EDGE_INVALID")) {
      return "mapForm.errors.edgeInvalid";
    }

    return "mapForm.saveFailed";
  }
}

export function normalizeMapMaterialInput(input: MapMaterialCreateInput): MapMaterialCreateInput {
  const nodes = normalizeMapNodes(input.nodes, false);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = normalizeMapEdges(input.edges, nodeIds, false);

  return {
    name: normalizeText(input.name),
    description: normalizeLongText(input.description),
    communityVisible: true,
    style: isWorkspaceMaterialStyle(input.style) ? input.style : "realistic",
    nodes,
    edges
  };
}

export function validateMapMaterialInput(input: MapMaterialCreateInput) {
  const normalized = normalizeMapMaterialInputStrict(input);

  if (!normalized.name) {
    throw new Error("MAP_NAME_REQUIRED");
  }

  if (!normalized.description) {
    throw new Error("MAP_DESCRIPTION_REQUIRED");
  }

  const nodeIds = new Set<string>();

  for (const node of normalized.nodes) {
    if (!node.id) {
      throw new Error("MAP_NODE_REQUIRED");
    }

    if (nodeIds.has(node.id)) {
      throw new Error("MAP_NODE_DUPLICATE");
    }

    nodeIds.add(node.id);

    if (!node.name.trim()) {
      throw new Error("MAP_NODE_NAME_REQUIRED");
    }

    if (!isMapNodeType(node.type)) {
      throw new Error("MAP_NODE_TYPE_INVALID");
    }
  }

  const edgeIds = new Set<string>();

  for (const edge of normalized.edges) {
    if (!edge.id) {
      throw new Error("MAP_EDGE_INVALID");
    }

    if (edgeIds.has(edge.id)) {
      throw new Error("MAP_EDGE_DUPLICATE");
    }

    edgeIds.add(edge.id);

    if (!isMapRelationType(edge.relation)) {
      throw new Error("MAP_EDGE_RELATION_INVALID");
    }

    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) {
      throw new Error("MAP_EDGE_INVALID");
    }
  }

  return normalized;
}

export function buildMapMaterialMetadata(input: MapMaterialCreateInput): WorkspaceMapMaterialMetadata {
  const normalized = validateMapMaterialInput(input);

  return {
    kind: "map",
    version: 1,
    name: normalized.name,
    description: normalized.description,
    style: normalized.style,
    nodes: normalized.nodes,
    edges: normalized.edges
  };
}

export function getMapMaterialMetadata(metadata: unknown): WorkspaceMapMaterialMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Partial<WorkspaceMapMaterialMetadata>;

  return record.kind === "map" && Array.isArray(record.nodes) && Array.isArray(record.edges)
    ? (record as WorkspaceMapMaterialMetadata)
    : null;
}

export function isMapNodeType(value: string): value is WorkspaceMapMaterialNodeType {
  return mapNodeTypes.includes(value as WorkspaceMapMaterialNodeType);
}

export function isMapRelationType(value: string): value is WorkspaceMapMaterialRelationType {
  return mapRelationTypes.includes(value as WorkspaceMapMaterialRelationType);
}

function normalizeMapMaterialInputStrict(input: MapMaterialCreateInput) {
  const nodes = normalizeMapNodes(input.nodes, true);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = normalizeMapEdges(input.edges, nodeIds, true);

  return {
    name: normalizeText(input.name),
    description: normalizeLongText(input.description),
    communityVisible: true,
    style: isWorkspaceMaterialStyle(input.style) ? input.style : "realistic",
    nodes,
    edges
  };
}

function normalizeMapNodes(nodes: WorkspaceMapMaterialNode[] | undefined, strict: boolean) {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.map((node, index) => {
    const fallbackPosition = getDefaultMapNodePosition(index);
    const type = isMapNodeType(node.type) ? node.type : "landmark";

    if (strict && !isMapNodeType(node.type)) {
      throw new Error("MAP_NODE_TYPE_INVALID");
    }

    return {
      id: normalizeId(node.id, `map-node-${index + 1}`),
      type,
      name: normalizeText(node.name),
      description: normalizeLongText(node.description),
      x: typeof node.x === "number" && Number.isFinite(node.x) ? node.x : fallbackPosition.x,
      y: typeof node.y === "number" && Number.isFinite(node.y) ? node.y : fallbackPosition.y
    } satisfies WorkspaceMapMaterialNode;
  });
}

function normalizeMapEdges(edges: WorkspaceMapMaterialEdge[] | undefined, nodeIds: Set<string>, strict: boolean) {
  if (!Array.isArray(edges)) {
    return [];
  }

  return edges
    .map((edge, index) => {
      if (strict && !isMapRelationType(edge.relation)) {
        throw new Error("MAP_EDGE_RELATION_INVALID");
      }

      return {
        id: normalizeId(edge.id, `map-edge-${index + 1}`),
        relation: isMapRelationType(edge.relation) ? edge.relation : "connects",
        source: normalizeId(edge.source, ""),
        target: normalizeId(edge.target, ""),
        description: normalizeLongText(edge.description)
      };
    })
    .filter((edge) => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) {
        if (strict) {
          throw new Error("MAP_EDGE_INVALID");
        }

        return false;
      }

      return true;
    });
}

function createMapId(prefix: string) {
  const randomId = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

  return `${prefix}-${randomId.slice(0, 8)}`;
}

function normalizeId(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function normalizeLongText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getDefaultMapNodePosition(index: number) {
  const offsets = [
    { x: -1.1, y: -0.1 },
    { x: -0.2, y: 0.05 },
    { x: 0.75, y: 0.1 },
    { x: 1.25, y: 0.45 },
    { x: 0.2, y: 0.8 },
    { x: -0.95, y: 0.65 }
  ];

  return offsets[index] ?? {
    x: -0.4 + index * 0.3,
    y: index % 2 === 0 ? 0.2 : -0.2
  };
}

function roundMapLayoutCoordinate(value: number) {
  return Number(value.toFixed(3));
}

function getDefaultMapNodeName(type: WorkspaceMapMaterialNodeType, index: number) {
  const labels: Record<WorkspaceMapMaterialNodeType, string> = {
    country: "新国家",
    region: "新区域",
    city: "新城市",
    village: "新村落",
    landmark: "新地标",
    path: "新路径"
  };

  return `${labels[type]}${index > 0 ? ` ${index + 1}` : ""}`;
}

function isWorkspaceMaterialStyle(style: string): style is WorkspaceMaterialStyle {
  return ["realistic", "fantasy", "sciFi", "mystery", "cyberpunk", "classical", "apocalyptic"].includes(style);
}
