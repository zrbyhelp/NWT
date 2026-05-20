export const colorThemes = [
  {
    id: "star-map",
    name: "星图",
    swatches: ["#1f6feb", "#f59e0b", "#e8f1ff"]
  },
  {
    id: "matrix",
    name: "矩阵",
    swatches: ["#159957", "#a3e635", "#07130d"]
  },
  {
    id: "deep-space",
    name: "深空",
    swatches: ["#7c3aed", "#22d3ee", "#080b18"]
  },
  {
    id: "morning-fog",
    name: "晨雾",
    swatches: ["#3f8ca8", "#e26d5c", "#eef3f4"]
  }
] as const;

export const typographyPresets = [
  { id: "compact", name: "紧凑", fontScale: 0.94, lineHeight: 1.55, density: 0.9 },
  { id: "standard", name: "标准", fontScale: 1, lineHeight: 1.7, density: 1 },
  { id: "relaxed", name: "舒展", fontScale: 1.08, lineHeight: 1.86, density: 1.14 }
] as const;

