import "server-only";

import { createConnection } from "node:net";
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
  var __nwtProxyHealthCache:
    | {
        checkedAt: number;
        reachable: boolean;
        signature: string;
      }
    | undefined;
}

const proxyProbeTimeoutMs = 1000;
const proxyProbeCacheMs = 60_000;

export async function configureServerOutboundProxy() {
  const config = await resolveRuntimeServerProxyConfig();

  configureUndiciProxy(config);

  return config;
}

export async function createProxyAwareNodeHttpHandler() {
  const config = await resolveRuntimeServerProxyConfig();

  if (!config.enabled) {
    return undefined;
  }

  const agent = getSharedNodeProxyAgent(config);

  return new NodeHttpHandler({
    httpAgent: agent as unknown as HttpAgent,
    httpsAgent: agent as unknown as HttpsAgent
  });
}

export async function probeServerProxyConfig(config: ServerProxyConfig) {
  const proxyUrls = getConfiguredProxyUrls(config);

  if (proxyUrls.length === 0) {
    return false;
  }

  for (const proxyUrl of proxyUrls) {
    if (!(await probeProxyEndpoint(proxyUrl))) {
      return false;
    }
  }

  return true;
}

async function resolveRuntimeServerProxyConfig() {
  const config = resolveServerProxyConfig(await readOutboundProxySettings());

  if (!config.enabled) {
    return config;
  }

  const reachable = await probeServerProxyConfigWithCache(config);

  if (reachable) {
    return config;
  }

  return disableServerProxyConfig(config);
}

async function probeServerProxyConfigWithCache(config: ServerProxyConfig) {
  const cached = globalThis.__nwtProxyHealthCache;
  const now = Date.now();

  if (cached && cached.signature === config.signature && now - cached.checkedAt < proxyProbeCacheMs) {
    return cached.reachable;
  }

  const reachable = await probeServerProxyConfig(config);

  globalThis.__nwtProxyHealthCache = {
    checkedAt: now,
    reachable,
    signature: config.signature
  };

  return reachable;
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

  setGlobalDispatcher(
    new EnvHttpProxyAgent({
      httpProxy: config.httpProxy || config.httpsProxy,
      httpsProxy: config.httpsProxy || config.httpProxy,
      noProxy: config.noProxy
    })
  );
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

function disableServerProxyConfig(config: ServerProxyConfig): ServerProxyConfig {
  return {
    ...config,
    enabled: false,
    signature: JSON.stringify({
      enabled: false,
      httpProxy: config.httpProxy,
      httpsProxy: config.httpsProxy,
      noProxy: config.noProxy
    })
  };
}

function getConfiguredProxyUrls(config: ServerProxyConfig) {
  return [config.httpProxy, config.httpsProxy].map((value) => value.trim()).filter(Boolean);
}

async function probeProxyEndpoint(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname;
    const port = url.port ? Number.parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80;

    if (!host || !Number.isFinite(port) || port <= 0) {
      return false;
    }

    return await new Promise<boolean>((resolve) => {
      const socket = createConnection({ host, port });
      let settled = false;

      const settle = (reachable: boolean) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.removeAllListeners();
        socket.destroy();
        resolve(reachable);
      };

      socket.setTimeout(proxyProbeTimeoutMs);
      socket.once("connect", () => settle(true));
      socket.once("timeout", () => settle(false));
      socket.once("error", () => settle(false));
    });
  } catch {
    return false;
  }
}
