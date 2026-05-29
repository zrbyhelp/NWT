import type { VoiceModelCallPreset } from "./types";

export const genericVoiceCallPreset: VoiceModelCallPreset = {
  id: "generic",
  capabilities: ["tts", "asr"],
  transport: "openai-compatible"
};

export const xiaomiVoiceCallPreset: VoiceModelCallPreset = {
  id: "xiaomi",
  capabilities: ["tts", "asr", "voice-design", "voice-clone"],
  transport: "xiaomi-mimo"
};

export const openAiVoiceCallPreset: VoiceModelCallPreset = {
  id: "openai",
  capabilities: ["tts", "asr"],
  transport: "openai-compatible"
};

export const qwenVoiceCallPreset: VoiceModelCallPreset = {
  id: "qwen",
  capabilities: ["tts", "asr"],
  transport: "dashscope-compatible"
};

export const cosyVoiceCallPreset: VoiceModelCallPreset = {
  id: "cosyvoice",
  capabilities: ["tts", "voice-clone"],
  transport: "dashscope-compatible"
};

export const fishSpeechCallPreset: VoiceModelCallPreset = {
  id: "fish-speech",
  capabilities: ["tts", "voice-clone"],
  transport: "fish-speech-compatible"
};

export const senseVoiceCallPreset: VoiceModelCallPreset = {
  id: "sensevoice",
  capabilities: ["asr"],
  transport: "sensevoice-compatible"
};
