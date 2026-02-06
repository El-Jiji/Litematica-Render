
import blockMappings from '../assets/block_mapping.json';

export class BlockMapper {
  constructor() {
    const full = globalThis.FULL_BLOCK_MAP;
    this.mappings = full && typeof full === 'object' ? full : blockMappings;
    this.fallbackMappings = blockMappings;
  }

  /**
   * Get the texture filename for a block and face.
   * @param {string} blockName - Full block name (e.g. minecraft:oak_log)
   * @param {string} face - Face direction (top, bottom, north, south, east, west, side)
   * @param {object} props - Block properties (e.g. { axis: 'x', facing: 'north' })
   * @returns {string} - Texture filename without extension
   */
  getTexture(blockName, face, _props = {}) {
    void _props;
    const m = this.mappings[blockName] ?? this.fallbackMappings[blockName];
    if (m) {
      if (typeof m === 'string') return m;
      if (typeof m.texture === 'string') return m.texture;
      const faces = m.sides || m;
      if (faces && typeof faces === 'object') {
        if (faces[face]) return faces[face];
        if (face === 'side') {
          if (faces['side']) return faces['side'];
          if (faces['north']) return faces['north'];
        }
        if (faces['all']) return faces['all'];
      }
    }

    // 2. Automated fallback for common patterns
    let name = blockName.replace('minecraft:', '');
    
    // Strip prefixes
    const PREFIXES = ["potted_", "waxed_"];
    for (const prefix of PREFIXES) {
        if (name.startsWith(prefix)) {
            name = name.substring(prefix.length);
        }
    }

    // List of suffixes to strip to find the "base" block
    const DERIVED_SUFFIXES = [
      "_stairs", "_slab", "_wall_sign", "_wall", "_fence_gate", "_fence", 
      "_button", "_pressure_plate", "_hanging_sign", "_sign",
      "_brick_wall", "_wood", "_carpet", "_bars", "_lantern", "_chain", "_rod",
      "_wall_torch", "_torch"
    ];

    // Blocks that only have a single texture and NEVER use _top/_bottom suffixes
    const SINGLE_TEXTURE_BASES = [
      "wool", "planks", "concrete", "concrete_powder", "terracotta", "glass", 
      "stained_glass", "bricks", "ore", "leaves", "sapling", "fan", "coral", 
      "tnt", "amethyst_block", "copper_block", "raw_iron_block", "raw_gold_block",
      "raw_copper_block", "netherite_block", "diamond_block", "gold_block", 
      "iron_block", "emerald_block", "lapis_block", "coal_block", "moss_block",
      "mud_bricks", "tuff_bricks", "prismarine_bricks", "quartz_bricks"
    ];

    // Simple stripping
    for (const suffix of DERIVED_SUFFIXES) {
        if (name.endsWith(suffix)) {
             const baseName = name.substring(0, name.length - suffix.length);
             
             // Special handling: _wood -> _log
             if (suffix === '_wood') {
                  name = baseName.includes('_log') ? baseName : baseName + '_log';
                  const barkMapping = this.mappings[`minecraft:${name}`];
                  if (barkMapping?.sides?.side) return barkMapping.sides.side;
                  return name;
             }

             name = baseName;

             // Wood mapping (stairs, slabs, fences to planks)
             if (['_fence', '_fence_gate', '_sign', '_hanging_sign', '_wall_sign', '_stairs', '_slab'].includes(suffix)) {
                if (!name.endsWith('_planks') && !name.includes('_log') && !name.includes('_stem') && !name.includes('_hyphae') && !name.endsWith('_bricks')) {
                   const woodTypes = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped', 'pale_oak'];
                   if (woodTypes.includes(name)) {
                       name += '_planks';
                   }
                }
             }
             
             if (suffix === '_carpet' && name !== 'moss') {
                name += '_wool';
             }

             break;
        }
    }
    
    // Normalize singular brick -> plural bricks
    if (name.endsWith('_brick') && !name.endsWith('nether_brick') && name !== 'mud_brick') {
        name += 's';
    }
    if (name === 'nether_brick') name = 'nether_bricks';
    if (name === 'mud_brick') name = 'mud_bricks';
    
    // Generic fallbacks
    if (name.includes('_bed')) return name.replace('_bed', '_wool');
    if (name.includes('_banner')) return name.replace('_wall_banner', '_wool').replace('_banner', '_wool');
    if (name.includes('candle_cake')) return 'cake_top';
    if (name.includes('petrified_oak')) return 'oak_planks';
    
    const final = (this.mappings[`minecraft:${name}`] ?? this.fallbackMappings[`minecraft:${name}`]);
    if (final) {
      if (typeof final === 'string') return final;
      if (typeof final.texture === 'string') return final.texture;
      const faces = final.sides || final;
      if (faces[face]) return faces[face];
      if (face === 'side' && faces['north']) return faces['north'];
      if ((face === 'top' || face === 'bottom') && faces['side']) return faces['side'];
      if (faces['all']) return faces['all'];
    }
    
    if (blockName.startsWith('minecraft:potted_')) return name;

    if (face === 'top' || face === 'bottom') {
      const logs = ['oak','spruce','birch','jungle','acacia','dark_oak','mangrove','cherry','pale_oak','crimson','warped'];
      for (const l of logs) {
        if (name === l || name === `${l}_log` || name === `${l}_stem`) {
          const base = name.includes('_log') || name.includes('_stem') ? name : (l === 'crimson' || l === 'warped' ? `${l}_stem` : `${l}_log`);
          return `${base}_top`;
        }
      }
      return `${name}_top`; 
    }

    // Default
    return name;
  }
}

export const blockMapper = new BlockMapper();
