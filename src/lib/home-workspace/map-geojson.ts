import sharp from "sharp";
import { buildMapGraphSignature, buildMapMaterialMetadata, mapNodeTypes } from "./map";
import type {
  MapMaterialCreateInput,
  WorkspaceMapGeoJsonFeature,
  WorkspaceMapGeoJsonFeatureCollection,
  WorkspaceMapGeoJsonPosition,
  WorkspaceMapMaterialGeoJson,
  WorkspaceMapMaterialNode,
  WorkspaceMapMaterialNodeType,
  WorkspaceMapMaterialRelationType
} from "./types";

type MapGeoJsonImageContext = {
  bytes?: Uint8Array;
  contentType?: string;
  fileName?: string;
};

type ProjectedNode = WorkspaceMapMaterialNode & {
  km: WorkspaceMapGeoJsonPosition;
};

type MapGeoJsonProjection = {
  aspectRatio: number;
  heightKm: number;
  widthKm: number;
};

const mapAreaNodeTypes = ["country", "region", "city", "village", "landmark"] as const satisfies WorkspaceMapMaterialNodeType[];
const nodeTypeRadiusRatio: Record<WorkspaceMapMaterialNodeType, number> = {
  city: 0.055,
  country: 0.25,
  landmark: 0.026,
  path: 0.018,
  region: 0.16,
  village: 0.038
};

export async function generateMapGeoJson(
  input: MapMaterialCreateInput,
  options: {
    image?: MapGeoJsonImageContext | null;
  } = {}
): Promise<WorkspaceMapMaterialGeoJson> {
  const metadata = buildMapMaterialMetadata(input);
  const imageMetrics = options.image?.bytes ? await readMapGeoJsonImageMetrics(options.image.bytes) : null;
  const projection = buildMapGeoJsonProjection(metadata.nodes.length, metadata.edges.length, imageMetrics?.aspectRatio);
  const projectedNodes = projectMapNodes(metadata.nodes, projection);
  const nodeById = new Map(projectedNodes.map((node) => [node.id, node]));
  const parentByNodeId = buildMapGeoJsonParentMap(metadata.edges);
  const areaFeatures = buildMapGeoJsonAreaFeatures(projectedNodes, parentByNodeId, projection);
  const relationFeatures = metadata.edges.flatMap((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);

    if (!source || !target) {
      return [];
    }

    return [buildMapGeoJsonRelationFeature(edge, source, target)];
  });
  const placeFeatures = projectedNodes.map((node) => buildMapGeoJsonPlaceFeature(node, parentByNodeId.get(node.id)));
  const data = normalizeMapGeoJsonFeatureCollection({
    bbox: buildMapGeoJsonBbox([...areaFeatures, ...relationFeatures, ...placeFeatures], projection),
    features: [...areaFeatures, ...relationFeatures, ...placeFeatures],
    type: "FeatureCollection"
  });

  return {
    source: "algorithm",
    data,
    scale: {
      heightKm: projection.heightKm,
      metersPerUnit: 1000,
      unit: "km",
      widthKm: projection.widthKm
    },
    edgeCount: metadata.edges.length,
    generatedAt: new Date().toISOString(),
    graphSignature: buildMapGraphSignature(metadata),
    nodeCount: metadata.nodes.length,
    outlineBased: Boolean(options.image?.bytes)
  };
}

export function normalizeMapGeoJsonForSave(value: unknown, graphSignature: string): WorkspaceMapMaterialGeoJson | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Partial<WorkspaceMapMaterialGeoJson>;

  if (record.source !== "algorithm" || record.graphSignature !== graphSignature || !record.data || !record.scale) {
    return null;
  }

  return {
    source: "algorithm",
    data: normalizeMapGeoJsonFeatureCollection(record.data),
    scale: {
      heightKm: normalizePositiveNumber(record.scale.heightKm, 1),
      metersPerUnit: 1000,
      unit: "km",
      widthKm: normalizePositiveNumber(record.scale.widthKm, 1)
    },
    edgeCount: normalizeNonNegativeInteger(record.edgeCount),
    generatedAt: typeof record.generatedAt === "string" && record.generatedAt.trim() ? record.generatedAt.trim() : new Date().toISOString(),
    graphSignature,
    nodeCount: normalizeNonNegativeInteger(record.nodeCount),
    outlineBased: Boolean(record.outlineBased)
  };
}

function buildMapGeoJsonProjection(nodeCount: number, edgeCount: number, aspectRatio = 16 / 9): MapGeoJsonProjection {
  const normalizedAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0.5 && aspectRatio < 4 ? aspectRatio : 16 / 9;
  const widthKm = roundMapGeoJsonCoordinate(Math.min(6400, Math.max(120, 180 * Math.sqrt(Math.max(1, nodeCount)) + edgeCount * 28)));
  const heightKm = roundMapGeoJsonCoordinate(widthKm / normalizedAspectRatio);

  return {
    aspectRatio: normalizedAspectRatio,
    heightKm,
    widthKm
  };
}

function projectMapNodes(nodes: WorkspaceMapMaterialNode[], projection: MapGeoJsonProjection): ProjectedNode[] {
  if (nodes.length === 0) {
    return [];
  }

  const fallbackNodes = needsFallbackLayout(nodes) ? createFallbackNodePositions(nodes) : nodes;
  const xs = fallbackNodes.map((node) => node.x);
  const ys = fallbackNodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const usableWidth = projection.widthKm * 0.74;
  const usableHeight = projection.heightKm * 0.72;

  return fallbackNodes.map((node) => {
    const normalizedX = ((node.x - minX) / spanX) - 0.5;
    const normalizedY = ((node.y - minY) / spanY) - 0.5;

    return {
      ...node,
      km: [
        roundMapGeoJsonCoordinate(normalizedX * usableWidth),
        roundMapGeoJsonCoordinate(-normalizedY * usableHeight)
      ]
    };
  });
}

function buildMapGeoJsonAreaFeatures(
  nodes: ProjectedNode[],
  parentByNodeId: Map<string, string>,
  projection: MapGeoJsonProjection
) {
  const childrenByParentId = new Map<string, ProjectedNode[]>();

  nodes.forEach((node) => {
    const parentId = parentByNodeId.get(node.id);

    if (!parentId) {
      return;
    }

    const children = childrenByParentId.get(parentId) ?? [];

    children.push(node);
    childrenByParentId.set(parentId, children);
  });

  return nodes
    .filter((node) => mapAreaNodeTypes.includes(node.type as (typeof mapAreaNodeTypes)[number]))
    .map((node) => {
      const children = childrenByParentId.get(node.id) ?? [];
      const radiusKm = getMapGeoJsonRadiusKm(node.type, projection);
      const polygon = children.length > 0
        ? createEnvelopePolygon([node, ...children].map((entry) => entry.km), radiusKm * 0.42, node.id)
        : createOrganicPolygon(node.km, radiusKm, node.id, getMapGeoJsonTypeStretch(node.type));

      return {
        type: "Feature",
        id: `area-${node.id}`,
        geometry: {
          type: "Polygon",
          coordinates: [polygon]
        },
        properties: {
          id: `area-${node.id}`,
          name: node.name,
          description: node.description,
          featureKind: "area",
          level: getMapGeoJsonNodeLevel(node.type),
          nodeId: node.id,
          nodeType: node.type,
          parentId: parentByNodeId.get(node.id),
          radiusKm
        }
      } satisfies WorkspaceMapGeoJsonFeature;
    });
}

function buildMapGeoJsonPlaceFeature(node: ProjectedNode, parentId: string | undefined): WorkspaceMapGeoJsonFeature {
  return {
    type: "Feature",
    id: `place-${node.id}`,
    geometry: {
      type: "Point",
      coordinates: node.km
    },
    properties: {
      id: `place-${node.id}`,
      name: node.name,
      description: node.description,
      featureKind: "place",
      level: getMapGeoJsonNodeLevel(node.type) + 1,
      nodeId: node.id,
      nodeType: node.type,
      parentId,
      radiusKm: getMapGeoJsonRadiusKm(node.type, { widthKm: 100, heightKm: 56.25, aspectRatio: 16 / 9 })
    }
  };
}

function buildMapGeoJsonRelationFeature(
  edge: { id: string; source: string; target: string; relation: WorkspaceMapMaterialRelationType; description: string },
  source: ProjectedNode,
  target: ProjectedNode
): WorkspaceMapGeoJsonFeature {
  const midX = (source.km[0] + target.km[0]) / 2;
  const midY = (source.km[1] + target.km[1]) / 2;
  const dx = target.km[0] - source.km[0];
  const dy = target.km[1] - source.km[1];
  const bend = edge.relation === "connects" || edge.relation === "through" ? 0.12 : 0.04;
  const control: WorkspaceMapGeoJsonPosition = [
    roundMapGeoJsonCoordinate(midX - dy * bend),
    roundMapGeoJsonCoordinate(midY + dx * bend)
  ];

  return {
    type: "Feature",
    id: `relation-${edge.id}`,
    geometry: {
      type: "LineString",
      coordinates: [source.km, control, target.km]
    },
    properties: {
      id: `relation-${edge.id}`,
      name: `${source.name} - ${target.name}`,
      description: edge.description,
      edgeId: edge.id,
      featureKind: "relation",
      level: 8,
      relationType: edge.relation,
      sourceNodeId: edge.source,
      targetNodeId: edge.target
    }
  };
}

function buildMapGeoJsonParentMap(edges: Array<{ relation: WorkspaceMapMaterialRelationType; source: string; target: string }>) {
  const parentByNodeId = new Map<string, string>();

  edges.forEach((edge) => {
    if (edge.relation === "contains") {
      parentByNodeId.set(edge.target, edge.source);
    }

    if (edge.relation === "belongs_to") {
      parentByNodeId.set(edge.source, edge.target);
    }
  });

  return parentByNodeId;
}

function createOrganicPolygon(
  center: WorkspaceMapGeoJsonPosition,
  radiusKm: number,
  seed: string,
  stretch: { x: number; y: number }
): WorkspaceMapGeoJsonPosition[] {
  const pointCount = 28;
  const points: WorkspaceMapGeoJsonPosition[] = [];

  for (let index = 0; index < pointCount; index += 1) {
    const angle = (Math.PI * 2 * index) / pointCount;
    const roughness = 0.82 + seededNoise(`${seed}-${index}`) * 0.36;
    const x = center[0] + Math.cos(angle) * radiusKm * stretch.x * roughness;
    const y = center[1] + Math.sin(angle) * radiusKm * stretch.y * roughness;

    points.push([roundMapGeoJsonCoordinate(x), roundMapGeoJsonCoordinate(y)]);
  }

  points.push(points[0]);

  return points;
}

function createEnvelopePolygon(points: WorkspaceMapGeoJsonPosition[], paddingKm: number, seed: string): WorkspaceMapGeoJsonPosition[] {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs) - paddingKm;
  const maxX = Math.max(...xs) + paddingKm;
  const minY = Math.min(...ys) - paddingKm;
  const maxY = Math.max(...ys) + paddingKm;
  const center: WorkspaceMapGeoJsonPosition = [(minX + maxX) / 2, (minY + maxY) / 2];
  const radiusX = Math.max(paddingKm * 1.4, (maxX - minX) / 2);
  const radiusY = Math.max(paddingKm * 1.2, (maxY - minY) / 2);
  const polygon = createOrganicPolygon(center, 1, seed, { x: radiusX, y: radiusY });

  return polygon;
}

function buildMapGeoJsonBbox(features: WorkspaceMapGeoJsonFeature[], projection: MapGeoJsonProjection): [number, number, number, number] {
  const coordinates = features.flatMap((feature) => collectGeometryCoordinates(feature.geometry));

  if (coordinates.length === 0) {
    return [
      roundMapGeoJsonCoordinate(-projection.widthKm / 2),
      roundMapGeoJsonCoordinate(-projection.heightKm / 2),
      roundMapGeoJsonCoordinate(projection.widthKm / 2),
      roundMapGeoJsonCoordinate(projection.heightKm / 2)
    ];
  }

  const xs = coordinates.map((coordinate) => coordinate[0]);
  const ys = coordinates.map((coordinate) => coordinate[1]);
  const padding = Math.max(projection.widthKm, projection.heightKm) * 0.05;

  return [
    roundMapGeoJsonCoordinate(Math.min(...xs) - padding),
    roundMapGeoJsonCoordinate(Math.min(...ys) - padding),
    roundMapGeoJsonCoordinate(Math.max(...xs) + padding),
    roundMapGeoJsonCoordinate(Math.max(...ys) + padding)
  ];
}

function normalizeMapGeoJsonFeatureCollection(value: unknown): WorkspaceMapGeoJsonFeatureCollection {
  const record = value as Partial<WorkspaceMapGeoJsonFeatureCollection>;
  const features = Array.isArray(record.features)
    ? record.features.filter(isWorkspaceMapGeoJsonFeature)
    : [];
  const bbox = Array.isArray(record.bbox) && record.bbox.length === 4
    ? record.bbox.map((entry) => Number(entry)) as [number, number, number, number]
    : buildMapGeoJsonBbox(features, { aspectRatio: 16 / 9, heightKm: 90, widthKm: 160 });

  return {
    bbox,
    features,
    type: "FeatureCollection"
  };
}

function isWorkspaceMapGeoJsonFeature(value: unknown): value is WorkspaceMapGeoJsonFeature {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const feature = value as Partial<WorkspaceMapGeoJsonFeature>;

  return feature.type === "Feature" &&
    typeof feature.id === "string" &&
    Boolean(feature.geometry) &&
    typeof feature.properties?.id === "string" &&
    typeof feature.properties.name === "string";
}

function collectGeometryCoordinates(geometry: WorkspaceMapGeoJsonFeature["geometry"]): WorkspaceMapGeoJsonPosition[] {
  if (geometry.type === "Point") {
    return [geometry.coordinates];
  }

  if (geometry.type === "LineString") {
    return geometry.coordinates;
  }

  return geometry.coordinates.flat();
}

function getMapGeoJsonRadiusKm(type: WorkspaceMapMaterialNodeType, projection: MapGeoJsonProjection) {
  return roundMapGeoJsonCoordinate(Math.min(projection.widthKm, projection.heightKm) * nodeTypeRadiusRatio[type]);
}

function getMapGeoJsonTypeStretch(type: WorkspaceMapMaterialNodeType) {
  if (type === "city" || type === "village") {
    return { x: 1.16, y: 0.86 };
  }

  if (type === "landmark") {
    return { x: 0.9, y: 1.08 };
  }

  return { x: 1.24, y: 0.92 };
}

function getMapGeoJsonNodeLevel(type: WorkspaceMapMaterialNodeType) {
  const index = mapNodeTypes.indexOf(type);

  return index >= 0 ? index : mapNodeTypes.length;
}

function needsFallbackLayout(nodes: WorkspaceMapMaterialNode[]) {
  if (nodes.length <= 1) {
    return true;
  }

  const first = nodes[0];

  return nodes.every((node) => Math.abs(node.x - first.x) < 0.0001 && Math.abs(node.y - first.y) < 0.0001);
}

function createFallbackNodePositions(nodes: WorkspaceMapMaterialNode[]) {
  return nodes.map((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, nodes.length);
    const radius = 1 + index / Math.max(4, nodes.length);

    return {
      ...node,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    };
  });
}

async function readMapGeoJsonImageMetrics(bytes: Uint8Array) {
  try {
    const metadata = await sharp(bytes, { limitInputPixels: false }).metadata();

    return {
      aspectRatio: metadata.width && metadata.height ? metadata.width / metadata.height : 16 / 9
    };
  } catch {
    return null;
  }
}

function normalizePositiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function roundMapGeoJsonCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function seededNoise(seed: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0) / 0xffffffff;
}
