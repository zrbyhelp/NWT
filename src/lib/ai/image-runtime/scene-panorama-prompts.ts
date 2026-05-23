import type { ScenePanoramaFace, ScenePanoramaGenerationInput } from "./types";

type ScenePanoramaSizeProfile = {
  faceEditSize: string;
  faceSize: number;
  id: string;
  motherSize: string;
  normalizedHeight: number;
  normalizedWidth: number;
};

const maskBoardTargetResolution = "3840x2160";

export function appendMaskBoardTargetPrompt(prompt: string) {
  const target = hasCjkText(prompt)
    ? [
        `目标输出：4K 16:9 横版角色设定板，${maskBoardTargetResolution}。`,
        "不要在画面中写尺寸说明文字，不要水印，不要 UI 操作控件。"
      ]
    : [
        `Target output: 4K 16:9 horizontal character setting board, ${maskBoardTargetResolution}.`,
        "Do not add text explaining the size, watermarks, or UI controls."
      ];

  return [prompt, ...target].join("\n");
}

export function appendItemBoardTargetPrompt(prompt: string) {
  const target = hasCjkText(prompt)
    ? [
        `目标输出：4K 16:9 横版物品设定板，${maskBoardTargetResolution}。`,
        "需要包含清晰物品主视觉、材质/颜色/用途提示和比例尺。不要水印，不要 UI 操作控件。"
      ]
    : [
        `Target output: 4K 16:9 horizontal item design board, ${maskBoardTargetResolution}.`,
        "Include a clear item hero view, material/color/use notes, and a scale ruler. No watermark or UI controls."
      ];

  return [prompt, ...target].join("\n");
}

export function buildItemViewPrompt(basePrompt: string, face: ScenePanoramaFace) {
  const faceLabelZh: Record<ScenePanoramaFace, string> = {
    back: "后视图",
    bottom: "底视图",
    front: "前视图",
    left: "左视图",
    right: "右视图",
    top: "顶视图"
  };
  const faceLabelEn: Record<ScenePanoramaFace, string> = {
    back: "back view",
    bottom: "bottom view",
    front: "front view",
    left: "left view",
    right: "right view",
    top: "top view"
  };

  if (hasCjkText(basePrompt)) {
    return [
      basePrompt,
      `根据参考设定图生成同一件物品的${faceLabelZh[face]}。`,
      "输出单张正交视图：纯背景、居中、完整物品、统一比例、统一材质和颜色。",
      "不要文字、不要标注、不要比例尺、不要 UI 边框、不要人物手持、不要裁切。"
    ].join("\n");
  }

  return [
    basePrompt,
    `Generate the ${faceLabelEn[face]} of the same item from the reference design board.`,
    "Output one orthographic view: plain background, centered, complete object, consistent scale, materials, and colors.",
    "No text, labels, ruler, UI frame, hand-held presentation, or cropping."
  ].join("\n");
}

export function buildItemModelInputPrompt(basePrompt: string) {
  if (hasCjkText(basePrompt)) {
    return [
      basePrompt,
      "根据参考设定图生成同一件物品的一张模型输入图，用于 InstantMesh 单图重建 GLB。",
      "让模型自动选择最能表达物品结构、轮廓、材质、关键功能和厚度关系的三分之四展示角度；不要固定为 45 度。",
      "输出单张图片：纯白或浅中性纯色背景，完整物品居中，边缘留出适度安全距离，光照清晰均匀。",
      "不要多图拼版，不要前后左右上下六视图，不要文字、标注、比例尺、UI 边框、人物手持、复杂场景背景或裁切。"
    ].join("\n");
  }

  return [
    basePrompt,
    "Generate one model input image of the same item for InstantMesh single-image GLB reconstruction.",
    "Let the model choose the best three-quarter presentation angle that explains the item's structure, silhouette, materials, key function, and thickness; do not force a fixed 45-degree view.",
    "Output a single image: pure white or light neutral solid background, complete object centered, safe margins around the object, clean and even lighting.",
    "No multi-image sheet, no front/back/left/right/top/bottom six views, no text, labels, ruler, UI frame, hand-held presentation, busy scene background, or cropping."
  ].join("\n");
}

function hasCjkText(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

export function buildScenePanoramaMotherPrompt(input: ScenePanoramaGenerationInput, sizeProfile: ScenePanoramaSizeProfile) {
  const style = getSceneStylePrompt(input.style, input.locale);
  const drawingStyle = getScenePanoramaDrawingStylePrompt(input.panoramaDrawingStyle, input.locale);
  const blockScale = getScenePanoramaBlockScalePrompt(input);

  if (input.locale === "en-US") {
    return [
      "Create one seamless 360-degree equirectangular panorama master image for an interactive fiction scene.",
      `Target output: 4K equirectangular panorama, ${sizeProfile.motherSize}, 2:1 aspect ratio. Do not add text explaining the size.`,
      "If reference images are provided, use them for layout, materials, atmosphere, lighting, and spatial scale. Do not copy text, UI, frames, watermarks, or non-scene artifacts from the references.",
      "The image must represent a complete interior or exterior space that can wrap horizontally.",
      "Render a clean, crisp, inspectable environment: sharp material edges, readable architecture, coherent furniture or terrain, and clear surface detail even when viewed up close.",
      "Avoid muddy gray color wash, low-contrast haze, smeared textures, melted objects, warped walls, distorted furniture, painterly blur, or vague AI blobs.",
      "Preserve strong but believable lighting: clear key lights, ambient shadows, local highlights, and material reflections without flattening the scene.",
      "The left and right edges must join perfectly as one continuous world; the leftmost 8% and rightmost 8% must be the same continuous wall, floor, ceiling, terrain, lighting gradient, and perspective flow.",
      "Keep the horizontal wrap seam intentionally boring and low-detail: continuous blank wall, floor, ceiling, sky, terrain, or soft atmosphere is preferred over props or strong silhouettes near the seam.",
      "The first 12% and last 12% should be visually interchangeable in color temperature, exposure, material pattern, horizon height, and perspective direction.",
      "Do not place doors, windows, mirrors, posters, characters, bright lamps, large props, text, or high-contrast silhouettes crossing the horizontal wrap seam.",
      "Avoid objects, light bands, color-temperature changes, shadow cuts, or perspective lines that break at the wrap seam.",
      "Use one global exposure, white balance, color grading, lighting direction, and material language across the entire image.",
      "Keep one fixed camera height, one horizon level, one focal length feeling, and one time-of-day across the full 360 degrees.",
      "Place architecture, furniture, terrain, shadows, and large props so they remain coherent when later split into front/back/left/right/top/bottom cubemap faces.",
      "Avoid face-specific hero objects, sudden color-temperature changes, or repeated motifs that would make adjacent faces look like different rooms.",
      "No text, no labels, no watermark, no UI, no character close-ups.",
      "Keep spatial continuity, believable perspective, consistent lighting, and clear materials.",
      `Scene: ${input.sceneName}.`,
      `Scene description: ${input.sceneDescription}.`,
      `Block: ${input.blockName}.`,
      `Block description: ${input.blockDescription}.`,
      `Block scale: ${blockScale}.`,
      `Visual style: ${style}.`,
      `Rendering type: ${drawingStyle}.`
    ].join("\n");
  }

  return [
    "生成一张用于交互小说场景的 360 度等距柱状全景母图。",
    `目标输出：4K 等距柱状全景母图，${sizeProfile.motherSize}，2:1 画幅；不要在画面中写尺寸说明文字。`,
    "如果提供了参考图，请参考其布局、材质、氛围、光照和空间尺度；不要复制参考图中的文字、UI、边框、水印或非场景杂物。",
    "画面必须表现一个可以水平环绕的完整室内或室外空间。",
    "场景必须干净、清晰、经得起放大查看：材质边界清楚，建筑结构可信，家具或地形形体明确，表面细节可读。",
    "避免灰脏色罩、低对比雾感、涂抹纹理、融化物体、弯曲墙体、变形家具、厚重模糊笔触或含混的 AI 块状细节。",
    "保留可信但有质感的光照：明确主光、环境阴影、局部高光和材质反射，不要把画面压成平光或脏灰。",
    "左右边缘必须能无缝闭合成同一个连续世界；最左 8% 和最右 8% 必须延续同一面墙、地面、天花、地形、光照渐变和透视走向。",
    "水平环绕接缝要刻意保持低复杂度：优先让连续空墙、地面、天花、天空、地形或柔和氛围经过接缝，不要把强主体放在接缝附近。",
    "最左 12% 和最右 12% 在色温、曝光、材质纹理、地平线高度和透视方向上要看起来可以互换。",
    "不要让门、窗、镜子、海报、人物、强光灯、大型道具、文字或高对比轮廓跨过水平环绕接缝。",
    "避免物体、光带、色温变化、阴影切口或透视线在环绕接缝处断裂。",
    "整张图必须使用统一曝光、统一白平衡、统一调色、统一光照方向和统一材质语言。",
    "完整 360 度空间必须保持同一机位高度、同一地平线、同一镜头透视感和同一时间光照。",
    "建筑、家具、地形、阴影和大型道具的摆放要能在后续切成前、后、左、右、上、下六面图时继续连贯。",
    "避免只属于某一面的突兀主体、突然变化的色温，或让相邻面看起来像不同房间的重复元素。",
    "不要文字、标签、水印、UI，也不要近景人物特写。",
    "保持空间连续、透视可信、光照一致、材质清晰。",
    `场景：${input.sceneName}。`,
    `场景说明：${input.sceneDescription}。`,
    `区块：${input.blockName}。`,
    `区块说明：${input.blockDescription}。`,
    `区块规模：${blockScale}。`,
    `视觉风格：${style}。`,
    `画面类型：${drawingStyle}。`
  ].join("\n");
}

export function buildScenePanoramaFacePrompt(
  input: ScenePanoramaGenerationInput,
  face: ScenePanoramaFace,
  attempt: number,
  sizeProfile: ScenePanoramaSizeProfile
) {
  const direction = getScenePanoramaFaceDescription(face, input.locale);
  const adjacency = getScenePanoramaFaceAdjacencyDescription(face, input.locale);
  const retryInstruction = getScenePanoramaFaceRetryInstruction(attempt, input.locale);
  const style = getSceneStylePrompt(input.style, input.locale);
  const drawingStyle = getScenePanoramaDrawingStylePrompt(input.panoramaDrawingStyle, input.locale);
  const blockScale = getScenePanoramaBlockScalePrompt(input);

  if (input.locale === "en-US") {
    return [
      "Perform pixel-faithful image upscaling, restoration, and enhancement for this cubemap face.",
      `Target output: 4K square cubemap face, ${sizeProfile.faceEditSize}. Do not add text explaining the size.`,
      "Use the input image as a strict spatial reference, not as a loose concept sketch.",
      "Keep the exact composition, camera position, field of view, perspective, crop, rotation, object placement, object scale, and horizon level.",
      "Do not add objects, remove objects, move objects, resize objects, rotate objects, repaint the scene as a new illustration, or reinterpret the space.",
      "All wall lines, floor lines, ceiling lines, horizon lines, shadow boundaries, object silhouettes, and material texture directions must stay near the same pixel positions as the reference.",
      "Allowed improvements: higher apparent resolution, clearer texture detail, material readability, gentle noise cleanup, small missing-detail restoration, and richer light quality.",
      "If the reference face is blurry, low-detail, or slightly warped, reconstruct crisp plausible interior detail in the central area while preserving large geometry, silhouettes, perspective, horizon, and all edge connections.",
      "Make surfaces readable and clean: no muddy gray wash, no over-smoothed low-frequency smear, no melted props, no warped furniture, no vague AI texture patches.",
      "Preserve useful lighting effects from the reference: local highlights, specular reflections, shadow depth, luminous screens, lamps, windows, and atmosphere should remain vivid but consistent with adjacent faces.",
      "Forbidden artifacts: feathered edges, blurred seams, vignette, frame, border, face-specific color shift, restyling, recropping, or standalone-poster composition.",
      "Do not perform independent color grading for this face. Inherit the mother panorama's overall exposure, white balance, black level, highlight rolloff, saturation, material palette, and ambient light.",
      "Keep dark scenes dark. Do not brighten one face independently, add artificial fill light, cool/warm only this face, or turn the face into a separate corrected photograph.",
      "This face is one side of a shared 360-degree cubemap. Its four edges connect directly to other AI-upscaled faces and must remain sharp, continuous, and stitchable.",
      "The outer 8% of every edge is a stitching zone: preserve the input pixels' structures, colors, brightness, line directions, and object cuts especially strictly there.",
      "Do not invent new geometry within the stitching zone. Restore clarity there, but keep the mother panorama's edge layout more important than creative detail.",
      "Do not add edge-only glow, haze, vignette, blur, shadow, color wash, or new detail that is not present in the input edge region.",
      "Match the reference global exposure, white balance, color grading, lighting direction, time-of-day, material palette, camera height, and spatial scale.",
      `Face direction: ${direction}.`,
      `Face adjacency: ${adjacency}.`,
      `Scene: ${input.sceneName}.`,
      `Scene description: ${input.sceneDescription}.`,
      `Block: ${input.blockName}.`,
      `Block description: ${input.blockDescription}.`,
      `Block scale: ${blockScale}.`,
      `Visual style: ${style}.`,
      `Rendering type: ${drawingStyle}.`,
      retryInstruction
    ].join("\n");
  }

  return [
    "对这张六面体单面图做像素级忠实升级、高清恢复和细节增强。",
    `目标输出：4K 正方形六面体单面图，${sizeProfile.faceEditSize}；不要在画面中写尺寸说明文字。`,
    "输入图是严格空间参考，不是宽松概念草图。",
    "必须保持完全相同的构图、机位、视场角、透视、裁切、旋转、物体位置、物体比例和地平线高度。",
    "不要新增物体、删除物体、移动物体、缩放物体、旋转物体、把画面重画成新插画，或重新理解空间。",
    "所有墙线、地线、天花线、地平线、阴影边界、物体轮廓和材质纹理方向，都必须保持在参考图的相同像素位置附近。",
    "允许增强：表观分辨率、纹理清晰度、材质可读性、轻微噪点清理、局部缺失细节恢复和光照质感。",
    "如果参考单面本身模糊、细节不足或轻微变形，可以在画面中央区域重建清晰可信的内部细节，但必须保留大型结构、轮廓、透视、地平线和所有边缘连接关系。",
    "画面表面要干净可读：不要灰脏色罩、不要过度平滑的低频涂抹、不要融化道具、不要变形家具、不要含混的 AI 纹理块。",
    "保留参考图里有用的光照效果：局部高光、镜面反射、阴影层次、发光屏幕、灯具、窗光和氛围光都要清晰，但必须与相邻面一致。",
    "禁止出现：边缘羽化、接缝模糊、暗角、画框、边框、单面独立偏色、风格重绘、重新裁切或海报式构图。",
    "不要对当前单面做独立调色。必须继承母图的整体曝光、白平衡、黑位、高光压缩、饱和度、材质色板和环境光。",
    "暗光场景要保持暗光氛围。不要单独提亮某一面、添加补光、只让这一面变冷或变暖，也不要把它修成一张独立校色照片。",
    "这张图是同一个 360 度六面体空间的一面，四条边会直接连接其他 AI 高清升级后的面，边缘必须清晰、连续、可拼接。",
    "每条边外侧 8% 是拼接保护区：这里必须特别严格保留输入图的结构、颜色、亮度、线条方向和物体切口。",
    "不要在拼接区域发明新几何结构。这里可以恢复清晰度，但母图边缘布局优先级高于创意细节。",
    "不要在边缘单独添加辉光、雾化、暗角、模糊、阴影、色块或输入边缘区域不存在的新细节。",
    "必须匹配参考图的统一曝光、白平衡、调色、光照方向、时间光线、材质色板、机位高度和空间比例。",
    `当前方向：${direction}。`,
    `相邻关系：${adjacency}。`,
    `场景：${input.sceneName}。`,
    `场景说明：${input.sceneDescription}。`,
    `区块：${input.blockName}。`,
    `区块说明：${input.blockDescription}。`,
    `区块规模：${blockScale}。`,
    `视觉风格：${style}。`,
    `画面类型：${drawingStyle}。`,
    retryInstruction
  ].join("\n");
}

function getScenePanoramaBlockScalePrompt(input: ScenePanoramaGenerationInput) {
  const meters = typeof input.blockScaleMeters === "number" && Number.isFinite(input.blockScaleMeters)
    ? input.blockScaleMeters
    : null;
  const preset = input.blockScalePreset || "mid";

  if (input.locale === "en-US") {
    return meters ? `${preset}, about ${meters} meters across` : preset;
  }

  return meters ? `${preset}，约 ${meters} 米跨度` : preset;
}

function getScenePanoramaFaceAdjacencyDescription(face: ScenePanoramaFace, locale: ScenePanoramaGenerationInput["locale"]) {
  const zh: Record<ScenePanoramaFace, string> = {
    back: "back.left 接 right.right；back.right 接 left.left；back.top 接 top.top；back.bottom 接 bottom.bottom",
    bottom: "bottom.top 接 front.bottom；bottom.right 接 right.bottom；bottom.bottom 接 back.bottom；bottom.left 接 left.bottom",
    front: "front.left 接 left.right；front.right 接 right.left；front.top 接 top.bottom；front.bottom 接 bottom.top",
    left: "left.left 接 back.right；left.right 接 front.left；left.top 接 top.left；left.bottom 接 bottom.left",
    right: "right.left 接 front.right；right.right 接 back.left；right.top 接 top.right；right.bottom 接 bottom.right",
    top: "top.bottom 接 front.top；top.right 接 right.top；top.top 接 back.top；top.left 接 left.top"
  };
  const en: Record<ScenePanoramaFace, string> = {
    back: "back.left connects to right.right; back.right connects to left.left; back.top connects to top.top; back.bottom connects to bottom.bottom",
    bottom: "bottom.top connects to front.bottom; bottom.right connects to right.bottom; bottom.bottom connects to back.bottom; bottom.left connects to left.bottom",
    front: "front.left connects to left.right; front.right connects to right.left; front.top connects to top.bottom; front.bottom connects to bottom.top",
    left: "left.left connects to back.right; left.right connects to front.left; left.top connects to top.left; left.bottom connects to bottom.left",
    right: "right.left connects to front.right; right.right connects to back.left; right.top connects to top.right; right.bottom connects to bottom.right",
    top: "top.bottom connects to front.top; top.right connects to right.top; top.top connects to back.top; top.left connects to left.top"
  };

  return locale === "en-US" ? en[face] : zh[face];
}

function getScenePanoramaFaceRetryInstruction(attempt: number, locale: ScenePanoramaGenerationInput["locale"]) {
  if (attempt <= 1) {
    return locale === "en-US"
      ? "First pass: preserve the reference exactly and only improve fidelity."
      : "首次生成：严格保留参考图，只提升清晰度和细节可信度。";
  }

  return locale === "en-US"
    ? `Retry pass ${attempt}: the previous attempt changed structure or caused seam mismatch. Reduce creativity, stay closer to the reference, and perform only conservative high-definition restoration.`
    : `重试轮次 ${attempt}：上一轮可能改变结构或造成接缝不匹配。降低创造性，更贴近参考图，只做保守的高清恢复。`;
}

function getScenePanoramaFaceDescription(face: ScenePanoramaFace, locale: ScenePanoramaGenerationInput["locale"]) {
  const zh: Record<ScenePanoramaFace, string> = {
    back: "后方回望视角，与左、右和上下边缘连续",
    bottom: "地面或下方视角，避免新增主体，保持地面纹理连续",
    front: "主前方视角，与左右和上下边缘连续",
    left: "左侧视角，与前后方向连续",
    right: "右侧视角，与前后方向连续",
    top: "天花、天空或上方视角，避免新增主体，保持顶部结构连续"
  };
  const en: Record<ScenePanoramaFace, string> = {
    back: "rear view, continuous with left, right, top, and bottom edges",
    bottom: "floor or downward view, avoid new focal subjects, keep ground texture continuous",
    front: "main forward view, continuous with left, right, top, and bottom edges",
    left: "left-side view, continuous with front and back directions",
    right: "right-side view, continuous with front and back directions",
    top: "ceiling, sky, or upward view, avoid new focal subjects, keep overhead structure continuous"
  };

  return locale === "en-US" ? en[face] : zh[face];
}

function getSceneStylePrompt(style: string, locale: ScenePanoramaGenerationInput["locale"]) {
  const zh: Record<string, string> = {
    apocalyptic: "末世废墟感，磨损材质，压抑但可读的空间层次",
    classical: "古风空间，东方审美，结构克制，细节雅致",
    cyberpunk: "赛博霓虹，高科技材质，冷暖光对比强",
    fantasy: "玄幻幻想空间，材质奇异但空间可信",
    mystery: "悬疑氛围，低调光线，隐藏线索感",
    realistic: "写实质感，真实光照，空间比例可信",
    sciFi: "科幻空间，清晰结构，金属、玻璃与能量光源"
  };
  const en: Record<string, string> = {
    apocalyptic: "apocalyptic ruin atmosphere, worn materials, oppressive but readable spatial layers",
    classical: "classical Chinese-inspired space, restrained structure, refined details",
    cyberpunk: "cyberpunk neon lighting, high-tech materials, strong warm-cool contrast",
    fantasy: "fantasy space, uncanny materials with believable spatial logic",
    mystery: "mystery atmosphere, low-key lighting, hidden-clue feeling",
    realistic: "realistic materials, natural lighting, believable proportions",
    sciFi: "sci-fi space, clear structure, metal, glass, and energy lighting"
  };

  return locale === "en-US" ? en[style] ?? en.realistic : zh[style] ?? zh.realistic;
}

function getScenePanoramaDrawingStylePrompt(style: string, locale: ScenePanoramaGenerationInput["locale"]) {
  const zh: Record<string, string> = {
    anime: "二次元插画空间，干净线条，色块清晰，适合轻小说式场景漫游",
    cel: "赛璐璐动画空间，边缘利落，光影分层明确，适合动画感全景",
    comic: "漫画场景风，线条明确，黑白与色彩张力强，但保持空间透视准确",
    concept: "概念设定图空间，设计感强，结构清楚，适合世界观设定展示",
    guofeng: "国风插画空间，东方审美，材质和装饰细节克制精致",
    painterly: "厚涂插画空间，笔触丰富，光影和材质表现更强",
    photo: "真实摄影质感，自然镜头光线，材质细节可信",
    realistic: "写实空间渲染，比例自然，材质可信，适合沉浸式探索"
  };
  const en: Record<string, string> = {
    anime: "anime environment illustration, clean linework, clear color blocks for light-novel scene exploration",
    cel: "cel-shaded animated environment, crisp edges and clearly layered lighting",
    comic: "comic environment style with clear ink lines and strong visual energy while preserving accurate perspective",
    concept: "environment concept art, design-forward, structurally clear, suitable for worldbuilding presentation",
    guofeng: "Chinese-inspired illustrated environment with refined eastern aesthetics and restrained detail",
    painterly: "painterly environment illustration with rich brushwork and stronger light and material rendering",
    photo: "photographic look with natural camera lighting and believable material detail",
    realistic: "realistic environment rendering with natural proportions, believable materials, and immersive exploration"
  };

  return locale === "en-US" ? en[style] ?? en.realistic : zh[style] ?? zh.realistic;
}
