const DEFAULT_REMOTE_VERSION = "1.21.1";
const DEFAULT_REMOTE_BASE = `https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/${DEFAULT_REMOTE_VERSION}/blocks/`;

function getBaseUrl() {
  const envBase = import.meta?.env?.VITE_TEXTURES_BASE;
  if (envBase) {
    return envBase.endsWith("/") ? envBase : envBase + "/";
  }
  return DEFAULT_REMOTE_BASE;
}

export const blockTextures = {
  "minecraft:grass_block": {
    top: "grass_block_top.png",
    bottom: "dirt.png",
    side: "grass_block_side.png",
  },
  "minecraft:stone": "stone.png",
  "minecraft:dirt": "dirt.png",
  "minecraft:cobblestone": "cobblestone.png",
  "minecraft:oak_planks": "oak_planks.png",
  "minecraft:spruce_planks": "spruce_planks.png",
  "minecraft:birch_planks": "birch_planks.png",
  "minecraft:jungle_planks": "jungle_planks.png",
  "minecraft:acacia_planks": "acacia_planks.png",
  "minecraft:dark_oak_planks": "dark_oak_planks.png",
  "minecraft:mangrove_planks": "mangrove_planks.png",
  "minecraft:cherry_planks": "cherry_planks.png",
  "minecraft:bamboo_planks": "bamboo_planks.png",
  "minecraft:bedrock": "bedrock.png",
  "minecraft:sand": "sand.png",
  "minecraft:red_sand": "red_sand.png",
  "minecraft:gravel": "gravel.png",
  "minecraft:gold_ore": "gold_ore.png",
  "minecraft:iron_ore": "iron_ore.png",
  "minecraft:coal_ore": "coal_ore.png",
  "minecraft:nether_gold_ore": "nether_gold_ore.png",
  "minecraft:oak_log": {
    top: "oak_log_top.png",
    bottom: "oak_log_top.png",
    side: "oak_log.png",
  },
  "minecraft:spruce_log": {
    top: "spruce_log_top.png",
    bottom: "spruce_log_top.png",
    side: "spruce_log.png",
  },
  "minecraft:birch_log": {
    top: "birch_log_top.png",
    bottom: "birch_log_top.png",
    side: "birch_log.png",
  },
  "minecraft:jungle_log": {
    top: "jungle_log_top.png",
    bottom: "jungle_log_top.png",
    side: "jungle_log.png",
  },
  "minecraft:acacia_log": {
    top: "acacia_log_top.png",
    bottom: "acacia_log_top.png",
    side: "acacia_log.png",
  },
  "minecraft:dark_oak_log": {
    top: "dark_oak_log_top.png",
    bottom: "dark_oak_log_top.png",
    side: "dark_oak_log.png",
  },
  "minecraft:glass": "glass.png",
  "minecraft:white_wool": "white_wool.png",
  // Add more as needed or rely on default
};

export function getTextureUrl(blockName, face = "side") {
  const definition = blockTextures[blockName];

  let filename;
  if (typeof definition === "string") {
    filename = definition;
  } else if (typeof definition === "object") {
    filename = definition[face] || definition.side || definition.top; // Fallback
  }

  if (!filename) {
    // Try to guess: remove namespace and use as filename
    const name = blockName.replace("minecraft:", "");
    filename = `${name}.png`;
  }

  return `${getBaseUrl()}${filename}`;
}
