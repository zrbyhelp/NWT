export type VoiceModelCallPresetId = "xiaomi" | "openai" | "qwen" | "cosyvoice" | "fish-speech" | "sensevoice" | "generic";

export type VoiceModelCapability = "tts" | "asr" | "voice-design" | "voice-clone";

export type VoiceModelCallTransport =
  | "dashscope-compatible"
  | "fish-speech-compatible"
  | "openai-compatible"
  | "sensevoice-compatible"
  | "xiaomi-mimo";

export type VoiceRuntimeConfig = {
  baseUrl: string;
  modelId: string;
  providerName: string;
};

export type VoiceModelCallPreset = {
  id: VoiceModelCallPresetId;
  capabilities: VoiceModelCapability[];
  transport: VoiceModelCallTransport;
};
