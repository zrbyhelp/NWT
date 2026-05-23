import JSZip from "jszip";
import {
  isValidMaterialImageBytes,
  isValidMaterialModelBytes
} from "@/lib/storage/material";
import { MaterialTransferError } from "./errors";
import type {
  MaterialArchiveManifest,
  PreparedImportMaterial
} from "./types";
import {
  normalizeImageContentType,
  validateManifest
} from "./validators";

export async function loadArchive(bytes: ArrayBuffer | Uint8Array) {
  try {
    return await JSZip.loadAsync(bytes);
  } catch {
    throw new MaterialTransferError("INVALID_MATERIAL_ZIP");
  }
}

export async function readManifest(zip: JSZip): Promise<MaterialArchiveManifest> {
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

export async function prepareImportMaterials(zip: JSZip, manifest: MaterialArchiveManifest): Promise<PreparedImportMaterial[]> {
  const preparedMaterials: PreparedImportMaterial[] = [];

  for (const archiveItem of manifest.materials) {
    let imageBytes: Uint8Array | null = null;
    let imageContentType: string | null = null;
    const scenePanoramaFaceImages: PreparedImportMaterial["scenePanoramaFaceImages"] = [];
    const scenePanoramaMotherImages: PreparedImportMaterial["scenePanoramaMotherImages"] = [];
    const itemViewImages: PreparedImportMaterial["itemViewImages"] = [];
    let itemModelInputImage: PreparedImportMaterial["itemModelInputImage"] = null;
    let itemModel: PreparedImportMaterial["itemModel"] = null;

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

    for (const motherAsset of archiveItem.scenePanoramaMothers ?? []) {
      const imageFile = zip.file(motherAsset.image.path);

      if (!imageFile) {
        throw new MaterialTransferError("MATERIAL_IMAGE_REQUIRED");
      }

      const imageBytes = await imageFile.async("uint8array");
      const imageContentType = normalizeImageContentType(motherAsset.image.contentType);

      if (!imageContentType || !isValidMaterialImageBytes(imageBytes, imageContentType)) {
        throw new MaterialTransferError("INVALID_MATERIAL_IMAGE_FILE");
      }

      scenePanoramaMotherImages.push({
        blockId: motherAsset.blockId,
        imageBytes,
        imageContentType
      });
    }

    for (const viewAsset of archiveItem.itemViewImages ?? []) {
      const imageFile = zip.file(viewAsset.image.path);

      if (!imageFile) {
        throw new MaterialTransferError("MATERIAL_IMAGE_REQUIRED");
      }

      const imageBytes = await imageFile.async("uint8array");
      const imageContentType = normalizeImageContentType(viewAsset.image.contentType);

      if (!imageContentType || !isValidMaterialImageBytes(imageBytes, imageContentType)) {
        throw new MaterialTransferError("INVALID_MATERIAL_IMAGE_FILE");
      }

      itemViewImages.push({
        face: viewAsset.face,
        imageBytes,
        imageContentType
      });
    }

    if (archiveItem.itemModelInputImage) {
      const imageFile = zip.file(archiveItem.itemModelInputImage.image.path);

      if (!imageFile) {
        throw new MaterialTransferError("MATERIAL_IMAGE_REQUIRED");
      }

      const imageBytes = await imageFile.async("uint8array");
      const imageContentType = normalizeImageContentType(archiveItem.itemModelInputImage.image.contentType);

      if (!imageContentType || !isValidMaterialImageBytes(imageBytes, imageContentType)) {
        throw new MaterialTransferError("INVALID_MATERIAL_IMAGE_FILE");
      }

      itemModelInputImage = {
        imageBytes,
        imageContentType
      };
    }

    if (archiveItem.itemModel) {
      const modelFile = zip.file(archiveItem.itemModel.path);

      if (!modelFile) {
        throw new MaterialTransferError("MATERIAL_MODEL_REQUIRED");
      }

      const modelBytes = await modelFile.async("uint8array");

      if (!isValidMaterialModelBytes(modelBytes, archiveItem.itemModel.contentType, archiveItem.itemModel.fileName)) {
        throw new MaterialTransferError("INVALID_MATERIAL_MODEL_FILE");
      }

      itemModel = {
        bytes: modelBytes,
        contentType: "model/gltf-binary",
        fileName: archiveItem.itemModel.fileName
      };
    }

    preparedMaterials.push({
      archiveItem,
      imageBytes,
      imageContentType,
      scenePanoramaFaceImages,
      scenePanoramaMotherImages,
      itemViewImages,
      itemModelInputImage,
      itemModel
    });
  }

  return preparedMaterials;
}
