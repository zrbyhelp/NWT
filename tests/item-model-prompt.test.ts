import { describe, expect, it } from "vitest";
import { buildItemModelInputPrompt } from "@/lib/ai/image-runtime/scene-panorama-prompts";

describe("item model input prompt", () => {
  it("keeps the generated input focused on the same single item in Chinese", () => {
    const prompt = buildItemModelInputPrompt("物品：星门棱钥。材质：银色金属、绿色导光芯。");

    expect(prompt).toContain("同一件物品");
    expect(prompt).toContain("只提取设定板中的主物品本体");
    expect(prompt).toContain("忽略文字标注、比例尺、材质色块、二级视图、小窗、图标和版面装饰");
    expect(prompt).toContain("保持关键部件数量");
    expect(prompt).toContain("可读厚度关系");
    expect(prompt).toContain("所有外轮廓四周留出清楚安全边距");
    expect(prompt).toContain("不要多图拼版");
    expect(prompt).toContain("不要第二件物品");
    expect(prompt).toContain("不要前后左右上下六视图");
    expect(prompt).toContain("人物手持或使用、真实伤害、血迹、威胁或攻击场景");
  });

  it("keeps the generated input focused on the same single item in English", () => {
    const prompt = buildItemModelInputPrompt("Item: star gate prism key. Materials: brushed silver metal and green light core.");

    expect(prompt).toContain("same item");
    expect(prompt).toContain("Extract only the main item body");
    expect(prompt).toContain("ignoring text labels, rulers, material swatches, secondary views, inset panels, icons, and layout decoration");
    expect(prompt).toContain("Preserve key part counts");
    expect(prompt).toContain("readable thickness relationships");
    expect(prompt).toContain("clear safe margins around every outer silhouette");
    expect(prompt).toContain("No multi-image sheet");
    expect(prompt).toContain("no second item");
    expect(prompt).toContain("no front/back/left/right/top/bottom six views");
    expect(prompt).toContain("hand-held or in-use presentation, injury, blood, threat or attack scene");
  });
});
