
import blockMappings from '../assets/block_mapping.json';

// Fallback for simple single-texture blocks that might not be in the JSON
const SINGLE_TEXTURE_SUFFIXES = [
  "_planks", "_ore", "_wool", "_concrete", "_terracotta", "_stained_glass",
  "_fan", "_torch", "_coral", "_glass"
];

export class BlockMapper {
  constructor() {
    this.mappings = blockMappings;
  }

  /**
   * Get the texture filename for a block and face.
   * @param {string} blockName - Full block name (e.g. minecraft:oak_log)
   * @param {string} face - Face direction (top, bottom, north, south, east, west, side)
   * @param {object} props - Block properties (e.g. { axis: 'x', facing: 'north' })
   * @returns {string} - Texture filename without extension
   */
  getTexture(blockName, face, props = {}) {
    // 1. Check strict mapping
    const mapping = this.mappings[blockName];
    if (mapping) {
        if (typeof mapping.texture === 'string') {
            return mapping.texture; // Single texture for everything
        }
        
        if (mapping.sides) {
            // Check specific face mapping
            // If face is 'side', we might want to return a side texture if defined,
            // or fallback to specific cardinals if 'side' isn't explicitly there but north/etc are.
            // But usually 'side' comes from the viewer requesting a generic side.
            if (mapping.sides[face]) {
                return mapping.sides[face];
            }
            // Fallback for generic 'side' request if specific sides are defined
            if (face === 'side' && mapping.sides['north']) {
                 return mapping.sides['north'];
            }
             // Fallback for generic 'side' request if only top/top exists? Unlikely.
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
    
    // Check if the name matches a single texture base
    const isSingleTexture = SINGLE_TEXTURE_BASES.some(base => name.endsWith(base));

    // Check if the name exists in mappings
    const finalMapping = this.mappings[`minecraft:${name}`];
    if (finalMapping) {
        if (typeof finalMapping.texture === 'string') return finalMapping.texture;
        if (finalMapping.sides) {
            if (finalMapping.sides[face]) return finalMapping.sides[face];
            if (face === 'side' && finalMapping.sides['north']) return finalMapping.sides['north'];
            
            // If top/bottom requested but not found, check if it's a single texture block
            if (isSingleTexture && finalMapping.sides['side']) return finalMapping.sides['side'];
            
            // Fallback to 'side' or first available
            if ((face === 'top' || face === 'bottom') && finalMapping.sides['side']) return finalMapping.sides['side'];
        }
    }
    
    if (blockName.startsWith('minecraft:potted_')) return name;

    // Heuristic for logs/stems that are not in mappings but requested as top/bottom
    if (face === 'top' || face === 'bottom') {
         if (isSingleTexture) return name;

         const logTypes = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'crimson', 'warped'];
         for (const log of logTypes) {
             if (name === log || name === `${log}_log` || name === `${log}_stem`) {
                 const base = name.includes('_log') || name.includes('_stem') ? name : (log === 'crimson' || log === 'warped' ? `${log}_stem` : `${log}_log`);
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
