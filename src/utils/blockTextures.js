import { blockMapper } from "./BlockMapper";
const DEFAULT_LOCAL_BASE = "/mc/textures/block/";

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

function normalizeName(name) {
  if (!name) return "";
  let n = name;
  if (n.startsWith("/mc/textures/block/")) n = n.substring("/mc/textures/block/".length);
  if (n.startsWith("textures/block/")) n = n.substring("textures/block/".length);
  if (n.endsWith(".png")) n = n.slice(0, -4);
  return n;
}

function resolveTextureFile(filename) {
  const n = normalizeName(filename);
  if (hasTexture(n)) return n + ".png";
  return null;
}

function fallbackName(baseNorm, face) {
  let n = baseNorm;
  // Fluids, fire, light/barrier
  if (n === "water" || n === "water_top") return "water_still";
  if (n === "lava" || n === "lava_top") return "lava_still";
  if (n.startsWith("fire")) return "fire_0";
  if (n.startsWith("soul_fire")) return "soul_fire_0";
  if (n === "light" || n === "light_top") return "glass";
  if (n === "barrier" || n === "barrier_top") return "glass";
  if (n === "structure_void" || n === "structure_void_top") return "glass";

  // Metals and blocks singular naming
  if (n === "iron" || n === "iron_top") return "iron_block";
  if (n === "gold" || n === "gold_top") return "gold_block";
  if (n === "copper" || n === "copper_top") return "copper_block";
  if (n === "diamond" || n === "diamond_top") return "diamond_block";
  if (n === "emerald" || n === "emerald_top") return "emerald_block";
  if (n === "lapis" || n === "lapis_top") return "lapis_block";
  if (n === "netherite" || n === "netherite_top") return "netherite_block";
  if (n === "red_nether_brick" || n === "red_nether_brick_top") return "red_nether_bricks";

  // Plants/crops
  if (n === "tall_grass") return "tall_grass_top";
  if (n.startsWith("sweet_berry_bush")) return "sweet_berry_bush_stage3";
  if (n === "wheat" || n === "wheat_top") return "wheat_stage7";
  if (n === "carrots" || n === "carrots_top") return "carrots_stage3";
  if (n === "beetroots" || n === "beetroots_top") return "beetroots_stage3";
  if (n === "potatoes" || n === "potatoes_top") return "potatoes_stage3";
  if (n === "torchflower" || n === "torchflower_crop" || n === "torchflower_crop_top") return "torchflower";
  if (n === "pitcher_plant") return "wildflowers";
  if (n === "bamboo_sapling" || n === "bamboo_sapling_top") return "bamboo_stage0";

  // Coral wall fans -> fan
  if (n.endsWith("_coral_wall_fan") || n.endsWith("_coral_wall_fan_top")) {
    n = n.replace("_wall_", "_").replace(/_top$/, "");
    if (n.startsWith("dead_")) {
      n = n.replace("dead_", "dead_");
    }
    return n.replace("_wall_fan", "_fan");
  }

  // Deepslate tiles normalization
  if (n.startsWith("deepslate_tile")) return "deepslate_tiles";

  // Doors/chests/golems
  if (n.startsWith("dark_oak_door")) return "dark_oak_door_bottom";
  if (n.includes("ender_chest")) return "obsidian";
  if (n === "decorated_pot") return "bricks";
  if (n.includes("chest")) return "oak_planks";
  if (n.includes("golem_statue")) {
    if (n.includes("weathered")) return "weathered_copper";
    if (n.includes("oxidized")) return "oxidized_copper";
    if (n.includes("exposed")) return "exposed_copper";
    return "copper_block";
  }

  if (n === "moss") return "moss_block";
  if (n.includes("skull")) {
    if (n.includes("wither")) return "blackstone_top";
    return "bone_block_top";
  }
  if (n.includes("head")) return "moss_block";
  if (n === "wall" || n.endsWith("_wall")) return "stone_bricks";
  if (n === "glass_pane") return "glass_pane_top";
  if (n === "redstone_wire") return "redstone_dust_line0";
  if (n === "moving_piston" || n === "moving_piston_top") return "piston_top";
  if (n === "campfire" || n === "campfire_top") return "campfire_log";
  if (n === "soul_campfire" || n === "soul_campfire_top") return "campfire_log";
  if (n === "bubble_column" || n === "bubble_column_top") return "water_still";
  if (n === "jack_o" || n === "jack_o_top") return "jack_o_lantern";
  if (n === "end" || n === "end_top") return "end_stone";
  if (n === "nether_wart" || n === "nether_wart_top") return "nether_wart_stage2";
  if (n === "redstone" || n === "redstone_top") return "redstone_block";
  if (n === "cocoa" || n === "cocoa_top") return "cocoa_stage2";
  if (n === "dried_kelp_block" || n === "dried_kelp_block_top") return "dried_kelp_top";
  if (n === "soul" || n === "soul_top") return "soul_sand";
  if (n === "pointed_dripstone") return "dripstone_block";
  if (n === "pale_moss_wool" || n === "pale_moss_wool_top") return "white_wool";

  if (face === "top" && hasTexture(n + "_top")) return n + "_top";
  if (face === "bottom" && hasTexture(n + "_bottom")) return n + "_bottom";
  return null;
}

function pickCandidate(baseNorm, face) {
  const candidates = [];
  const faceSuffix = typeof face === "string" ? face : "side";
  // Prefer exact, face, common sides
  candidates.push(baseNorm);
  candidates.push(`${baseNorm}_${faceSuffix}`);
  candidates.push(`${baseNorm}_side`);
  candidates.push(`${baseNorm}_top`);
  candidates.push(`${baseNorm}_bottom`);
  // Specific families
  if (baseNorm.endsWith("_door")) {
    candidates.unshift(`${baseNorm}_bottom`);
    candidates.unshift(`${baseNorm}_top`);
  }
  if (baseNorm.endsWith("_pane")) {
    candidates.unshift(`${baseNorm}_top`);
  }
  for (const c of candidates) {
    const r = resolveTextureFile(c);
    if (r) return r;
  }
  return null;
}

export function getTextureUrl(blockName, face = "side", props = {}) {
  // 1. Get ideal candidate from BlockMapper
  const idealName = blockMapper.getTexture(blockName, face, props);
  
  // If the mapping already returns a full path, use it directly
  if (typeof idealName === "string" && idealName.startsWith("/mc/textures/block/")) {
    return idealName;
  }
  
  // 2. Resolve to actual file
  let resolved = resolveTextureFile(idealName);
  
  if (resolved) return getBaseUrl() + resolved;
  
  // If idealName already looks like a filename with extension, use it
  if (typeof idealName === "string" && idealName.endsWith(".png")) {
    // Ensure we don't double-prefix
    const norm = normalizeName(idealName);
    return getBaseUrl() + norm;
  }
  
  let baseNorm = normalizeName(idealName);
  if (baseNorm.endsWith("_top") || baseNorm.endsWith("_bottom")) {
    const withoutSuffix = baseNorm.replace(/_(top|bottom)$/, "");
    resolved = resolveTextureFile(withoutSuffix);
    if (resolved) return getBaseUrl() + resolved;
    baseNorm = withoutSuffix;
  }
  
  resolved = pickCandidate(baseNorm, face);
  if (resolved) return getBaseUrl() + resolved;
  
  const fb = fallbackName(baseNorm, face);
  if (fb) {
    resolved = resolveTextureFile(fb);
    if (resolved) return getBaseUrl() + resolved;
    return getBaseUrl() + fb + ".png";
  }
  
  return getBaseUrl() + idealName + ".png";
}

