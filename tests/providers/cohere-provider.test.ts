import { describe, expect, test } from "bun:test";
import { createOpenAIChatAdapter } from "../../src/adapters/openai-chat";
import { buildInitProviders } from "../../src/cli/init";
import { KEY_LOGIN_PROVIDERS, validateApiKey } from "../../src/oauth/key-providers";
import {
  deriveInitProviders,
  deriveProviderPresets,
  providerConfigSeed,
} from "../../src/providers/derive";
import { PROVIDER_REGISTRY } from "../../src/providers/registry";
import { routeModel } from "../../src/router";
import type { OcxConfig, OcxProviderConfig } from "../../src/types";

const MODEL = "command-a-plus-05-2026";
const BASE_URL = "https://api.cohere.ai/compatibility/v1";

function cohereEntry() {
  const entry = PROVIDER_REGISTRY.find(candidate => candidate.id === "cohere");
  if (!entry) throw new Error("missing Cohere registry entry");
  return entry;
}

function cohereConfig(overrides: Partial<OcxProviderConfig> = {}): OcxConfig {
  return {
    port: 10100,
    defaultProvider: "cohere",
    providers: {
      cohere: {
        ...providerConfigSeed(cohereEntry()),
        apiKey: "cohere-test-key",
        ...overrides,
      },
    },
  };
}

describe("Cohere OpenAI Compatibility API provider", () => {
  test("registers a conservative Chat Completions preset and derives its setup surfaces", async () => {
    expect(cohereEntry()).toMatchObject({
      id: "cohere",
      label: "Cohere",
      adapter: "openai-chat",
      baseUrl: BASE_URL,
      authKind: "key",
      dashboardUrl: "https://dashboard.cohere.com/api-keys",
      apiKeyValidation: "unknown",
      preserveCustomDestination: true,
      defaultModel: MODEL,
      models: [MODEL],
      liveModels: false,
      modelContextWindows: { [MODEL]: 128_000 },
      modelMaxOutputTokens: { [MODEL]: 64_000 },
      modelReasoningEfforts: { [MODEL]: ["high"] },
      modelDefaultReasoningEfforts: { [MODEL]: "high" },
      modelReasoningEffortMap: { [MODEL]: { none: "none" } },
      parallelToolCalls: false,
      omitChatStreamOptions: true,
    });

    expect(KEY_LOGIN_PROVIDERS.cohere).toMatchObject({
      label: "Cohere",
      adapter: "openai-chat",
      baseUrl: BASE_URL,
      dashboardUrl: "https://dashboard.cohere.com/api-keys",
      apiKeyValidation: "unknown",
      defaultModel: MODEL,
      models: [MODEL],
      liveModels: false,
      parallelToolCalls: false,
      omitChatStreamOptions: true,
    });
    expect(await validateApiKey("cohere", KEY_LOGIN_PROVIDERS.cohere!, "not-a-real-key")).toBe("unknown");

    expect(buildInitProviders()).toEqual(deriveInitProviders());
    expect(buildInitProviders().find(provider => provider.id === "cohere")).toMatchObject({
      kind: "key",
      adapter: "openai-chat",
      baseUrl: BASE_URL,
      defaultModel: MODEL,
    });
    expect(deriveProviderPresets().find(provider => provider.id === "cohere")).toMatchObject({
      auth: "key",
      dashboardUrl: "https://dashboard.cohere.com/api-keys",
    });

    const seed = providerConfigSeed(cohereEntry());
    expect(seed).toMatchObject({
      adapter: "openai-chat",
      baseUrl: BASE_URL,
      authMode: "key",
      defaultModel: MODEL,
      models: [MODEL],
      liveModels: false,
      modelContextWindows: { [MODEL]: 128_000 },
      modelMaxOutputTokens: { [MODEL]: 64_000 },
      modelDefaultReasoningEfforts: { [MODEL]: "high" },
      modelReasoningEffortMap: { [MODEL]: { none: "none" } },
      parallelToolCalls: false,
      omitChatStreamOptions: true,
    });
  });

  test("builds the documented Chat Completions request without unsupported extensions", () => {
    const config = cohereConfig();
    const route = routeModel(config, `cohere/${MODEL}`);
    const request = createOpenAIChatAdapter(route.provider).buildRequest({
      modelId: route.modelId,
      context: {
        messages: [{ role: "user", content: "ping", timestamp: 0 }],
        tools: [{
          name: "lookup",
          description: "Lookup",
          parameters: { type: "object", properties: { query: { type: "string" } } },
        }],
      },
      stream: true,
      options: { reasoning: "high", parallelToolCalls: true },
    });
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;

    expect(request.url).toBe(`${BASE_URL}/chat/completions`);
    expect(request.headers.Authorization).toBe("Bearer cohere-test-key");
    expect(body.model).toBe(MODEL);
    expect(body.stream).toBe(true);
    expect(body.reasoning_effort).toBe("high");
    expect(body).not.toHaveProperty("stream_options");
    expect(body).not.toHaveProperty("parallel_tool_calls");
    expect(body.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "function",
        function: expect.objectContaining({ name: "lookup" }),
      }),
    ]));
  });

  test("does not retarget a saved custom destination with the same provider id", () => {
    const route = routeModel(
      cohereConfig({ baseUrl: "https://custom.example/v1" }),
      "cohere/custom-model",
    );
    expect(route.provider).toMatchObject({
      adapter: "openai-chat",
      baseUrl: "https://custom.example/v1",
      authMode: "key",
    });
  });
});
