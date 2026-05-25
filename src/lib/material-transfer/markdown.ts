import type { Locale } from "@/i18n/routing";
import {
  getCreatureMetadataRecord,
  getItemMetadataRecord,
  getMapMetadataRecord,
  getMaskMetadataRecord,
  getSceneMetadataRecord
} from "./metadata";
import type { MaterialArchiveItem } from "./types";

export function formatMaterialMarkdown(item: MaterialArchiveItem, locale: Locale) {
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

  const creatureMetadata = getCreatureMetadataRecord(item.metadata);

  if (creatureMetadata) {
    lines.push(`## ${isEnglish ? "Creature Data" : "生物数据"}`, "");
    pushOptionalMarkdownBlock(lines, isEnglish ? "Definition" : "完整定义", creatureMetadata.description);
    pushRecordMarkdown(lines, isEnglish ? "Taxonomy" : "分类", creatureMetadata.taxonomy);
    pushRecordMarkdown(lines, isEnglish ? "Morphology" : "形态结构", creatureMetadata.morphology);
    pushRecordMarkdown(lines, isEnglish ? "Colors" : "颜色标记", creatureMetadata.colors);
    pushRecordMarkdown(lines, isEnglish ? "Vocalization" : "发声", creatureMetadata.vocalization);
    pushRecordMarkdown(lines, isEnglish ? "Senses" : "感知", creatureMetadata.senses);
    pushRecordMarkdown(lines, isEnglish ? "Ecology" : "生态", creatureMetadata.ecology);
    pushRecordMarkdown(lines, isEnglish ? "Abilities and Limits" : "能力与限制", creatureMetadata.abilities);
    pushOptionalMarkdownBlock(lines, isEnglish ? "Behavior Logic" : "行为逻辑", creatureMetadata.behaviorLogic);
    pushRecordMarkdown(lines, isEnglish ? "Behavior Tendencies" : "行为倾向", creatureMetadata.behavior);
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
        const scalePreset = typeof blockRecord.scalePreset === "string" ? blockRecord.scalePreset : "";
        const scaleMeters = typeof blockRecord.scaleMeters === "number" ? blockRecord.scaleMeters : null;

        lines.push(`### ${title}`, "");
        if (scalePreset || scaleMeters) {
          lines.push(`- ${isEnglish ? "Scale" : "规模"}: ${scalePreset || "-"}${scaleMeters ? ` / ${scaleMeters}m` : ""}`, "");
        }
        pushOptionalMarkdownBlock(lines, isEnglish ? "Description" : "说明", blockRecord.description);
      });
    }
  }

  const mapMetadata = getMapMetadataRecord(item.metadata);

  if (mapMetadata) {
    lines.push(`## ${isEnglish ? "Map Data" : "地图数据"}`, "");
    pushOptionalMarkdownBlock(lines, isEnglish ? "Map Description" : "地图说明", mapMetadata.description);
    const mapNodeNameById = buildMapNodeNameById(mapMetadata.nodes);

    if (Array.isArray(mapMetadata.nodes) && mapMetadata.nodes.length > 0) {
      lines.push(`### ${isEnglish ? "Nodes" : "节点"}`, "");
      mapMetadata.nodes.forEach((node: unknown, index: number) => {
        if (!node || typeof node !== "object") {
          return;
        }

        const nodeRecord = node as Record<string, unknown>;
        const title = typeof nodeRecord.name === "string" && nodeRecord.name ? nodeRecord.name : `${isEnglish ? "Node" : "节点"} ${index + 1}`;
        const nodeType = typeof nodeRecord.type === "string" ? nodeRecord.type : "";
        const positionX = typeof nodeRecord.x === "number" && Number.isFinite(nodeRecord.x) ? nodeRecord.x.toFixed(2) : "-";
        const positionY = typeof nodeRecord.y === "number" && Number.isFinite(nodeRecord.y) ? nodeRecord.y.toFixed(2) : "-";

        lines.push(`- ${title} (${typeof nodeRecord.id === "string" ? nodeRecord.id : "-"})`);
        lines.push(`  - ${isEnglish ? "Type" : "类型"}: ${nodeType || "-"}`);
        lines.push(`  - ${isEnglish ? "Position" : "位置"}: ${positionX}, ${positionY}`);

        if (typeof nodeRecord.description === "string" && nodeRecord.description.trim()) {
          lines.push(`  - ${isEnglish ? "Description" : "说明"}: ${nodeRecord.description.trim()}`);
        }
      });
      lines.push("");
    }

    if (Array.isArray(mapMetadata.edges) && mapMetadata.edges.length > 0) {
      lines.push(`### ${isEnglish ? "Relations" : "关系"}`, "");
      mapMetadata.edges.forEach((edge: unknown, index: number) => {
        if (!edge || typeof edge !== "object") {
          return;
        }

        const edgeRecord = edge as Record<string, unknown>;
        const title = typeof edgeRecord.relation === "string" && edgeRecord.relation
          ? edgeRecord.relation
          : `${isEnglish ? "Edge" : "关系"} ${index + 1}`;
        const source = formatMapEndpoint(edgeRecord.source, mapNodeNameById);
        const target = formatMapEndpoint(edgeRecord.target, mapNodeNameById);

        lines.push(`- ${title}: ${source} -> ${target}`);

        if (typeof edgeRecord.description === "string" && edgeRecord.description.trim()) {
          lines.push(`  - ${isEnglish ? "Description" : "说明"}: ${edgeRecord.description.trim()}`);
        }
      });
      lines.push("");
    }
  }

  const itemMetadata = getItemMetadataRecord(item.metadata);

  if (itemMetadata) {
    lines.push(`## ${isEnglish ? "Item Data" : "物品数据"}`, "");
    pushOptionalMarkdownBlock(lines, isEnglish ? "Description" : "描述", itemMetadata.description);
    pushRecordMarkdown(lines, isEnglish ? "Basic" : "基础信息", {
      category: itemMetadata.itemCategory,
      brand: itemMetadata.brand,
      model: itemMetadata.model,
      scaleHint: itemMetadata.scaleHint
    });
    pushRecordMarkdown(lines, isEnglish ? "Tags" : "标签字段", {
      traits: formatMarkdownListValue(itemMetadata.traits),
      uses: formatMarkdownListValue(itemMetadata.uses),
      functions: formatMarkdownListValue(itemMetadata.functions),
      materials: formatMarkdownListValue(itemMetadata.materials),
      colors: formatMarkdownListValue(itemMetadata.colors),
      styles: formatMarkdownListValue(itemMetadata.styles),
      keywords: formatMarkdownListValue(itemMetadata.keywords)
    });
  }

  if (item.image) {
    lines.push(`## ${isEnglish ? "Image" : "图片"}`, "", `![${isEnglish ? "Material image" : "素材图片"}](images/${item.image.fileName})`, "");
  }

  if (item.itemViewImages && item.itemViewImages.length > 0) {
    lines.push(`## ${isEnglish ? "Legacy Item Views" : "历史六视图"}`, "");
    item.itemViewImages.forEach((asset) => {
      lines.push(`- ${asset.face}: ${asset.image.path}`);
    });
    lines.push("");
  }

  if (item.itemModelInputImage) {
    lines.push(
      `## ${isEnglish ? "Model Input Image" : "模型输入图"}`,
      "",
      `![${isEnglish ? "Model input image" : "模型输入图"}](${item.itemModelInputImage.image.path})`,
      ""
    );
  }

  if (item.itemModel) {
    lines.push(`## ${isEnglish ? "3D Model" : "3D 模型"}`, "", `- ${item.itemModel.fileName}: ${item.itemModel.path}`, "");
  }

  if (item.scenePanoramaFaces && item.scenePanoramaFaces.length > 0) {
    lines.push(`## ${isEnglish ? "Panorama Faces" : "全景六面图"}`, "");
    item.scenePanoramaFaces.forEach((asset) => {
      lines.push(`- ${asset.blockId} / ${asset.face}: ${asset.image.path}`);
    });
    lines.push("");
  }

  if (item.scenePanoramaMothers && item.scenePanoramaMothers.length > 0) {
    lines.push(`## ${isEnglish ? "Panorama Masters" : "全景母图"}`, "");
    item.scenePanoramaMothers.forEach((asset) => {
      lines.push(`- ${asset.blockId}: ${asset.image.path}`);
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

function formatMarkdownListValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).join(", ") : "";
}

function buildMapNodeNameById(nodes: unknown) {
  const nodeNameById = new Map<string, string>();

  if (!Array.isArray(nodes)) {
    return nodeNameById;
  }

  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      continue;
    }

    const record = node as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";

    if (id && name) {
      nodeNameById.set(id, name);
    }
  }

  return nodeNameById;
}

function formatMapEndpoint(value: unknown, nodeNameById: Map<string, string>) {
  if (typeof value !== "string" || !value.trim()) {
    return "-";
  }

  const id = value.trim();
  const name = nodeNameById.get(id);

  return name ? `${name} (${id})` : id;
}
