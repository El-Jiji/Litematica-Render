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
function hasTexture(b) {
  return textureSet.has(b);
}
function pickCandidate(name, face, initial) {
  let base = (initial || name).replace(/\.png$/, "");
  const c = [];
  c.push(base);
  if (face && !base.endsWith("_" + face)) c.unshift(`${name}_${face}`);
  if (base.endsWith("_brick")) c.push(base + "s");
  if (base === "brick") c.push("bricks");
  if (base.endsWith("_stained_glass_pane")) c.push(base + "_top");
  if (base.endsWith("_carpet")) {
    const x = base.replace(/_carpet$/, "");
    if (x === "moss") c.push("moss_block");
    else if (x === "pale_moss") c.push("pale_moss_carpet");
    else c.push(x + "_wool");
  }
  if (base === "pale_moss_wool") c.push("pale_moss_carpet");
  if (base === "melon") c.push("melon_side");
  if (base === "scaffolding") c.push("scaffolding_side");
  if (base === "barrel") c.push("barrel_side");
  if (base === "composter") c.push("composter_side");
  if (base === "hopper") c.push("hopper_outside");
  if (base === "lectern") c.push("lectern_sides");
  if (base === "campfire") c.push("campfire_log");
  if (base === "water") c.push("water_still");
  if (base === "tall_grass") c.push("tall_grass_top");
  if (base === "large_fern") c.push("large_fern_top");
  if (base === "small_dripleaf") c.push("small_dripleaf_side");
  if (base === "bamboo") c.push("bamboo_block");
  if (base === "bamboo_sapling") c.push("bamboo_stage0");
  if (base === "azalea_bush") c.push("azalea_side");
  if (base === "flowering_azalea_bush") c.push("flowering_azalea_side");
  if (/^potted_.+/.test(base)) c.push(base.replace(/^potted_/, ""));
  if (/^stripped_.+_wood$/.test(base)) c.push(base.replace(/_wood$/, "_log"));
  else if (/_wood$/.test(base)) c.push(base.replace(/_wood$/, "_log"));
  if (/^stripped_.+_hyphae$/.test(base))
    c.push(base.replace(/_hyphae$/, "_stem"));
  else if (/_hyphae$/.test(base)) c.push(base.replace(/_hyphae$/, "_stem"));
  const fam = [
    "oak",
    "spruce",
    "birch",
    "jungle",
    "acacia",
    "dark_oak",
    "mangrove",
    "cherry",
    "bamboo",
    "warped",
    "crimson",
  ];
  if (fam.includes(base)) c.push(base + "_planks");
  if (base === "quartz") c.push("quartz_block_side");
  if (base === "purpur") c.push("purpur_block");
  const waxmap = {
    waxed_exposed_cut_copper: "exposed_cut_copper",
    waxed_weathered_cut_copper: "weathered_cut_copper",
    waxed_oxidized_cut_copper: "oxidized_cut_copper",
  };
  if (waxmap[base]) c.push(waxmap[base]);
  for (let i = 0; i < c.length; i++) {
    if (hasTexture(c[i])) return c[i] + ".png";
  }
  return base + ".png";
}

export const blockTextures = {
  "minecraft:grass_block": {
    top: "grass_block_top.png",
    bottom: "dirt.png",
    side: "grass_block_side.png",
  },
  // Smooth stone: usa textura única
  "minecraft:smooth_stone": "smooth_stone.png",
  // Basalt y polished_basalt: top/side (sin bottom específico, usar top como fallback)
  "minecraft:basalt": {
    top: "basalt_top.png",
    side: "basalt_side.png",
  },
  "minecraft:polished_basalt": {
    top: "polished_basalt_top.png",
    side: "polished_basalt_side.png",
  },
  // Froglights: top/side (sin bottom específico, usar top como fallback)
  "minecraft:ochre_froglight": {
    top: "ochre_froglight_top.png",
    side: "ochre_froglight_side.png",
  },
  "minecraft:pearlescent_froglight": {
    top: "pearlescent_froglight_top.png",
    side: "pearlescent_froglight_side.png",
  },
  "minecraft:verdant_froglight": {
    top: "verdant_froglight_top.png",
    side: "verdant_froglight_side.png",
  },
  // Budding amethyst: textura única
  "minecraft:budding_amethyst": "budding_amethyst.png",
  // Hay block y bone block: top/side
  "minecraft:hay_block": {
    top: "hay_block_top.png",
    side: "hay_block_side.png",
  },
  "minecraft:bone_block": {
    top: "bone_block_top.png",
    side: "bone_block_side.png",
  },
  // Bloques manuales específicos (dripstone, firefly, pale_oak, dried_ghast)
  "minecraft:pointed_dripstone": "pointed_dripstone_up_base.png", // Ajustado a archivo existente
  "minecraft:firefly_bush": "firefly_bush.png",
  "minecraft:pale_oak_sapling": "pale_oak_sapling.png",
  "minecraft:pale_oak_shelf": "pale_oak_shelf.png",
  "minecraft:dried_ghast": "dried_ghast_hydration_0_south.png", // Ajustado a archivo existente
  "minecraft:deepslate_brick": "deepslate_bricks.png",
  "minecraft:pale_oak_hanging_sign": "pale_oak_planks.png",

  // Heurística manual para stairs/slabs/walls/fences que derivan de un bloque base
  // stairs -> suele usar la textura del bloque base. Ej: diorite_stairs usa diorite.png
  // slab -> diorite_slab usa diorite.png
  // wall -> diorite_wall usa diorite.png
  // fence -> dark_oak_fence usa dark_oak_planks.png
  // hanging_sign -> pale_oak_hanging_sign usa stripped_pale_oak_log o planks?

  // Como no podemos mapear 1 a 1 infinitos bloques, usaremos lógica en getTextureUrl

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
    const name = blockName.replace("minecraft:", "");
    // Prefer nombre base (name.png) para la mayoría de bloques
    // y solo usar sufijos por cara en los casos conocidos multi-textura.
    const MULTI_FACE_BLOCKS = new Set([
      "grass_block",
      "ochre_froglight",
      "pearlescent_froglight",
      "verdant_froglight",
      "basalt",
      "polished_basalt",
      "hay_block",
      "bone_block",
      "smooth_stone",
      "note_block",
      "bedrock", // aunque suele ser único, lo dejamos en base por seguridad
    ]);

    const SINGLE_TEXTURE_REGEX =
      /(planks|ore|bricks|terracotta|concrete|wool|glass|leaves|blackstone$|andesite$|diorite$|polished_andesite$|polished_diorite$|stone$|gold_block$|diamond_block$|redstone_block$|emerald_block$|lapis_block$|coal_block$)/;

    if (MULTI_FACE_BLOCKS.has(name)) {
      const suffix = face && typeof face === "string" ? `_${face}` : "";
      filename = `${name}${suffix}.png`;
    } else {
      if (name.endsWith("_brick")) {
        filename = `${name}s.png`;
      } else if (name === "brick") {
        filename = "bricks.png";
      } else if (name.endsWith("_carpet")) {
        const base = name.replace(/_carpet$/, "");
        if (base === "moss") {
          filename = "moss_block.png";
        } else if (base === "pale_moss") {
          filename = "pale_moss_carpet.png";
        } else {
          filename = `${base}_wool.png`;
        }
      } else if (name.endsWith("_stained_glass_pane")) {
        filename = `${name}_top.png`;
      } else if (name === "melon") {
        filename = "melon_side.png";
      } else if (name === "scaffolding") {
        filename = "scaffolding_side.png";
      } else if (name === "barrel") {
        filename = "barrel_side.png";
      } else if (name === "composter") {
        filename = "composter_side.png";
      } else if (name === "hopper") {
        filename = "hopper_outside.png";
      } else if (name === "lectern") {
        filename = "lectern_sides.png";
      } else if (name === "campfire") {
        filename = "campfire_log.png";
      } else if (name === "water") {
        filename = "water_still.png";
      } else if (name === "tall_grass") {
        filename = "tall_grass_top.png";
      } else if (name === "large_fern") {
        filename = "large_fern_top.png";
      } else if (name === "small_dripleaf") {
        filename = "small_dripleaf_side.png";
      } else if (name === "bamboo") {
        filename = "bamboo_block.png";
      } else if (name === "bamboo_sapling") {
        filename = "bamboo_stage0.png";
      } else if (name.startsWith("potted_")) {
        filename = `${name.replace(/^potted_/, "")}.png`;
      } else if (/^stripped_.*_wood$/.test(name)) {
        filename = `${name.replace(/_wood$/, "_log")}.png`;
      } else if (/.*_wood$/.test(name)) {
        filename = `${name.replace(/_wood$/, "_log")}.png`;
      } else if (/^stripped_.*_hyphae$/.test(name)) {
        filename = `${name.replace(/_hyphae$/, "_stem")}.png`;
      } else if (/.*_hyphae$/.test(name)) {
        filename = `${name.replace(/_hyphae$/, "_stem")}.png`;
      } else if (
        [
          "oak",
          "spruce",
          "birch",
          "jungle",
          "acacia",
          "dark_oak",
          "mangrove",
          "cherry",
          "bamboo",
          "warped",
          "crimson",
        ].includes(name)
      ) {
        filename = `${name}_planks.png`;
      } else if (name === "quartz") {
        filename = "quartz_block_side.png";
      } else if (name === "purpur") {
        filename = "purpur_block.png";
      } else if (name === "grindstone") {
        filename = "grindstone_side.png";
      } else if (name === "chiseled_bookshelf") {
        filename = "chiseled_bookshelf_side.png";
      } else if (name === "loom") {
        filename = "loom_side.png";
      } else if (name === "azalea_bush") {
        filename = "azalea_side.png";
      } else if (name === "flowering_azalea_bush") {
        filename = "flowering_azalea_side.png";
      } else if (name === "waxed_exposed_cut_copper") {
        filename = "exposed_cut_copper.png";
      } else if (name === "waxed_weathered_cut_copper") {
        filename = "weathered_cut_copper.png";
      } else if (name === "waxed_oxidized_cut_copper") {
        filename = "oxidized_cut_copper.png";
      } else {
        // Heurística avanzada para bloques derivados (stairs, slabs, walls, fences, signs)
        // Eliminar sufijos comunes para encontrar la textura base
        let baseName = name;

        if (name.endsWith("_stairs")) baseName = name.replace("_stairs", "");
        else if (name.endsWith("_slab")) baseName = name.replace("_slab", "");
        else if (name.endsWith("_wall")) baseName = name.replace("_wall", "");
        else if (name.endsWith("_fence"))
          baseName = name.replace("_fence", "_planks"); // oak_fence -> oak_planks
        else if (name.endsWith("_fence_gate"))
          baseName = name.replace("_fence_gate", "_planks");
        else if (name.endsWith("_button"))
          baseName = name.replace("_button", "");
        else if (name.endsWith("_pressure_plate"))
          baseName = name.replace("_pressure_plate", "");
        else if (name.endsWith("_hanging_sign"))
          baseName = name.replace("_hanging_sign", "_planks"); // pale_oak_hanging_sign -> pale_oak_planks
        else if (name.endsWith("_wall_sign"))
          baseName = name.replace("_wall_sign", "_planks");
        else if (name.endsWith("_sign"))
          baseName = name.replace("_sign", "_planks");
        else if (name.endsWith("_trapdoor"))
          baseName = name.replace("_trapdoor", ""); // trapdoors a veces tienen textura propia, a veces no.
        // Trapdoors suelen tener su propio PNG (oak_trapdoor.png), así que mejor no reemplazar si existe.
        // Pero si falló el 404, quizás sea mejor dejarlo como nombre original.

        // Ajustes específicos detectados en logs
        // Ya lo cubre el replace anterior si el nombre base coincide con una textura existente.

        // Si tras quitar sufijo, el nombre resultante es diferente, probamos ese.
        // Pero ojo: diorite_stairs -> diorite.png (correcto)
        // dark_oak_fence -> dark_oak_planks.png (correcto con la regla fence->planks)
        // pale_oak_trapdoor -> pale_oak_trapdoor.png (debería existir, si falla es porque no está en repo)

        // Aplicar reglas de derivación solo si no es un bloque "único" que debería tener textura propia
        const shouldDerive =
          name.includes("_stairs") ||
          name.includes("_slab") ||
          name.includes("_wall") ||
          name.includes("_fence") ||
          name.includes("_hanging_sign") ||
          name.includes("_wall_sign") ||
          name.includes("_sign") ||
          name.includes("_button") ||
          name.includes("_pressure_plate");

        if (shouldDerive) {
          // Normalizar singular a plural para familias comunes
          if (baseName.endsWith("_brick")) {
            baseName = baseName.replace(/_brick$/, "_bricks");
          }
          if (baseName.endsWith("_tile")) {
            baseName = baseName.replace(/_tile$/, "_tiles");
          }
          filename = `${baseName}.png`;
        } else {
          // Por defecto: nombre original
          filename = `${name}.png`;
        }
      }
    }
  }

  const finalFile = pickCandidate(name, face, filename);
  return `${getBaseUrl()}${finalFile}`;
}
