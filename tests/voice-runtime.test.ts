import { describe, expect, it } from "vitest";
import { inferVoiceModelCapabilities, resolveVoiceModelCallPreset } from "@/lib/ai/voice-runtime";

describe("voice model call presets", () => {
  it("resolves Xiaomi MiMo voice models", () => {
    expect(
      resolveVoiceModelCallPreset({
        baseUrl: "https://platform.xiaomimimo.com/v1",
        modelId: "MiMo-V2-TTS",
        providerName: "小米语音 AI"
      })
    ).toMatchObject({ id: "xiaomi", capabilities: ["tts"], transport: "xiaomi-mimo" });

    expect(
      resolveVoiceModelCallPreset({
        baseUrl: "https://platform.xiaomimimo.com/v1",
        modelId: "mimo-v2.5-tts",
        providerName: "Xiaomi"
      })
    ).toMatchObject({ id: "xiaomi", capabilities: ["tts"] });
  });

  it("infers Xiaomi voice design and voice clone capabilities", () => {
    expect(inferVoiceModelCapabilities("MiMo-V2.5-TTS-VoiceDesign")).toEqual(["voice-design"]);
    expect(inferVoiceModelCapabilities("MiMo-V2.5-TTS-VoiceClone")).toEqual(["voice-clone"]);
    expect(inferVoiceModelCapabilities("MiMo-V2.5-ASR")).toEqual(["asr"]);
  });

  it("resolves common provider families", () => {
    expect(resolveVoiceModelCallPreset({ baseUrl: "https://api.openai.com/v1", modelId: "tts-1", providerName: "OpenAI" }).id).toBe("openai");
    expect(resolveVoiceModelCallPreset({ baseUrl: "https://api.openai.com/v1", modelId: "gpt-4o-mini-tts", providerName: "OpenAI" }).id).toBe("openai");
    expect(resolveVoiceModelCallPreset({ baseUrl: "https://api.openai.com/v1", modelId: "whisper-1", providerName: "OpenAI" }).id).toBe("openai");
    expect(resolveVoiceModelCallPreset({ baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", modelId: "qwen-tts", providerName: "通义千问" }).id).toBe("qwen");
    expect(resolveVoiceModelCallPreset({ baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", modelId: "cosyvoice-v2", providerName: "DashScope" }).id).toBe("cosyvoice");
    expect(resolveVoiceModelCallPreset({ baseUrl: "https://api.fish.audio/v1", modelId: "fish-speech-1.5", providerName: "Fish Audio" }).id).toBe("fish-speech");
    expect(resolveVoiceModelCallPreset({ baseUrl: "https://api.example.com/v1", modelId: "sensevoice-small", providerName: "SenseVoice" }).id).toBe("sensevoice");
  });

  it("falls back to generic for unknown voice configs", () => {
    expect(
      resolveVoiceModelCallPreset({
        baseUrl: "https://voice.example.com/v1",
        modelId: "custom-model",
        providerName: "Custom"
      })
    ).toMatchObject({ id: "generic", capabilities: ["tts", "asr"], transport: "openai-compatible" });
  });
});
