import sharp from "sharp";

export const scenePanoramaPostprocessFaces = ["front", "back", "left", "right", "top", "bottom"] as const;

export type ScenePanoramaPostprocessFace = (typeof scenePanoramaPostprocessFaces)[number];

export type ScenePanoramaPostprocessImage = {
  bytes: Buffer;
  contentType: string;
  face: ScenePanoramaPostprocessFace;
  fileName: string;
};

export type ScenePanoramaPostprocessEdge = "top" | "right" | "bottom" | "left";

export type ScenePanoramaQualityIssueKind = "color" | "geometry";

export type ScenePanoramaQualityIssue = {
  delta: number;
  edgeDelta: number;
  firstEdge: ScenePanoramaPostprocessEdge;
  firstFace: ScenePanoramaPostprocessFace;
  innerBandDelta: number;
  kind: ScenePanoramaQualityIssueKind;
  lumaDelta: number;
  reversed: boolean;
  secondEdge: ScenePanoramaPostprocessEdge;
  secondFace: ScenePanoramaPostprocessFace;
  structureDelta: number;
};

export type ScenePanoramaQualityReport = {
  averageEdgeDelta: number;
  averageInnerBandDelta: number;
  averageStructureDelta: number;
  edgeDeltas: Array<{
    delta: number;
    firstEdge: ScenePanoramaPostprocessEdge;
    firstFace: ScenePanoramaPostprocessFace;
    reversed: boolean;
    secondEdge: ScenePanoramaPostprocessEdge;
    secondFace: ScenePanoramaPostprocessFace;
  }>;
  faceByteSizes: Record<ScenePanoramaPostprocessFace, number>;
  innerBandDeltas: Array<{
    bandWidth: number;
    delta: number;
    firstEdge: ScenePanoramaPostprocessEdge;
    firstFace: ScenePanoramaPostprocessFace;
    reversed: boolean;
    secondEdge: ScenePanoramaPostprocessEdge;
    secondFace: ScenePanoramaPostprocessFace;
  }>;
  largestFaceBytes: number;
  maxEdgeDelta: number;
  maxInnerBandDelta: number;
  maxStructureDelta: number;
  issues: ScenePanoramaQualityIssue[];
  structureDeltas: Array<{
    delta: number;
    firstEdge: ScenePanoramaPostprocessEdge;
    firstFace: ScenePanoramaPostprocessFace;
    reversed: boolean;
    secondEdge: ScenePanoramaPostprocessEdge;
    secondFace: ScenePanoramaPostprocessFace;
  }>;
  totalBytes: number;
};

export type ScenePanoramaMotherQualityIssue =
  | "wrap-edge-color"
  | "wrap-band-color"
  | "wrap-luma"
  | "horizon-shift"
  | "seam-complexity";

export type ScenePanoramaMotherQualityReport = {
  bandDelta: number;
  edgeDelta: number;
  horizonPeakShiftRatio: number;
  issues: Array<{
    kind: ScenePanoramaMotherQualityIssue;
    threshold: number;
    value: number;
  }>;
  lumaDelta: number;
  passed: boolean;
  score: number;
  seamComplexityRatio: number;
  thresholds: {
    bandDelta: number;
    edgeDelta: number;
    horizonPeakShiftRatio: number;
    lumaDelta: number;
    seamComplexityRatio: number;
  };
};

export type ScenePanoramaColorReport = {
  averageFaceColorDeltaAfter: number;
  averageFaceColorDeltaBefore: number;
  averageReferenceColorDelta: number;
  averageSeamDeltaAfter?: number;
  averageSeamDeltaBefore?: number;
  colorAlgorithm:
    | "candidate-preserving-color-match-v2"
    | "mother-guided-color-transfer-v1"
    | "mother-guided-low-frequency-seam-v3"
    | "whole-face-balanced-v1";
  colorAdjusted: boolean;
  colorRejected: boolean;
  faceDeltas: Array<{
    afterDelta: number;
    beforeDelta: number;
    face: ScenePanoramaPostprocessFace;
  }>;
  maxFaceColorDeltaAfter: number;
  maxFaceColorDeltaBefore: number;
  maxFaceColorDelta: number;
  maxSeamDeltaAfter?: number;
  maxSeamDeltaBefore?: number;
};

export type ScenePanoramaColorHarmonizationResult = {
  faces: ScenePanoramaPostprocessImage[];
  report: ScenePanoramaColorReport;
};

export type ScenePanoramaColorSeamRepairResult = {
  applied: boolean;
  color: ScenePanoramaColorReport;
  faces: ScenePanoramaPostprocessImage[];
  qualityAfter: ScenePanoramaQualityReport;
  qualityBefore: ScenePanoramaQualityReport;
};

export type ScenePanoramaMotherStabilizationResult = {
  bytes: Buffer;
  contentType: string;
  fileName: string;
};

export type ScenePanoramaPostprocessOptions = {
  faceSize?: number;
  innerBandQualityWidth?: number;
  normalizedHeight?: number;
  normalizedWidth?: number;
};

const defaultFaceSize = 4096;
const generatedWebpQuality = 92;
const motherQualityEdgeDeltaThreshold = 18;
const motherQualityBandDeltaThreshold = 28;
const motherQualityLumaDeltaThreshold = 18;
const motherQualityHorizonPeakShiftRatioThreshold = 0.06;
const motherQualitySeamComplexityRatioThreshold = 1.8;
const scenePanoramaQualityEdgeDeltaThreshold = 18;
const scenePanoramaQualityInnerBandDeltaThreshold = 28;
const scenePanoramaQualityStructureDeltaThreshold = 16;
const colorAlgorithm = "mother-guided-low-frequency-seam-v3" as const;
const colorStatsSize = 160;
const colorCloseEnoughDelta = 3;
const colorCloseEnoughMaxDelta = 8;
const colorGateMinimumImprovement = 1.1;
const colorGateAllowedFaceRegression = 1.5;
const colorGateAllowedSeamRegression = 2;
const colorLowFrequencyTransferStrength = 0.76;
const colorLowFrequencyChromaStrength = 0.62;
const colorLowFrequencyLumaStrength = 0.78;
const colorLowFrequencyMaxDelta = 60;
const colorDetailPreservation = 1.5;
const colorReferenceEdgeAnchorStrength = 0.74;
const colorReferenceEdgeAnchorWidthRatio = 0.003;
const faceStitchingReferenceAnchorStrength = 0.92;
const faceStitchingReferenceAnchorWidthRatio = 1 / 18;
const seamBlendStrength = 0.58;
const seamBlendWidthRatio = 1 / 32;
const seamSmoothRadiusRatio = 1 / 80;
const seamCorrectionMax = 34;
const motherWrapBlendStrength = 0.62;
const motherWrapBlendWidthRatio = 0.065;
const motherWrapSmoothRadiusRatio = 1 / 60;
const motherWrapCorrectionMax = 38;
const scenePanoramaAdjacentEdges: Array<{
  firstEdge: ScenePanoramaPostprocessEdge;
  firstFace: ScenePanoramaPostprocessFace;
  reversed: boolean;
  secondEdge: ScenePanoramaPostprocessEdge;
  secondFace: ScenePanoramaPostprocessFace;
}> = [
  { firstFace: "front", firstEdge: "left", secondFace: "left", secondEdge: "right", reversed: false },
  { firstFace: "front", firstEdge: "right", secondFace: "right", secondEdge: "left", reversed: false },
  { firstFace: "front", firstEdge: "top", secondFace: "top", secondEdge: "bottom", reversed: false },
  { firstFace: "front", firstEdge: "bottom", secondFace: "bottom", secondEdge: "top", reversed: false },
  { firstFace: "right", firstEdge: "right", secondFace: "back", secondEdge: "left", reversed: false },
  { firstFace: "right", firstEdge: "top", secondFace: "top", secondEdge: "right", reversed: true },
  { firstFace: "right", firstEdge: "bottom", secondFace: "bottom", secondEdge: "right", reversed: false },
  { firstFace: "left", firstEdge: "left", secondFace: "back", secondEdge: "right", reversed: false },
  { firstFace: "left", firstEdge: "top", secondFace: "top", secondEdge: "left", reversed: false },
  { firstFace: "left", firstEdge: "bottom", secondFace: "bottom", secondEdge: "left", reversed: true },
  { firstFace: "back", firstEdge: "top", secondFace: "top", secondEdge: "top", reversed: true },
  { firstFace: "back", firstEdge: "bottom", secondFace: "bottom", secondEdge: "bottom", reversed: true }
];

type RgbaImage = {
  pixels: Buffer;
  height: number;
  width: number;
};

type ColorStats = {
  contrast: number;
  high: [number, number, number];
  low: [number, number, number];
  lumaHigh: number;
  lumaLow: number;
  lumaMedian: number;
  mean: [number, number, number];
  median: [number, number, number];
  saturationMean: number;
  saturationMedian: number;
  std: [number, number, number];
};

export async function stabilizeScenePanoramaFaces(
  referenceFaces: ScenePanoramaPostprocessImage[],
  candidateFaces: ScenePanoramaPostprocessImage[],
  options: ScenePanoramaPostprocessOptions = {}
): Promise<ScenePanoramaPostprocessImage[]> {
  const { faceSize } = resolveScenePanoramaPostprocessOptions(options);
  const stabilizedFaces: ScenePanoramaPostprocessImage[] = [];

  for (const face of scenePanoramaPostprocessFaces) {
    const candidate = candidateFaces.find((item) => item.face === face);

    if (!candidate) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    const reference = getPostprocessFace(referenceFaces, face);
    const referenceImage = await decodeFaceToRgba(reference.bytes, faceSize);
    const candidateImage = await decodeFaceToRgba(candidate.bytes, faceSize);
    const anchoredImage = anchorFaceStitchingBandToReference(referenceImage, candidateImage, faceSize);

    stabilizedFaces.push({
      ...candidate,
      bytes: await encodeRgbaToWebp(anchoredImage.pixels, anchoredImage.width, anchoredImage.height),
      contentType: "image/webp",
      fileName: candidate.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
    });
  }

  return stabilizedFaces;
}

export async function harmonizeScenePanoramaFaceColors(
  referenceFaces: ScenePanoramaPostprocessImage[],
  candidateFaces: ScenePanoramaPostprocessImage[],
  options: ScenePanoramaPostprocessOptions = {}
): Promise<ScenePanoramaColorHarmonizationResult> {
  const { faceSize } = resolveScenePanoramaPostprocessOptions(options);
  const referenceStatsByFace = new Map<ScenePanoramaPostprocessFace, ColorStats>();
  const candidateStatsByFace = new Map<ScenePanoramaPostprocessFace, ColorStats>();

  for (const face of scenePanoramaPostprocessFaces) {
    const reference = getPostprocessFace(referenceFaces, face);
    const candidate = getPostprocessFace(candidateFaces, face);

    referenceStatsByFace.set(face, await measureFaceColorStats(reference.bytes, faceSize));
    candidateStatsByFace.set(face, await measureFaceColorStats(candidate.bytes, faceSize));
  }

  const candidateOutputFaces: ScenePanoramaPostprocessImage[] = [];
  const transferredFaces: Array<ScenePanoramaPostprocessImage & { decoded: RgbaImage }> = [];
  const faceDeltas: ScenePanoramaColorReport["faceDeltas"] = [];

  for (const face of scenePanoramaPostprocessFaces) {
    const candidate = getPostprocessFace(candidateFaces, face);
    const reference = getPostprocessFace(referenceFaces, face);
    const referenceStats = referenceStatsByFace.get(face);
    const candidateStats = candidateStatsByFace.get(face);

    if (!referenceStats || !candidateStats) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    candidateOutputFaces.push(await normalizeColorOutputFace(candidate, faceSize));
    const beforeDelta = measureColorStatsDelta(candidateStats, referenceStats);
    const decodedReference = await decodeFaceToRgba(reference.bytes, faceSize);
    const decodedCandidate = await decodeFaceToRgba(candidate.bytes, faceSize);
    const transferred = await transferFaceColorFromReference(
      decodedReference,
      decodedCandidate,
      faceSize,
      referenceStats,
      candidateStats
    );
    const edgeAnchored = anchorFaceEdgesToReference(decodedReference, transferred, faceSize);

    transferredFaces.push({
      ...candidate,
      bytes: Buffer.alloc(0),
      contentType: "image/webp",
      decoded: edgeAnchored,
      fileName: candidate.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
    });
    faceDeltas.push({
      afterDelta: beforeDelta,
      beforeDelta,
      face
    });
  }

  const seamBalancedFaces = await equalizeScenePanoramaFaceSeams(transferredFaces, faceSize);
  const harmonizedFaces: ScenePanoramaPostprocessImage[] = [];

  for (const face of scenePanoramaPostprocessFaces) {
    const image = seamBalancedFaces.find((item) => item.face === face);
    const referenceStats = referenceStatsByFace.get(face);
    const faceDelta = faceDeltas.find((item) => item.face === face);

    if (!image || !referenceStats || !faceDelta) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    const finalBytes = await encodeRgbaToWebp(image.decoded.pixels, image.decoded.width, image.decoded.height);
    const adjustedStats = await measureFaceColorStats(finalBytes, faceSize);

    faceDelta.afterDelta = measureColorStatsDelta(adjustedStats, referenceStats);
    harmonizedFaces.push({
      ...image,
      bytes: finalBytes,
      contentType: "image/webp",
      fileName: image.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
    });
  }

  const seamQualityBefore = await measureColorGateSeamQuality(candidateOutputFaces, faceSize);
  const seamQualityAfter = await measureColorGateSeamQuality(harmonizedFaces, faceSize);
  const averageFaceColorDeltaBefore = faceDeltas.reduce((sum, item) => sum + item.beforeDelta, 0) / Math.max(1, faceDeltas.length);
  const averageFaceColorDeltaAfter = faceDeltas.reduce((sum, item) => sum + item.afterDelta, 0) / Math.max(1, faceDeltas.length);
  const maxFaceColorDeltaBefore = Math.max(...faceDeltas.map((item) => item.beforeDelta));
  const maxFaceColorDeltaAfter = Math.max(...faceDeltas.map((item) => item.afterDelta));
  const shouldApply = shouldApplyColorHarmonization(
    faceDeltas,
    averageFaceColorDeltaBefore,
    averageFaceColorDeltaAfter,
    maxFaceColorDeltaBefore,
    maxFaceColorDeltaAfter,
    seamQualityBefore,
    seamQualityAfter
  );

  if (!shouldApply) {
    const isAlreadyClose =
      averageFaceColorDeltaBefore <= colorCloseEnoughDelta &&
      maxFaceColorDeltaBefore <= colorCloseEnoughMaxDelta &&
      seamQualityBefore.average <= 18 &&
      seamQualityBefore.max <= 32;
    const fallbackFaceDeltas = faceDeltas.map((item) => ({
      ...item,
      afterDelta: item.beforeDelta
    }));

    return {
      faces: candidateOutputFaces,
      report: {
        averageFaceColorDeltaAfter: averageFaceColorDeltaBefore,
        averageFaceColorDeltaBefore,
        averageReferenceColorDelta: averageFaceColorDeltaBefore,
        averageSeamDeltaAfter: seamQualityBefore.average,
        averageSeamDeltaBefore: seamQualityBefore.average,
        colorAlgorithm,
        colorAdjusted: false,
        colorRejected: !isAlreadyClose,
        faceDeltas: fallbackFaceDeltas,
        maxFaceColorDeltaAfter: maxFaceColorDeltaBefore,
        maxFaceColorDeltaBefore,
        maxFaceColorDelta: maxFaceColorDeltaBefore,
        maxSeamDeltaAfter: seamQualityBefore.max,
        maxSeamDeltaBefore: seamQualityBefore.max
      }
    };
  }

  return {
    faces: harmonizedFaces,
    report: {
      averageFaceColorDeltaAfter,
      averageFaceColorDeltaBefore,
      averageReferenceColorDelta: averageFaceColorDeltaAfter,
      averageSeamDeltaAfter: seamQualityAfter.average,
      averageSeamDeltaBefore: seamQualityBefore.average,
      colorAlgorithm,
      colorAdjusted: faceDeltas.some((item) => item.afterDelta < item.beforeDelta - 0.5),
      colorRejected: false,
      faceDeltas,
      maxFaceColorDeltaAfter,
      maxFaceColorDeltaBefore,
      maxFaceColorDelta: maxFaceColorDeltaAfter,
      maxSeamDeltaAfter: seamQualityAfter.max,
      maxSeamDeltaBefore: seamQualityBefore.max
    }
  };
}

export async function stabilizeScenePanoramaMotherImage(
  image: Pick<ScenePanoramaPostprocessImage, "bytes" | "contentType" | "fileName">,
  options: ScenePanoramaPostprocessOptions = {}
): Promise<ScenePanoramaMotherStabilizationResult> {
  const normalizedWidth = options.normalizedWidth ?? 4096;
  const normalizedHeight = options.normalizedHeight ?? 2048;
  const decoded = await decodeEquirectangularToRgba(image.bytes, normalizedWidth, normalizedHeight);
  const stabilized = stabilizeEquirectangularWrapSeam(decoded);
  const bytes = await encodeRgbaToWebp(stabilized.pixels, stabilized.width, stabilized.height);

  return {
    bytes,
    contentType: "image/webp",
    fileName: image.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
  };
}

export async function analyzeScenePanoramaMotherImage(
  image: Pick<ScenePanoramaPostprocessImage, "bytes" | "contentType" | "fileName">,
  options: ScenePanoramaPostprocessOptions = {}
): Promise<ScenePanoramaMotherQualityReport> {
  const normalizedWidth = options.normalizedWidth ?? 4096;
  const normalizedHeight = options.normalizedHeight ?? 2048;
  const decoded = await decodeEquirectangularToRgba(image.bytes, normalizedWidth, normalizedHeight);
  const edgeDelta = measureHorizontalWrapEdgeDelta(decoded);
  const bandDelta = measureHorizontalWrapBandDelta(decoded, Math.max(4, Math.round(normalizedWidth * 0.1)));
  const lumaDelta = measureHorizontalWrapLumaDelta(decoded, Math.max(4, Math.round(normalizedWidth * 0.08)));
  const horizonPeakShiftRatio = measureHorizontalWrapHorizonShiftRatio(decoded, Math.max(4, Math.round(normalizedWidth * 0.12)));
  const seamComplexityRatio = measureHorizontalWrapSeamComplexityRatio(decoded, Math.max(4, Math.round(normalizedWidth * 0.08)));
  const thresholds = {
    bandDelta: motherQualityBandDeltaThreshold,
    edgeDelta: motherQualityEdgeDeltaThreshold,
    horizonPeakShiftRatio: motherQualityHorizonPeakShiftRatioThreshold,
    lumaDelta: motherQualityLumaDeltaThreshold,
    seamComplexityRatio: motherQualitySeamComplexityRatioThreshold
  };
  const issues: ScenePanoramaMotherQualityReport["issues"] = [];

  if (edgeDelta > thresholds.edgeDelta) {
    issues.push({ kind: "wrap-edge-color", threshold: thresholds.edgeDelta, value: edgeDelta });
  }

  if (bandDelta > thresholds.bandDelta) {
    issues.push({ kind: "wrap-band-color", threshold: thresholds.bandDelta, value: bandDelta });
  }

  if (lumaDelta > thresholds.lumaDelta) {
    issues.push({ kind: "wrap-luma", threshold: thresholds.lumaDelta, value: lumaDelta });
  }

  if (horizonPeakShiftRatio > thresholds.horizonPeakShiftRatio) {
    issues.push({
      kind: "horizon-shift",
      threshold: thresholds.horizonPeakShiftRatio,
      value: horizonPeakShiftRatio
    });
  }

  if (seamComplexityRatio > thresholds.seamComplexityRatio) {
    issues.push({
      kind: "seam-complexity",
      threshold: thresholds.seamComplexityRatio,
      value: seamComplexityRatio
    });
  }

  return {
    bandDelta,
    edgeDelta,
    horizonPeakShiftRatio,
    issues,
    lumaDelta,
    passed: issues.length === 0,
    score:
      edgeDelta / thresholds.edgeDelta +
      bandDelta / thresholds.bandDelta +
      lumaDelta / thresholds.lumaDelta +
      horizonPeakShiftRatio / thresholds.horizonPeakShiftRatio +
      seamComplexityRatio / thresholds.seamComplexityRatio,
    seamComplexityRatio,
    thresholds
  };
}

export async function analyzeScenePanoramaFaces(
  faces: ScenePanoramaPostprocessImage[],
  options: ScenePanoramaPostprocessOptions = {}
): Promise<ScenePanoramaQualityReport> {
  const { faceSize, innerBandQualityWidth } = resolveScenePanoramaPostprocessOptions(options);
  const faceByteSizes = scenePanoramaPostprocessFaces.reduce<Record<ScenePanoramaPostprocessFace, number>>((result, face) => {
    const image = faces.find((item) => item.face === face);

    if (!image) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    result[face] = image.bytes.byteLength;

    return result;
  }, {} as Record<ScenePanoramaPostprocessFace, number>);
  const decodedFaces = await decodeScenePanoramaFaces(faces, faceSize);
  const edgeDeltas = scenePanoramaAdjacentEdges.map((edge) => {
    const first = getDecodedFaceImage(decodedFaces, edge.firstFace);
    const second = getDecodedFaceImage(decodedFaces, edge.secondFace);

    return {
      ...edge,
      delta: measureFaceEdgeDeltaBetween(first, second, edge.firstEdge, edge.secondEdge, edge.reversed, faceSize)
    };
  });
  const innerBandDeltas = scenePanoramaAdjacentEdges.map((edge) => {
    const first = getDecodedFaceImage(decodedFaces, edge.firstFace);
    const second = getDecodedFaceImage(decodedFaces, edge.secondFace);

    return {
      ...edge,
      bandWidth: innerBandQualityWidth,
      delta: measureFaceInnerBandDeltaBetween(
        first,
        second,
        edge.firstEdge,
        edge.secondEdge,
        edge.reversed,
        faceSize,
        innerBandQualityWidth
      )
    };
  });
  const structureDeltas = scenePanoramaAdjacentEdges.map((edge) => {
    const first = getDecodedFaceImage(decodedFaces, edge.firstFace);
    const second = getDecodedFaceImage(decodedFaces, edge.secondFace);

    return {
      ...edge,
      delta: measureFaceStructureDeltaBetween(
        first,
        second,
        edge.firstEdge,
        edge.secondEdge,
        edge.reversed,
        faceSize,
        innerBandQualityWidth
      )
    };
  });
  const issues = buildScenePanoramaQualityIssues(edgeDeltas, innerBandDeltas, structureDeltas, decodedFaces, faceSize);
  const totalBytes = Object.values(faceByteSizes).reduce((sum, size) => sum + size, 0);
  const maxEdgeDelta = Math.max(...edgeDeltas.map((edge) => edge.delta));
  const maxInnerBandDelta = Math.max(...innerBandDeltas.map((edge) => edge.delta));
  const maxStructureDelta = Math.max(...structureDeltas.map((edge) => edge.delta));

  return {
    averageEdgeDelta: edgeDeltas.reduce((sum, edge) => sum + edge.delta, 0) / Math.max(1, edgeDeltas.length),
    averageInnerBandDelta: innerBandDeltas.reduce((sum, edge) => sum + edge.delta, 0) / Math.max(1, innerBandDeltas.length),
    averageStructureDelta: structureDeltas.reduce((sum, edge) => sum + edge.delta, 0) / Math.max(1, structureDeltas.length),
    edgeDeltas,
    faceByteSizes,
    innerBandDeltas,
    issues,
    largestFaceBytes: Math.max(...Object.values(faceByteSizes)),
    maxEdgeDelta,
    maxInnerBandDelta,
    maxStructureDelta,
    structureDeltas,
    totalBytes
  };
}

export async function repairScenePanoramaColorSeams(
  referenceFaces: ScenePanoramaPostprocessImage[],
  candidateFaces: ScenePanoramaPostprocessImage[],
  options: ScenePanoramaPostprocessOptions = {}
): Promise<ScenePanoramaColorSeamRepairResult> {
  const { faceSize } = resolveScenePanoramaPostprocessOptions(options);
  const qualityBefore = await analyzeScenePanoramaFaces(candidateFaces, { faceSize });
  const harmonized = await harmonizeScenePanoramaFaceColors(referenceFaces, candidateFaces, { faceSize });
  const qualityAfter = await analyzeScenePanoramaFaces(harmonized.faces, { faceSize });
  const beforeScore = getScenePanoramaQualityReportScore(qualityBefore);
  const afterScore = getScenePanoramaQualityReportScore(qualityAfter);

  return {
    applied: afterScore < beforeScore || qualityAfter.issues.length === 0,
    color: harmonized.report,
    faces: afterScore < beforeScore || qualityAfter.issues.length === 0 ? harmonized.faces : candidateFaces,
    qualityAfter,
    qualityBefore
  };
}

export async function measureFaceEdgeDelta(
  firstBytes: Buffer,
  secondBytes: Buffer,
  edge: ScenePanoramaPostprocessEdge,
  options: ScenePanoramaPostprocessOptions = {}
) {
  const { faceSize } = resolveScenePanoramaPostprocessOptions(options);
  const first = await decodeFaceToRgba(firstBytes, faceSize);
  const second = await decodeFaceToRgba(secondBytes, faceSize);

  return measureFaceEdgeDeltaBetween(first, second, edge, edge, false, faceSize);
}

export async function measureFaceReferenceEdgeDelta(
  referenceBytes: Buffer,
  candidateBytes: Buffer,
  edge: ScenePanoramaPostprocessEdge,
  options: ScenePanoramaPostprocessOptions = {}
) {
  const { faceSize, innerBandQualityWidth } = resolveScenePanoramaPostprocessOptions(options);
  const reference = await decodeFaceToRgba(referenceBytes, faceSize);
  const candidate = await decodeFaceToRgba(candidateBytes, faceSize);
  const edgeDelta = measureFaceEdgeDeltaBetween(reference, candidate, edge, edge, false, faceSize);
  const innerBandDelta = measureFaceInnerBandDeltaBetween(
    reference,
    candidate,
    edge,
    edge,
    false,
    faceSize,
    innerBandQualityWidth
  );
  const structureDelta = measureFaceStructureDeltaBetween(
    reference,
    candidate,
    edge,
    edge,
    false,
    faceSize,
    innerBandQualityWidth
  );

  return edgeDelta + innerBandDelta / 2 + structureDelta;
}

function measureFaceEdgeDeltaBetween(
  first: RgbaImage,
  second: RgbaImage,
  firstEdge: ScenePanoramaPostprocessEdge,
  secondEdge: ScenePanoramaPostprocessEdge,
  reverseSecondEdge: boolean,
  faceSize: number
) {
  let total = 0;
  let count = 0;

  for (let i = 0; i < faceSize; i += 1) {
    const secondOffset = reverseSecondEdge ? faceSize - 1 - i : i;
    const [firstX, firstY] = getEdgePixelPosition(firstEdge, i, first.width, first.height);
    const [secondX, secondY] = getEdgePixelPosition(secondEdge, secondOffset, second.width, second.height);
    const firstIndex = (firstY * first.width + firstX) * 4;
    const secondIndex = (secondY * second.width + secondX) * 4;

    total += Math.abs(first.pixels[firstIndex] - second.pixels[secondIndex]);
    total += Math.abs(first.pixels[firstIndex + 1] - second.pixels[secondIndex + 1]);
    total += Math.abs(first.pixels[firstIndex + 2] - second.pixels[secondIndex + 2]);
    count += 3;
  }

  return total / Math.max(1, count);
}

function measureFaceLumaDeltaBetween(
  first: RgbaImage,
  second: RgbaImage,
  firstEdge: ScenePanoramaPostprocessEdge,
  secondEdge: ScenePanoramaPostprocessEdge,
  reverseSecondEdge: boolean,
  faceSize: number,
  bandWidth: number
) {
  let total = 0;
  let count = 0;

  for (let depth = 0; depth < bandWidth; depth += 1) {
    for (let i = 0; i < faceSize; i += 1) {
      const secondOffset = reverseSecondEdge ? faceSize - 1 - i : i;
      const [firstX, firstY] = getInnerBandPixelPosition(firstEdge, i, depth, first.width, first.height);
      const [secondX, secondY] = getInnerBandPixelPosition(secondEdge, secondOffset, depth, second.width, second.height);
      const firstIndex = (firstY * first.width + firstX) * 4;
      const secondIndex = (secondY * second.width + secondX) * 4;

      total += Math.abs(
        measureRgbLuma([first.pixels[firstIndex], first.pixels[firstIndex + 1], first.pixels[firstIndex + 2]]) -
          measureRgbLuma([second.pixels[secondIndex], second.pixels[secondIndex + 1], second.pixels[secondIndex + 2]])
      );
      count += 1;
    }
  }

  return total / Math.max(1, count);
}

function measureFaceStructureDeltaBetween(
  first: RgbaImage,
  second: RgbaImage,
  firstEdge: ScenePanoramaPostprocessEdge,
  secondEdge: ScenePanoramaPostprocessEdge,
  reverseSecondEdge: boolean,
  faceSize: number,
  bandWidth: number
) {
  let total = 0;
  let count = 0;
  const maxDepth = Math.max(1, Math.min(bandWidth, faceSize - 2));

  for (let depth = 0; depth < maxDepth; depth += 1) {
    for (let i = 1; i < faceSize - 1; i += 1) {
      const secondOffset = reverseSecondEdge ? faceSize - 1 - i : i;
      const firstGradient = measureInnerBandLumaGradient(first, firstEdge, i, depth);
      const secondGradient = measureInnerBandLumaGradient(second, secondEdge, secondOffset, depth);

      total += Math.abs(firstGradient - secondGradient);
      count += 1;
    }
  }

  return total / Math.max(1, count);
}

function measureFaceInnerBandDeltaBetween(
  first: RgbaImage,
  second: RgbaImage,
  firstEdge: ScenePanoramaPostprocessEdge,
  secondEdge: ScenePanoramaPostprocessEdge,
  reverseSecondEdge: boolean,
  faceSize: number,
  bandWidth: number
) {
  let total = 0;
  let count = 0;

  for (let depth = 0; depth < bandWidth; depth += 1) {
    for (let i = 0; i < faceSize; i += 1) {
      const secondOffset = reverseSecondEdge ? faceSize - 1 - i : i;
      const [firstX, firstY] = getInnerBandPixelPosition(firstEdge, i, depth, first.width, first.height);
      const [secondX, secondY] = getInnerBandPixelPosition(secondEdge, secondOffset, depth, second.width, second.height);
      const firstIndex = (firstY * first.width + firstX) * 4;
      const secondIndex = (secondY * second.width + secondX) * 4;

      total += Math.abs(first.pixels[firstIndex] - second.pixels[secondIndex]);
      total += Math.abs(first.pixels[firstIndex + 1] - second.pixels[secondIndex + 1]);
      total += Math.abs(first.pixels[firstIndex + 2] - second.pixels[secondIndex + 2]);
      count += 3;
    }
  }

  return total / Math.max(1, count);
}

function buildScenePanoramaQualityIssues(
  edgeDeltas: ScenePanoramaQualityReport["edgeDeltas"],
  innerBandDeltas: ScenePanoramaQualityReport["innerBandDeltas"],
  structureDeltas: ScenePanoramaQualityReport["structureDeltas"],
  decodedFaces: Map<ScenePanoramaPostprocessFace, RgbaImage>,
  faceSize: number
) {
  return edgeDeltas
    .map((edge): ScenePanoramaQualityIssue | null => {
      const innerBand = innerBandDeltas.find((item) =>
        item.firstFace === edge.firstFace &&
        item.firstEdge === edge.firstEdge &&
        item.secondFace === edge.secondFace &&
        item.secondEdge === edge.secondEdge
      );
      const structure = structureDeltas.find((item) =>
        item.firstFace === edge.firstFace &&
        item.firstEdge === edge.firstEdge &&
        item.secondFace === edge.secondFace &&
        item.secondEdge === edge.secondEdge
      );
      const first = getDecodedFaceImage(decodedFaces, edge.firstFace);
      const second = getDecodedFaceImage(decodedFaces, edge.secondFace);
      const innerBandDelta = innerBand?.delta ?? 0;
      const structureDelta = structure?.delta ?? 0;
      const lumaDelta = measureFaceLumaDeltaBetween(
        first,
        second,
        edge.firstEdge,
        edge.secondEdge,
        edge.reversed,
        faceSize,
        Math.max(4, Math.round(faceSize / 32))
      );
      const failed =
        edge.delta > scenePanoramaQualityEdgeDeltaThreshold ||
        innerBandDelta > scenePanoramaQualityInnerBandDeltaThreshold ||
        structureDelta > scenePanoramaQualityStructureDeltaThreshold;

      if (!failed) {
        return null;
      }

      return {
        ...edge,
        delta: Math.max(edge.delta, innerBandDelta, structureDelta),
        edgeDelta: edge.delta,
        innerBandDelta,
        kind: structureDelta > scenePanoramaQualityStructureDeltaThreshold ? "geometry" : "color",
        lumaDelta,
        structureDelta
      };
    })
    .filter((issue): issue is ScenePanoramaQualityIssue => Boolean(issue));
}

function measureInnerBandLumaGradient(image: RgbaImage, edge: ScenePanoramaPostprocessEdge, offset: number, depth: number) {
  const [x, y] = getInnerBandPixelPosition(edge, offset, depth, image.width, image.height);
  const [nextX, nextY] = getInnerBandPixelPosition(
    edge,
    Math.min(image.width - 1, offset + 1),
    Math.min(Math.max(0, Math.min(image.width, image.height) - 1), depth + 1),
    image.width,
    image.height
  );
  const index = (y * image.width + x) * 4;
  const nextIndex = (nextY * image.width + nextX) * 4;
  const luma = measureRgbLuma([image.pixels[index], image.pixels[index + 1], image.pixels[index + 2]]);
  const nextLuma = measureRgbLuma([image.pixels[nextIndex], image.pixels[nextIndex + 1], image.pixels[nextIndex + 2]]);

  return Math.abs(nextLuma - luma);
}

function getScenePanoramaQualityReportScore(quality: ScenePanoramaQualityReport) {
  return (
    quality.maxEdgeDelta / scenePanoramaQualityEdgeDeltaThreshold +
    quality.maxInnerBandDelta / scenePanoramaQualityInnerBandDeltaThreshold +
    quality.maxStructureDelta / scenePanoramaQualityStructureDeltaThreshold
  );
}

function measureHorizontalWrapEdgeDelta(image: RgbaImage) {
  let total = 0;
  let count = 0;

  for (let y = 0; y < image.height; y += 1) {
    const leftIndex = y * image.width * 4;
    const rightIndex = (y * image.width + image.width - 1) * 4;

    for (let channel = 0; channel < 3; channel += 1) {
      total += Math.abs(image.pixels[leftIndex + channel] - image.pixels[rightIndex + channel]);
      count += 1;
    }
  }

  return total / Math.max(1, count);
}

function measureHorizontalWrapBandDelta(image: RgbaImage, bandWidth: number) {
  let total = 0;
  let count = 0;

  for (let depth = 0; depth < bandWidth; depth += 1) {
    for (let y = 0; y < image.height; y += 1) {
      const leftIndex = (y * image.width + depth) * 4;
      const rightIndex = (y * image.width + image.width - 1 - depth) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        total += Math.abs(image.pixels[leftIndex + channel] - image.pixels[rightIndex + channel]);
        count += 1;
      }
    }
  }

  return total / Math.max(1, count);
}

function measureHorizontalWrapLumaDelta(image: RgbaImage, bandWidth: number) {
  let total = 0;
  let count = 0;

  for (let depth = 0; depth < bandWidth; depth += 1) {
    for (let y = 0; y < image.height; y += 1) {
      const leftIndex = (y * image.width + depth) * 4;
      const rightIndex = (y * image.width + image.width - 1 - depth) * 4;
      const leftLuma = measureRgbLuma([image.pixels[leftIndex], image.pixels[leftIndex + 1], image.pixels[leftIndex + 2]]);
      const rightLuma = measureRgbLuma([image.pixels[rightIndex], image.pixels[rightIndex + 1], image.pixels[rightIndex + 2]]);

      total += Math.abs(leftLuma - rightLuma);
      count += 1;
    }
  }

  return total / Math.max(1, count);
}

function measureHorizontalWrapHorizonShiftRatio(image: RgbaImage, bandWidth: number) {
  const leftProfile = measureVerticalGradientProfile(image, 0, bandWidth);
  const rightProfile = measureVerticalGradientProfile(image, image.width - bandWidth, bandWidth);
  const leftPeak = getProfilePeakIndex(leftProfile);
  const rightPeak = getProfilePeakIndex(rightProfile);

  return Math.abs(leftPeak - rightPeak) / Math.max(1, image.height);
}

function measureHorizontalWrapSeamComplexityRatio(image: RgbaImage, bandWidth: number) {
  const leftComplexity = measureBandLumaComplexity(image, 0, bandWidth);
  const rightComplexity = measureBandLumaComplexity(image, image.width - bandWidth, bandWidth);
  const centerWidth = Math.max(4, Math.min(bandWidth * 2, Math.round(image.width * 0.16)));
  const centerComplexity = measureBandLumaComplexity(image, Math.round((image.width - centerWidth) / 2), centerWidth);

  return (leftComplexity + rightComplexity) / 2 / Math.max(1, centerComplexity);
}

function measureVerticalGradientProfile(image: RgbaImage, startX: number, width: number) {
  const profile = Array.from({ length: image.height - 1 }, () => 0);

  for (let y = 0; y < image.height - 1; y += 1) {
    let rowTotal = 0;

    for (let x = startX; x < startX + width; x += 1) {
      const clampedX = Math.max(0, Math.min(image.width - 1, x));
      const index = (y * image.width + clampedX) * 4;
      const nextIndex = ((y + 1) * image.width + clampedX) * 4;
      const luma = measureRgbLuma([image.pixels[index], image.pixels[index + 1], image.pixels[index + 2]]);
      const nextLuma = measureRgbLuma([image.pixels[nextIndex], image.pixels[nextIndex + 1], image.pixels[nextIndex + 2]]);

      rowTotal += Math.abs(nextLuma - luma);
    }

    profile[y] = rowTotal / Math.max(1, width);
  }

  return profile;
}

function measureBandLumaComplexity(image: RgbaImage, startX: number, width: number) {
  let total = 0;
  let count = 0;

  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = startX + 1; x < startX + width - 1; x += 1) {
      const clampedX = Math.max(1, Math.min(image.width - 2, x));
      const index = (y * image.width + clampedX) * 4;
      const rightIndex = (y * image.width + clampedX + 1) * 4;
      const downIndex = ((y + 1) * image.width + clampedX) * 4;
      const luma = measureRgbLuma([image.pixels[index], image.pixels[index + 1], image.pixels[index + 2]]);
      const rightLuma = measureRgbLuma([image.pixels[rightIndex], image.pixels[rightIndex + 1], image.pixels[rightIndex + 2]]);
      const downLuma = measureRgbLuma([image.pixels[downIndex], image.pixels[downIndex + 1], image.pixels[downIndex + 2]]);

      total += Math.abs(rightLuma - luma) + Math.abs(downLuma - luma);
      count += 2;
    }
  }

  return total / Math.max(1, count);
}

function getProfilePeakIndex(values: number[]) {
  const smoothed = smoothNumberSeries(values, Math.max(2, Math.round(values.length / 96)));
  const sorted = [...smoothed].sort((first, second) => first - second);
  const threshold = getPercentile(sorted, 0.82);
  let weightedIndexTotal = 0;
  let weightTotal = 0;
  let peak = 0;
  let peakValue = Number.NEGATIVE_INFINITY;

  smoothed.forEach((value, index) => {
    const weight = Math.max(0, value - threshold);

    weightedIndexTotal += index * weight;
    weightTotal += weight;

    if (value > peakValue) {
      peak = index;
      peakValue = value;
    }
  });

  return weightTotal > 0 ? Math.round(weightedIndexTotal / weightTotal) : peak;
}

async function decodeScenePanoramaFaces(faces: ScenePanoramaPostprocessImage[], faceSize: number) {
  const decodedFaces = new Map<ScenePanoramaPostprocessFace, RgbaImage>();

  for (const face of scenePanoramaPostprocessFaces) {
    const image = faces.find((item) => item.face === face);

    if (!image) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
    }

    decodedFaces.set(face, await decodeFaceToRgba(image.bytes, faceSize));
  }

  return decodedFaces;
}

function getDecodedFaceImage(faces: Map<ScenePanoramaPostprocessFace, RgbaImage>, face: ScenePanoramaPostprocessFace) {
  const image = faces.get(face);

  if (!image) {
    throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
  }

  return image;
}

function getPostprocessFace(faces: ScenePanoramaPostprocessImage[], face: ScenePanoramaPostprocessFace) {
  const image = faces.find((item) => item.face === face);

  if (!image) {
    throw new Error(`SCENE_PANORAMA_FACE_MISSING_${face}`);
  }

  return image;
}

async function transferFaceColorFromReference(
  reference: RgbaImage,
  candidate: RgbaImage,
  faceSize: number,
  _referenceStats: ColorStats,
  _candidateStats: ColorStats
): Promise<RgbaImage> {
  const output = Buffer.alloc(faceSize * faceSize * 4);
  const referenceLow = await createLowFrequencyColorField(reference, faceSize);
  const candidateLow = await createLowFrequencyColorField(candidate, faceSize);

  for (let y = 0; y < faceSize; y += 1) {
    for (let x = 0; x < faceSize; x += 1) {
      const index = (y * faceSize + x) * 4;
      const candidatePixel = [
        candidate.pixels[index],
        candidate.pixels[index + 1],
        candidate.pixels[index + 2]
      ] as [number, number, number];
      const candidateLuma = measureRgbLuma(candidatePixel);
      const candidateLowPixel = [
        candidateLow.pixels[index],
        candidateLow.pixels[index + 1],
        candidateLow.pixels[index + 2]
      ] as [number, number, number];
      const referenceLowPixel = [
        referenceLow.pixels[index],
        referenceLow.pixels[index + 1],
        referenceLow.pixels[index + 2]
      ] as [number, number, number];
      const candidateLowLuma = measureRgbLuma(candidateLowPixel);
      const referenceLowLuma = measureRgbLuma(referenceLowPixel);
      const lumaProtect = getExtremeLumaProtection(candidateLuma);
      const lowLumaDelta = clamp(
        referenceLowLuma - candidateLowLuma,
        -colorLowFrequencyMaxDelta,
        colorLowFrequencyMaxDelta
      );

      for (let channel = 0; channel < 3; channel += 1) {
        const candidateDetail = candidatePixel[channel] - candidateLowPixel[channel];
        const candidateLowChroma = candidateLowPixel[channel] - candidateLowLuma;
        const referenceLowChroma = referenceLowPixel[channel] - referenceLowLuma;
        const chromaDelta = clamp(
          referenceLowChroma - candidateLowChroma,
          -colorLowFrequencyMaxDelta,
          colorLowFrequencyMaxDelta
        );
        const targetLow =
          candidateLowPixel[channel] +
          lowLumaDelta * colorLowFrequencyLumaStrength +
          chromaDelta * colorLowFrequencyChromaStrength;
        const target = targetLow + candidateDetail * colorDetailPreservation;
        const mixed = candidatePixel[channel] + (target - candidatePixel[channel]) * colorLowFrequencyTransferStrength * lumaProtect;

        output[index + channel] = Math.round(clamp(mixed, 0, 255));
      }

      output[index + 3] = candidate.pixels[index + 3] || 255;
    }
  }

  return {
    pixels: output,
    height: faceSize,
    width: faceSize
  };
}

async function createLowFrequencyColorField(image: RgbaImage, faceSize: number): Promise<RgbaImage> {
  const lowSize = Math.min(256, Math.max(8, Math.round(faceSize / 32)));
  const pixels = await createSharpRgbaInput(image.pixels, image.width, image.height)
    .resize(lowSize, lowSize, { fit: "fill", kernel: "lanczos3" })
    .blur(Math.max(1.2, lowSize / 12))
    .resize(faceSize, faceSize, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer();

  return {
    pixels,
    height: faceSize,
    width: faceSize
  };
}

function anchorFaceEdgesToReference(reference: RgbaImage, candidate: RgbaImage, faceSize: number): RgbaImage {
  const output = Buffer.from(candidate.pixels);
  const anchorWidth = Math.max(1, Math.min(16, Math.round(faceSize * colorReferenceEdgeAnchorWidthRatio)));
  const edges: ScenePanoramaPostprocessEdge[] = ["top", "right", "bottom", "left"];

  edges.forEach((edge) => {
    for (let depth = 0; depth < anchorWidth; depth += 1) {
      const depthWeight = colorReferenceEdgeAnchorStrength * Math.pow(1 - depth / Math.max(1, anchorWidth), 2);

      for (let offset = 0; offset < faceSize; offset += 1) {
        const [x, y] = getInnerBandPixelPosition(edge, offset, depth, faceSize, faceSize);
        const index = (y * faceSize + x) * 4;

        for (let channel = 0; channel < 3; channel += 1) {
          const candidateValue = output[index + channel];
          const referenceValue = reference.pixels[index + channel];

          output[index + channel] = Math.round(clamp(candidateValue + (referenceValue - candidateValue) * depthWeight, 0, 255));
        }
      }
    }
  });

  return {
    pixels: output,
    height: faceSize,
    width: faceSize
  };
}

function anchorFaceStitchingBandToReference(reference: RgbaImage, candidate: RgbaImage, faceSize: number): RgbaImage {
  const output = Buffer.from(candidate.pixels);
  const anchorWidth = Math.max(2, Math.min(256, Math.round(faceSize * faceStitchingReferenceAnchorWidthRatio)));
  const edges: ScenePanoramaPostprocessEdge[] = ["top", "right", "bottom", "left"];

  edges.forEach((edge) => {
    for (let depth = 0; depth < anchorWidth; depth += 1) {
      const depthRatio = depth / Math.max(1, anchorWidth - 1);
      const depthWeight = faceStitchingReferenceAnchorStrength * Math.pow(1 - depthRatio, 1.75);

      for (let offset = 0; offset < faceSize; offset += 1) {
        const [x, y] = getInnerBandPixelPosition(edge, offset, depth, faceSize, faceSize);
        const index = (y * faceSize + x) * 4;

        for (let channel = 0; channel < 3; channel += 1) {
          const candidateValue = output[index + channel];
          const referenceValue = reference.pixels[index + channel];

          output[index + channel] = Math.round(clamp(candidateValue + (referenceValue - candidateValue) * depthWeight, 0, 255));
        }
      }
    }
  });

  return {
    pixels: output,
    height: faceSize,
    width: faceSize
  };
}

function getExtremeLumaProtection(luma: number) {
  if (luma < 18 || luma > 238) {
    return 0.35;
  }

  if (luma < 42 || luma > 218) {
    return 0.68;
  }

  return 1;
}

async function equalizeScenePanoramaFaceSeams(
  faces: Array<ScenePanoramaPostprocessImage & { decoded: RgbaImage }>,
  faceSize: number
) {
  const balancedFaces = faces.map((face) => ({
    ...face,
    decoded: {
      ...face.decoded,
      pixels: Buffer.from(face.decoded.pixels)
    }
  }));
  const decodedByFace = new Map(balancedFaces.map((face) => [face.face, face.decoded]));
  const bandWidth = Math.max(4, Math.round(faceSize * seamBlendWidthRatio));
  const smoothRadius = Math.max(2, Math.round(faceSize * seamSmoothRadiusRatio));

  scenePanoramaAdjacentEdges.forEach((edge) => {
    const first = decodedByFace.get(edge.firstFace);
    const second = decodedByFace.get(edge.secondFace);

    if (!first || !second) {
      throw new Error(`SCENE_PANORAMA_FACE_MISSING_${edge.firstFace}`);
    }

    for (let depth = 0; depth < bandWidth; depth += 1) {
      const depthWeight = seamBlendStrength * Math.pow(1 - depth / bandWidth, 2);
      const deltas = Array.from({ length: faceSize }, () => [0, 0, 0] as [number, number, number]);

      for (let offset = 0; offset < faceSize; offset += 1) {
        const secondOffset = edge.reversed ? faceSize - 1 - offset : offset;
        const [firstX, firstY] = getInnerBandPixelPosition(edge.firstEdge, offset, depth, faceSize, faceSize);
        const [secondX, secondY] = getInnerBandPixelPosition(edge.secondEdge, secondOffset, depth, faceSize, faceSize);
        const firstIndex = (firstY * faceSize + firstX) * 4;
        const secondIndex = (secondY * faceSize + secondX) * 4;

        for (let channel = 0; channel < 3; channel += 1) {
          deltas[offset][channel] = second.pixels[secondIndex + channel] - first.pixels[firstIndex + channel];
        }
      }

      const smoothedDeltas = smoothRgbSeries(deltas, smoothRadius);

      for (let offset = 0; offset < faceSize; offset += 1) {
        const secondOffset = edge.reversed ? faceSize - 1 - offset : offset;
        const [firstX, firstY] = getInnerBandPixelPosition(edge.firstEdge, offset, depth, faceSize, faceSize);
        const [secondX, secondY] = getInnerBandPixelPosition(edge.secondEdge, secondOffset, depth, faceSize, faceSize);
        const firstIndex = (firstY * faceSize + firstX) * 4;
        const secondIndex = (secondY * faceSize + secondX) * 4;

        for (let channel = 0; channel < 3; channel += 1) {
          const correction = clamp(
            (smoothedDeltas[offset][channel] * depthWeight) / 2,
            -seamCorrectionMax,
            seamCorrectionMax
          );
          const firstValue = first.pixels[firstIndex + channel];
          const secondValue = second.pixels[secondIndex + channel];

          first.pixels[firstIndex + channel] = Math.round(clamp(firstValue + correction, 0, 255));
          second.pixels[secondIndex + channel] = Math.round(clamp(secondValue - correction, 0, 255));
        }
      }
    }
  });

  return balancedFaces;
}

async function measureColorGateSeamQuality(faces: ScenePanoramaPostprocessImage[], faceSize: number) {
  const gateFaceSize = Math.min(faceSize, 512);
  const report = await analyzeScenePanoramaFaces(faces, {
    faceSize: gateFaceSize,
    innerBandQualityWidth: Math.max(4, Math.round(gateFaceSize / 32))
  });

  return {
    average: (report.averageEdgeDelta + report.averageInnerBandDelta) / 2,
    max: Math.max(report.maxEdgeDelta, report.maxInnerBandDelta)
  };
}

async function decodeEquirectangularToRgba(bytes: Buffer, width: number, height: number): Promise<RgbaImage> {
  const pixels = await sharp(bytes)
    .resize(width, height, { fit: "fill" })
    .toColorspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer();

  return {
    pixels,
    height,
    width
  };
}

function stabilizeEquirectangularWrapSeam(image: RgbaImage): RgbaImage {
  const seamX = findLowestComplexityVerticalSeamX(image);
  const rotated = rotateEquirectangularToSeam(image, seamX);
  const output = Buffer.from(rotated.pixels);
  const bandWidth = Math.max(8, Math.round(rotated.width * motherWrapBlendWidthRatio));
  const smoothRadius = Math.max(2, Math.round(rotated.height * motherWrapSmoothRadiusRatio));

  for (let depth = 0; depth < bandWidth; depth += 1) {
    const weight = motherWrapBlendStrength * Math.pow(1 - depth / bandWidth, 2);
    const deltas = Array.from({ length: rotated.height }, () => [0, 0, 0] as [number, number, number]);

    for (let y = 0; y < rotated.height; y += 1) {
      const leftX = depth;
      const rightX = rotated.width - 1 - depth;
      const leftIndex = (y * rotated.width + leftX) * 4;
      const rightIndex = (y * rotated.width + rightX) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        deltas[y][channel] = output[rightIndex + channel] - output[leftIndex + channel];
      }
    }

    const smoothedDeltas = smoothRgbSeries(deltas, smoothRadius);

    for (let y = 0; y < rotated.height; y += 1) {
      const leftX = depth;
      const rightX = rotated.width - 1 - depth;
      const leftIndex = (y * rotated.width + leftX) * 4;
      const rightIndex = (y * rotated.width + rightX) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const correction = clamp(
          (smoothedDeltas[y][channel] * weight) / 2,
          -motherWrapCorrectionMax,
          motherWrapCorrectionMax
        );
        const left = output[leftIndex + channel];
        const right = output[rightIndex + channel];

        output[leftIndex + channel] = Math.round(clamp(left + correction, 0, 255));
        output[rightIndex + channel] = Math.round(clamp(right - correction, 0, 255));
      }
    }
  }

  return {
    ...rotated,
    pixels: output
  };
}

function findLowestComplexityVerticalSeamX(image: RgbaImage) {
  const step = Math.max(1, Math.round(image.width / 512));
  let bestX = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let x = 0; x < image.width; x += step) {
    const score = measureVerticalSeamScore(image, x);

    if (score < bestScore) {
      bestScore = score;
      bestX = x;
    }
  }

  const refineStart = bestX - step;
  const refineEnd = bestX + step;

  for (let offset = refineStart; offset <= refineEnd; offset += 1) {
    const x = ((offset % image.width) + image.width) % image.width;
    const score = measureVerticalSeamScore(image, x);

    if (score < bestScore) {
      bestScore = score;
      bestX = x;
    }
  }

  return bestX;
}

function measureVerticalSeamScore(image: RgbaImage, seamX: number) {
  const leftX = (seamX - 1 + image.width) % image.width;
  const rightX = seamX;
  const bandWidth = Math.max(4, Math.round(image.width * 0.1));
  const depthStep = Math.max(1, Math.round(bandWidth / 40));
  const yStep = Math.max(1, Math.round(image.height / 256));
  let edgeDelta = 0;
  let structureDelta = 0;
  let bandColorDelta = 0;
  let bandLumaDelta = 0;
  let bandStructureDelta = 0;
  let bandCount = 0;
  let count = 0;

  for (let y = 0; y < image.height; y += 1) {
    const leftIndex = (y * image.width + leftX) * 4;
    const rightIndex = (y * image.width + rightX) * 4;
    const leftLuma = measureRgbLuma([image.pixels[leftIndex], image.pixels[leftIndex + 1], image.pixels[leftIndex + 2]]);
    const rightLuma = measureRgbLuma([image.pixels[rightIndex], image.pixels[rightIndex + 1], image.pixels[rightIndex + 2]]);

    edgeDelta += Math.abs(image.pixels[leftIndex] - image.pixels[rightIndex]);
    edgeDelta += Math.abs(image.pixels[leftIndex + 1] - image.pixels[rightIndex + 1]);
    edgeDelta += Math.abs(image.pixels[leftIndex + 2] - image.pixels[rightIndex + 2]);

    if (y < image.height - 1) {
      const nextLeftIndex = ((y + 1) * image.width + leftX) * 4;
      const nextRightIndex = ((y + 1) * image.width + rightX) * 4;
      const nextLeftLuma = measureRgbLuma([
        image.pixels[nextLeftIndex],
        image.pixels[nextLeftIndex + 1],
        image.pixels[nextLeftIndex + 2]
      ]);
      const nextRightLuma = measureRgbLuma([
        image.pixels[nextRightIndex],
        image.pixels[nextRightIndex + 1],
        image.pixels[nextRightIndex + 2]
      ]);

      structureDelta += Math.abs(nextLeftLuma - leftLuma) + Math.abs(nextRightLuma - rightLuma);
    }

    count += 1;
  }

  for (let depth = 0; depth < bandWidth; depth += depthStep) {
    const leftBandX = (seamX + depth) % image.width;
    const rightBandX = (seamX - 1 - depth + image.width) % image.width;

    for (let y = 0; y < image.height - 1; y += yStep) {
      const leftIndex = (y * image.width + leftBandX) * 4;
      const rightIndex = (y * image.width + rightBandX) * 4;
      const nextLeftIndex = ((y + 1) * image.width + leftBandX) * 4;
      const nextRightIndex = ((y + 1) * image.width + rightBandX) * 4;
      const leftLuma = measureRgbLuma([image.pixels[leftIndex], image.pixels[leftIndex + 1], image.pixels[leftIndex + 2]]);
      const rightLuma = measureRgbLuma([image.pixels[rightIndex], image.pixels[rightIndex + 1], image.pixels[rightIndex + 2]]);
      const nextLeftLuma = measureRgbLuma([
        image.pixels[nextLeftIndex],
        image.pixels[nextLeftIndex + 1],
        image.pixels[nextLeftIndex + 2]
      ]);
      const nextRightLuma = measureRgbLuma([
        image.pixels[nextRightIndex],
        image.pixels[nextRightIndex + 1],
        image.pixels[nextRightIndex + 2]
      ]);

      bandColorDelta += Math.abs(image.pixels[leftIndex] - image.pixels[rightIndex]);
      bandColorDelta += Math.abs(image.pixels[leftIndex + 1] - image.pixels[rightIndex + 1]);
      bandColorDelta += Math.abs(image.pixels[leftIndex + 2] - image.pixels[rightIndex + 2]);
      bandLumaDelta += Math.abs(leftLuma - rightLuma);
      bandStructureDelta += Math.abs((nextLeftLuma - leftLuma) - (nextRightLuma - rightLuma));
      bandCount += 1;
    }
  }

  return (
    edgeDelta / Math.max(1, count * 3) * 0.4 +
    structureDelta / Math.max(1, count * 2) * 0.2 +
    bandColorDelta / Math.max(1, bandCount * 3) +
    bandLumaDelta / Math.max(1, bandCount) * 0.8 +
    bandStructureDelta / Math.max(1, bandCount) * 0.5
  );
}

function rotateEquirectangularToSeam(image: RgbaImage, seamX: number): RgbaImage {
  if (seamX <= 0) {
    return image;
  }

  const output = Buffer.alloc(image.pixels.length);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sourceX = (x + seamX) % image.width;
      const sourceIndex = (y * image.width + sourceX) * 4;
      const targetIndex = (y * image.width + x) * 4;

      output[targetIndex] = image.pixels[sourceIndex];
      output[targetIndex + 1] = image.pixels[sourceIndex + 1];
      output[targetIndex + 2] = image.pixels[sourceIndex + 2];
      output[targetIndex + 3] = image.pixels[sourceIndex + 3];
    }
  }

  return {
    ...image,
    pixels: output
  };
}

async function measureFaceColorStats(bytes: Buffer, faceSize: number): Promise<ColorStats> {
  const statsWidth = Math.min(colorStatsSize, faceSize);
  const pixels = await sharp(bytes)
    .resize(statsWidth, statsWidth, { fit: "fill" })
    .toColorspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer();
  const samples = collectColorSamples(pixels);
  const lumaValues = samples.map((sample) => sample.luma).sort((first, second) => first - second);
  const lumaLowCut = getPercentile(lumaValues, 0.08);
  const lumaHighCut = getPercentile(lumaValues, 0.92);
  const shouldFilterExtremes = lumaHighCut - lumaLowCut >= 8;
  const filteredSamples = shouldFilterExtremes
    ? samples.filter((sample) => sample.luma >= lumaLowCut && sample.luma <= lumaHighCut)
    : samples;
  const selectedSamples = filteredSamples.length >= Math.max(16, samples.length * 0.2) ? filteredSamples : samples;
  const channelValues = [[], [], []] as [number[], number[], number[]];
  const selectedLumaValues: number[] = [];
  const selectedSaturationValues: number[] = [];

  selectedSamples.forEach((sample) => {
    channelValues[0].push(sample.r);
    channelValues[1].push(sample.g);
    channelValues[2].push(sample.b);
    selectedLumaValues.push(sample.luma);
    selectedSaturationValues.push(sample.saturation);
  });
  channelValues.forEach((values) => values.sort((first, second) => first - second));
  selectedLumaValues.sort((first, second) => first - second);
  selectedSaturationValues.sort((first, second) => first - second);

  const mean = channelValues.map(getMean) as [number, number, number];
  const std = channelValues.map((values, channel) => getStandardDeviation(values, mean[channel])) as [number, number, number];
  const low = channelValues.map((values) => getPercentile(values, 0.12)) as [number, number, number];
  const high = channelValues.map((values) => getPercentile(values, 0.88)) as [number, number, number];
  const lumaLow = getPercentile(selectedLumaValues, 0.12);
  const lumaHigh = getPercentile(selectedLumaValues, 0.88);

  return {
    contrast: lumaHigh - lumaLow,
    high,
    low,
    lumaHigh,
    lumaLow,
    lumaMedian: getPercentile(selectedLumaValues, 0.5),
    mean,
    median: channelValues.map((values) => getPercentile(values, 0.5)) as [number, number, number],
    saturationMean: getMean(selectedSaturationValues),
    saturationMedian: getPercentile(selectedSaturationValues, 0.5),
    std
  };
}

function measureColorStatsDelta(first: ColorStats, second: ColorStats) {
  let medianRgbDelta = 0;

  for (let channel = 0; channel < 3; channel += 1) {
    medianRgbDelta += Math.abs(first.median[channel] - second.median[channel]);
  }
  medianRgbDelta /= 3;
  const lumaDelta = Math.abs(first.lumaMedian - second.lumaMedian);
  const contrastDelta = Math.abs(first.contrast - second.contrast);
  const saturationDelta = Math.abs(first.saturationMedian - second.saturationMedian) * 100;

  return medianRgbDelta * 0.68 + lumaDelta * 0.18 + contrastDelta * 0.08 + saturationDelta * 0.06;
}

function shouldApplyColorHarmonization(
  faceDeltas: ScenePanoramaColorReport["faceDeltas"],
  averageBefore: number,
  averageAfter: number,
  maxBefore: number,
  maxAfter: number,
  seamBefore: { average: number; max: number },
  seamAfter: { average: number; max: number }
) {
  if (averageBefore <= colorCloseEnoughDelta) {
    return false;
  }

  return (
    averageAfter <= averageBefore - colorGateMinimumImprovement &&
    maxAfter <= maxBefore - colorGateMinimumImprovement &&
    seamAfter.average <= seamBefore.average + colorGateAllowedSeamRegression &&
    seamAfter.max <= seamBefore.max + colorGateAllowedSeamRegression * 1.5 &&
    faceDeltas.every((item) => item.afterDelta <= item.beforeDelta + colorGateAllowedFaceRegression)
  );
}

async function normalizeColorOutputFace(
  face: ScenePanoramaPostprocessImage,
  faceSize: number
): Promise<ScenePanoramaPostprocessImage> {
  if (face.contentType === "image/webp") {
    return face;
  }

  const image = await decodeFaceToRgba(face.bytes, faceSize);

  return {
    ...face,
    bytes: await encodeRgbaToWebp(image.pixels, image.width, image.height),
    contentType: "image/webp",
    fileName: face.fileName.replace(/\.[a-z0-9]+$/i, ".webp")
  };
}

function collectColorSamples(pixels: Buffer) {
  const samples: Array<{ b: number; g: number; luma: number; r: number; saturation: number }> = [];

  for (let index = 0; index < pixels.length; index += 3) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    samples.push({
      b,
      g,
      luma: 0.2126 * r + 0.7152 * g + 0.0722 * b,
      r,
      saturation: max <= 0 ? 0 : (max - min) / max
    });
  }

  return samples;
}

function getMean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function smoothRgbSeries(values: Array<[number, number, number]>, radius: number) {
  if (values.length === 0 || radius <= 0) {
    return values;
  }

  return values.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(values.length - 1, index + radius);
    const smoothed = [0, 0, 0] as [number, number, number];
    let count = 0;

    for (let sampleIndex = start; sampleIndex <= end; sampleIndex += 1) {
      smoothed[0] += values[sampleIndex][0];
      smoothed[1] += values[sampleIndex][1];
      smoothed[2] += values[sampleIndex][2];
      count += 1;
    }

    smoothed[0] /= Math.max(1, count);
    smoothed[1] /= Math.max(1, count);
    smoothed[2] /= Math.max(1, count);

    return smoothed;
  });
}

function smoothNumberSeries(values: number[], radius: number) {
  if (values.length === 0 || radius <= 0) {
    return values;
  }

  return values.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(values.length - 1, index + radius);
    let total = 0;
    let count = 0;

    for (let sampleIndex = start; sampleIndex <= end; sampleIndex += 1) {
      total += values[sampleIndex];
      count += 1;
    }

    return total / Math.max(1, count);
  });
}

function getStandardDeviation(values: number[], mean: number) {
  const variance = values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / Math.max(1, values.length);

  return Math.sqrt(Math.max(0, variance));
}

function getPercentile(sortedValues: number[], percentile: number) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const clampedPercentile = clamp(percentile, 0, 1);
  const position = (sortedValues.length - 1) * clampedPercentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lowerValue = sortedValues[lowerIndex] ?? sortedValues[0] ?? 0;
  const upperValue = sortedValues[upperIndex] ?? lowerValue;

  return lowerValue + (upperValue - lowerValue) * (position - lowerIndex);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveScenePanoramaPostprocessOptions(options: ScenePanoramaPostprocessOptions) {
  const faceSize = options.faceSize ?? defaultFaceSize;
  const innerBandQualityWidth = options.innerBandQualityWidth ?? Math.max(4, Math.round(faceSize / 32));

  return {
    faceSize,
    innerBandQualityWidth
  };
}

async function decodeFaceToRgba(bytes: Buffer, faceSize: number): Promise<RgbaImage> {
  const pixels = await sharp(bytes)
    .resize(faceSize, faceSize, { fit: "fill" })
    .toColorspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer();

  return {
    pixels,
    height: faceSize,
    width: faceSize
  };
}

async function encodeRgbaToWebp(pixels: Buffer, width: number, height: number) {
  return createSharpRgbaInput(pixels, width, height)
    .webp({
      effort: 4,
      quality: generatedWebpQuality,
      smartSubsample: true
    })
    .toBuffer();
}

function createSharpRgbaInput(pixels: Buffer, width: number, height: number) {
  return sharp(pixels, {
    raw: {
      channels: 4,
      height,
      width
    }
  });
}

function measureRgbLuma([r, g, b]: [number, number, number]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getEdgePixelPosition(edge: ScenePanoramaPostprocessEdge, offset: number, width: number, height: number): [number, number] {
  switch (edge) {
    case "top":
      return [offset, 0];
    case "right":
      return [width - 1, offset];
    case "bottom":
      return [offset, height - 1];
    case "left":
      return [0, offset];
  }
}

function getInnerBandPixelPosition(
  edge: ScenePanoramaPostprocessEdge,
  offset: number,
  depth: number,
  width: number,
  height: number
): [number, number] {
  switch (edge) {
    case "top":
      return [offset, depth];
    case "right":
      return [width - 1 - depth, offset];
    case "bottom":
      return [offset, height - 1 - depth];
    case "left":
      return [depth, offset];
  }
}
