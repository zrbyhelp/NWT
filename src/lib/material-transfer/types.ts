import type {
  WorkspaceMaterialCategory,
  WorkspaceMaterialLibrarySource,
  WorkspaceMaterialStyle
} from "@/lib/home-workspace";

export const archiveFormat = "nwt.materials";
export const archiveVersion = 1;
export const selfCreatedSource = "SELF_CREATED" satisfies WorkspaceMaterialLibrarySource;
export const scenePanoramaFaces = ["front", "back", "left", "right", "top", "bottom"] as const;

export type ScenePanoramaFace = (typeof scenePanoramaFaces)[number];

export type MaterialArchiveImage = {
  path: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

export type MaterialArchiveScenePanoramaFace = {
  blockId: string;
  face: ScenePanoramaFace;
  image: MaterialArchiveImage;
};

export type MaterialArchiveScenePanoramaMother = {
  blockId: string;
  image: MaterialArchiveImage;
};

export type MaterialArchiveItemViewImage = {
  face: ScenePanoramaFace;
  image: MaterialArchiveImage;
};

export type MaterialArchiveItemModelInputImage = {
  image: MaterialArchiveImage;
};

export type MaterialArchiveItemModel = {
  path: string;
  fileName: string;
  contentType: "model/gltf-binary";
  byteSize: number;
};

export type MaterialArchiveItem = {
  slug: string;
  category: WorkspaceMaterialCategory;
  style: WorkspaceMaterialStyle;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  metadata: unknown;
  image: MaterialArchiveImage | null;
  itemModelInputImage?: MaterialArchiveItemModelInputImage | null;
  itemViewImages?: MaterialArchiveItemViewImage[];
  itemModel?: MaterialArchiveItemModel | null;
  scenePanoramaFaces?: MaterialArchiveScenePanoramaFace[];
  scenePanoramaMothers?: MaterialArchiveScenePanoramaMother[];
};

export type MaterialArchiveManifest = {
  format: typeof archiveFormat;
  version: typeof archiveVersion;
  exportedAt: string;
  materials: MaterialArchiveItem[];
};

export type PreparedImportMaterial = {
  archiveItem: MaterialArchiveItem;
  imageBytes: Uint8Array | null;
  imageContentType: string | null;
  scenePanoramaFaceImages: Array<{
    blockId: string;
    face: ScenePanoramaFace;
    imageBytes: Uint8Array;
    imageContentType: string;
  }>;
  scenePanoramaMotherImages: Array<{
    blockId: string;
    imageBytes: Uint8Array;
    imageContentType: string;
  }>;
  itemViewImages: Array<{
    face: ScenePanoramaFace;
    imageBytes: Uint8Array;
    imageContentType: string;
  }>;
  itemModelInputImage: {
    imageBytes: Uint8Array;
    imageContentType: string;
  } | null;
  itemModel: {
    bytes: Uint8Array;
    contentType: "model/gltf-binary";
    fileName: string;
  } | null;
};

export type UploadedImportMaterial = Omit<PreparedImportMaterial, "itemModel" | "itemModelInputImage"> & {
  previewUrl: string | null;
  scenePanoramaFaceUrls: Array<{
    blockId: string;
    face: ScenePanoramaFace;
    url: string;
  }>;
  scenePanoramaMotherUrls: Array<{
    blockId: string;
    url: string;
  }>;
  itemViewImageUrls: Array<{
    face: ScenePanoramaFace;
    url: string;
  }>;
  itemModelInputImageUrl: string | null;
  itemModel: {
    byteSize: number;
    contentType: "model/gltf-binary";
    fileName: string;
    url: string;
  } | null;
  metadata: unknown;
};
