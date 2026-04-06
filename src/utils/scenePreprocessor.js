import { parseLitematicBuffer } from "./litematicParserCore";

const CHUNK_SIZE = 16;

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

      materials[materialName] = (materials[materialName] || 0) + 1;
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

      chunk.blocks.push({
        name: block.name,
        props,
        x,
        y,
        z,
        visibleFaces: 63,
      });
      chunk.totalBlocks += 1;
      chunk.visibleFaces += 6;

      chunk.bounds.minX = Math.min(chunk.bounds.minX, x);
      chunk.bounds.minY = Math.min(chunk.bounds.minY, y);
      chunk.bounds.minZ = Math.min(chunk.bounds.minZ, z);
      chunk.bounds.maxX = Math.max(chunk.bounds.maxX, x);
      chunk.bounds.maxY = Math.max(chunk.bounds.maxY, y);
      chunk.bounds.maxZ = Math.max(chunk.bounds.maxZ, z);

      chunks.set(chunkId, chunk);
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
    totalBlocks,
    culledFaces: 0,
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
