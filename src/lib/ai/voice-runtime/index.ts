import {
  cosyVoiceCallPreset,
  fishSpeechCallPreset,
  genericVoiceCallPreset,
  openAiVoiceCallPreset,
  qwenVoiceCallPreset,
  senseVoiceCallPreset,
  xiaomiVoiceCallPreset
} from "./presets";
import type { VoiceModelCallPreset, VoiceModelCapability, VoiceRuntimeConfig } from "./types";

export type {
  VoiceModelCallPreset,
  VoiceModelCallPresetId,
  VoiceModelCallTransport,
  VoiceModelCapability,
  VoiceRuntimeConfig
} from "./types";

export {
  cosyVoiceCallPreset,
  fishSpeechCallPreset,
  genericVoiceCallPreset,
  openAiVoiceCallPreset,
  qwenVoiceCallPreset,
  senseVoiceCallPreset,
  xiaomiVoiceCallPreset
} from "./presets";

export function resolveVoiceModelCallPreset(config: VoiceRuntimeConfig): VoiceModelCallPreset {
  const haystack = createVoiceModelHaystack(config);

  if (isXiaomiVoiceModel(haystack)) {
    return withCapabilities(xiaomiVoiceCallPreset, inferVoiceModelCapabilities(haystack, xiaomiVoiceCallPreset.capabilities));
  }

  if (isOpenAiVoiceModel(haystack)) {
    return withCapabilities(openAiVoiceCallPreset, inferVoiceModelCapabilities(haystack, openAiVoiceCallPreset.capabilities));
  }

  if (isCosyVoiceModel(haystack)) {
    return withCapabilities(cosyVoiceCallPreset, inferVoiceModelCapabilities(haystack, cosyVoiceCallPreset.capabilities));
  }

  if (isQwenVoiceModel(haystack)) {
    return withCapabilities(qwenVoiceCallPreset, inferVoiceModelCapabilities(haystack, qwenVoiceCallPreset.capabilities));
  }

  if (isFishSpeechModel(haystack)) {
    return withCapabilities(fishSpeechCallPreset, inferVoiceModelCapabilities(haystack, fishSpeechCallPreset.capabilities));
  }

  if (isSenseVoiceModel(haystack)) {
    return withCapabilities(senseVoiceCallPreset, inferVoiceModelCapabilities(haystack, senseVoiceCallPreset.capabilities));
  }

  return withCapabilities(genericVoiceCallPreset, inferVoiceModelCapabilities(haystack, genericVoiceCallPreset.capabilities));
}

export function inferVoiceModelCapabilities(value: string, fallback: VoiceModelCapability[] = genericVoiceCallPreset.capabilities): VoiceModelCapability[] {
  const normalized = normalizeVoiceModelText(value);

  if (/(voice[-_:/ ]?design|voice[-_:/ ]?create|voice[-_:/ ]?creation|声音设计|音色设计)/.test(normalized)) {
    return ["voice-design"];
  }

  if (/(voice[-_:/ ]?clone|voice[-_:/ ]?cloning|clone[-_:/ ]?voice|声音克隆|音色克隆)/.test(normalized)) {
    return ["voice-clone"];
  }

  if (/(^|[-_:/ ])(asr|stt|transcribe|transcription|recognition|speech[-_:/ ]?to[-_:/ ]?text|whisper|sensevoice)([-_:/ ]|$)/.test(normalized)) {
    return ["asr"];
  }

  if (/(^|[-_:/ ])(tts|text[-_:/ ]?to[-_:/ ]?speech|speech|cosyvoice|fish[-_:/ ]?speech|mimo)([-_:/ ]|$)/.test(normalized)) {
    return ["tts"];
  }

  return fallback;
}

function createVoiceModelHaystack(config: VoiceRuntimeConfig) {
  return normalizeVoiceModelText(`${config.providerName} ${config.baseUrl} ${config.modelId}`);
}

function normalizeVoiceModelText(value: string) {
  return value.trim().toLowerCase();
}

function isXiaomiVoiceModel(haystack: string) {
  return /(xiaomi|mimo|小米|platform\.xiaomimimo\.com)/.test(haystack);
}

function isOpenAiVoiceModel(haystack: string) {
  return /(api\.openai\.com|openai|(^|[-_:/ ])(?:tts-[0-9a-z.-]+|whisper-[0-9a-z.-]+|gpt-4o(?:-mini)?-(?:tts|transcribe|audio-preview))([-_:/ ]|$))/.test(haystack);
}

function isCosyVoiceModel(haystack: string) {
  return /(cosy[-_:/ ]?voice|cosyvoice)/.test(haystack);
}

function isQwenVoiceModel(haystack: string) {
  return /(qwen[-_:/ ]?(?:tts|audio|omni|asr)|tongyi|dashscope|aliyun|alibaba|通义|百炼)/.test(haystack);
}

function isFishSpeechModel(haystack: string) {
  return /(fish[-_:/ ]?speech|fishaudio|fish\.audio)/.test(haystack);
}

function isSenseVoiceModel(haystack: string) {
  return /(sense[-_:/ ]?voice|sensevoice)/.test(haystack);
}

function withCapabilities(preset: VoiceModelCallPreset, capabilities: VoiceModelCapability[]): VoiceModelCallPreset {
  return {
    ...preset,
    capabilities
  };
}
