import type { Locale } from "@/i18n/routing";
import { authRequiredCode } from "@/lib/auth-types";
import type {
  MapImageStreamDoneEvent,
  MapImageStreamEvent,
  MapMaterialCreateInput,
  SceneMaterialCreateInput,
  WorkspaceConversation
} from "@/lib/home-workspace";
import type {
  MessageStreamEvent,
  MapImageOutlineResult,
  ScenePanoramaMotherDraft,
  ScenePanoramaStreamDoneEvent,
  ScenePanoramaStreamEvent,
  SceneReferenceImageDraft
} from "./shared";

export async function streamHomeMessage(
  conversationId: string,
  content: string,
  locale: Locale,
  onDelta: (content: string) => void
): Promise<WorkspaceConversation> {
  const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/stream`, {
    body: JSON.stringify({ content, locale }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!response.ok || !response.body) {
    throw new Error("Message stream failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const event = JSON.parse(line) as MessageStreamEvent;

      if (event.type === "delta") {
        onDelta(event.content);
      }

      if (event.type === "done") {
        return event.conversation;
      }

      if (event.type === "error") {
        throw new Error(event.message === authRequiredCode ? authRequiredCode : event.message);
      }
    }

    if (done) {
      break;
    }
  }

  throw new Error("Message stream ended without a final conversation.");
}

export async function streamHomeScenePanorama(
  input: SceneMaterialCreateInput,
  blockId: string,
  locale: Locale,
  maxRedrawAttempts: number,
  mother: ScenePanoramaMotherDraft,
  onEvent: (event: ScenePanoramaStreamEvent) => void
) {
  const formData = new FormData();

  formData.append("draft", JSON.stringify(input));
  formData.append("blockId", blockId);
  formData.append("locale", locale);
  formData.append("maxRedrawAttempts", String(maxRedrawAttempts));
  if (mother.file) {
    formData.append("motherImage", mother.file);
    formData.append("motherSource", mother.source);
  } else if (mother.storedUrl) {
    formData.append("motherUrl", mother.storedUrl);
  }

  const response = await fetch("/api/materials/scene-panorama/stream", {
    body: formData,
    method: "POST"
  });

  if (!response.ok || !response.body) {
    throw new Error("SCENE_PANORAMA_STREAM_FAILED");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneEvent: ScenePanoramaStreamDoneEvent | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const event = parseScenePanoramaStreamEvent(chunk);

      if (!event) {
        continue;
      }

      if (event.type === "error") {
        throw new Error(event.message === authRequiredCode ? authRequiredCode : event.message);
      }

      onEvent(event);

      if (event.type === "done") {
        doneEvent = event;
      }
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    const event = parseScenePanoramaStreamEvent(buffer);

    if (event?.type === "error") {
      throw new Error(event.message === authRequiredCode ? authRequiredCode : event.message);
    }

    if (event) {
      onEvent(event);
    }

    if (event?.type === "done") {
      doneEvent = event;
    }
  }

  if (!doneEvent) {
    throw new Error("SCENE_PANORAMA_STREAM_INCOMPLETE");
  }

  return doneEvent;
}

export async function streamHomeScenePanoramaMother(
  input: SceneMaterialCreateInput,
  blockId: string,
  locale: Locale,
  maxRedrawAttempts: number,
  referenceImages: SceneReferenceImageDraft[],
  onEvent: (event: ScenePanoramaStreamEvent) => void
) {
  const formData = new FormData();

  formData.append("draft", JSON.stringify(input));
  formData.append("blockId", blockId);
  formData.append("locale", locale);
  formData.append("maxRedrawAttempts", String(maxRedrawAttempts));
  referenceImages.forEach((image) => {
    formData.append("referenceImages", image.file);
  });

  const response = await fetch("/api/materials/scene-panorama/mother/stream", {
    body: formData,
    method: "POST"
  });

  if (!response.ok || !response.body) {
    throw new Error("SCENE_PANORAMA_STREAM_FAILED");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneEvent: Extract<ScenePanoramaStreamEvent, { type: "motherDone" }> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const event = parseScenePanoramaStreamEvent(chunk);

      if (!event) {
        continue;
      }

      if (event.type === "error") {
        throw new Error(event.message === authRequiredCode ? authRequiredCode : event.message);
      }

      onEvent(event);

      if (event.type === "motherDone") {
        doneEvent = event;
      }
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    const event = parseScenePanoramaStreamEvent(buffer);

    if (event?.type === "error") {
      throw new Error(event.message === authRequiredCode ? authRequiredCode : event.message);
    }

    if (event) {
      onEvent(event);
    }

    if (event?.type === "motherDone") {
      doneEvent = event;
    }
  }

  if (!doneEvent) {
    throw new Error("SCENE_PANORAMA_STREAM_INCOMPLETE");
  }

  return doneEvent;
}

export async function streamHomeMapImage(
  input: MapMaterialCreateInput,
  locale: Locale,
  nodeBatchSize: number,
  referenceImages: SceneReferenceImageDraft[],
  referencePrompt: string,
  onEvent: (event: MapImageStreamEvent) => void,
  options: {
    completedNodeIds?: string[];
    previousImageFile?: File | null;
    previousImageSource?: "generated" | "uploaded" | "existing";
    previousImageUrl?: string;
    resumeRound?: number;
  } = {}
) {
  const formData = new FormData();

  formData.append("draft", JSON.stringify(input));
  formData.append("locale", locale);
  formData.append("nodeBatchSize", String(nodeBatchSize));
  formData.append("referencePrompt", referencePrompt);
  formData.append("completedNodeIds", JSON.stringify(options.completedNodeIds ?? []));
  if (typeof options.resumeRound === "number") {
    formData.append("resumeRound", String(options.resumeRound));
  }
  if (options.previousImageFile) {
    formData.append("previousImage", options.previousImageFile);
    formData.append("previousImageSource", options.previousImageSource ?? "generated");
  } else if (options.previousImageUrl) {
    formData.append("previousImageUrl", options.previousImageUrl);
  }
  referenceImages.forEach((image) => {
    formData.append("referenceImages", image.file);
  });

  const response = await fetch("/api/materials/map-image/stream", {
    body: formData,
    method: "POST"
  });

  if (!response.ok || !response.body) {
    throw new Error("MAP_IMAGE_STREAM_FAILED");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminalEvent: MapImageStreamDoneEvent | Extract<MapImageStreamEvent, { type: "paused" }> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const event = parseMapImageStreamEvent(chunk);

      if (!event) {
        continue;
      }

      if (event.type === "error") {
        throw new Error(event.message === authRequiredCode ? authRequiredCode : event.message);
      }

      onEvent(event);

      if (event.type === "done" || event.type === "paused") {
        terminalEvent = event;
      }
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    const event = parseMapImageStreamEvent(buffer);

    if (event?.type === "error") {
      throw new Error(event.message === authRequiredCode ? authRequiredCode : event.message);
    }

    if (event) {
      onEvent(event);
    }

    if (event?.type === "done" || event?.type === "paused") {
      terminalEvent = event;
    }
  }

  if (!terminalEvent) {
    throw new Error("MAP_IMAGE_STREAM_INCOMPLETE");
  }

  return terminalEvent;
}

export async function generateHomeMapImageOutline(
  image: File,
  source: "generated" | "uploaded" | "existing" | null
): Promise<MapImageOutlineResult> {
  const formData = new FormData();

  formData.append("image", image);
  formData.append("source", source === "generated" ? "generated" : "uploaded");

  const response = await fetch("/api/materials/map-image/outline", {
    body: formData,
    method: "POST"
  });
  const payload = await response.json() as MapImageOutlineResult | { message?: string };

  if (!response.ok) {
    throw new Error("message" in payload && payload.message ? payload.message : "MAP_IMAGE_OUTLINE_FAILED");
  }

  return payload as MapImageOutlineResult;
}

export function resolveSendError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("missing-default-llm")) {
    return t("errors.missingDefaultLlm");
  }

  if (message.includes("missing-provider-secret")) {
    return t("errors.missingProviderSecret");
  }

  return t("errors.send");
}

function parseScenePanoramaStreamEvent(chunk: string): ScenePanoramaStreamEvent | null {
  const data = chunk
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  return data ? JSON.parse(data) as ScenePanoramaStreamEvent : null;
}

function parseMapImageStreamEvent(chunk: string): MapImageStreamEvent | null {
  const data = chunk
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  return data ? JSON.parse(data) as MapImageStreamEvent : null;
}
