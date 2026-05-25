import neo4j from "neo4j-driver";
import type {
  WorkspaceMapMaterialEdge,
  WorkspaceMapMaterialMetadata,
  WorkspaceMapMaterialNode,
  WorkspaceMapMaterialRelationType
} from "@/lib/home-workspace";
import { mapRelationTypes } from "@/lib/home-workspace/map";

export type MapMaterialProjectionPayload = {
  materialId: string;
  name: string;
  description: string;
  style: WorkspaceMapMaterialMetadata["style"];
  nodes: WorkspaceMapMaterialNode[];
  edges: WorkspaceMapMaterialEdge[];
};

const relationTypeByValue: Record<WorkspaceMapMaterialRelationType, string> = {
  contains: "CONTAINS",
  belongs_to: "BELONGS_TO",
  adjacent: "ADJACENT",
  connects: "CONNECTS",
  through: "THROUGH",
  north_of: "NORTH_OF",
  south_of: "SOUTH_OF",
  east_of: "EAST_OF",
  west_of: "WEST_OF"
};

export function buildMapMaterialProjectionPayload(
  materialId: string,
  metadata: WorkspaceMapMaterialMetadata
): MapMaterialProjectionPayload {
  return {
    materialId,
    name: metadata.name,
    description: metadata.description,
    style: metadata.style,
    nodes: metadata.nodes.map((node) => ({ ...node })),
    edges: metadata.edges.map((edge) => ({ ...edge }))
  };
}

export async function syncMapMaterialProjection(
  materialId: string,
  metadata: WorkspaceMapMaterialMetadata
): Promise<MapMaterialProjectionPayload> {
  const payload = buildMapMaterialProjectionPayload(materialId, metadata);
  const { neo4jDriver } = await import("./neo4j");
  const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.WRITE });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        [
          "MATCH (place:MapPlace {materialId: $materialId})",
          "DETACH DELETE place"
        ].join("\n"),
        { materialId: payload.materialId }
      );
      await tx.run(
        [
          "MATCH (root:MapMaterial {materialId: $materialId})",
          "DETACH DELETE root"
        ].join("\n"),
        { materialId: payload.materialId }
      );

      await tx.run(
        [
          "CREATE (root:MapMaterial {",
          "  materialId: $materialId,",
          "  name: $name,",
          "  description: $description,",
          "  style: $style,",
          "  kind: 'map',",
          "  version: 1",
          "})"
        ].join("\n"),
        {
          materialId: payload.materialId,
          name: payload.name,
          description: payload.description,
          style: payload.style
        }
      );

      if (payload.nodes.length > 0) {
        await tx.run(
          [
            "MATCH (root:MapMaterial {materialId: $materialId})",
            "UNWIND $nodes AS node",
            "CREATE (place:MapPlace {",
            "  materialId: $materialId,",
            "  nodeId: node.id,",
            "  type: node.type,",
            "  name: node.name,",
            "  description: node.description,",
            "  x: node.x,",
            "  y: node.y",
            "})",
            "CREATE (root)-[:HAS_PLACE]->(place)"
          ].join("\n"),
          {
            materialId: payload.materialId,
            nodes: payload.nodes
          }
        );
      }

      for (const relation of mapRelationTypes) {
        const edges = payload.edges.filter((edge) => edge.relation === relation);

        if (edges.length === 0) {
          continue;
        }

        await tx.run(
          [
            "UNWIND $edges AS edge",
            "MATCH (source:MapPlace {materialId: $materialId, nodeId: edge.source})",
            "MATCH (target:MapPlace {materialId: $materialId, nodeId: edge.target})",
            `CREATE (source)-[rel:${relationTypeByValue[relation]} {`,
            "  materialId: $materialId,",
            "  edgeId: edge.id,",
            "  relation: edge.relation,",
            "  description: edge.description",
            "}]->(target)"
          ].join("\n"),
          {
            materialId: payload.materialId,
            edges
          }
        );
      }
    });
  } finally {
    await session.close();
  }

  return payload;
}
