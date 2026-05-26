import type {
  ScenePanoramaFace,
  ScenePanoramaGenerationResult,
  ScenePanoramaMotherGenerationResult,
  ScenePanoramaStreamCallback
} from "@/lib/ai/image-runtime";
import type { AuthViewer } from "@/lib/auth-types";

export type WorkspaceScript = {
  id: string;
  slug: string;
  category: "featured" | "world" | "roleplay" | "writing" | "analysis";
  title: string;
  description: string;
  welcome: string;
  inLibrary: boolean;
  librarySource?: WorkspaceScriptLibrarySource;
};

export type WorkspaceScriptLibrarySource = "SELF_CREATED" | "COMMUNITY_ADDED";

export type WorkspaceMaterialCategory = "mask" | "map" | "item" | "creature" | "scene";

export type WorkspaceMaterialStyle =
  | "realistic"
  | "fantasy"
  | "sciFi"
  | "mystery"
  | "cyberpunk"
  | "classical"
  | "apocalyptic";

export type WorkspaceMaterialLibrarySource = WorkspaceScriptLibrarySource;

export type WorkspaceMaterial = {
  id: string;
  slug: string;
  category: WorkspaceMaterialCategory;
  style: WorkspaceMaterialStyle;
  title: string;
  description: string;
  previewUrl: string | null;
  metadata?: WorkspaceMaterialMetadata | null;
  communityVisible: boolean;
  inLibrary: boolean;
  librarySource?: WorkspaceMaterialLibrarySource;
};

export type MaskDraftPatch = {
  name?: string;
  intro?: string;
  features?: string;
  style?: WorkspaceMaterialStyle;
  body?: Partial<Record<WorkspaceMaskBodyFieldId, string>>;
  colors?: Partial<Record<WorkspaceMaskColorFieldId, string>>;
  voice?: Partial<Record<WorkspaceMaskVoiceFieldId, number>>;
  personality?: Partial<Record<WorkspaceMaskPersonalityFieldId, number>>;
};

export type MaskAiAssistResult = {
  message: string;
  patch: MaskDraftPatch;
};

export type CreatureDraftPatch = {
  name?: string;
  description?: string;
  style?: WorkspaceMaterialStyle;
  taxonomy?: Partial<Record<WorkspaceCreatureTaxonomyFieldId, string>>;
  morphology?: Partial<Record<WorkspaceCreatureMorphologyFieldId, string>>;
  colors?: Partial<Record<WorkspaceCreatureColorFieldId, string>>;
  vocalization?: Partial<Record<WorkspaceCreatureVocalizationFieldId, number>>;
  senses?: Partial<Record<WorkspaceCreatureSenseFieldId, number>>;
  ecology?: Partial<Record<WorkspaceCreatureEcologyFieldId, string>>;
  abilities?: Partial<Record<WorkspaceCreatureAbilityFieldId, string[]>>;
  behaviorLogic?: string;
  behavior?: Partial<Record<WorkspaceCreatureBehaviorFieldId, number>>;
};

export type CreatureAiAssistResult = {
  message: string;
  patch: CreatureDraftPatch;
};

export type MaskBoardGenerationResult = {
  contentType: string;
  dataUrl: string;
  fileName: string;
};

export type CreatureBoardGenerationResult = MaskBoardGenerationResult;

export type ItemViewFace = ScenePanoramaFace;

export type ItemViewImageResult = {
  contentType: string;
  dataUrl: string;
  face: ItemViewFace;
  fileName: string;
};

export type ItemBoardGenerationResult = MaskBoardGenerationResult;

export type ItemModelInputImageResult = {
  contentType: string;
  dataUrl: string;
  fileName: string;
};

export type ItemViewsGenerationResult = {
  images: Record<ItemViewFace, ItemViewImageResult>;
};

export type ItemModelInputImageGenerationResult = {
  image: ItemModelInputImageResult;
};

export type MaskMaterialCreateInput = {
  name: string;
  intro: string;
  features: string;
  communityVisible?: boolean;
  style: WorkspaceMaterialStyle;
  body: Record<WorkspaceMaskBodyFieldId, string>;
  colors: Record<WorkspaceMaskColorFieldId, string>;
  voice: Record<WorkspaceMaskVoiceFieldId, number>;
  personality: Record<WorkspaceMaskPersonalityFieldId, number>;
  boardDrawingStyle?: WorkspaceMaskBoardDrawingStyle;
  boardImageSource?: "uploaded" | "generated" | null;
};

export type CreatureMaterialCreateInput = {
  name: string;
  description: string;
  communityVisible?: boolean;
  style: WorkspaceMaterialStyle;
  taxonomy: Record<WorkspaceCreatureTaxonomyFieldId, string>;
  morphology: Record<WorkspaceCreatureMorphologyFieldId, string>;
  colors: Record<WorkspaceCreatureColorFieldId, string>;
  vocalization: Record<WorkspaceCreatureVocalizationFieldId, number>;
  senses: Record<WorkspaceCreatureSenseFieldId, number>;
  ecology: Record<WorkspaceCreatureEcologyFieldId, string>;
  abilities: Record<WorkspaceCreatureAbilityFieldId, string[]>;
  behaviorLogic: string;
  behavior: Record<WorkspaceCreatureBehaviorFieldId, number>;
  boardDrawingStyle?: WorkspaceMaskBoardDrawingStyle;
  boardImageSource?: "uploaded" | "generated" | null;
};

export type SceneMaterialCreateInput = {
  name: string;
  description: string;
  communityVisible?: boolean;
  style: WorkspaceMaterialStyle;
  panoramaDrawingStyle?: WorkspaceScenePanoramaDrawingStyle;
  blocks: SceneMaterialBlockInput[];
};

export type ItemMaterialCreateInput = {
  name: string;
  itemCategory: string;
  description: string;
  communityVisible?: boolean;
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
  boardDrawingStyle?: WorkspaceMaskBoardDrawingStyle;
  boardImageSource?: "uploaded" | "generated" | null;
  modelInputImage?: { source: "generated" | "uploaded"; url?: string } | null;
  viewImages?: Partial<Record<ItemViewFace, { source: "generated" | "uploaded"; url?: string }>>;
  model3d?: {
    byteSize?: number;
    contentType?: string;
    fileName?: string;
    source: "instantmesh" | "uploaded";
    url: string;
  } | null;
};

export type WorkspaceMapMaterialNodeType =
  | "country"
  | "region"
  | "city"
  | "village"
  | "landmark"
  | "path";

export type WorkspaceMapMaterialRelationType =
  | "contains"
  | "belongs_to"
  | "adjacent"
  | "connects"
  | "through"
  | "north_of"
  | "south_of"
  | "east_of"
  | "west_of";

export type WorkspaceMapMaterialNode = {
  id: string;
  type: WorkspaceMapMaterialNodeType;
  name: string;
  description: string;
  x: number;
  y: number;
};

export type WorkspaceMapMaterialEdge = {
  id: string;
  relation: WorkspaceMapMaterialRelationType;
  source: string;
  target: string;
  description: string;
};

export type WorkspaceMapMaterialImageSource = "generated" | "uploaded";

export type WorkspaceMapMaterialImage = {
  source: WorkspaceMapMaterialImageSource;
  url: string;
  nodeBatchSize?: number;
  iterationCount?: number;
  nodeCount?: number;
  edgeCount?: number;
  graphSignature?: string;
  referencePrompt?: string;
  generatedAt?: string;
};

export type WorkspaceMapGeoJsonPosition = [number, number];

export type WorkspaceMapGeoJsonGeometry =
  | {
      type: "Point";
      coordinates: WorkspaceMapGeoJsonPosition;
    }
  | {
      type: "LineString";
      coordinates: WorkspaceMapGeoJsonPosition[];
    }
  | {
      type: "Polygon";
      coordinates: WorkspaceMapGeoJsonPosition[][];
    };

export type WorkspaceMapGeoJsonFeature = {
  type: "Feature";
  id: string;
  geometry: WorkspaceMapGeoJsonGeometry;
  properties: {
    id: string;
    name: string;
    description?: string;
    featureKind: "area" | "route" | "place" | "relation";
    nodeId?: string;
    edgeId?: string;
    nodeType?: WorkspaceMapMaterialNodeType;
    relationType?: WorkspaceMapMaterialRelationType;
    parentId?: string;
    sourceNodeId?: string;
    targetNodeId?: string;
    level: number;
    radiusKm?: number;
  };
};

export type WorkspaceMapGeoJsonFeatureCollection = {
  type: "FeatureCollection";
  bbox: [number, number, number, number];
  features: WorkspaceMapGeoJsonFeature[];
};

export type WorkspaceMapGeoJsonScale = {
  unit: "km";
  widthKm: number;
  heightKm: number;
  metersPerUnit: number;
};

export type WorkspaceMapMaterialGeoJson = {
  source: "algorithm";
  data: WorkspaceMapGeoJsonFeatureCollection;
  scale: WorkspaceMapGeoJsonScale;
  graphSignature: string;
  nodeCount: number;
  edgeCount: number;
  generatedAt: string;
  outlineBased?: boolean;
};

export type MapMaterialCreateInput = {
  name: string;
  description: string;
  communityVisible?: boolean;
  style: WorkspaceMaterialStyle;
  nodes: WorkspaceMapMaterialNode[];
  edges: WorkspaceMapMaterialEdge[];
};

export type MapDraftPatch = {
  name?: string;
  description?: string;
  communityVisible?: boolean;
  style?: WorkspaceMaterialStyle;
  addNodes?: Array<{
    id?: string;
    type?: WorkspaceMapMaterialNodeType;
    name: string;
    description: string;
    x?: number;
    y?: number;
  }>;
  updateNodes?: Array<{
    id: string;
    type?: WorkspaceMapMaterialNodeType;
    name?: string;
    description?: string;
    x?: number;
    y?: number;
  }>;
  removeNodeIds?: string[];
  addEdges?: Array<{
    id?: string;
    relation?: WorkspaceMapMaterialRelationType;
    source: string;
    target: string;
    description?: string;
  }>;
  updateEdges?: Array<{
    id: string;
    relation?: WorkspaceMapMaterialRelationType;
    source?: string;
    target?: string;
    description?: string;
  }>;
  removeEdgeIds?: string[];
};

export type MapCreateDraft = MapMaterialCreateInput & {
  communityVisible: boolean;
};

export type MapAiAssistResult = {
  message: string;
  patch: MapDraftPatch;
};

export type MapImageMetaInput = Omit<WorkspaceMapMaterialImage, "url"> & {
  url?: string;
};

export type MapGeoJsonMetaInput = WorkspaceMapMaterialGeoJson;

export type MapImageStreamImage = {
  contentType: string;
  dataUrl: string;
  fileName: string;
};

export type MapImageStreamDoneEvent = {
  edgeCount: number;
  graphSignature: string;
  image: MapImageStreamImage;
  iterationCount: number;
  nodeBatchSize: number;
  nodeCount: number;
  referencePrompt?: string;
  type: "done";
};

export type MapImageStreamEvent =
  | {
      type: "progress";
      progress: number;
      round: number;
      totalRounds: number;
      stage: "queued" | "generating" | "retrying";
      attempt?: number;
      messageKey: string;
      relationSummary?: string;
    }
  | {
      type: "image";
      completedNodeIds: string[];
      image: MapImageStreamImage;
      progress: number;
      relationSummary: string;
      round: number;
      totalRounds: number;
    }
  | {
      type: "paused";
      completedNodeIds: string[];
      failedRound: number;
      image?: MapImageStreamImage;
      message: string;
      progress: number;
      relationSummary?: string;
      round: number;
      totalRounds: number;
    }
  | MapImageStreamDoneEvent
  | { type: "error"; message: string };

export type MapImageStreamHandler = (event: MapImageStreamEvent) => Promise<void> | void;

export type ItemDraftPatch = Partial<Pick<
  ItemMaterialCreateInput,
  | "brand"
  | "colors"
  | "description"
  | "functions"
  | "itemCategory"
  | "keywords"
  | "materials"
  | "model"
  | "name"
  | "scaleHint"
  | "styles"
  | "style"
  | "traits"
  | "uses"
>>;

export type ItemAiAssistResult = {
  message: string;
  patch: ItemDraftPatch;
};

export type SceneMaterialBlockInput = {
  id: string;
  name: string;
  description: string;
  scalePreset?: WorkspaceSceneScalePreset;
  panorama: SceneMaterialPanoramaInput | null;
};

export type SceneMaterialPanoramaInput = {
  faceSource: "uploaded" | "generated" | "direct-cut" | "reference-repaint";
  faces?: Partial<Record<ScenePanoramaFace, string>>;
  mother?: {
    source: "generated" | "uploaded";
    url: string;
  } | null;
};

export type SceneDraftPatch = {
  name?: string;
  description?: string;
  style?: WorkspaceMaterialStyle;
  addBlocks?: Array<{
    id?: string;
    name: string;
    description: string;
    scalePreset?: WorkspaceSceneScalePreset;
  }>;
  updateBlocks?: Array<{
    id: string;
    name?: string;
    description?: string;
    scalePreset?: WorkspaceSceneScalePreset;
  }>;
  removeBlockIds?: string[];
};

export type SceneAiAssistResult = {
  message: string;
  patch: SceneDraftPatch;
};

export type SceneAssistReferenceImage = {
  contentType: string;
  dataUrl: string;
  fileName: string;
  byteSize: number;
};

export type ScenePanoramaGenerationState = ScenePanoramaGenerationResult;
export type ScenePanoramaMotherGenerationState = ScenePanoramaMotherGenerationResult;
export type ScenePanoramaStreamHandler = ScenePanoramaStreamCallback;

export type WorkspaceMaskBoardDrawingStyle =
  | "photo"
  | "realistic"
  | "anime"
  | "painterly"
  | "cel"
  | "guofeng"
  | "comic"
  | "concept";
export type WorkspaceScenePanoramaDrawingStyle = WorkspaceMaskBoardDrawingStyle;
export type WorkspaceSceneScalePreset = "closeUp" | "near" | "mid" | "wide" | "aerial";

export type WorkspaceMaskBodyFieldId =
  | "hairStyle"
  | "browShape"
  | "faceShape"
  | "eyeShape"
  | "noseType"
  | "mouthShape"
  | "earShape"
  | "height"
  | "weight"
  | "gender"
  | "ageStage"
  | "bodyType";

export type WorkspaceMaskColorFieldId = "hairColor" | "eyeColor" | "browColor" | "skinColor";
export type WorkspaceMaskBoardImageSource = "uploaded" | "generated";
export type WorkspaceMaskVoiceFieldId =
  | "pitch"
  | "speechSpeed"
  | "volume"
  | "intonation"
  | "emotionExposure"
  | "nasalResonance"
  | "breathiness";
export type WorkspaceMaskPersonalityFieldId =
  | "extroversion"
  | "dominance"
  | "rationality"
  | "emotionalStability"
  | "confidence"
  | "affinity"
  | "sharingDesire"
  | "humor"
  | "aggression"
  | "politeness"
  | "coquetry"
  | "sensitivity"
  | "possessiveness"
  | "dependency"
  | "proactiveCare"
  | "boundaries"
  | "loyalty"
  | "action"
  | "curiosity"
  | "performative";

export type WorkspaceCreatureTaxonomyFieldId = "creatureType";
export type WorkspaceCreatureMorphologyFieldId =
  | "sizeClass"
  | "length"
  | "weight"
  | "limbStructure"
  | "bodyCovering"
  | "headFeature"
  | "tailAppendage"
  | "movement"
  | "specialOrgans";
export type WorkspaceCreatureColorFieldId = "primaryColor" | "secondaryColor" | "markingColor" | "glowColor";
export type WorkspaceCreatureVocalizationFieldId =
  | "frequency"
  | "rhythm"
  | "volume"
  | "emotionReadability"
  | "mimicry";
export type WorkspaceCreatureSenseFieldId = "sensoryAcuity";
export type WorkspaceCreatureEcologyFieldId =
  | "habitat"
  | "diet"
  | "activityCycle"
  | "socialStructure"
  | "reproduction";
export type WorkspaceCreatureAbilityFieldId =
  | "powers"
  | "weaknesses"
  | "resourceNeeds"
  | "interactionUses"
  | "dangerNotes"
  | "keywords";
export type WorkspaceCreatureBehaviorFieldId =
  | "aggression"
  | "sociability"
  | "territoriality"
  | "curiosity"
  | "alertness"
  | "stealth"
  | "persistence"
  | "adaptability"
  | "tameability"
  | "bonding"
  | "threatResponse"
  | "resourceGuarding";

export type WorkspaceMaskMaterialMetadata = {
  kind: "mask";
  version: 1;
  name: string;
  intro: string;
  features: string;
  style: WorkspaceMaterialStyle;
  body: Record<WorkspaceMaskBodyFieldId, string>;
  colors: Record<WorkspaceMaskColorFieldId, string>;
  voice: Record<WorkspaceMaskVoiceFieldId, number>;
  personality: Record<WorkspaceMaskPersonalityFieldId, number>;
  boardDrawingStyle: WorkspaceMaskBoardDrawingStyle;
  boardImage: {
    source: WorkspaceMaskBoardImageSource;
    url: string;
  } | null;
};

export type WorkspaceCreatureMaterialMetadata = {
  kind: "creature";
  version: 1;
  subject: "species";
  name: string;
  description: string;
  style: WorkspaceMaterialStyle;
  taxonomy: Record<WorkspaceCreatureTaxonomyFieldId, string>;
  morphology: Record<WorkspaceCreatureMorphologyFieldId, string>;
  colors: Record<WorkspaceCreatureColorFieldId, string>;
  vocalization: Record<WorkspaceCreatureVocalizationFieldId, number>;
  senses: Record<WorkspaceCreatureSenseFieldId, number>;
  ecology: Record<WorkspaceCreatureEcologyFieldId, string>;
  abilities: Record<WorkspaceCreatureAbilityFieldId, string[]>;
  behaviorLogic: string;
  behavior: Record<WorkspaceCreatureBehaviorFieldId, number>;
  boardDrawingStyle: WorkspaceMaskBoardDrawingStyle;
  boardImage: {
    source: WorkspaceMaskBoardImageSource;
    url: string;
  } | null;
};

export type WorkspaceItemMaterialMetadata = {
  kind: "item";
  version: 1 | 2;
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
  boardDrawingStyle: WorkspaceMaskBoardDrawingStyle;
  boardImage: {
    source: WorkspaceMaskBoardImageSource;
    url: string;
  } | null;
  modelInputImage?: {
    source: WorkspaceMaskBoardImageSource;
    url: string;
  } | null;
  viewImages?: Partial<Record<ItemViewFace, {
    source: WorkspaceMaskBoardImageSource;
    url: string;
  }>>;
  model3d: {
    byteSize?: number;
    contentType?: string;
    fileName?: string;
    source: "instantmesh" | "uploaded";
    url: string;
  } | null;
};

export type WorkspaceSceneMaterialMetadata = {
  kind: "scene";
  version: 1 | 2;
  name: string;
  description: string;
  style: WorkspaceMaterialStyle;
  panoramaDrawingStyle: WorkspaceScenePanoramaDrawingStyle;
  blocks: Array<{
    id: string;
    name: string;
    description: string;
    scaleMeters?: number;
    scalePreset?: WorkspaceSceneScalePreset;
    panorama: {
      faceSource: "uploaded" | "generated" | "direct-cut" | "reference-repaint";
      faces?: Partial<Record<ScenePanoramaFace, { url: string }>>;
      mother?: {
        source: "generated" | "uploaded";
        url: string;
      } | null;
    } | null;
  }>;
};

export type WorkspaceMapMaterialMetadata = {
  kind: "map";
  version: 1;
  name: string;
  description: string;
  style: WorkspaceMaterialStyle;
  nodes: WorkspaceMapMaterialNode[];
  edges: WorkspaceMapMaterialEdge[];
  image?: WorkspaceMapMaterialImage | null;
  geojson?: WorkspaceMapMaterialGeoJson | null;
};

export type WorkspaceMaterialMetadata =
  | WorkspaceMaskMaterialMetadata
  | WorkspaceCreatureMaterialMetadata
  | WorkspaceItemMaterialMetadata
  | WorkspaceSceneMaterialMetadata
  | WorkspaceMapMaterialMetadata
  | Record<string, unknown>;

export type MaskMaterialBoardImageMode = "keep" | "replace" | "clear";
export type ItemMaterialImageMode = MaskMaterialBoardImageMode;
export type MapMaterialImageMode = MaskMaterialBoardImageMode;

export type WorkspaceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
  tokenUsageEstimated: boolean;
  createdAt: string;
};

export type WorkspaceTokenUsage = {
  upstream: number;
  downstream: number;
  estimated: boolean;
};

export type WorkspaceConversation = {
  id: string;
  title: string;
  scriptTitle: string;
  scriptWelcome: string;
  updatedAt: string;
  lastMessage: string;
  tokenUsage: WorkspaceTokenUsage;
  messages: WorkspaceMessage[];
};

export type WorkspaceData = {
  viewer: AuthViewer | null;
  myScripts: WorkspaceScript[];
  communityScripts: WorkspaceScript[];
  myMaterials: WorkspaceMaterial[];
  communityMaterials: WorkspaceMaterial[];
  conversations: WorkspaceConversation[];
  persistenceAvailable: boolean;
};
