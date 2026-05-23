import type {
  WorkspaceMaterial,
  WorkspaceScript
} from "@/lib/home-workspace";

export function mergeScripts(primaryScripts: WorkspaceScript[], preferredScripts: WorkspaceScript[]) {
  const scriptsById = new Map<string, WorkspaceScript>();

  primaryScripts.forEach((script) => scriptsById.set(script.id, script));
  preferredScripts.forEach((script) => scriptsById.set(script.id, script));

  return Array.from(scriptsById.values());
}

export function mergeMaterials(primaryMaterials: WorkspaceMaterial[], preferredMaterials: WorkspaceMaterial[]) {
  const materialsById = new Map<string, WorkspaceMaterial>();

  primaryMaterials.forEach((material) => materialsById.set(material.id, material));
  preferredMaterials.forEach((material) => materialsById.set(material.id, material));

  return Array.from(materialsById.values());
}

export function upsertMaterialList(materials: WorkspaceMaterial[], material: WorkspaceMaterial) {
  const exists = materials.some((item) => item.id === material.id);

  if (!exists) {
    return [material, ...materials];
  }

  return materials.map((item) => (item.id === material.id ? material : item));
}

export function groupConversations<T extends { updatedAt: string }>(conversations: T[]) {
  const groups: Array<{ key: "today" | "earlier"; conversations: T[] }> = [
    { key: "today", conversations: [] },
    { key: "earlier", conversations: [] }
  ];
  const today = new Date();

  conversations.forEach((conversation) => {
    const date = new Date(conversation.updatedAt);
    const key = date.toDateString() === today.toDateString() ? "today" : "earlier";
    groups.find((group) => group.key === key)?.conversations.push(conversation);
  });

  return groups.filter((group) => group.conversations.length > 0);
}
