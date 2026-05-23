import {
  Check,
  Clapperboard,
  ClipboardList,
  Download,
  Ghost,
  Loader2,
  MapPinned,
  Maximize2,
  PackageOpen,
  Pencil,
  Plus,
  SendHorizontal,
  Trash2,
  Upload,
  VenetianMask,
  X
} from "lucide-react";
import type {
  ItemDraftPatch,
  ItemMaterialCreateInput,
  SceneDraftPatch,
  SceneMaterialCreateInput,
  WorkspaceConversation,
  WorkspaceData,
  WorkspaceItemMaterialMetadata,
  WorkspaceMaterial,
  WorkspaceMaterialCategory,
  WorkspaceMaterialMetadata,
  WorkspaceMaterialStyle,
  WorkspaceSceneMaterialMetadata,
  WorkspaceSceneScalePreset,
  WorkspaceScript
} from "@/lib/home-workspace";
export type {
  ItemDraftPatch,
  ItemMaterialCreateInput,
  SceneDraftPatch,
  SceneMaterialCreateInput,
  WorkspaceConversation,
  WorkspaceData,
  WorkspaceItemMaterialMetadata,
  WorkspaceMaterial,
  WorkspaceMaterialCategory,
  WorkspaceMaterialMetadata,
  WorkspaceMaterialStyle,
  WorkspaceSceneMaterialMetadata,
  WorkspaceSceneScalePreset,
  WorkspaceScript
} from "@/lib/home-workspace";

export type ViewMode = "scriptPicker" | "scriptManager" | "materialManager" | "chat";
export type ScriptManagerView = "mine" | "community";
export type MaterialManagerView = ScriptManagerView;
export type StreamingReply = {
  content: string;
  conversationId: string;
};
export type MessageStreamEvent =
  | { type: "delta"; content: string }
  | { type: "done"; conversation: WorkspaceConversation }
  | { type: "error"; message: string };
export type ScenePanoramaStreamImage = {
  contentType: string;
  dataUrl: string;
  fileName: string;
};
export type ScenePanoramaStreamFaceImage = ScenePanoramaStreamImage & {
  face: ScenePanoramaFace;
};
export type ScenePanoramaStreamDoneEvent = {
  bestAttempt?: number;
  color?: unknown;
  colorError?: string;
  colorStatus?: "adjusted" | "rejected" | "unchanged" | "skipped";
  earlyStopped?: boolean;
  mode: "enhanced" | "direct-cut";
  motherQuality?: unknown;
  motherQualityPassed?: boolean;
  quality?: unknown;
  qualityBestEffort?: boolean;
  qualityPassed?: boolean;
  repaired: boolean;
  sizeProfile?: string;
  type: "done";
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
      quality: unknown;
      score?: number;
    }
  | {
      type: "motherDone";
      attempt: number;
      image: ScenePanoramaStreamImage;
      quality: unknown;
      qualityPassed: boolean;
      sizeProfile?: string;
    }
  | { type: "face"; attempt: number; face: ScenePanoramaFace; image: ScenePanoramaStreamFaceImage; phase: "preview" | "final" }
  | { type: "iterating"; attempt: number; faces: ScenePanoramaFace[] }
  | {
      type: "quality";
      accepted?: boolean;
      attempt: number;
      bestAttempt?: number;
      failedFaces: ScenePanoramaFace[];
      passed: boolean;
      quality: unknown;
      score?: number;
    }
  | ScenePanoramaStreamDoneEvent
  | { type: "error"; message: string };
export const scriptCategories = ["featured", "world", "roleplay", "writing", "analysis"] as const;
export const materialStyles = ["realistic", "fantasy", "sciFi", "mystery", "cyberpunk", "classical", "apocalyptic"] as const;
export const materialTypes = ["mask", "map", "item", "creature", "scene"] as const;
export const scenePanoramaFaces = ["front", "back", "left", "right", "top", "bottom"] as const;
export const scenePanoramaThreeFaceOrder = ["right", "left", "top", "bottom", "front", "back"] as const;
export const defaultScenePanoramaView = { fov: 70, lat: 0, lon: 0 } as const;
export const minScenePanoramaFov = 35;
export const maxScenePanoramaFov = 95;
export const minScenePanoramaLat = -85;
export const maxScenePanoramaLat = 85;
export const sceneScalePresets = [
  { id: "closeUp", meters: 2 },
  { id: "near", meters: 8 },
  { id: "mid", meters: 25 },
  { id: "wide", meters: 100 },
  { id: "aerial", meters: 500 }
] as const;
export const defaultSceneScalePreset = "mid" satisfies WorkspaceSceneScalePreset;
export const maxSceneReferenceImages = 3;
export const defaultScenePanoramaMaxRedrawAttempts = 1;
export const minScenePanoramaMaxRedrawAttempts = 1;
export const maxScenePanoramaMaxRedrawAttempts = 10;
export const materialIcons = {
  mask: VenetianMask,
  map: MapPinned,
  item: PackageOpen,
  creature: Ghost,
  scene: Clapperboard
} as const;

export type ScenePanoramaView = {
  fov: number;
  lat: number;
  lon: number;
};

export type ScenePanoramaWebglLoadMode = "idle" | "immediate";

export function clampScenePanoramaView(view: Partial<ScenePanoramaView>): ScenePanoramaView {
  return {
    fov: clampScenePanoramaNumber(view.fov, minScenePanoramaFov, maxScenePanoramaFov, defaultScenePanoramaView.fov),
    lat: clampScenePanoramaNumber(view.lat, minScenePanoramaLat, maxScenePanoramaLat, defaultScenePanoramaView.lat),
    lon: normalizeScenePanoramaLon(
      typeof view.lon === "number" && Number.isFinite(view.lon) ? view.lon : defaultScenePanoramaView.lon
    )
  };
}

export function clampScenePanoramaNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;

  return Math.max(min, Math.min(max, numberValue));
}

export function normalizeScenePanoramaLon(lon: number) {
  const normalized = ((((lon + 180) % 360) + 360) % 360) - 180;

  return Object.is(normalized, -0) ? 0 : normalized;
}

export function scheduleScenePanoramaWebglStart(callback: () => void, delayMs = 0) {
  let cancelled = false;
  let frameId: number | null = null;
  let idleId: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const browserWindow = typeof window === "undefined" ? null : window;
  const requestIdle = browserWindow?.requestIdleCallback?.bind(browserWindow);
  const cancelIdle = browserWindow?.cancelIdleCallback?.bind(browserWindow);

  function runWhenIdle() {
    if (cancelled) {
      return;
    }

    if (requestIdle) {
      idleId = requestIdle(
        () => {
          if (!cancelled) {
            callback();
          }
        },
        { timeout: 1200 }
      );

      return;
    }

    if (browserWindow) {
      frameId = browserWindow.requestAnimationFrame(() => {
        if (!cancelled) {
          callback();
        }
      });

      return;
    }

    callback();
  }

  timeoutId = setTimeout(runWhenIdle, Math.max(0, delayMs));

  return () => {
    cancelled = true;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (browserWindow && frameId !== null) {
      browserWindow.cancelAnimationFrame(frameId);
    }

    if (cancelIdle && idleId !== null) {
      cancelIdle(idleId);
    }
  };
}

export async function loadScenePanoramaCubeTexture(THREE: typeof import("three"), urls: string[]) {
  if (typeof window !== "undefined" && "createImageBitmap" in window && typeof THREE.ImageBitmapLoader === "function") {
    const imageBitmaps: ImageBitmap[] = [];

    try {
      const loader = new THREE.ImageBitmapLoader();

      loader.setCrossOrigin("anonymous");
      loader.setOptions({ imageOrientation: "none" });
      for (const url of urls) {
        imageBitmaps.push(await loader.loadAsync(url));
      }
      const texture = new THREE.CubeTexture(imageBitmaps);

      texture.needsUpdate = true;

      return { imageBitmaps, texture };
    } catch {
      imageBitmaps.forEach((image) => image.close());
      // Some object-storage responses do not permit bitmap decoding. Fall back to Three's image loader.
    }
  }

  const loader = new THREE.CubeTextureLoader();

  loader.setCrossOrigin("anonymous");
  const texture = await new Promise<import("three").CubeTexture>((resolve, reject) => {
    loader.load(urls, resolve, undefined, reject);
  });

  return { imageBitmaps: [] as ImageBitmap[], texture };
}

export async function loadSceneEquirectangularTexture(THREE: typeof import("three"), imageUrl: string) {
  if (typeof window !== "undefined" && "createImageBitmap" in window && typeof THREE.ImageBitmapLoader === "function") {
    try {
      const loader = new THREE.ImageBitmapLoader();

      loader.setCrossOrigin("anonymous");
      loader.setOptions({ imageOrientation: "flipY" });
      const imageBitmap = await loader.loadAsync(imageUrl);
      const texture = new THREE.Texture(imageBitmap);

      texture.needsUpdate = true;

      return { imageBitmap, texture };
    } catch {
      // Fall back when the browser cannot decode this URL as an ImageBitmap.
    }
  }

  const loader = new THREE.TextureLoader();

  loader.setCrossOrigin("anonymous");

  return { imageBitmap: null as ImageBitmap | null, texture: await loader.loadAsync(imageUrl) };
}
export const scriptPickerPageSize = 6;
export const maskBodyFields = [
  { id: "hairStyle", options: ["short", "long", "tied", "wavy", "curly", "buzz"] },
  { id: "browShape", options: ["straight", "arched", "sword", "soft", "thick", "thin"] },
  { id: "faceShape", options: ["oval", "round", "square", "heart", "long", "sharp"] },
  { id: "eyeShape", options: ["almond", "round", "phoenix", "narrow", "drooping", "deepSet"] },
  { id: "noseType", options: ["straight", "highBridge", "small", "broad", "hooked", "roundTip"] },
  { id: "mouthShape", options: ["thin", "full", "bow", "wide", "small", "firm"] },
  { id: "earShape", options: ["round", "pointed", "small", "broad", "long", "hidden"] },
  { id: "height", unit: "cm", options: [] },
  { id: "weight", unit: "kg", options: [] },
  { id: "gender", options: ["female", "male", "androgynous", "nonbinary"] },
  { id: "ageStage", options: ["child", "youth", "adult", "elder"] },
  { id: "bodyType", options: ["slim", "athletic", "soft", "sturdy", "graceful", "imposing"] }
] as const;
export const maskColorFields = [
  { id: "hairColor", swatches: ["#1F1A17", "#5C4033", "#C7C7C7", "#F2F0E8", "#8A2E24", "#C99B3D"] },
  { id: "eyeColor", swatches: ["#1B1B1D", "#5B3823", "#C9822B", "#3F7A4B", "#3D6EA8", "#8B9198"] },
  { id: "browColor", swatches: ["#1F1A17", "#5C4033", "#C7C7C7", "#8A2E24"] },
  { id: "skinColor", swatches: ["#F3D7BD", "#D8AA78", "#B77955", "#7A4B37", "#F1E3D3", "#C8A47E"] }
] as const;
export const maskVoiceFields = [
  { id: "pitch", min: 0, max: 100, defaultValue: 50 },
  { id: "speechSpeed", min: 80, max: 220, defaultValue: 150 },
  { id: "volume", min: 0, max: 100, defaultValue: 50 },
  { id: "intonation", min: 0, max: 100, defaultValue: 50 },
  { id: "emotionExposure", min: 0, max: 100, defaultValue: 50 },
  { id: "nasalResonance", min: 0, max: 100, defaultValue: 50 },
  { id: "breathiness", min: 0, max: 100, defaultValue: 50 }
] as const;
export const maskPersonalityGroups = [
  { id: "basic", fields: ["extroversion", "dominance", "rationality", "emotionalStability", "confidence"] },
  { id: "social", fields: ["affinity", "sharingDesire", "humor", "aggression", "politeness"] },
  { id: "emotion", fields: ["coquetry", "sensitivity", "possessiveness", "dependency"] },
  { id: "relationship", fields: ["proactiveCare", "boundaries", "loyalty"] },
  { id: "behavior", fields: ["action", "curiosity", "performative"] }
] as const;
export const maskBoardDrawingStyles = ["photo", "realistic", "anime", "painterly", "cel", "guofeng", "comic", "concept"] as const;
export const itemTagFields = ["traits", "uses", "functions", "materials", "colors", "styles", "keywords"] as const;
export type MaskBodyFieldId = (typeof maskBodyFields)[number]["id"];
export type MaskColorFieldId = (typeof maskColorFields)[number]["id"];
export type MaskVoiceFieldId = (typeof maskVoiceFields)[number]["id"];
export type MaskPersonalityFieldId = (typeof maskPersonalityGroups)[number]["fields"][number];
export type MaskBoardDrawingStyle = (typeof maskBoardDrawingStyles)[number];
export type ScenePanoramaDrawingStyle = MaskBoardDrawingStyle;
export type SceneReferenceImageDraft = {
  id: string;
  file: File;
  previewUrl: string;
};
export type MaskCreateDraft = {
  name: string;
  intro: string;
  features: string;
  style: WorkspaceMaterialStyle;
  body: Record<MaskBodyFieldId, string>;
  colors: Record<MaskColorFieldId, string>;
  voice: Record<MaskVoiceFieldId, number>;
  personality: Record<MaskPersonalityFieldId, number>;
  boardDrawingStyle: MaskBoardDrawingStyle;
  boardImagePreviewUrl: string;
  boardImageFile: File | null;
  boardImageSource: MaskBoardImageSource;
  aiMessages: MaskAiMessage[];
};
export type MaskBoardImageSource = "uploaded" | "generated" | null;
export type MaskAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
export type MaskDraftPatch = {
  name?: string;
  intro?: string;
  features?: string;
  style?: WorkspaceMaterialStyle;
  body?: Partial<Record<MaskBodyFieldId, string>>;
  colors?: Partial<Record<MaskColorFieldId, string>>;
  voice?: Partial<Record<MaskVoiceFieldId, number>>;
  personality?: Partial<Record<MaskPersonalityFieldId, number>>;
};
export type ScenePanoramaFace = (typeof scenePanoramaFaces)[number];
export type ItemViewFace = ScenePanoramaFace;
export type ItemTagFieldId = "traits" | "uses" | "functions" | "materials" | "colors" | "styles" | "keywords";
export type ItemViewImageDraft = {
  file: File | null;
  previewUrl: string;
  source: "generated" | "uploaded" | "existing";
  storedUrl: string | null;
};
export type ItemModelInputImageDraft = ItemViewImageDraft;
export type ItemModelDraft = {
  byteSize?: number;
  contentType?: string;
  fileName?: string;
  source: "instantmesh" | "uploaded";
  url: string;
} | null;
export type ItemCreateDraft = {
  name: string;
  itemCategory: string;
  description: string;
  traits: string[];
  uses: string[];
  functions: string[];
  materials: string[];
  colors: string[];
  styles: string[];
  brand: string;
  model: string;
  keywords: string[];
  scaleHint: string;
  style: WorkspaceMaterialStyle;
  boardDrawingStyle: MaskBoardDrawingStyle;
  boardImagePreviewUrl: string;
  boardImageFile: File | null;
  boardImageSource: MaskBoardImageSource;
  modelInputImage: ItemModelInputImageDraft | null;
  viewImages: Partial<Record<ItemViewFace, ItemViewImageDraft>>;
  model3d: ItemModelDraft;
  modelExtraParams: string;
  aiMessages: MaskAiMessage[];
};
export type ItemModelProgress = {
  messageKey: string;
  progress: number;
};
export type ItemModelStreamEvent =
  | { type: "progress"; stage: string; messageKey: string; progress: number }
  | { type: "done"; byteSize: number; contentType: string; fileName: string; url: string }
  | { type: "error"; message: string };
export type ScenePanoramaFaceDraft = {
  file: File | null;
  previewUrl: string;
  source: "uploaded" | "generated" | "existing" | "direct-cut" | "reference-repaint";
  storedUrl: string | null;
};
export type ScenePanoramaMotherDraft = {
  file: File | null;
  previewUrl: string;
  qualityPassed?: boolean;
  source: "generated" | "uploaded" | "existing";
  storedUrl: string | null;
};
export type ScenePanoramaDraft = {
  faceSource: "uploaded" | "generated" | "direct-cut" | "reference-repaint";
  faces: Partial<Record<ScenePanoramaFace, ScenePanoramaFaceDraft>>;
  mother: ScenePanoramaMotherDraft | null;
};
export type ScenePanoramaGenerationDraft = {
  completed: boolean;
  error: string | null;
  faces: Partial<Record<ScenePanoramaFace, ScenePanoramaStreamFaceImage>>;
  finalFaces: Partial<Record<ScenePanoramaFace, ScenePanoramaStreamFaceImage>>;
  iteratingFaces: ScenePanoramaFace[];
  messageKey: string;
  motherImage: ScenePanoramaStreamImage | null;
  progress: number;
  stage: string;
};
export type SceneBlockDraft = {
  id: string;
  name: string;
  description: string;
  referenceImages: SceneReferenceImageDraft[];
  scalePreset: WorkspaceSceneScalePreset;
  panorama: ScenePanoramaDraft | null;
};
export type SceneCreateDraft = {
  name: string;
  description: string;
  style: WorkspaceMaterialStyle;
  panoramaDrawingStyle: ScenePanoramaDrawingStyle;
  blocks: SceneBlockDraft[];
};
export type SceneAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
export const maskBoardAcceptedTypes = ["image/jpeg", "image/png", "image/webp"];
export const maxMaskBoardImageBytes = 10 * 1024 * 1024;
export const scenePanoramaAcceptedTypes = maskBoardAcceptedTypes;
export const maxScenePanoramaFaceBytes = 10 * 1024 * 1024;
