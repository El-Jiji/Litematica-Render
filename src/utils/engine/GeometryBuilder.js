import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";

const FACE_ORDER = ["east", "west", "up", "down", "south", "north"];
const FACE_BITS = {
  east: 1,
  west: 2,
  up: 4,
  down: 8,
  south: 16,
  north: 32,
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
  const raw = [
    [uv[0], uv[3]],
    [uv[2], uv[3]],
    [uv[2], uv[1]],
    [uv[0], uv[1]],
  ];

  return raw.map(([u, v]) => [
    au1 + (u / 16) * atlasWidth,
    1 - (av1 + (v / 16) * atlasHeight),
  ]);
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
    const tintColor = options.tintColor || [1, 1, 1];
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
        const faceColor = Number.isInteger(faceData.tintindex)
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
          colors.push(faceColor[0], faceColor[1], faceColor[2]);
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
    return geometry;
  }
}
