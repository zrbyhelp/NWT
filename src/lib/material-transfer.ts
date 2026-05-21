import "server-only";

import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import type {
  Prisma,
  StoryMaterialCategory as PrismaStoryMaterialCategory,
  StoryMaterialStyle as PrismaStoryMaterialStyle
} from "@prisma/client";
import type { Locale } from "@/i18n/routing";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getMaterialImageExtension,
  isValidMaterialImageBytes,
  uploadMaterialImageBytes
} from "@/lib/storage/material";
import type {
  WorkspaceMaterial,
  WorkspaceMaterialCategory,
  WorkspaceMaterialLibrarySource,
  WorkspaceMaterialMetadata,
  WorkspaceMaterialStyle
} from "@/lib/home-workspace";

const archiveFormat = "nwt.materials";
const archiveVersion = 1;
const selfCreatedSource = "SELF_CREATED" satisfies WorkspaceMaterialLibrarySource;
const scenePanoramaFaces = ["front", "back", "left", "right", "top", "bottom"] as const;

type ScenePanoramaFace = (typeof scenePanoramaFaces)[number];

type MaterialRecord = {
  id: string;
  slug: string;
  category: string;
  style?: string | null;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  previewUrl?: string | null;
  metadata?: unknown;
  communityVisible?: boolean | null;
};

type MaterialArchiveImage = {
  path: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

type MaterialArchiveScenePanoramaFace = {
  blockId: string;
  face: ScenePanoramaFace;
  image: MaterialArchiveImage;
};

type MaterialArchiveItem = {
  slug: string;
  category: WorkspaceMaterialCategory;
  style: WorkspaceMaterialStyle;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  metadata: unknown;
  image: MaterialArchiveImage | null;
  scenePanoramaFaces?: MaterialArchiveScenePanoramaFace[];
};

type MaterialArchiveManifest = {
  format: typeof archiveFormat;
  version: typeof archiveVersion;
  exportedAt: string;
  materials: MaterialArchiveItem[];
};

type PreparedImportMaterial = {
  archiveItem: MaterialArchiveItem;
  imageBytes: Uint8Array | null;
  imageContentType: string | null;
  scenePanoramaFaceImages: Array<{
    blockId: string;
    face: ScenePanoramaFace;
    imageBytes: Uint8Array;
    imageContentType: string;
  }>;
};

type UploadedImportMaterial = PreparedImportMaterial & {
  previewUrl: string | null;
  scenePanoramaFaceUrls: Array<{
    blockId: string;
    face: ScenePanoramaFace;
    url: string;
  }>;
  metadata: unknown;
};

export class MaterialTransferError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "MaterialTransferError";
    this.code = code;
  }
}

export async function exportSelfCreatedMaterialsZip({
  locale,
  materialId,
  origin
}: {
  locale: Locale;
  materialId?: string | null;
  origin: string;
}) {
  const viewer = await requireAuth();
  const records = materialId
    ? await getSingleSelfCreatedMaterial(viewer.id, materialId)
    : await getAllSelfCreatedMaterials(viewer.id);

  if (records.length === 0) {
    throw new MaterialTransferError("NO_SELF_CREATED_MATERIALS");
  }

  const zip = new JSZip();
  const manifest: MaterialArchiveManifest = {
    format: archiveFormat,
    version: archiveVersion,
    exportedAt: new Date().toISOString(),
    materials: []
  };

  for (const record of records) {
    const pathSlug = createArchivePathSegment(record.slug);
    const sceneFaces = await downloadScenePanoramaFaces(record.metadata, pathSlug, origin);
    const image = sceneFaces.length === 0 && record.previewUrl ? await downloadMaterialImage(record.previewUrl, origin) : null;
    const imageFileName = image ? `preview.${image.extension}` : "";
    const imagePath = image ? `materials/${pathSlug}/images/${imageFileName}` : "";

    if (image && imagePath) {
      zip.file(imagePath, image.bytes);
    }

    sceneFaces.forEach((asset) => {
      zip.file(asset.image.path, asset.bytes);
    });

    const archiveItem: MaterialArchiveItem = {
      slug: record.slug,
      category: normalizeMaterialCategory(record.category),
      style: normalizeMaterialStyle(record.style),
      titleZh: record.titleZh,
      titleEn: record.titleEn,
      descriptionZh: record.descriptionZh,
      descriptionEn: record.descriptionEn,
      metadata: cloneJson(record.metadata ?? null),
      image: image
        ? {
            path: imagePath,
            fileName: imageFileName,
            contentType: image.contentType,
            byteSize: image.bytes.byteLength
          }
        : null,
      scenePanoramaFaces: sceneFaces.map((asset) => ({
        blockId: asset.blockId,
        face: asset.face,
        image: asset.image
      }))
    };

    manifest.materials.push(archiveItem);
    zip.file(`materials/${pathSlug}/material.md`, formatMaterialMarkdown(archiveItem, locale));
  }

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  return {
    bytes: await zip.generateAsync({ type: "uint8array" }),
    fileName: materialId
      ? `nwt-material-${createArchivePathSegment(records[0]?.titleZh || records[0]?.slug || "material")}.zip`
      : `nwt-materials-${new Date().toISOString().slice(0, 10)}.zip`,
    materialCount: manifest.materials.length
  };
}

export async function importMaterialsZip(bytes: ArrayBuffer | Uint8Array, locale: Locale) {
  const viewer = await requireAuth();
  const zip = await loadArchive(bytes);
  const manifest = await readManifest(zip);
  const preparedMaterials = await prepareImportMaterials(zip, manifest);

  const uploadedMaterials: UploadedImportMaterial[] = [];

  for (const prepared of preparedMaterials) {
    const previewUrl =
      prepared.imageBytes && prepared.imageContentType
        ? await uploadMaterialImageBytes(viewer.id, prepared.imageBytes, prepared.imageContentType, "imports")
        : null;
    const scenePanoramaFaceUrls = await Promise.all(
      prepared.scenePanoramaFaceImages.map(async (faceImage) => ({
        blockId: faceImage.blockId,
        face: faceImage.face,
        url: await uploadMaterialImageBytes(viewer.id, faceImage.imageBytes, faceImage.imageContentType, "imports")
      }))
    );

    uploadedMaterials.push({
      ...prepared,
      previewUrl: getImportedScenePreviewUrl(scenePanoramaFaceUrls) ?? previewUrl,
      scenePanoramaFaceUrls,
      metadata: updateImportedMetadataImage(prepared.archiveItem.metadata, previewUrl, scenePanoramaFaceUrls)
    });
  }

  const createdMaterials = await prisma.$transaction(async (tx) => {
    const results: MaterialRecord[] = [];

    for (const prepared of uploadedMaterials) {
      const titleZh = normalizeText(prepared.archiveItem.titleZh, prepared.archiveItem.slug);
      const titleEn = normalizeText(prepared.archiveItem.titleEn, titleZh);
      const descriptionZh = normalizeLongText(prepared.archiveItem.descriptionZh, titleZh);
      const descriptionEn = normalizeLongText(prepared.archiveItem.descriptionEn, descriptionZh);

      const material = await tx.storyMaterial.create({
        data: {
          slug: createImportedMaterialSlug(prepared.archiveItem.category, titleZh, prepared.archiveItem.slug),
          category: toPrismaMaterialCategory(prepared.archiveItem.category),
          style: toPrismaMaterialStyle(prepared.archiveItem.style),
          titleZh,
          titleEn,
          descriptionZh,
          descriptionEn,
          previewUrl: prepared.previewUrl,
          metadata: prepared.metadata === null ? undefined : prepared.metadata as Prisma.InputJsonValue,
          communityVisible: false,
          libraryEntries: {
            create: {
              userId: viewer.id,
              source: selfCreatedSource
            }
          }
        }
      });

      results.push(material);
    }

    return results;
  });

  return {
    importedCount: createdMaterials.length,
    materials: createdMaterials.map((material) =>
      mapMaterial(material, locale, {
        inLibrary: true,
        librarySource: selfCreatedSource
      })
    )
  };
}

function getSingleSelfCreatedMaterial(userId: string, materialId: string) {
  return prisma.storyMaterialLibraryEntry
    .findFirst({
      where: {
        userId,
        materialId,
        source: selfCreatedSource
      },
      include: {
        material: true
      }
    })
    .then((entry) => {
      if (!entry) {
        throw new MaterialTransferError("MATERIAL_NOT_EXPORTABLE");
      }

      return [entry.material];
    });
}

async function getAllSelfCreatedMaterials(userId: string) {
  const entries = await prisma.storyMaterialLibraryEntry.findMany({
    where: {
      userId,
      source: selfCreatedSource
    },
    include: {
      material: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  return entries.map((entry) => entry.material);
}

async function downloadMaterialImage(previewUrl: string, origin: string) {
  const url = resolveMaterialImageUrl(previewUrl, origin);
  const response = await fetch(url);

  if (!response.ok) {
    throw new MaterialTransferError("MATERIAL_IMAGE_DOWNLOAD_FAILED");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = normalizeImageContentType(response.headers.get("content-type") ?? inferImageContentType(previewUrl) ?? "");
  const extension = contentType ? getMaterialImageExtension(contentType) : null;

  if (!contentType || !extension || !isValidMaterialImageBytes(bytes, contentType)) {
    throw new MaterialTransferError("INVALID_MATERIAL_IMAGE_FILE");
  }

  return {
    bytes,
    contentType,
    extension
  };
}

async function downloadScenePanoramaFaces(metadata: unknown, pathSlug: string, origin: string) {
  const record = getSceneMetadataRecord(metadata);
  const assets: Array<{
    blockId: string;
    bytes: Uint8Array;
    face: ScenePanoramaFace;
    image: MaterialArchiveImage;
  }> = [];

  if (!record || !Array.isArray(record.blocks)) {
    return assets;
  }

  for (const block of record.blocks) {
    if (!block || typeof block !== "object") {
      continue;
    }

    const blockRecord = block as Record<string, unknown>;
    const blockId = normalizeText(blockRecord.id, "block");
    const panorama = blockRecord.panorama;

    if (!panorama || typeof panorama !== "object") {
      continue;
    }

    const faces = (panorama as Record<string, unknown>).faces;

    if (!faces || typeof faces !== "object") {
      continue;
    }

    for (const face of scenePanoramaFaces) {
      const faceRecord = (faces as Record<string, unknown>)[face];
      const url =
        faceRecord && typeof faceRecord === "object"
          ? (faceRecord as Record<string, unknown>).url
          : null;

      if (typeof url !== "string" || !url) {
        continue;
      }

      const image = await downloadMaterialImage(url, origin);
      const fileName = `${face}.${image.extension}`;
      const path = `materials/${pathSlug}/panorama/${createArchivePathSegment(blockId)}/${fileName}`;

      assets.push({
        blockId,
        bytes: image.bytes,
        face,
        image: {
          path,
          fileName,
          contentType: image.contentType,
          byteSize: image.bytes.byteLength
        }
      });
    }
  }

  return assets;
}

function resolveMaterialImageUrl(previewUrl: string, origin: string) {
  if (previewUrl.startsWith("/")) {
    return new URL(previewUrl, origin).toString();
  }

  return previewUrl;
}

async function loadArchive(bytes: ArrayBuffer | Uint8Array) {
  try {
    return await JSZip.loadAsync(bytes);
  } catch {
    throw new MaterialTransferError("INVALID_MATERIAL_ZIP");
  }
}

async function readManifest(zip: JSZip): Promise<MaterialArchiveManifest> {
  const manifestFile = zip.file("manifest.json");

  if (!manifestFile) {
    throw new MaterialTransferError("MATERIAL_MANIFEST_REQUIRED");
  }

  try {
    return validateManifest(JSON.parse(await manifestFile.async("text")));
  } catch (error) {
    if (error instanceof MaterialTransferError) {
      throw error;
    }

    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }
}

async function prepareImportMaterials(zip: JSZip, manifest: MaterialArchiveManifest): Promise<PreparedImportMaterial[]> {
  const preparedMaterials: PreparedImportMaterial[] = [];

  for (const archiveItem of manifest.materials) {
    let imageBytes: Uint8Array | null = null;
    let imageContentType: string | null = null;
    const scenePanoramaFaceImages: PreparedImportMaterial["scenePanoramaFaceImages"] = [];

    if (archiveItem.image) {
      const imageFile = zip.file(archiveItem.image.path);

      if (!imageFile) {
        throw new MaterialTransferError("MATERIAL_IMAGE_REQUIRED");
      }

      imageBytes = await imageFile.async("uint8array");
      imageContentType = normalizeImageContentType(archiveItem.image.contentType);

      if (!imageContentType || !isValidMaterialImageBytes(imageBytes, imageContentType)) {
        throw new MaterialTransferError("INVALID_MATERIAL_IMAGE_FILE");
      }
    }

    for (const faceAsset of archiveItem.scenePanoramaFaces ?? []) {
      const imageFile = zip.file(faceAsset.image.path);

      if (!imageFile) {
        throw new MaterialTransferError("MATERIAL_IMAGE_REQUIRED");
      }

      const faceBytes = await imageFile.async("uint8array");
      const faceContentType = normalizeImageContentType(faceAsset.image.contentType);

      if (!faceContentType || !isValidMaterialImageBytes(faceBytes, faceContentType)) {
        throw new MaterialTransferError("INVALID_MATERIAL_IMAGE_FILE");
      }

      scenePanoramaFaceImages.push({
        blockId: faceAsset.blockId,
        face: faceAsset.face,
        imageBytes: faceBytes,
        imageContentType: faceContentType
      });
    }

    preparedMaterials.push({
      archiveItem,
      imageBytes,
      imageContentType,
      scenePanoramaFaceImages
    });
  }

  return preparedMaterials;
}

function validateManifest(value: unknown): MaterialArchiveManifest {
  if (!value || typeof value !== "object") {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  const record = value as Record<string, unknown>;

  if (record.format !== archiveFormat || record.version !== archiveVersion) {
    throw new MaterialTransferError("UNSUPPORTED_MATERIAL_ARCHIVE");
  }

  if (!Array.isArray(record.materials) || record.materials.length === 0) {
    throw new MaterialTransferError("MATERIAL_ARCHIVE_EMPTY");
  }

  return {
    format: archiveFormat,
    version: archiveVersion,
    exportedAt: typeof record.exportedAt === "string" ? record.exportedAt : new Date().toISOString(),
    materials: record.materials.map(validateArchiveItem)
  };
}

function validateArchiveItem(value: unknown): MaterialArchiveItem {
  if (!value || typeof value !== "object") {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  const record = value as Record<string, unknown>;
  const category = typeof record.category === "string" ? record.category : "";
  const style = typeof record.style === "string" ? record.style : "";

  if (!isWorkspaceMaterialCategory(category) || !isWorkspaceMaterialStyle(style)) {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  return {
    slug: normalizeText(record.slug, "imported-material"),
    category,
    style,
    titleZh: normalizeText(record.titleZh, normalizeText(record.titleEn, "导入素材")),
    titleEn: normalizeText(record.titleEn, normalizeText(record.titleZh, "Imported Material")),
    descriptionZh: normalizeLongText(record.descriptionZh, ""),
    descriptionEn: normalizeLongText(record.descriptionEn, ""),
    metadata: cloneJson(record.metadata ?? null),
    image: validateArchiveImage(record.image),
    scenePanoramaFaces: validateArchiveScenePanoramaFaces(record.scenePanoramaFaces)
  };
}

function validateArchiveScenePanoramaFaces(value: unknown): MaterialArchiveScenePanoramaFace[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
    }

    const record = item as Record<string, unknown>;
    const blockId = normalizeText(record.blockId, "");
    const face = typeof record.face === "string" && isScenePanoramaFace(record.face) ? record.face : null;

    if (!blockId || !face) {
      throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
    }

    return {
      blockId,
      face,
      image: validateRequiredArchiveImage(record.image)
    };
  });
}

function validateRequiredArchiveImage(value: unknown): MaterialArchiveImage {
  const image = validateArchiveImage(value);

  if (!image) {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  return image;
}

function validateArchiveImage(value: unknown): MaterialArchiveImage | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!value || typeof value !== "object") {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  const record = value as Record<string, unknown>;
  const path = normalizeText(record.path, "");
  const contentType = normalizeImageContentType(typeof record.contentType === "string" ? record.contentType : "");

  if (!path || !path.startsWith("materials/")) {
    throw new MaterialTransferError("INVALID_MATERIAL_MANIFEST");
  }

  if (!contentType) {
    throw new MaterialTransferError("INVALID_MATERIAL_IMAGE_FILE");
  }

  return {
    path,
    fileName: normalizeText(record.fileName, "preview"),
    contentType,
    byteSize: typeof record.byteSize === "number" && Number.isFinite(record.byteSize) ? Math.max(0, Math.round(record.byteSize)) : 0
  };
}

function formatMaterialMarkdown(item: MaterialArchiveItem, locale: Locale) {
  const isEnglish = locale === "en-US";
  const lines = [
    `# ${isEnglish ? item.titleEn || item.titleZh : item.titleZh || item.titleEn}`,
    "",
    `- ${isEnglish ? "Type" : "类型"}: ${item.category}`,
    `- ${isEnglish ? "Style" : "风格"}: ${item.style}`,
    `- Slug: ${item.slug}`,
    "",
    `## ${isEnglish ? "Description" : "简介"}`,
    "",
    isEnglish ? item.descriptionEn || item.descriptionZh || "-" : item.descriptionZh || item.descriptionEn || "-",
    ""
  ];

  const maskMetadata = getMaskMetadataRecord(item.metadata);

  if (maskMetadata) {
    lines.push(`## ${isEnglish ? "Facade Data" : "假面数据"}`, "");
    pushOptionalMarkdownBlock(lines, isEnglish ? "Introduction" : "假面介绍", maskMetadata.intro);
    pushOptionalMarkdownBlock(lines, isEnglish ? "Traits" : "特征", maskMetadata.features);
    pushRecordMarkdown(lines, isEnglish ? "Body" : "身体信息", maskMetadata.body);
    pushRecordMarkdown(lines, isEnglish ? "Colors" : "颜色", maskMetadata.colors);
    pushRecordMarkdown(lines, isEnglish ? "Voice" : "语音", maskMetadata.voice);
    pushRecordMarkdown(lines, isEnglish ? "Personality" : "性格", maskMetadata.personality);
  }

  const sceneMetadata = getSceneMetadataRecord(item.metadata);

  if (sceneMetadata) {
    lines.push(`## ${isEnglish ? "Scene Data" : "场景数据"}`, "");
    pushOptionalMarkdownBlock(lines, isEnglish ? "Scene Description" : "场景说明", sceneMetadata.description);
    if (Array.isArray(sceneMetadata.blocks)) {
      sceneMetadata.blocks.forEach((block: unknown, index: number) => {
        if (!block || typeof block !== "object") {
          return;
        }

        const blockRecord = block as Record<string, unknown>;
        const title = typeof blockRecord.name === "string" && blockRecord.name ? blockRecord.name : `${isEnglish ? "Block" : "区块"} ${index + 1}`;

        lines.push(`### ${title}`, "");
        pushOptionalMarkdownBlock(lines, isEnglish ? "Description" : "说明", blockRecord.description);
      });
    }
  }

  if (item.image) {
    lines.push(`## ${isEnglish ? "Image" : "图片"}`, "", `![${isEnglish ? "Material image" : "素材图片"}](images/${item.image.fileName})`, "");
  }

  if (item.scenePanoramaFaces && item.scenePanoramaFaces.length > 0) {
    lines.push(`## ${isEnglish ? "Panorama Faces" : "全景六面图"}`, "");
    item.scenePanoramaFaces.forEach((asset) => {
      lines.push(`- ${asset.blockId} / ${asset.face}: ${asset.image.path}`);
    });
    lines.push("");
  }

  lines.push(`## ${isEnglish ? "Raw Data" : "结构化数据"}`, "", "```json", JSON.stringify(item, null, 2), "```", "");

  return lines.join("\n");
}

function pushOptionalMarkdownBlock(lines: string[], title: string, value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return;
  }

  lines.push(`### ${title}`, "", value.trim(), "");
}

function pushRecordMarkdown(lines: string[], title: string, value: unknown) {
  if (!value || typeof value !== "object") {
    return;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(([, entryValue]) => entryValue !== "" && entryValue !== null && entryValue !== undefined);

  if (entries.length === 0) {
    return;
  }

  lines.push(`### ${title}`, "");
  entries.forEach(([key, entryValue]) => {
    lines.push(`- ${key}: ${String(entryValue)}`);
  });
  lines.push("");
}

function updateImportedMetadataImage(
  metadata: unknown,
  previewUrl: string | null,
  scenePanoramaFaceUrls: Array<{ blockId: string; face: ScenePanoramaFace; url: string }> = []
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

  if (record.kind === "scene" && Array.isArray(record.blocks) && scenePanoramaFaceUrls.length > 0) {
    record.blocks = record.blocks.map((block) => {
      if (!block || typeof block !== "object") {
        return block;
      }

      const blockRecord = block as Record<string, unknown>;
      const blockId = typeof blockRecord.id === "string" ? blockRecord.id : "";
      const blockFaces = scenePanoramaFaceUrls.filter((item) => item.blockId === blockId);

      if (blockFaces.length === 0) {
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
        faces
      };

      return blockRecord;
    });
  }

  return record;
}

function getImportedScenePreviewUrl(scenePanoramaFaceUrls: Array<{ blockId: string; face: ScenePanoramaFace; url: string }>) {
  return scenePanoramaFaceUrls.find((item) => item.face === "front")?.url ?? null;
}

function getMaskBoardImageSource(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = (value as Record<string, unknown>).source;

  return source === "generated" || source === "uploaded" ? source : null;
}

function getMaskMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  return record.kind === "mask" ? record : null;
}

function getSceneMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  return record.kind === "scene" ? record : null;
}

function mapMaterial(
  material: MaterialRecord,
  locale: Locale,
  library: {
    inLibrary?: boolean;
    librarySource?: WorkspaceMaterialLibrarySource;
  }
): WorkspaceMaterial {
  const isEnglish = locale === "en-US";
  const librarySource = library.librarySource;

  return {
    id: material.id,
    slug: material.slug,
    category: normalizeMaterialCategory(material.category),
    style: normalizeMaterialStyle(material.style),
    title: isEnglish ? material.titleEn : material.titleZh,
    description: isEnglish ? material.descriptionEn : material.descriptionZh,
    previewUrl: material.previewUrl ?? null,
    metadata: (material.metadata as WorkspaceMaterialMetadata | null | undefined) ?? null,
    communityVisible: material.communityVisible ?? true,
    inLibrary: library.inLibrary ?? false,
    ...(librarySource ? { librarySource } : {})
  };
}

function normalizeMaterialCategory(category: string): WorkspaceMaterialCategory {
  if (category === "MASK" || category === "mask") {
    return "mask";
  }

  if (category === "MAP" || category === "map") {
    return "map";
  }

  if (category === "CREATURE" || category === "creature") {
    return "creature";
  }

  if (category === "SCENE" || category === "scene") {
    return "scene";
  }

  return "item";
}

function normalizeMaterialStyle(style?: string | null): WorkspaceMaterialStyle {
  if (style === "FANTASY" || style === "fantasy") {
    return "fantasy";
  }

  if (style === "SCI_FI" || style === "sciFi") {
    return "sciFi";
  }

  if (style === "MYSTERY" || style === "mystery") {
    return "mystery";
  }

  if (style === "CYBERPUNK" || style === "cyberpunk") {
    return "cyberpunk";
  }

  if (style === "CLASSICAL" || style === "classical") {
    return "classical";
  }

  if (style === "APOCALYPTIC" || style === "apocalyptic") {
    return "apocalyptic";
  }

  return "realistic";
}

function isScenePanoramaFace(value: string): value is ScenePanoramaFace {
  return scenePanoramaFaces.includes(value as ScenePanoramaFace);
}

function toPrismaMaterialCategory(category: WorkspaceMaterialCategory): PrismaStoryMaterialCategory {
  const categories: Record<WorkspaceMaterialCategory, PrismaStoryMaterialCategory> = {
    creature: "CREATURE",
    item: "ITEM",
    map: "MAP",
    mask: "MASK",
    scene: "SCENE"
  };

  return categories[category];
}

function toPrismaMaterialStyle(style: WorkspaceMaterialStyle): PrismaStoryMaterialStyle {
  const styles: Record<WorkspaceMaterialStyle, PrismaStoryMaterialStyle> = {
    apocalyptic: "APOCALYPTIC",
    classical: "CLASSICAL",
    cyberpunk: "CYBERPUNK",
    fantasy: "FANTASY",
    mystery: "MYSTERY",
    realistic: "REALISTIC",
    sciFi: "SCI_FI"
  };

  return styles[style];
}

function isWorkspaceMaterialCategory(category: string): category is WorkspaceMaterialCategory {
  return ["mask", "map", "item", "creature", "scene"].includes(category);
}

function isWorkspaceMaterialStyle(style: string): style is WorkspaceMaterialStyle {
  return ["realistic", "fantasy", "sciFi", "mystery", "cyberpunk", "classical", "apocalyptic"].includes(style);
}

function createImportedMaterialSlug(category: WorkspaceMaterialCategory, title: string, sourceSlug: string) {
  const normalized = createArchivePathSegment(title || sourceSlug || "imported");

  return `${category}-${normalized}-${randomUUID().slice(0, 8)}`;
}

function createArchivePathSegment(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || "material";
}

function normalizeText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";

  return (text || fallback).slice(0, 120);
}

function normalizeLongText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";

  return text || fallback;
}

function normalizeImageContentType(contentType: string) {
  const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? "";

  return getMaterialImageExtension(normalized) ? normalized : null;
}

function inferImageContentType(path: string) {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerPath.endsWith(".png")) {
    return "image/png";
  }

  if (lowerPath.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}

function cloneJson(value: unknown) {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}
