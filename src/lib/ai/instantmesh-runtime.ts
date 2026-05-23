import "server-only";

import { getDefaultInstantMeshRuntimeConfig } from "@/lib/ai/model-config";
import { configureServerOutboundProxy } from "@/lib/network/proxy";
import { updateAiObservation, withAiObservation } from "@/lib/observability/langfuse";
import { isValidMaterialModelBytes, uploadItemModelBytes } from "@/lib/storage/material";

export type InstantMeshInputImage = {
  bytes: Buffer;
  contentType: string;
  fileName: string;
};

export type InstantMeshStreamEvent =
  | { type: "progress"; stage: "queued" | "submitted" | "polling" | "downloading" | "uploading"; messageKey: string; progress: number }
  | { type: "done"; byteSize: number; contentType: string; fileName: string; url: string }
  | { type: "error"; message: string };

export type InstantMeshStreamCallback = (event: InstantMeshStreamEvent) => void | Promise<void>;

type InstantMeshTaskResponse = {
  taskId?: string;
};

type InstantMeshStatusResponse = {
  error?: string;
  glbUrl?: string;
  message?: string;
  status?: string;
};

export async function generateInstantMeshModelFromImage({
  extraParams,
  image,
  onEvent,
  scaleHint,
  userId
}: {
  extraParams?: string;
  image: InstantMeshInputImage;
  onEvent?: InstantMeshStreamCallback;
  scaleHint?: string;
  userId: string;
}) {
  validateInstantMeshImage(image);
  const config = await getDefaultInstantMeshRuntimeConfig(userId);

  return withAiObservation("item.instantmesh.generate", {
    feature: "item.instantmesh.generate",
    input: {
      imageFileName: image.fileName,
      scaleHint,
      submitPath: config.submitPath,
      statusPathTemplate: config.statusPathTemplate
    },
    modelId: "instantmesh",
    providerName: config.name,
    userId
  }, async (span) => {
    await emit(onEvent, { type: "progress", stage: "queued", messageKey: "itemForm.modelProgressQueued", progress: 5 });
    await configureServerOutboundProxy();

    const taskId = await submitInstantMeshTask(config, image, scaleHint, extraParams);

    updateAiObservation(span, {
      metadata: {
        baseUrl: config.baseUrl,
        taskId
      }
    });
    await emit(onEvent, { type: "progress", stage: "submitted", messageKey: "itemForm.modelProgressSubmitted", progress: 20 });

    const glbUrl = await pollInstantMeshTask(config, taskId, onEvent);

    await emit(onEvent, { type: "progress", stage: "downloading", messageKey: "itemForm.modelProgressDownloading", progress: 82 });
    const { bytes, contentType, fileName } = await downloadInstantMeshModel(glbUrl);

    await emit(onEvent, { type: "progress", stage: "uploading", messageKey: "itemForm.modelProgressUploading", progress: 92 });
    const url = await uploadItemModelBytes(userId, bytes, contentType, fileName);

    const result = {
      byteSize: bytes.byteLength,
      contentType,
      fileName,
      url
    };

    updateAiObservation(span, {
      output: result
    });
    await emit(onEvent, { type: "done", ...result });

    return result;
  });
}

function validateInstantMeshImage(image: InstantMeshInputImage) {
  if (!image.bytes.byteLength || !image.contentType) {
    throw new Error("ITEM_MODEL_INPUT_IMAGE_REQUIRED");
  }
}

async function submitInstantMeshTask(
  config: Awaited<ReturnType<typeof getDefaultInstantMeshRuntimeConfig>>,
  image: InstantMeshInputImage,
  scaleHint?: string,
  extraParams?: string
) {
  const formData = new FormData();
  const bytes = new Uint8Array(image.bytes.byteLength);

  bytes.set(image.bytes);
  formData.append(
    "modelInputImage",
    new Blob([bytes.buffer], { type: image.contentType }),
    image.fileName || "model-input.png"
  );
  formData.append("format", "glb");
  formData.append("scaleHint", scaleHint ?? "");
  formData.append("extraParams", extraParams ?? "");

  const response = await fetch(buildInstantMeshUrl(config.baseUrl, config.submitPath), {
    body: formData,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${config.apiKey}`
    },
    method: "POST"
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`INSTANTMESH_SUBMIT_FAILED_${response.status}: ${truncateInstantMeshError(text)}`);
  }

  const payload = parseJson(text) as InstantMeshTaskResponse | null;
  const taskId = payload?.taskId;

  if (!taskId) {
    throw new Error("INSTANTMESH_TASK_ID_MISSING");
  }

  return taskId;
}

async function pollInstantMeshTask(
  config: Awaited<ReturnType<typeof getDefaultInstantMeshRuntimeConfig>>,
  taskId: string,
  onEvent?: InstantMeshStreamCallback
) {
  const startedAt = Date.now();
  const timeoutMs = config.timeoutSeconds * 1000;
  let attempt = 0;

  while (Date.now() - startedAt <= timeoutMs) {
    attempt += 1;
    await sleep(config.pollIntervalMs);
    await emit(onEvent, {
      type: "progress",
      stage: "polling",
      messageKey: "itemForm.modelProgressPolling",
      progress: Math.min(80, 24 + attempt * 4)
    });

    const response = await fetch(buildInstantMeshStatusUrl(config.baseUrl, config.statusPathTemplate, taskId), {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      }
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`INSTANTMESH_STATUS_FAILED_${response.status}: ${truncateInstantMeshError(text)}`);
    }

    const payload = parseJson(text) as InstantMeshStatusResponse | null;
    const status = payload?.status?.toLowerCase();

    if (status === "succeeded" || status === "success" || status === "completed") {
      if (!payload?.glbUrl) {
        throw new Error("INSTANTMESH_GLB_URL_MISSING");
      }

      return payload.glbUrl;
    }

    if (status === "failed" || status === "error" || status === "cancelled") {
      throw new Error(`INSTANTMESH_TASK_FAILED: ${truncateInstantMeshError(payload?.error ?? payload?.message ?? status)}`);
    }
  }

  throw new Error("INSTANTMESH_TASK_TIMEOUT");
}

async function downloadInstantMeshModel(url: string) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`INSTANTMESH_MODEL_DOWNLOAD_FAILED_${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "model/gltf-binary";
  const fileName = getInstantMeshFileName(url);

  if (!isValidMaterialModelBytes(bytes, contentType, fileName)) {
    throw new Error("INVALID_ITEM_MODEL_FILE");
  }

  return {
    bytes,
    contentType: "model/gltf-binary",
    fileName
  };
}

function buildInstantMeshUrl(baseUrl: string, path: string) {
  const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${trimmedBaseUrl}/${path.replace(/^\/+/, "")}`;
}

function buildInstantMeshStatusUrl(baseUrl: string, template: string, taskId: string) {
  return buildInstantMeshUrl(baseUrl, template.replace("{taskId}", encodeURIComponent(taskId)));
}

function getInstantMeshFileName(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split("/").filter(Boolean).pop() ?? "item-model.glb";

    return name.toLowerCase().endsWith(".glb") ? name : "item-model.glb";
  } catch {
    return "item-model.glb";
  }
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateInstantMeshError(value: unknown) {
  return String(value ?? "").slice(0, 500);
}

async function emit(onEvent: InstantMeshStreamCallback | undefined, event: InstantMeshStreamEvent) {
  if (onEvent) {
    await onEvent(event);
  }
}
