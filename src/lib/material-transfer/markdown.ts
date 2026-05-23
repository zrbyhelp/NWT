import type { Locale } from "@/i18n/routing";
import { getItemMetadataRecord, getMaskMetadataRecord, getSceneMetadataRecord } from "./metadata";
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
