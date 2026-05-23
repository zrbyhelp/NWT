import type { ScenePanoramaFace } from "./types";

export function updateImportedMetadataImage(
  metadata: unknown,
  previewUrl: string | null,
  scenePanoramaFaceUrls: Array<{ blockId: string; face: ScenePanoramaFace; url: string }> = [],
  scenePanoramaMotherUrls: Array<{ blockId: string; url: string }> = [],
  itemViewImageUrls: Array<{ face: ScenePanoramaFace; url: string }> = [],
  itemModelInputImageUrl: string | null = null,
  itemModel: { byteSize: number; contentType: "model/gltf-binary"; fileName: string; url: string } | null = null
) {
  const cloned = cloneJson(metadata);

  if (!cloned || typeof cloned !== "object" || Array.isArray(cloned)) {
    return cloned;
  }

  const record = cloned as Record<string, unknown>;

  if (record.kind === "mask" && ("boardImage" in record || previewUrl)) {
    record.boardImage = previewUrl
      ? {
          source: getMaskBoardImageSource(record.boardImage) ?? "uploaded",
          url: previewUrl
        }
      : null;
  }

  if (record.kind === "item") {
    if ("boardImage" in record || previewUrl) {
      record.boardImage = previewUrl
        ? {
            source: getMaskBoardImageSource(record.boardImage) ?? "uploaded",
            url: previewUrl
          }
        : null;
    }

    if (itemViewImageUrls.length > 0) {
      const previousViewImages = record.viewImages && typeof record.viewImages === "object"
        ? record.viewImages as Record<string, unknown>
        : {};
      record.viewImages = itemViewImageUrls.reduce<Partial<Record<ScenePanoramaFace, { source: "generated" | "uploaded"; url: string }>>>((result, item) => {
        const previous = previousViewImages[item.face];
        const source =
          previous && typeof previous === "object" && (previous as Record<string, unknown>).source === "uploaded"
            ? "uploaded"
            : "generated";

        result[item.face] = { source, url: item.url };

        return result;
      }, {});
    }

    if ("modelInputImage" in record || itemModelInputImageUrl) {
      record.modelInputImage = itemModelInputImageUrl
        ? {
            source: getMaskBoardImageSource(record.modelInputImage) ?? "generated",
            url: itemModelInputImageUrl
          }
        : null;
    }

    if (itemModel) {
      record.model3d = {
        byteSize: itemModel.byteSize,
        contentType: itemModel.contentType,
        fileName: itemModel.fileName,
        source: "instantmesh",
        url: itemModel.url
      };
    }
  }

  if (record.kind === "scene" && Array.isArray(record.blocks) && (scenePanoramaFaceUrls.length > 0 || scenePanoramaMotherUrls.length > 0)) {
    record.blocks = record.blocks.map((block) => {
      if (!block || typeof block !== "object") {
        return block;
      }

      const blockRecord = block as Record<string, unknown>;
      const blockId = typeof blockRecord.id === "string" ? blockRecord.id : "";
      const blockFaces = scenePanoramaFaceUrls.filter((item) => item.blockId === blockId);
      const blockMother = scenePanoramaMotherUrls.find((item) => item.blockId === blockId);

      if (blockFaces.length === 0 && !blockMother) {
        return blockRecord;
      }

      const previousPanorama = blockRecord.panorama && typeof blockRecord.panorama === "object"
        ? blockRecord.panorama as Record<string, unknown>
        : {};
      const faces = blockFaces.reduce<Record<ScenePanoramaFace, { url: string }>>((result, item) => {
        result[item.face] = { url: item.url };

        return result;
      }, {} as Record<ScenePanoramaFace, { url: string }>);

      blockRecord.panorama = {
        ...previousPanorama,
        ...(blockFaces.length > 0 ? { faces } : {}),
        ...(blockMother ? { mother: { source: "generated", url: blockMother.url } } : {})
      };

      return blockRecord;
    });
  }

  return record;
}

export function getImportedScenePreviewUrl(
  metadata: unknown,
  scenePanoramaFaceUrls: Array<{ blockId: string; face: ScenePanoramaFace; url: string }>,
  scenePanoramaMotherUrls: Array<{ blockId: string; url: string }> = []
) {
  const firstBlockId = getImportedSceneFirstBlockId(metadata);

  if (firstBlockId) {
    return (
      scenePanoramaMotherUrls.find((item) => item.blockId === firstBlockId)?.url ??
      scenePanoramaFaceUrls.find((item) => item.blockId === firstBlockId && item.face === "front")?.url ??
      null
    );
  }

  return scenePanoramaMotherUrls[0]?.url ?? scenePanoramaFaceUrls.find((item) => item.face === "front")?.url ?? null;
}

export function getImportedItemPreviewUrl(
  metadata: unknown,
  previewUrl: string | null,
  itemModelInputImageUrl: string | null,
  itemViewImageUrls: Array<{ face: ScenePanoramaFace; url: string }>
) {
  const record = getItemMetadataRecord(metadata);

  if (!record) {
    return null;
  }

  return previewUrl ?? itemModelInputImageUrl ?? itemViewImageUrls.find((item) => item.face === "front")?.url ?? null;
}

export function getMaskMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  return record.kind === "mask" ? record : null;
}

export function getSceneMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  return record.kind === "scene" ? record : null;
}

export function getItemMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  return record.kind === "item" ? record : null;
}

function getImportedSceneFirstBlockId(metadata: unknown) {
  const record = getSceneMetadataRecord(metadata);

  if (!record || !Array.isArray(record.blocks)) {
    return "";
  }

  const firstBlock = record.blocks[0];

  return firstBlock && typeof firstBlock === "object" && "id" in firstBlock && typeof firstBlock.id === "string"
    ? firstBlock.id
    : "";
}

function getMaskBoardImageSource(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = (value as Record<string, unknown>).source;

  return source === "generated" || source === "uploaded" ? source : null;
}

function cloneJson(value: unknown) {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}
