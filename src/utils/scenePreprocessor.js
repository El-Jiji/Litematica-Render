import { parseLitematicBuffer } from "./litematicParserCore";

export const FACE_MASKS = {
  east: 1,
  west: 2,
  up: 4,
  down: 8,
  south: 16,
  north: 32,
};

const CHUNK_SIZE = 16;
const NON_OCCLUDING_NAME_PATTERNS = [
  "glass",
  "pane",
  "slab",
  "stairs",
  "wall",
  "fence",
  "gate",
  "door",
  "trapdoor",
  "button",
  "pressure_plate",
  "carpet",
  "rail",
  "torch",
  "lantern",
  "chain",
  "ladder",
  "vine",
  "flower",
  "grass",
  "fern",
  "crop",
  "sapling",
  "leaves",
  "water",
  "lava",
  "ice",
  "tall_seagrass",
  "seagrass",
  "bed",
  "sign",
  "banner",
  "skull",
  "head",
  "candle",
  "rod",
  "coral",
  "kelp",
  "scaffolding",
  "cauldron",
  "hopper",
  "chest",
  "barrel",
  "lectern",
  "bell",
  "campfire",
  "anvil",
];

const NEIGHBOR_DIRECTIONS = [
  { dx: 1, dy: 0, dz: 0, mask: FACE_MASKS.east },
  { dx: -1, dy: 0, dz: 0, mask: FACE_MASKS.west },
  { dx: 0, dy: 1, dz: 0, mask: FACE_MASKS.up },
  { dx: 0, dy: -1, dz: 0, mask: FACE_MASKS.down },
  { dx: 0, dy: 0, dz: 1, mask: FACE_MASKS.south },
  { dx: 0, dy: 0, dz: -1, mask: FACE_MASKS.north },
];

function encodePosition(x, y, z) {
  return `${x},${y},${z}`;
}

function encodeChunkCoord(x, y, z) {
  return `${x},${y},${z}`;
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

function isLikelyOccludingBlock(name, props = {}) {
  const shortName = name.replace("minecraft:", "");

  if (props.waterlogged === "true") return false;
  if (
    props.type === "top" ||
    props.type === "bottom" ||
    props.half === "top" ||
    props.half === "bottom"
  ) {
    return false;
  }

  return !NON_OCCLUDING_NAME_PATTERNS.some((pattern) =>
    shortName.includes(pattern),
  );
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
  const chunks = new Map();
  const blocks = [];
  const occupancy = new Map();

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  Object.values(parsed.regions || {}).forEach((region) => {
    const ox = region.position.x;
    const oy = region.position.y;
    const oz = region.position.z;

    region.blocks.forEach((block) => {
      const x = ox + block.x;
      const y = oy + block.y;
      const z = oz + block.z;
      const materialName = block.name.replace("minecraft:", "");

      materials[materialName] = (materials[materialName] || 0) + 1;
      occupancy.set(
        encodePosition(x, y, z),
        isLikelyOccludingBlock(block.name, block.props),
      );

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;

      blocks.push({
        name: block.name,
        props: block.props || {},
        x,
        y,
        z,
        isOccluding: isLikelyOccludingBlock(block.name, block.props),
      });
    });
  });

  if (blocks.length === 0) {
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

  let culledFaces = 0;

  blocks.forEach((block) => {
    let visibleFaces = 0;

    for (const direction of NEIGHBOR_DIRECTIONS) {
      const neighborValue = occupancy.get(
        encodePosition(
          block.x + direction.dx,
          block.y + direction.dy,
          block.z + direction.dz,
        ),
      );
      const hasNeighbor = neighborValue !== undefined;
      const occludingNeighbor = neighborValue === true;

      if (!hasNeighbor || !block.isOccluding || !occludingNeighbor) {
        visibleFaces |= direction.mask;
        continue;
      }

      culledFaces += 1;
    }

    if (visibleFaces === 0) {
      return;
    }

    const chunkX = Math.floor(block.x / chunkSize);
    const chunkY = Math.floor(block.y / chunkSize);
    const chunkZ = Math.floor(block.z / chunkSize);
    const chunkId = encodeChunkCoord(chunkX, chunkY, chunkZ);
    const chunk = chunks.get(chunkId) || createChunkRecord(chunkX, chunkY, chunkZ);

    chunk.blocks.push({
      name: block.name,
      props: block.props,
      x: block.x,
      y: block.y,
      z: block.z,
      visibleFaces,
    });
    chunk.totalBlocks += 1;
    chunk.visibleFaces += countBits(visibleFaces);

    chunk.bounds.minX = Math.min(chunk.bounds.minX, block.x);
    chunk.bounds.minY = Math.min(chunk.bounds.minY, block.y);
    chunk.bounds.minZ = Math.min(chunk.bounds.minZ, block.z);
    chunk.bounds.maxX = Math.max(chunk.bounds.maxX, block.x);
    chunk.bounds.maxY = Math.max(chunk.bounds.maxY, block.y);
    chunk.bounds.maxZ = Math.max(chunk.bounds.maxZ, block.z);

    chunks.set(chunkId, chunk);
  });

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
      return chunk;
    })
    .sort((a, b) => a.distanceToCenter - b.distanceToCenter);

  const materialsList = Object.entries(materials)
    .map(([name, count]) => ({
      name: name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    metadata: normalizeMetadata(parsed.metadata),
    materials: materialsList,
    totalBlocks: blocks.length,
    culledFaces,
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

function countBits(mask) {
  let count = 0;
  let value = mask;

  while (value > 0) {
    count += value & 1;
    value >>= 1;
  }

  return count;
}

export async function parseAndProcessLitematic(arrayBuffer, options) {
  const parsed = parseLitematicBuffer(arrayBuffer);
  return buildProcessedScene(parsed, options);
}
