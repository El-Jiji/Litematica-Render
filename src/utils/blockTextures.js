import { blockMapper } from "./BlockMapper";
const DEFAULT_LOCAL_BASE = "/textures/block/";

function getBaseUrl() {
  const envBase = import.meta?.env?.VITE_TEXTURES_BASE;
  const base = envBase ?? DEFAULT_LOCAL_BASE;
  return base.endsWith("/") ? base : base + "/";
}

import textureIndexRaw from "../../blocknombres_texturas.txt?raw";
const textureList = textureIndexRaw
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);
const textureSet = new Set(textureList);

function hasTexture(name) {
  return textureSet.has(name);
}

// Logic to check if the file actually exists in our list
function resolveTextureFile(filename) {
   if (hasTexture(filename)) return filename + ".png";
   if (hasTexture(filename + ".png")) return filename + ".png";
   return null;
}

export function getTextureUrl(blockName, face = "side", props = {}) {
  // 1. Get ideal candidate from BlockMapper
  const idealName = blockMapper.getTexture(blockName, face, props);
  
  // 2. Resolve to actual file
  const resolved = resolveTextureFile(idealName);
  
  if (resolved) {
      return getBaseUrl() + resolved;
  }
  
  // 3. Last resort heuristics if mapping failed to point to an existing file
  // (We keep some of the old "try variations" logic but simplified)
  const base = blockName.replace("minecraft:", "");
  let candidates = [
      idealName,
      base,
      `${base}_${face}`, // try adding face suffix properties
  ];

  for (const c of candidates) {
        if (hasTexture(c)) return getBaseUrl() + c + ".png";
  }

  // Final fallback to the ideal name even if not found (let 404 happen or use placeholder)
  return getBaseUrl() + idealName + ".png";
}

