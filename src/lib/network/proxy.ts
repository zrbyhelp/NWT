import "server-only";

import type { Agent as HttpAgent } from "node:http";
import type { Agent as HttpsAgent } from "node:https";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { ProxyAgent } from "proxy-agent";
import { EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher, type Dispatcher } from "undici";
import { getProxyUrlForRequest, resolveServerProxyConfig, type ServerProxyConfig } from "@/lib/network/proxy-utils";
import { defaultOutboundProxySettings } from "@/lib/system-settings-types";

export { resolveServerProxyConfig, type ServerProxyConfig } from "@/lib/network/proxy-utils";

declare global {
  var __nwtOriginalUndiciDispatcher: Dispatcher | undefined;
  var __nwtProxySignature: string | undefined;
  var __nwtNodeProxyAgent: ProxyAgent | undefined;
  var __nwtNodeProxyAgentSignature: string | undefined;
}

export async function configureServerOutboundProxy() {
  const config = resolveServerProxyConfig(await readOutboundProxySettings());

  configureUndiciProxy(config);

  return config;
}

export async function createProxyAwareNodeHttpHandler() {
  const config = resolveServerProxyConfig(await readOutboundProxySettings());

  if (!config.enabled) {
    return undefined;
  }

  const agent = getSharedNodeProxyAgent(config);

  return new NodeHttpHandler({
    httpAgent: agent as unknown as HttpAgent,
    httpsAgent: agent as unknown as HttpsAgent
  });
}

async function readOutboundProxySettings() {
  try {
    const { getOutboundProxySettings } = await import("@/lib/system-settings");

    return await getOutboundProxySettings();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (process.env.NODE_ENV === "test" && message.includes("DATABASE_URL is required")) {
      return { ...defaultOutboundProxySettings };
    }

    throw error;
  }
}

function configureUndiciProxy(config: ServerProxyConfig) {
  if (!globalThis.__nwtOriginalUndiciDispatcher) {
    globalThis.__nwtOriginalUndiciDispatcher = getGlobalDispatcher();
  }

  if (!config.enabled) {
    if (globalThis.__nwtProxySignature) {
      setGlobalDispatcher(globalThis.__nwtOriginalUndiciDispatcher);
      globalThis.__nwtProxySignature = undefined;
    }

    return;
  }

  if (globalThis.__nwtProxySignature === config.signature) {
    return;
  }

  setGlobalDispatcher(new EnvHttpProxyAgent({
    httpProxy: config.httpProxy || config.httpsProxy,
    httpsProxy: config.httpsProxy || config.httpProxy,
    noProxy: config.noProxy
  }));
  globalThis.__nwtProxySignature = config.signature;
}

function getSharedNodeProxyAgent(config: ServerProxyConfig) {
  if (!globalThis.__nwtNodeProxyAgent || globalThis.__nwtNodeProxyAgentSignature !== config.signature) {
    globalThis.__nwtNodeProxyAgent?.destroy();
    globalThis.__nwtNodeProxyAgent = new ProxyAgent({
      getProxyForUrl: (url) => getProxyUrlForRequest(url, config)
    });
    globalThis.__nwtNodeProxyAgentSignature = config.signature;
  }

  return globalThis.__nwtNodeProxyAgent;
}
