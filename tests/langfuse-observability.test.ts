import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callbackHandler: vi.fn(function CallbackHandler(params: unknown) {
    return { name: "LangfuseCallbackHandler", params };
  }),
  openAI: vi.fn(function OpenAI(config: unknown) {
    return { config };
  }),
  observeOpenAI: vi.fn((client: unknown, config: unknown) => ({ client, config, observed: true })),
  propagateAttributes: vi.fn((_params: unknown, fn: () => unknown) => fn()),
  span: {
    update: vi.fn()
  },
  startActiveObservation: vi.fn((_name: string, fn: (span: { update: (attributes: unknown) => unknown }) => unknown) =>
    fn(mocks.span)
  )
}));

vi.mock("@langfuse/langchain", () => ({
  CallbackHandler: mocks.callbackHandler
}));

vi.mock("@langfuse/openai", () => ({
  observeOpenAI: mocks.observeOpenAI
}));

vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: mocks.propagateAttributes,
  startActiveObservation: mocks.startActiveObservation
}));

vi.mock("openai", () => ({
  default: mocks.openAI
}));

describe("Langfuse observability helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_BASE_URL;
    delete process.env.LANGFUSE_BASEURL;
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks observed OpenAI clients outside tests when Langfuse keys are missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { createObservedOpenAIClient } = await import("@/lib/observability/langfuse");

    expect(() =>
      createObservedOpenAIClient(
        {
          apiKey: "sk-test",
          baseUrl: "https://api.example.com/v1",
          modelId: "story-model",
          providerName: "Example"
        },
        { feature: "unit.openai", userId: "user-1" }
      )
    ).toThrow(expect.objectContaining({ code: "missing-langfuse-config" }));
    expect(mocks.openAI).not.toHaveBeenCalled();
    expect(mocks.observeOpenAI).not.toHaveBeenCalled();
  });

  it("wraps OpenAI clients with Langfuse trace metadata", async () => {
    process.env.LANGFUSE_PUBLIC_KEY = "lf_pk_test";
    process.env.LANGFUSE_SECRET_KEY = "lf_sk_test";
    const { createObservedOpenAIClient } = await import("@/lib/observability/langfuse");

    const client = createObservedOpenAIClient(
      {
        apiKey: "sk-test",
        baseUrl: "https://api.example.com/v1",
        modelId: "story-model",
        providerName: "Example",
        source: "database",
        temperature: 0.8
      },
      {
        conversationId: "conversation-1",
        feature: "conversation.reply",
        sessionId: "conversation-1",
        userId: "user-1"
      }
    );

    expect(client).toMatchObject({ observed: true });
    expect(mocks.openAI).toHaveBeenCalledWith({
      apiKey: "sk-test",
      baseURL: "https://api.example.com/v1"
    });
    expect(mocks.observeOpenAI).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        generationName: "conversation.reply.openai",
        sessionId: "conversation-1",
        tags: ["qijing-ai", "conversation.reply"],
        traceName: "conversation.reply",
        userId: "user-1"
      })
    );
    const openAiConfig = mocks.observeOpenAI.mock.calls[0][1] as { generationMetadata: Record<string, unknown> };

    expect(openAiConfig.generationMetadata).toMatchObject({
      conversationId: "conversation-1",
      feature: "conversation.reply",
      modelId: "story-model",
      providerName: "Example"
    });
  });

  it("creates LangGraph run config with Langfuse callbacks and metadata", async () => {
    const { createLangGraphRunConfig } = await import("@/lib/observability/langfuse");

    const config = createLangGraphRunConfig(
      {
        conversationId: "conversation-1",
        feature: "graph.workflow",
        metadata: { stage: "smoke" },
        sessionId: "conversation-1",
        userId: "user-1"
      },
      {
        metadata: { existing: "value" },
        tags: ["existing-tag"]
      }
    );

    expect(mocks.callbackHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "conversation-1",
        tags: ["qijing-ai", "graph.workflow"],
        traceMetadata: expect.objectContaining({
          conversationId: "conversation-1",
          feature: "graph.workflow",
          stage: "smoke"
        }),
        userId: "user-1"
      })
    );
    expect(config.callbacks).toHaveLength(1);
    expect(config.metadata).toMatchObject({
      conversationId: "conversation-1",
      existing: "value",
      feature: "graph.workflow",
      stage: "smoke"
    });
    expect(config.tags).toEqual(["existing-tag", "qijing-ai", "graph.workflow"]);
  });

  it("propagates trace attributes around observed AI work", async () => {
    const { withAiObservation } = await import("@/lib/observability/langfuse");

    const result = await withAiObservation(
      "unit.trace",
      {
        feature: "unit.trace",
        input: { prompt: "hello" },
        sessionId: "session-1",
        userId: "user-1"
      },
      async (span) => {
        span.update({ output: "ok" });
        return "ok";
      }
    );

    expect(result).toBe("ok");
    expect(mocks.startActiveObservation).toHaveBeenCalledWith("unit.trace", expect.any(Function), { asType: "span" });
    expect(mocks.propagateAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ feature: "unit.trace" }),
        sessionId: "session-1",
        traceName: "unit.trace",
        userId: "user-1"
      }),
      expect.any(Function)
    );
    expect(mocks.span.update).toHaveBeenCalledWith(expect.objectContaining({ input: { prompt: "hello" } }));
  });
});
