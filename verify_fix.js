
import fs from 'fs';

// Mock environment
const blockMappings = JSON.parse(fs.readFileSync('./src/assets/block_mapping.json', 'utf8'));

// Copy of the logic from BlockMapper.js for testing purposes
// (We could import it if we set up babel/node correctly, but this is faster for a quick check)
const SINGLE_TEXTURE_SUFFIXES = [
  "_planks", "_ore", "_wool", "_concrete", "_terracotta", "_stained_glass"
];

class BlockMapper {
  constructor() {
    this.mappings = blockMappings;
  }

  getTexture(blockName, face, props = {}) {
    // 1. Check strict mapping
    let mapping = this.mappings[blockName];
    if (mapping) {
        if (typeof mapping.texture === 'string') {
            return mapping.texture; // Single texture for everything
        }
        
        if (mapping.sides) {
            if (mapping.sides[face]) {
                return mapping.sides[face];
            }
            if (face === 'side' && mapping.sides['north']) {
                 return mapping.sides['north'];
            }
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
             if (suffix === '_wood') {
                 if (!name.includes('_log')) {
                    name += '_log';
                 }
                 // In verification script we can just continue to mapping check
             }

             // Special handling: _carpet -> _wool
             if (suffix === '_carpet') {
                 if (name !== 'moss') {
                    name += '_wool';
                 }
                 // In verify script, just proceed
             }

             break;
        }
    }
    
    // Normalize singular brick -> plural bricks (common in naming conventions)
    if (name.endsWith('_brick')) {
        name += 's';
    }
    
    // Check if the stripped name exists in mappings (e.g. diorite_stairs -> diorite -> mapped?)
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
         return `${name}_${face}`;
    }

    // Default to the block name itself
    return name;
  }
}

const mapper = new BlockMapper();

console.log('Testing BlockMapper Logic...');

const testCases = [
    { block: 'minecraft:oak_log', face: 'top', expected: 'oak_log_top' },
    { block: 'minecraft:oak_log', face: 'side', expected: 'oak_log' },
    { block: 'minecraft:stone', face: 'side', expected: 'stone' },
    { block: 'minecraft:grass_block', face: 'top', expected: 'grass_block_top' },
    { block: 'minecraft:grass_block', face: 'bottom', expected: 'dirt' },
    { block: 'minecraft:grass_block', face: 'side', expected: 'grass_block_side' },
    { block: 'minecraft:furnace', face: 'front', expected: 'furnace_front' },
    { block: 'minecraft:furnace', face: 'side', expected: 'furnace_side' },
    // Derived blocks
    { block: 'minecraft:diorite_stairs', face: 'top', expected: 'diorite' },
    { block: 'minecraft:diorite_stairs', face: 'side', expected: 'diorite' },
    { block: 'minecraft:oak_fence', face: 'side', expected: 'oak_planks' },
    { block: 'minecraft:pearlescent_froglight', face: 'bottom', expected: 'pearlescent_froglight_top' },
    { block: 'minecraft:pale_oak_stairs', face: 'top', expected: 'pale_oak_planks' },
    { block: 'minecraft:deepslate_brick_wall', face: 'side', expected: 'deepslate_bricks' },
    { block: 'minecraft:tuff', face: 'top', expected: 'tuff' },
    { block: 'minecraft:tuff_bricks', face: 'top', expected: 'tuff_bricks' },
    { block: 'minecraft:mossy_cobblestone', face: 'top', expected: 'mossy_cobblestone' },
    { block: 'minecraft:spruce_door', face: 'top', expected: 'spruce_door_bottom' }, // Mapped to bottom
    { block: 'minecraft:oak_wall_sign', face: 'front', expected: 'oak_planks' }, // Should resolve to oak_planks via stripping
    { block: 'minecraft:acacia_wood', face: 'top', expected: 'acacia_log' },
    { block: 'minecraft:potted_oak_sapling', face: 'top', expected: 'oak_sapling' },
    { block: 'minecraft:gray_carpet', face: 'top', expected: 'gray_wool' },
    { block: 'minecraft:waxed_exposed_cut_copper', face: 'top', expected: 'exposed_cut_copper' },
    { block: 'minecraft:mud_bricks', face: 'top', expected: 'mud_bricks' },
    { block: 'minecraft:prismarine', face: 'top', expected: 'prismarine' },
    { block: 'minecraft:melon', face: 'side', expected: 'melon_side' },
    { block: 'minecraft:melon', face: 'top', expected: 'melon_top' },
    { block: 'minecraft:tall_grass', face: 'top', expected: 'tall_grass_top' },
    { block: 'minecraft:bamboo', face: 'side', expected: 'bamboo_stalk' },
    { block: 'minecraft:moss_carpet', face: 'top', expected: 'moss_block' },
    { block: 'minecraft:yellow_stained_glass_pane', face: 'top', expected: 'yellow_stained_glass_pane_top' },
    { block: 'minecraft:crimson_hyphae', face: 'side', expected: 'crimson_stem' },
    { block: 'minecraft:hopper', face: 'top', expected: 'hopper_outside' },
    { block: 'minecraft:hopper', face: 'top', expected: 'hopper_outside' },
    { block: 'minecraft:lectern', face: 'top', expected: 'lectern_top' },
    // Aliases
    { block: 'minecraft:quartz', face: 'top', expected: 'quartz_block_side' },
    { block: 'minecraft:purpur', face: 'top', expected: 'purpur_block' },
    { block: 'minecraft:azalea_bush', face: 'top', expected: 'azalea_side' },
    { block: 'minecraft:dark_oak', face: 'top', expected: 'dark_oak_planks' },
    // Fallback cases
    { block: 'minecraft:white_wool', face: 'side', expected: 'white_wool' }, 
];

let passed = 0;

const results = [];
testCases.forEach(tc => {
    const result = mapper.getTexture(tc.block, tc.face, {});
    let status = 'PASS';
    if (result !== tc.expected) {
        status = 'FAIL';
        console.error(`[FAIL] ${tc.block} (${tc.face}) -> expected ${tc.expected}, got ${result}`); // keep console for backup
    }
    results.push(`[${status}] ${tc.block} (${tc.face}) -> ${result} (expected ${tc.expected})`);
    if (status === 'PASS') passed++;
});

console.log(`\nPassed ${passed}/${testCases.length} tests.`);
fs.writeFileSync('results.txt', results.join('\n'));

