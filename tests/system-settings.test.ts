import { describe, expect, it } from "vitest";
import {
  defaultOutboundProxySettings,
  normalizeOutboundProxySettings,
  outboundProxyInputSchema
} from "@/lib/system-settings-types";
import { getProxyUrlForRequest, resolveServerProxyConfig } from "@/lib/network/proxy-utils";

describe("outbound proxy settings", () => {
  it("normalizes missing values to the disabled default", () => {
    expect(normalizeOutboundProxySettings({})).toEqual(defaultOutboundProxySettings);
  });

  it("requires a proxy URL when enabled", () => {
    expect(() =>
      outboundProxyInputSchema.parse({
        enabled: true,
        httpProxy: "",
        httpsProxy: "",
        noProxy: "127.0.0.1,localhost"
      })
    ).toThrow("OUTBOUND_PROXY_URL_REQUIRED");
  });

  it("rejects non-http proxy URLs", () => {
    expect(() =>
      outboundProxyInputSchema.parse({
        enabled: true,
        httpProxy: "socks5://127.0.0.1:7890",
        httpsProxy: "",
        noProxy: "127.0.0.1,localhost"
      })
    ).toThrow("OUTBOUND_PROXY_URL_INVALID");
  });

  it("skips no_proxy hosts and proxies external requests", () => {
    const config = resolveServerProxyConfig({
      enabled: true,
      httpProxy: "http://proxy.local:7890",
      httpsProxy: "http://secure-proxy.local:7890",
      noProxy: "127.0.0.1,localhost,.internal,*.example.test,api.service.test:8443"
    });

    expect(getProxyUrlForRequest("http://api.openai.com/v1/models", config)).toBe("http://proxy.local:7890");
    expect(getProxyUrlForRequest("https://api.openai.com/v1/models", config)).toBe("http://secure-proxy.local:7890");
    expect(getProxyUrlForRequest("http://localhost:3000/api", config)).toBe("");
    expect(getProxyUrlForRequest("http://worker.internal/jobs", config)).toBe("");
    expect(getProxyUrlForRequest("https://cdn.example.test/image.png", config)).toBe("");
    expect(getProxyUrlForRequest("https://api.service.test:8443/models", config)).toBe("");
    expect(getProxyUrlForRequest("https://api.service.test:9443/models", config)).toBe("http://secure-proxy.local:7890");
  });
});
