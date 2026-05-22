import "server-only";

import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  defaultOutboundProxySettings,
  normalizeOutboundProxySettings,
  outboundProxyInputSchema,
  type AdminSystemSettings,
  type OutboundProxySettings
} from "@/lib/system-settings-types";

const outboundProxySettingKey = "outboundProxy";

export async function getAdminSystemSettings(): Promise<AdminSystemSettings> {
  await requireAdmin();

  return {
    outboundProxy: await getOutboundProxySettings()
  };
}

export async function saveAdminOutboundProxySettings(input: OutboundProxySettings): Promise<AdminSystemSettings> {
  await requireAdmin();

  const outboundProxy = outboundProxyInputSchema.parse(input);

  await prisma.systemSetting.upsert({
    where: { key: outboundProxySettingKey },
    update: { value: outboundProxy as unknown as Prisma.InputJsonValue },
    create: {
      key: outboundProxySettingKey,
      value: outboundProxy as unknown as Prisma.InputJsonValue
    }
  });

  return { outboundProxy };
}

export async function getOutboundProxySettings(): Promise<OutboundProxySettings> {
  const systemSetting = (prisma as typeof prisma & {
    systemSetting?: {
      findUnique: typeof prisma.systemSetting.findUnique;
    };
  }).systemSetting;

  if (!systemSetting) {
    return { ...defaultOutboundProxySettings };
  }

  const setting = await systemSetting.findUnique({
    where: { key: outboundProxySettingKey }
  });

  if (!setting) {
    return { ...defaultOutboundProxySettings };
  }

  try {
    return normalizeOutboundProxySettings(setting.value);
  } catch {
    return { ...defaultOutboundProxySettings };
  }
}
