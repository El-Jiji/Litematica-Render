import { parseLitematicBuffer } from "./litematicParserCore";

const CHUNK_SIZE = 16;
const FACE_BITS = {
  east: 1,
  west: 2,
  up: 4,
  down: 8,
  south: 16,
  north: 32,
};
const NEIGHBOR_FACES = [
  { dx: 1, dy: 0, dz: 0, bit: FACE_BITS.east },
  { dx: -1, dy: 0, dz: 0, bit: FACE_BITS.west },
  { dx: 0, dy: 1, dz: 0, bit: FACE_BITS.up },
  { dx: 0, dy: -1, dz: 0, bit: FACE_BITS.down },
  { dx: 0, dy: 0, dz: 1, bit: FACE_BITS.south },
  { dx: 0, dy: 0, dz: -1, bit: FACE_BITS.north },
];
const NON_FULL_BLOCK_SUFFIXES = [
  "_stairs",
  "_slab",
  "_wall",
  "_fence",
  "_fence_gate",
  "_door",
  "_trapdoor",
  "_pane",
  "_bars",
  "_button",
  "_pressure_plate",
  "_sign",
  "_hanging_sign",
  "_banner",
  "_bed",
  "_rail",
  "_torch",
  "_lantern",
  "_chain",
  "_rod",
  "_carpet",
  "_coral",
  "_coral_fan",
  "_sapling",
  "_flower",
  "_tulip",
  "_orchid",
  "_daisy",
  "_bush",
  "_vines",
  "_vine",
  "_roots",
  "_fungus",
  "_mushroom",
  "_crop",
  "_dripleaf",
  "_candle",
  "_skull",
  "_head",
];
const NON_FULL_BLOCK_NAMES = new Set([
  "minecraft:cactus",
  "minecraft:bamboo",
  "minecraft:scaffolding",
  "minecraft:ladder",
  "minecraft:campfire",
  "minecraft:soul_campfire",
  "minecraft:hopper",
  "minecraft:cauldron",
  "minecraft:anvil",
  "minecraft:chest",
  "minecraft:trapped_chest",
  "minecraft:ender_chest",
  "minecraft:lectern",
  "minecraft:bell",
  "minecraft:amethyst_cluster",
  "minecraft:small_amethyst_bud",
  "minecraft:medium_amethyst_bud",
  "minecraft:large_amethyst_bud",
]);
const SHAPE_CHANGING_PROPS = new Set([
  "type",
  "half",
  "shape",
  "facing",
  "face",
  "open",
  "hinge",
  "in_wall",
  "part",
  "attachment",
  "waterlogged",
  "layers",
  "level",
  "bites",
  "candles",
  "pickles",
  "thickness",
  "vertical_direction",
  "tilt",
  "axis",
]);

function encodeChunkCoord(x, y, z) {
  return `${x},${y},${z}`;
}

function encodeBlockCoord(x, y, z) {
  return `${x},${y},${z}`;
}

function isOccludingCube(blockName, props = {}) {
  if (NON_FULL_BLOCK_NAMES.has(blockName)) {
    return false;
  }

  const simpleName = blockName.replace("minecraft:", "");
  if (NON_FULL_BLOCK_SUFFIXES.some((suffix) => simpleName.endsWith(suffix))) {
    return false;
  }

  const propKeys = Object.keys(props);
  if (propKeys.length === 0) {
    return true;
  }

  if (propKeys.some((key) => SHAPE_CHANGING_PROPS.has(key))) {
    if (
      propKeys.length === 1 &&
      propKeys[0] === "axis" &&
      (simpleName.endsWith("_log") ||
        simpleName.endsWith("_stem") ||
        simpleName.endsWith("_hyphae") ||
        simpleName.endsWith("_pillar") ||
        simpleName === "basalt" ||
        simpleName === "bone_block" ||
        simpleName === "quartz_pillar" ||
        simpleName === "purpur_pillar")
    ) {
      return true;
    }

    return false;
  }

  return true;
}

function normalizeMetadata(metadata) {
  const simple = {};

  for (const [key, entry] of Object.entries(metadata || {})) {
    if (entry && typeof entry === "object" && "value" in entry) {
      simple[key] = entry.value;
    } else {
      simple[key] = entry;
    }
  }

  return simple;
}

function createChunkRecord(chunkX, chunkY, chunkZ) {
  return {
    id: encodeChunkCoord(chunkX, chunkY, chunkZ),
    coord: { x: chunkX, y: chunkY, z: chunkZ },
    bounds: {
      minX: Infinity,
      minY: Infinity,
      minZ: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
      maxZ: -Infinity,
    },
    center: { x: 0, y: 0, z: 0 },
    blocks: [],
    totalBlocks: 0,
    visibleFaces: 0,
  };
}

export function buildProcessedScene(parsed, options = {}) {
  const chunkSize = options.chunkSize || CHUNK_SIZE;
  const materials = {};
  const blockCounts = {};
  const chunks = new Map();
  const worldBlocks = [];
  const occupiedBlocks = new Map();

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let totalBlocks = 0;

  Object.values(parsed.regions || {}).forEach((region) => {
    const ox = region.position.x;
    const oy = region.position.y;
    const oz = region.position.z;

    region.blocks.forEach((block) => {
      const x = ox + block.x;
      const y = oy + block.y;
      const z = oz + block.z;
      const props = block.props || {};
      const materialName = block.name.replace("minecraft:", "");
      const occludingCube = isOccludingCube(block.name, props);

      materials[materialName] = (materials[materialName] || 0) + 1;
      blockCounts[block.name] = (blockCounts[block.name] || 0) + 1;
      totalBlocks += 1;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;

      const chunkX = Math.floor(x / chunkSize);
      const chunkY = Math.floor(y / chunkSize);
      const chunkZ = Math.floor(z / chunkSize);
      const chunkId = encodeChunkCoord(chunkX, chunkY, chunkZ);
      const chunk =
        chunks.get(chunkId) || createChunkRecord(chunkX, chunkY, chunkZ);

      const blockRecord = {
        name: block.name,
        props,
        x,
        y,
        z,
        visibleFaces: 63,
      };

      chunk.blocks.push(blockRecord);
      chunk.totalBlocks += 1;

      chunk.bounds.minX = Math.min(chunk.bounds.minX, x);
      chunk.bounds.minY = Math.min(chunk.bounds.minY, y);
      chunk.bounds.minZ = Math.min(chunk.bounds.minZ, z);
      chunk.bounds.maxX = Math.max(chunk.bounds.maxX, x);
      chunk.bounds.maxY = Math.max(chunk.bounds.maxY, y);
      chunk.bounds.maxZ = Math.max(chunk.bounds.maxZ, z);

      chunks.set(chunkId, chunk);
      worldBlocks.push(blockRecord);
      occupiedBlocks.set(encodeBlockCoord(x, y, z), {
        name: block.name,
        props,
        occludingCube,
      });
    });
  });

  if (totalBlocks === 0) {
    return {
      metadata: normalizeMetadata(parsed.metadata),
      materials: [],
      totalBlocks: 0,
      culledFaces: 0,
      chunkSize,
      chunks: [],
      bounds: {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        minZ: 0,
        maxZ: 0,
      },
      dimensions: { width: 0, height: 0, depth: 0 },
      center: [0, 0, 0],
    };
  }

  let totalVisibleFaces = 0;
  for (const block of worldBlocks) {
    const current = occupiedBlocks.get(encodeBlockCoord(block.x, block.y, block.z));
    let visibleFaces = 63;

    if (current?.occludingCube) {
      visibleFaces = 0;

      for (const neighbor of NEIGHBOR_FACES) {
        const adjacent = occupiedBlocks.get(
          encodeBlockCoord(
            block.x + neighbor.dx,
            block.y + neighbor.dy,
            block.z + neighbor.dz,
          ),
        );

        if (!adjacent?.occludingCube) {
          visibleFaces |= neighbor.bit;
        }
      }

    }

    block.visibleFaces = visibleFaces;
    totalVisibleFaces += countVisibleFaces(visibleFaces);
  }

  for (const chunk of chunks.values()) {
    chunk.visibleFaces = chunk.blocks.reduce(
      (sum, block) => sum + countVisibleFaces(block.visibleFaces),
      0,
    );
  }

  const center = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  const chunkList = Array.from(chunks.values())
    .map((chunk) => {
      chunk.center = {
        x: (chunk.bounds.minX + chunk.bounds.maxX) / 2,
        y: (chunk.bounds.minY + chunk.bounds.maxY) / 2,
        z: (chunk.bounds.minZ + chunk.bounds.maxZ) / 2,
      };
      chunk.distanceToCenter = Math.hypot(
        chunk.center.x - center[0],
        chunk.center.y - center[1],
        chunk.center.z - center[2],
      );
      chunk.exposedFaces = chunk.visibleFaces;
      return chunk;
    })
    .sort((a, b) => {
      if (b.exposedFaces !== a.exposedFaces) {
        return b.exposedFaces - a.exposedFaces;
      }

      return a.distanceToCenter - b.distanceToCenter;
    });

  const materialsList = Object.entries(materials)
    .map(([name, count]) => ({
      name: name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    metadata: normalizeMetadata(parsed.metadata),
    materials: materialsList,
    blockCounts,
    totalBlocks,
    culledFaces: totalBlocks * 6 - totalVisibleFaces,
    chunkSize,
    chunks: chunkList,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    dimensions: {
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      depth: maxZ - minZ + 1,
    },
    center,
  };
}

export async function parseAndProcessLitematic(arrayBuffer, options) {
  const parsed = parseLitematicBuffer(arrayBuffer);
  return buildProcessedScene(parsed, options);
}

function countVisibleFaces(visibleFaces) {
  let total = 0;

  for (const bit of Object.values(FACE_BITS)) {
    if ((visibleFaces & bit) !== 0) {
      total += 1;
    }
  }

  return total;
}
