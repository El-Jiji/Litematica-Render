
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
    // Order matters: longer suffixes checks first to avoid partial matches (e.g. _wall_sign vs _sign)
    const DERIVED_SUFFIXES = [
      "_stairs", "_slab", "_wall_sign", "_wall", "_fence_gate", "_fence", 
      "_button", "_pressure_plate", "_hanging_sign", "_sign",
      "_brick_wall", "_wood", "_carpet" 
    ];

    // Simple stripping
    for (const suffix of DERIVED_SUFFIXES) {
        if (name.endsWith(suffix)) {
             name = name.substring(0, name.length - suffix.length);
             
             // Special handling: oak_fence -> oak_planks, not oak
             if (suffix === '_fence' || suffix === '_fence_gate' || suffix === '_sign' || suffix === '_hanging_sign' || suffix === '_wall_sign' || suffix === '_stairs' || suffix === '_slab') {
                if (!name.endsWith('_planks') && !name.includes('_log') && !name.includes('_stem') && !name.includes('_hyphae') && !name.endsWith('_brick') && !name.endsWith('_bricks')) {
                   const woodTypes = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped', 'pale_oak'];
                   if (woodTypes.includes(name)) {
                       name += '_planks';
                   }
                }
             }
             
             // Special handling: _wood -> _log (6-sided bark)
             // We want this to resolve to just the base name (which will map to side/all texture)
             // But BlockMapper's default heuristic for 'top' is to append '_top' if it doesn't match an explicit face mapping.
             // So we need to ensure it hits a mapping, OR we force the face logic.
             if (suffix === '_wood') {
                 if (!name.includes('_log')) {
                    name += '_log';
                 }
                 // If we have mapped it to a log, it will have sides.
                 // But wait, "acacia_wood" means "acacia_log" texture on ALL sides.
                 // If we map to "acacia_log", that has a top/bottom.
                 // We may need an explicit "acacia_wood" mapping in JSON or special handling here.
                 // For now, let's assume if it is wood, we want the side texture.
                 return name; // Return early? No, need to check mappings.
             }

             // Special handling: _carpet -> _wool
             if (suffix === '_carpet') {
                 if (name !== 'moss') {
                    name += '_wool';
                 }
             }

             break;
        }
    }
    
    // Normalize singular brick -> plural bricks (common in naming conventions)
    if (name.endsWith('_brick')) {
        name += 's';
    }
    
    // Generic fallback for common complex blocks if specific mapping not found
    if (name.includes('_bed')) {
        return name.replace('_bed', '_wool'); // Visual fallback
    }
    if (name.includes('_banner')) {
        if (name.includes('wall_banner')) {
             return name.replace('_wall_banner', '_wool');
        }
        return name.replace('_banner', '_wool');
    }
    if (name.includes('head') || name.includes('skull')) {
         // Try to map to a head texture if possible, but heads are entities.
         // Let's rely on explicit mappings in JSON for heads.
    }
    if (name.includes('candle_cake')) {
        return 'cake_top'; // Best visual match
    }
    
    // Check if the stripped name exists in mappings
    const baseMapping = this.mappings[`minecraft:${name}`];
    if (baseMapping) {
        // Special case for WOOD: if original had _wood specific suffix, we likely want the SIDE texture of the log on all faces.
        if (blockName.endsWith('_wood')) {
             if (baseMapping.sides && baseMapping.sides['side']) {
                 return baseMapping.sides['side'];
             }
        }
        
        if (typeof baseMapping.texture === 'string') {
            return baseMapping.texture;
        }
        if (baseMapping.sides) {
             // If we are here, we are likely a derived block acting like the base block.
             // We should respect the base block's face mapping.
            if (baseMapping.sides[face]) {
                return baseMapping.sides[face];
            }
            if (face === 'side' && baseMapping.sides['north']) {
                 return baseMapping.sides['north'];
            }
        }
    }
    
    // Potted plant special handling: 
    // potted_oak_sapling -> oak_sapling. oak_sapling usually has a texture "oak_sapling".
    // But default heuristic adds _top?
    // We should check if the stripped name exists as a texture first?
    // Or just forcing it.
    if (blockName.startsWith('minecraft:potted_')) {
        return name;
    }

    // Heuristic: If it ends in specific suffixes, usually name.png
    if (SINGLE_TEXTURE_SUFFIXES.some(s => name.endsWith(s))) {
        return name;
    }

    // Heuristic: If we are asking for top/bottom, try name_top / name_bottom
    // BUT only if not already mapped or if generic fallback is needed.
    // If we stripped a suffix (e.g. diorite_stairs -> diorite), we want diorite.png, NOT diorite_top.png
    // UNLESS diorite has a top texture?
    // Let's rely on the fact that if we stripped, we probably want the base block texture.
    
    if (face === 'top' || face === 'bottom') {
         // Check if a specific top/bottom texture exists for this name? 
         // We can't check file existence here easily (no fs).
         // So we will optimistically return name+suffix if we didn't strip?
         // Or just return it and let the resolver fail and retry?
         return `${name}_${face}`;
    }


    // Default to the block name itself
    return name;
  }
}

export const blockMapper = new BlockMapper();
