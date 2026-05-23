import type {
  ScenePanoramaColorReport,
  ScenePanoramaMotherQualityReport,
  ScenePanoramaQualityReport
} from "@/lib/ai/scene-panorama-postprocess";
export type { ScenePanoramaMotherQualityReport } from "@/lib/ai/scene-panorama-postprocess";

export const scenePanoramaFaces = ["front", "back", "left", "right", "top", "bottom"] as const;

export type ScenePanoramaFace = (typeof scenePanoramaFaces)[number];

export type ScenePanoramaFaceImage = {
  contentType: string;
  dataUrl: string;
  face: ScenePanoramaFace;
  fileName: string;
};

export type ScenePanoramaGenerationInput = {
  sceneName: string;
  sceneDescription: string;
  blockName: string;
  blockDescription: string;
  blockScaleMeters?: number;
  blockScalePreset?: string;
  panoramaDrawingStyle: string;
  style: string;
  locale: "zh-CN" | "en-US";
};

export type ScenePanoramaColorStatus = "adjusted" | "rejected" | "skipped" | "unchanged";

export type ScenePanoramaSizeProfileId = "4k" | "gpt-image-2" | "legacy";

export type ScenePanoramaGenerationResult = {
  bestAttempt?: number;
  color?: ScenePanoramaColorReport;
  earlyStopped?: boolean;
  faces: Record<ScenePanoramaFace, ScenePanoramaFaceImage>;
  mode: "enhanced" | "direct-cut";
  colorError?: string;
  colorStatus?: ScenePanoramaColorStatus;
  motherQuality?: ScenePanoramaMotherQualityReport;
  motherQualityPassed?: boolean;
  quality?: ScenePanoramaQualityReport;
  qualityBestEffort?: boolean;
  qualityPassed?: boolean;
  repaired: boolean;
  sizeProfile?: ScenePanoramaSizeProfileId;
};

export type ScenePanoramaStreamImage = {
  contentType: string;
  dataUrl: string;
  fileName: string;
};

export type ScenePanoramaMotherGenerationResult = {
  attempt: number;
  mother: ScenePanoramaStreamImage;
  quality: ScenePanoramaMotherQualityReport;
  qualityPassed: boolean;
  sizeProfile?: ScenePanoramaSizeProfileId;
};

export type ScenePanoramaStreamEvent =
  | { type: "progress"; progress: number; stage: string; messageKey: string }
  | { type: "mother"; image: ScenePanoramaStreamImage }
  | {
      type: "motherQuality";
      accepted?: boolean;
      attempt: number;
      bestAttempt?: number;
      passed: boolean;
      quality: ScenePanoramaMotherQualityReport;
      score?: number;
    }
  | {
      type: "motherDone";
      attempt: number;
      image: ScenePanoramaStreamImage;
      quality: ScenePanoramaMotherQualityReport;
      qualityPassed: boolean;
      sizeProfile?: ScenePanoramaSizeProfileId;
    }
  | { type: "face"; attempt: number; face: ScenePanoramaFace; image: ScenePanoramaFaceImage; phase: "preview" | "final" }
  | { type: "iterating"; attempt: number; faces: ScenePanoramaFace[] }
  | {
      type: "quality";
      attempt: number;
      failedFaces: ScenePanoramaFace[];
      passed: boolean;
      quality: ScenePanoramaQualityReport;
      accepted?: boolean;
      bestAttempt?: number;
      score?: number;
    }
  | {
      type: "done";
      bestAttempt?: number;
      color?: ScenePanoramaColorReport;
      colorError?: string;
      colorStatus?: ScenePanoramaColorStatus;
      earlyStopped?: boolean;
      mode: ScenePanoramaGenerationResult["mode"];
      motherQuality?: ScenePanoramaMotherQualityReport;
      motherQualityPassed?: boolean;
      quality?: ScenePanoramaQualityReport;
      qualityBestEffort?: boolean;
      qualityPassed?: boolean;
      repaired: boolean;
      sizeProfile?: ScenePanoramaSizeProfileId;
    };

export type ScenePanoramaStreamCallback = (event: ScenePanoramaStreamEvent) => Promise<void> | void;

export type ScenePanoramaReferenceImage = {
  bytes: Buffer;
  contentType: string;
  fileName: string;
};

export type ScenePanoramaGenerationOptions = {
  motherImage?: ScenePanoramaReferenceImage;
  maxRedrawAttempts?: number;
  referenceImages?: ScenePanoramaReferenceImage[];
};

export type FaceBuffer = {
  bytes: Buffer;
  contentType: string;
  face: ScenePanoramaFace;
  fileName: string;
};

export type ScenePanoramaRepaintResult = {
  bestAttempt: number;
  earlyStopped: boolean;
  faces: FaceBuffer[];
  quality: ScenePanoramaQualityReport;
  qualityPassed: boolean;
  qualityRepairRounds: number;
  qualityRetriedFaces: ScenePanoramaFace[];
  score: number;
};

export type ScenePanoramaSizeProfile = {
  faceEditSize: string;
  faceSize: number;
  id: ScenePanoramaSizeProfileId;
  motherSize: string;
  normalizedHeight: number;
  normalizedWidth: number;
};

export type ImageModelCallPresetId = "doubao" | "gemini" | "openai" | "generic";

export type ImageModelCallTransport = "gemini-native" | "openai-compatible";

export type ImageReferenceEditMode = "auto" | "generation-image-field" | "openai-edits";

export type ImageRequestKind = "maskBoard" | "sceneFace" | "sceneMother";

export type ImageQualityOption = "low" | "medium" | "high" | "auto";

export type GeminiImageRequestOptions = {
  aspectRatio: string;
  imageSize?: "1K" | "2K" | "4K";
};

export type ImageModelCallPreset = {
  id: ImageModelCallPresetId;
  includeGenerateOutputFormat: boolean;
  includeHighFidelityEditOptions: boolean;
  includeResponseFormat: boolean;
  imageQuality?: ImageQualityOption;
  maskBoardSize: string;
  referenceEditMode: ImageReferenceEditMode;
  sceneFaceSize: string;
  sceneMotherSize: string;
  scenePanoramaSizeProfile?: ScenePanoramaSizeProfile;
  transport: ImageModelCallTransport;
  geminiOptions: Record<ImageRequestKind, GeminiImageRequestOptions>;
};

export type ImageRuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  modelId: string;
  providerName: string;
};

export type GeneratedImageBuffer = {
  bytes: Buffer;
  contentType: string;
  fileName: string;
  outputKind: "base64" | "gemini-inline" | "url";
};
