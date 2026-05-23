import type {
  GeminiImageRequestOptions,
  ImageModelCallPreset,
  ImageRequestKind,
  ScenePanoramaSizeProfile
} from "./types";

export const scenePanoramaDefaultSizeProfile: ScenePanoramaSizeProfile = {
  faceEditSize: "4096x4096",
  faceSize: 4096,
  id: "4k",
  motherSize: "4096x2048",
  normalizedHeight: 2048,
  normalizedWidth: 4096
};

export const scenePanoramaGptImage2SizeProfile: ScenePanoramaSizeProfile = {
  faceEditSize: "2880x2880",
  faceSize: 2880,
  id: "gpt-image-2",
  motherSize: "3840x1920",
  normalizedHeight: 1920,
  normalizedWidth: 3840
};

export const maskBoardTargetResolution = "3840x2160";

export const geminiDefaultImageOptions: Record<ImageRequestKind, GeminiImageRequestOptions> = {
  maskBoard: { aspectRatio: "16:9", imageSize: "4K" },
  sceneFace: { aspectRatio: "1:1", imageSize: "4K" },
  sceneMother: { aspectRatio: "21:9", imageSize: "4K" }
};

export const genericImageCallPreset: ImageModelCallPreset = {
  id: "generic",
  geminiOptions: geminiDefaultImageOptions,
  includeGenerateOutputFormat: false,
  includeHighFidelityEditOptions: false,
  includeResponseFormat: true,
  maskBoardSize: maskBoardTargetResolution,
  referenceEditMode: "auto",
  sceneFaceSize: scenePanoramaDefaultSizeProfile.faceEditSize,
  sceneMotherSize: scenePanoramaDefaultSizeProfile.motherSize,
  transport: "openai-compatible"
};

export const doubaoImageCallPreset: ImageModelCallPreset = {
  ...genericImageCallPreset,
  id: "doubao",
  referenceEditMode: "generation-image-field"
};

export const geminiOpenAICompatibleImageCallPreset: ImageModelCallPreset = {
  ...genericImageCallPreset,
  id: "gemini",
  referenceEditMode: "generation-image-field"
};

export const defaultScenePanoramaMaxRedrawAttempts = 1;
export const maxScenePanoramaMaxRedrawAttempts = 10;
export const minScenePanoramaMaxRedrawAttempts = 1;
export const maxAllowedScenePanoramaEdgeDelta = 18;
export const maxAllowedScenePanoramaInnerBandDelta = 28;
export const maxScenePanoramaFaceRequestAttempts = 3;
export const scenePanoramaFaceRetryBaseDelayMs = 600;
