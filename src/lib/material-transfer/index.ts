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
  downloadItemModel,
  downloadItemModelInputImage,
  downloadItemViewImages,
  downloadMaterialImage,
  downloadScenePanoramaFaces,
  downloadScenePanoramaMothers
} from "./assets";
import { MaterialTransferError } from "./errors";
import {
  loadArchive,
  prepareImportMaterials,
  readManifest
} from "./import";
import { formatMaterialMarkdown } from "./markdown";
import {
  getImportedItemPreviewUrl,
  getImportedScenePreviewUrl,
  updateImportedMetadataImage
} from "./metadata";
import {
  archiveFormat,
  archiveVersion,
  selfCreatedSource,
  type MaterialArchiveItem,
  type MaterialArchiveManifest,
  type ScenePanoramaFace,
  type UploadedImportMaterial
} from "./types";
import {
  createArchivePathSegment,
  normalizeLongText,
  normalizeText
} from "./validators";
import {
  uploadItemModelBytes,
  uploadMaterialImageBytes
} from "@/lib/storage/material";
import type {
  WorkspaceMaterial,
  WorkspaceMaterialCategory,
  WorkspaceMaterialLibrarySource,
  WorkspaceMaterialMetadata,
  WorkspaceMaterialStyle
} from "@/lib/home-workspace";

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

export { MaterialTransferError };

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
    const sceneMothers = await downloadScenePanoramaMothers(record.metadata, pathSlug, origin);
    const itemModelInputImage = await downloadItemModelInputImage(record.metadata, pathSlug, origin);
    const itemViews = await downloadItemViewImages(record.metadata, pathSlug, origin);
    const itemModel = await downloadItemModel(record.metadata, pathSlug, origin);
    const image = sceneFaces.length === 0 && sceneMothers.length === 0 && record.previewUrl ? await downloadMaterialImage(record.previewUrl, origin) : null;
    const imageFileName = image ? `preview.${image.extension}` : "";
    const imagePath = image ? `materials/${pathSlug}/images/${imageFileName}` : "";

    if (image && imagePath) {
      zip.file(imagePath, image.bytes);
    }

    sceneFaces.forEach((asset) => {
      zip.file(asset.image.path, asset.bytes);
    });
    sceneMothers.forEach((asset) => {
      zip.file(asset.image.path, asset.bytes);
    });
    if (itemModelInputImage) {
      zip.file(itemModelInputImage.image.path, itemModelInputImage.bytes);
    }
    itemViews.forEach((asset) => {
      zip.file(asset.image.path, asset.bytes);
    });
    if (itemModel) {
      zip.file(itemModel.model.path, itemModel.bytes);
    }

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
      itemModelInputImage: itemModelInputImage ? { image: itemModelInputImage.image } : null,
      itemViewImages: itemViews.map((asset) => ({
        face: asset.face,
        image: asset.image
      })),
      itemModel: itemModel?.model ?? null,
      scenePanoramaFaces: sceneFaces.map((asset) => ({
        blockId: asset.blockId,
        face: asset.face,
        image: asset.image
      })),
      scenePanoramaMothers: sceneMothers.map((asset) => ({
        blockId: asset.blockId,
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
    const scenePanoramaMotherUrls = await Promise.all(
      prepared.scenePanoramaMotherImages.map(async (motherImage) => ({
        blockId: motherImage.blockId,
        url: await uploadMaterialImageBytes(viewer.id, motherImage.imageBytes, motherImage.imageContentType, "imports")
      }))
    );
    const itemViewImageUrls = await Promise.all(
      prepared.itemViewImages.map(async (viewImage) => ({
        face: viewImage.face,
        url: await uploadMaterialImageBytes(viewer.id, viewImage.imageBytes, viewImage.imageContentType, "item-views")
      }))
    );
    const itemModelInputImageUrl = prepared.itemModelInputImage
      ? await uploadMaterialImageBytes(
          viewer.id,
          prepared.itemModelInputImage.imageBytes,
          prepared.itemModelInputImage.imageContentType,
          "item-model-inputs"
        )
      : null;
    const itemModel = prepared.itemModel
      ? {
          byteSize: prepared.itemModel.bytes.byteLength,
          contentType: prepared.itemModel.contentType,
          fileName: prepared.itemModel.fileName,
          url: await uploadItemModelBytes(viewer.id, prepared.itemModel.bytes, prepared.itemModel.contentType, prepared.itemModel.fileName)
        }
      : null;

    uploadedMaterials.push({
      ...prepared,
      previewUrl:
        getImportedScenePreviewUrl(prepared.archiveItem.metadata, scenePanoramaFaceUrls, scenePanoramaMotherUrls) ??
        getImportedItemPreviewUrl(prepared.archiveItem.metadata, previewUrl, itemModelInputImageUrl, itemViewImageUrls) ??
        previewUrl,
      scenePanoramaFaceUrls,
      scenePanoramaMotherUrls,
      itemViewImageUrls,
      itemModelInputImageUrl,
      itemModel,
      metadata: updateImportedMetadataImage(
        prepared.archiveItem.metadata,
        previewUrl,
        scenePanoramaFaceUrls,
        scenePanoramaMotherUrls,
        itemViewImageUrls,
        itemModelInputImageUrl,
        itemModel
      )
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
          communityVisible: true,
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
    communityVisible:
      typeof material.communityVisible === "boolean"
        ? material.communityVisible
        : true,
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

function createImportedMaterialSlug(category: WorkspaceMaterialCategory, title: string, sourceSlug: string) {
  const normalized = createArchivePathSegment(title || sourceSlug || "imported");

  return `${category}-${normalized}-${randomUUID().slice(0, 8)}`;
}

function cloneJson(value: unknown) {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}
