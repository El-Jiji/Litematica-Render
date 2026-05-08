import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";

const NON_OCCLUDING_BLOCK_SUFFIXES = [
  "_glass",
  "_stained_glass",
  "_pane",
  "_ice",
  "_leaves",
  "_crop",
  "_stem",
  "_door",
  "_trapdoor",
  "_fence",
  "_fence_gate",
  "_wall",
  "_sign",
];
const NON_FULL_BLOCK_NAMES = new Set([
  "minecraft:grass",
  "minecraft:short_grass",
  "minecraft:tall_grass",
  "minecraft:fern",
  "minecraft:large_fern",
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
  "minecraft:glass",
  "minecraft:tinted_glass",
  "minecraft:water",
  "minecraft:lava",
  "minecraft:ice",
  "minecraft:packed_ice",
  "minecraft:blue_ice",
  "minecraft:frosted_ice",
  "minecraft:slime_block",
  "minecraft:honey_block",
  "minecraft:kelp",
  "minecraft:kelp_plant",
  "minecraft:seagrass",
  "minecraft:tall_seagrass",
  "minecraft:wheat",
  "minecraft:carrots",
  "minecraft:potatoes",
  "minecraft:beetroots",
  "minecraft:nether_wart",
  "minecraft:sugar_cane",
  "minecraft:cocoa",
  "minecraft:attached_melon_stem",
  "minecraft:attached_pumpkin_stem",
  "minecraft:dandelion",
  "minecraft:poppy",
  "minecraft:blue_orchid",
  "minecraft:allium",
  "minecraft:azure_bluet",
  "minecraft:red_tulip",
  "minecraft:orange_tulip",
  "minecraft:white_tulip",
  "minecraft:pink_tulip",
  "minecraft:oxeye_daisy",
  "minecraft:cornflower",
  "minecraft:lily_of_the_valley",
  "minecraft:wither_rose",
  "minecraft:sunflower",
  "minecraft:lilac",
  "minecraft:rose_bush",
  "minecraft:peony",
  "minecraft:dirt_path",
  "minecraft:farmland",
  "minecraft:snow",
  "minecraft:end_rod",
  "minecraft:chorus_plant",
  "minecraft:chorus_flower",
  "minecraft:cobweb",
  "minecraft:spawner",
  "minecraft:lantern",
  "minecraft:soul_lantern",
  "minecraft:lightning_rod",
  "minecraft:pointed_dripstone",
  "minecraft:sweet_berry_bush",
  "minecraft:cave_vines",
  "minecraft:cave_vines_plant",
  "minecraft:glow_lichen",
  "minecraft:sculk_vein",
  "minecraft:azalea",
  "minecraft:flowering_azalea",
  "minecraft:big_dripleaf",
  "minecraft:small_dripleaf",
  "minecraft:hanging_roots",
  "minecraft:spore_blossom",
]);

const FACE_ORDER = ["east", "west", "up", "down", "south", "north"];
const FACE_BITS = {
  east: 1,
  west: 2,
  up: 4,
  down: 8,
  south: 16,
  north: 32,
};
// Minecraft-style face shading multipliers (same as BlueMap / vanilla smooth lighting)
const FACE_SHADE_MULTIPLIERS = {
  up: 1.0,
  down: 0.5,
  north: 0.8,
  south: 0.8,
  east: 0.6,
  west: 0.6,
};

// AO neighbor offsets per face per vertex (Minecraft smooth lighting algorithm)
// For each face, for each of the 4 vertices, the 3 neighbors to check (2 sides + 1 corner)
const AO_NEIGHBOR_OFFSETS = {
  up: [
    [[-1,1,0],[0,1,-1],[-1,1,-1]],
    [[-1,1,0],[0,1,1],[-1,1,1]],
    [[1,1,0],[0,1,1],[1,1,1]],
    [[1,1,0],[0,1,-1],[1,1,-1]],
  ],
  down: [
    [[-1,-1,0],[0,-1,-1],[-1,-1,-1]],
    [[1,-1,0],[0,-1,-1],[1,-1,-1]],
    [[1,-1,0],[0,-1,1],[1,-1,1]],
    [[-1,-1,0],[0,-1,1],[-1,-1,1]],
  ],
  north: [
    [[-1,0,-1],[0,-1,-1],[-1,-1,-1]],
    [[-1,0,-1],[0,1,-1],[-1,1,-1]],
    [[1,0,-1],[0,1,-1],[1,1,-1]],
    [[1,0,-1],[0,-1,-1],[1,-1,-1]],
  ],
  south: [
    [[-1,0,1],[0,-1,1],[-1,-1,1]],
    [[1,0,1],[0,-1,1],[1,-1,1]],
    [[1,0,1],[0,1,1],[1,1,1]],
    [[-1,0,1],[0,1,1],[-1,1,1]],
  ],
  east: [
    [[1,0,-1],[1,-1,0],[1,-1,-1]],
    [[1,0,-1],[1,1,0],[1,1,-1]],
    [[1,0,1],[1,1,0],[1,1,1]],
    [[1,0,1],[1,-1,0],[1,-1,1]],
  ],
  west: [
    [[- 1,0,-1],[- 1,-1,0],[- 1,-1,-1]],
    [[-1,0,1],[-1,-1,0],[-1,-1,1]],
    [[-1,0,1],[-1,1,0],[-1,1,1]],
    [[-1,0,-1],[-1,1,0],[-1,1,-1]],
  ],
};

const FACE_NORMALS = {
  east: new THREE.Vector3(1, 0, 0),
  west: new THREE.Vector3(-1, 0, 0),
  up: new THREE.Vector3(0, 1, 0),
  down: new THREE.Vector3(0, -1, 0),
  south: new THREE.Vector3(0, 0, 1),
  north: new THREE.Vector3(0, 0, -1),
};

function normalToFaceName(normal) {
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);

  if (absX >= absY && absX >= absZ) {
    return normal.x >= 0 ? "east" : "west";
  }

  if (absY >= absX && absY >= absZ) {
    return normal.y >= 0 ? "up" : "down";
  }

  return normal.z >= 0 ? "south" : "north";
}

function createVariantRotationMatrix(x = 0, y = 0, z = 0) {
  return new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(
      (-x * Math.PI) / 180,
      (-y * Math.PI) / 180,
      (-z * Math.PI) / 180,
      "YXZ",
    ),
  );
}

function remapVisibleFacesForVariant(visibleFaces = 63, x = 0, y = 0, z = 0) {
  if (visibleFaces === 63 || (x === 0 && y === 0 && z === 0)) {
    return visibleFaces;
  }

  const rotationMatrix = createVariantRotationMatrix(x, y, z);
  let localVisibleFaces = 0;

  for (const faceName of FACE_ORDER) {
    const worldNormal = FACE_NORMALS[faceName]
      .clone()
      .applyMatrix4(rotationMatrix);
    const rotatedFaceName = normalToFaceName(worldNormal);

    if ((visibleFaces & FACE_BITS[rotatedFaceName]) !== 0) {
      localVisibleFaces |= FACE_BITS[faceName];
    }
  }

  return localVisibleFaces;
}

function isSimpleFullCube(element) {
  if (!element || element.rotation) return false;

  const isFullBounds =
    element.from?.[0] === 0 &&
    element.from?.[1] === 0 &&
    element.from?.[2] === 0 &&
    element.to?.[0] === 16 &&
    element.to?.[1] === 16 &&
    element.to?.[2] === 16;

  if (!isFullBounds) return false;

  return FACE_ORDER.every((face) => element.faces?.[face]);
}

function toLocalVertex([x, y, z]) {
  return new THREE.Vector3((x - 8) / 16, (y - 8) / 16, (z - 8) / 16);
}

function getFaceVertices(side, from, to) {
  const [x1, y1, z1] = from;
  const [x2, y2, z2] = to;

  switch (side) {
    case "east":
      return [
        [x2, y1, z1],
        [x2, y2, z1],
        [x2, y2, z2],
        [x2, y1, z2],
      ];
    case "west":
      return [
        [x1, y1, z1],
        [x1, y1, z2],
        [x1, y2, z2],
        [x1, y2, z1],
      ];
    case "up":
      return [
        [x1, y2, z1],
        [x1, y2, z2],
        [x2, y2, z2],
        [x2, y2, z1],
      ];
    case "down":
      return [
        [x1, y1, z1],
        [x2, y1, z1],
        [x2, y1, z2],
        [x1, y1, z2],
      ];
    case "south":
      return [
        [x1, y1, z2],
        [x2, y1, z2],
        [x2, y2, z2],
        [x1, y2, z2],
      ];
    case "north":
      return [
        [x1, y1, z1],
        [x1, y2, z1],
        [x2, y2, z1],
        [x2, y1, z1],
      ];
    default:
      return [];
  }
}

function getDefaultUv(side, from, to) {
  switch (side) {
    case "up":
      return [from[0], from[2], to[0], to[2]];
    case "down":
      return [from[0], 16 - to[2], to[0], 16 - from[2]];
    case "north":
      return [16 - to[0], 16 - to[1], 16 - from[0], 16 - from[1]];
    case "south":
      return [from[0], 16 - to[1], to[0], 16 - from[1]];
    case "east":
      return [16 - to[2], 16 - to[1], 16 - from[2], 16 - from[1]];
    case "west":
      return [from[2], 16 - to[1], to[2], 16 - from[1]];
    default:
      return [0, 0, 16, 16];
  }
}

function getElementRotationMatrix(rotation) {
  if (!rotation) return null;

  const { origin, axis, angle, rescale } = rotation;
  const rad = (angle * Math.PI) / 180;
  const pivot = new THREE.Vector3(
    (origin[0] - 8) / 16,
    (origin[1] - 8) / 16,
    (origin[2] - 8) / 16,
  );
  const matrix = new THREE.Matrix4();
  const rotationMatrix = new THREE.Matrix4();

  if (axis === "x") rotationMatrix.makeRotationX(rad);
  else if (axis === "y") rotationMatrix.makeRotationY(rad);
  else if (axis === "z") rotationMatrix.makeRotationZ(rad);

  matrix.multiply(new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z));
  matrix.multiply(rotationMatrix);

  if (rescale) {
    const scale = 1 / Math.cos(rad);
    if (axis === "x") matrix.multiply(new THREE.Matrix4().makeScale(1, scale, scale));
    else if (axis === "y") matrix.multiply(new THREE.Matrix4().makeScale(scale, 1, scale));
    else if (axis === "z") matrix.multiply(new THREE.Matrix4().makeScale(scale, scale, 1));
  }

  matrix.multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  return matrix;
}

function rotateUvCoordinates(coords, rotation = 0) {
  const steps = ((((rotation / 90) % 4) + 4) % 4) | 0;
  if (steps === 0) return coords;

  return coords.map((_, index) => coords[(index + steps) % 4]);
}

function mapUvToAtlas(uv, atlasUV) {
  const [au1, av1, au2, av2] = atlasUV;
  const atlasWidth = au2 - au1;
  const atlasHeight = av2 - av1;
  
  // Tiny inset margin (approx 0.2 pixels on a 1024 atlas) to prevent texture bleeding
  const bleedMargin = 0.0002;

  const raw = [
    [uv[0], uv[3]],
    [uv[2], uv[3]],
    [uv[2], uv[1]],
    [uv[0], uv[1]],
  ];

  return raw.map(([u, v]) => {
    let mappedU = au1 + (u / 16) * atlasWidth;
    let mappedV = av1 + (v / 16) * atlasHeight;

    // Apply inset only at the edges of the tile bounds
    if (u <= 0.1) mappedU += bleedMargin;
    else if (u >= 15.9) mappedU -= bleedMargin;
    
    if (v <= 0.1) mappedV += bleedMargin;
    else if (v >= 15.9) mappedV -= bleedMargin;

    return [mappedU, 1 - mappedV];
  });
}

function buildGeometryFromArrays(positions, normals, uvs, indices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export class GeometryBuilder {
  static async build(
    variants,
    assetLoader,
    bakeVariantRotation = true,
    visibleFaces = 63,
    options = {},
  ) {
    const geometries = [];

    for (const entry of variants.filter(Boolean)) {
      const modelData = await assetLoader.getModel(entry.model);
      if (!modelData || !modelData.elements) continue;

      const modelGeometry = this.buildModelGeometry(
        modelData,
        entry,
        assetLoader,
        bakeVariantRotation,
        visibleFaces,
        options,
      );

      if (modelGeometry) geometries.push(modelGeometry);
    }

    if (geometries.length === 0) return null;
    if (geometries.length === 1) return geometries[0];

    return BufferGeometryUtils.mergeGeometries(geometries);
  }

  static buildModelGeometry(
    modelData,
    entry,
    assetLoader,
    bakeVariantRotation,
    visibleFaces,
    options = {},
  ) {
    const { x = 0, y = 0, z = 0 } = entry;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const colors = [];
    const aoValues = [];
    const tintColor = options.tintColor || [1, 1, 1];
    const aoData = options.aoData || null; // { blockX, blockY, blockZ, occlusionMap }
    const variantMatrix = bakeVariantRotation
      ? createVariantRotationMatrix(x, y, z)
      : null;
    const localVisibleFaces = remapVisibleFacesForVariant(visibleFaces, x, y, z);
    const normalMatrix = new THREE.Matrix3();

    for (const element of modelData.elements) {
      const { from, to, faces, rotation } = element;
      if (!from || !to || !faces) continue;

      const elementMatrix = getElementRotationMatrix(rotation);
      const transformMatrix = new THREE.Matrix4();
      if (variantMatrix) transformMatrix.multiply(variantMatrix);
      if (elementMatrix) transformMatrix.multiply(elementMatrix);
      normalMatrix.getNormalMatrix(transformMatrix);
      const canCullSimpleFaces = isSimpleFullCube(element);

      for (const side of FACE_ORDER) {
        const faceData = faces[side];
        if (!faceData) continue;
        if (
          canCullSimpleFaces &&
          (localVisibleFaces & FACE_BITS[side]) === 0
        ) {
          continue;
        }

        const texturePath = assetLoader.resolveTexture(
          faceData.texture,
          modelData.textures,
        );
        const atlasUV =
          assetLoader.getAtlasUV(texturePath) || assetLoader.getFallbackAtlasUV();

        if (!atlasUV) continue;

        // Face shading — Minecraft/BlueMap style directional multiplier
        const shade = FACE_SHADE_MULTIPLIERS[side] || 0.8;

        // Compute per-vertex AO for this face
        let vertexAO = [1, 1, 1, 1]; // default: no AO
        if (aoData && canCullSimpleFaces) {
          vertexAO = GeometryBuilder.computeVertexAO(
            side, aoData.blockX, aoData.blockY, aoData.blockZ, aoData.occlusionMap,
          );
        }

        const faceVertices = getFaceVertices(side, from, to);
        const transformedNormal = FACE_NORMALS[side]
          .clone()
          .applyMatrix3(normalMatrix)
          .normalize();
        const baseIndex = positions.length / 3;
        const uv = faceData.uv || getDefaultUv(side, from, to);
        const atlasCoords = rotateUvCoordinates(
          mapUvToAtlas(uv, atlasUV),
          faceData.rotation || 0,
        );
        const baseFaceColor = Number.isInteger(faceData.tintindex)
          ? tintColor
          : [1, 1, 1];

        faceVertices.forEach((vertex, index) => {
          const position = toLocalVertex(vertex).applyMatrix4(transformMatrix);
          positions.push(position.x, position.y, position.z);
          normals.push(
            transformedNormal.x,
            transformedNormal.y,
            transformedNormal.z,
          );
          uvs.push(atlasCoords[index][0], atlasCoords[index][1]);
          // Multiply vertex color by face shading
          colors.push(
            baseFaceColor[0] * shade,
            baseFaceColor[1] * shade,
            baseFaceColor[2] * shade,
          );
          aoValues.push(vertexAO[index]);
        });

        indices.push(
          baseIndex,
          baseIndex + 1,
          baseIndex + 2,
          baseIndex,
          baseIndex + 2,
          baseIndex + 3,
        );
      }
    }

    if (positions.length === 0) return null;
    const geometry = buildGeometryFromArrays(positions, normals, uvs, indices);
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("ao", new THREE.Float32BufferAttribute(aoValues, 1));
    return geometry;
  }

  /**
   * Compute per-vertex AO for a face using Minecraft's smooth lighting algorithm.
   * For each vertex, check 3 neighbors (2 edge + 1 corner) and compute occlusion.
   * Returns array of 4 AO values (0.0=fully occluded, 1.0=fully lit).
   */
  static computeVertexAO(face, bx, by, bz, occlusionMap) {
    const offsets = AO_NEIGHBOR_OFFSETS[face];
    if (!offsets || !occlusionMap) return [1, 1, 1, 1];

    const result = [];
    for (let v = 0; v < 4; v++) {
      const [side1Off, side2Off, cornerOff] = offsets[v];
      const side1 = occlusionMap[`${bx+side1Off[0]},${by+side1Off[1]},${bz+side1Off[2]}`] ? 1 : 0;
      const side2 = occlusionMap[`${bx+side2Off[0]},${by+side2Off[1]},${bz+side2Off[2]}`] ? 1 : 0;
      const corner = occlusionMap[`${bx+cornerOff[0]},${by+cornerOff[1]},${bz+cornerOff[2]}`] ? 1 : 0;

      // Minecraft AO formula
      let ao;
      if (side1 && side2) {
        ao = 0; // both sides are solid, corner is fully occluded
      } else {
        ao = 3 - (side1 + side2 + corner);
      }
      // Map to 0.0-1.0 range with a curve for softer look
      const aoNorm = ao / 3.0;
      // Apply a slight curve to make the AO effect more pronounced
      result.push(0.2 + aoNorm * 0.8);
    }
    return result;
  }
}
