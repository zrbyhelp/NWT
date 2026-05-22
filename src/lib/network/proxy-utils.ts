import type { OutboundProxySettings } from "@/lib/system-settings-types";

export type ServerProxyConfig = {
  enabled: boolean;
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
  signature: string;
};

export function resolveServerProxyConfig(settings: OutboundProxySettings): ServerProxyConfig {
  const httpProxy = settings.httpProxy.trim();
  const httpsProxy = settings.httpsProxy.trim();
  const noProxy = settings.noProxy.trim();
  const enabled = settings.enabled && Boolean(httpProxy || httpsProxy);
  const signature = JSON.stringify({
    enabled,
    httpProxy,
    httpsProxy,
    noProxy
  });

  return {
    enabled,
    httpProxy,
    httpsProxy,
    noProxy,
    signature
  };
}

export function getProxyUrlForRequest(value: string, config: ServerProxyConfig) {
  if (!config.enabled) {
    return "";
  }

  const url = new URL(value);

  if (!shouldProxyUrl(url, config.noProxy)) {
    return "";
  }

  return url.protocol === "http:" ? config.httpProxy || config.httpsProxy : config.httpsProxy || config.httpProxy;
}

export function shouldProxyUrl(url: URL, noProxy: string) {
  const entries = noProxy
    .split(/[,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (entries.length === 0) {
    return true;
  }

  if (entries.includes("*")) {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  const port = url.port ? Number.parseInt(url.port, 10) : defaultPort(url.protocol);

  return entries.every((entry) => {
    const { host, port: entryPort } = parseNoProxyEntry(entry);

    if (entryPort && entryPort !== port) {
      return true;
    }

    if (host.startsWith("*.")) {
      return !hostname.endsWith(host.slice(1));
    }

    if (host.startsWith(".")) {
      return !hostname.endsWith(host);
    }

    return hostname !== host;
  });
}

function parseNoProxyEntry(entry: string) {
  const match = entry.match(/^(.+):(\d+)$/);

  return {
    host: match?.[1] ?? entry,
    port: match?.[2] ? Number.parseInt(match[2], 10) : 0
  };
}

function defaultPort(protocol: string) {
  return protocol === "https:" ? 443 : protocol === "http:" ? 80 : 0;
}
