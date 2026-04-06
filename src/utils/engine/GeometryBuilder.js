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

function remapVisibleFacesForVariant(visibleFaces = 63, x = 0, y = 0) {
  if (visibleFaces === 63 || (x === 0 && y === 0)) {
    return visibleFaces;
  }

  const rotationMatrix = new THREE.Matrix4()
    .makeRotationY((-y * Math.PI) / 180)
    .multiply(new THREE.Matrix4().makeRotationX((-x * Math.PI) / 180));

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

function createIndexedGeometryWithVisibleFaces(geometry, visibleFaces = 63) {
  if (visibleFaces === 63 || !geometry.index) {
    return geometry;
  }

  const baseIndex = geometry.index.array;
  const filtered = [];

  for (let faceIndex = 0; faceIndex < FACE_ORDER.length; faceIndex++) {
    const faceName = FACE_ORDER[faceIndex];
    const isVisible = (visibleFaces & FACE_BITS[faceName]) !== 0;

    if (!isVisible) continue;

    const start = faceIndex * 6;
    for (let i = 0; i < 6; i++) {
      filtered.push(baseIndex[start + i]);
    }
  }

  if (filtered.length === 0) {
    geometry.dispose();
    return null;
  }

  geometry.setIndex(filtered);
  geometry.computeVertexNormals();
  return geometry;
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

export class GeometryBuilder {
  /**
   * Builds a geometry for a set of model variants.
   * IMPROVEMENT: Rotations (x, y) are NOT baked into the geometry here anymore
   * if we want to move them to the instance matrix.
   */
  static async build(
    variants,
    assetLoader,
    bakeVariantRotation = true,
    visibleFaces = 63,
  ) {
    const geometries = [];

    for (const entry of variants) {
      const modelData = await assetLoader.getModel(entry.model);
      if (!modelData || !modelData.elements) continue;

      const modelGeometries = await this.buildModelGeometries(
        modelData,
        entry,
        assetLoader,
        bakeVariantRotation,
        visibleFaces,
      );
      geometries.push(...modelGeometries);
    }

    if (geometries.length === 0) return null;
    
    return BufferGeometryUtils.mergeGeometries(geometries);
  }

  static async buildModelGeometries(
    modelData,
    entry,
    assetLoader,
    bakeVariantRotation,
    visibleFaces,
  ) {
    const { x = 0, y = 0 } = entry;
    const resultGeometries = [];
    const localVisibleFaces = remapVisibleFacesForVariant(visibleFaces, x, y);

    for (const element of modelData.elements) {
      const { from, to, faces, rotation } = element;
      const size = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
      const center = [
        (from[0] + to[0]) / 2,
        (from[1] + to[1]) / 2,
        (from[2] + to[2]) / 2,
      ];

      let geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
      geometry.translate(center[0] - 8, center[1] - 8, center[2] - 8);
      geometry.scale(1 / 16, 1 / 16, 1 / 16);

      if (isSimpleFullCube(element)) {
        geometry = createIndexedGeometryWithVisibleFaces(
          geometry,
          localVisibleFaces,
        );
        if (!geometry) continue;
      }

      // Element rotation (baked)
      if (rotation) {
        const { origin, axis, angle, rescale } = rotation;
        const rad = (angle * Math.PI) / 180;
        const pivot = new THREE.Vector3(
          (origin[0] - 8) / 16,
          (origin[1] - 8) / 16,
          (origin[2] - 8) / 16,
        );

        geometry.translate(-pivot.x, -pivot.y, -pivot.z);
        if (axis === "x") geometry.rotateX(rad);
        else if (axis === "y") geometry.rotateY(rad);
        else if (axis === "z") geometry.rotateZ(rad);

        if (rescale) {
          const scale = 1 / Math.cos(rad);
          if (axis === "x") geometry.scale(1, scale, scale);
          else if (axis === "y") geometry.scale(scale, 1, scale);
          else if (axis === "z") geometry.scale(scale, scale, 1);
        }
        geometry.translate(pivot.x, pivot.y, pivot.z);
      }

      // Variant rotation (baked only if requested)
      if (bakeVariantRotation) {
        if (x !== 0) geometry.rotateX((-x * Math.PI) / 180);
        if (y !== 0) geometry.rotateY((-y * Math.PI) / 180);
      }

      // UV Mapping using Atlas
      if (faces) {
        const uvAttribute = geometry.attributes.uv;
        
        for (let i = 0; i < FACE_ORDER.length; i++) {
          const side = FACE_ORDER[i];
          const faceData = faces[side];
          if (!faceData) {
            // Hide face by collapsing UVs
            for (let j = 0; j < 4; j++) uvAttribute.setXY(i * 4 + j, 0, 0);
            continue;
          }

          const texturePath = assetLoader.resolveTexture(faceData.texture, modelData.textures);
          const atlasUV = assetLoader.getAtlasUV(texturePath);

          let uv = faceData.uv;
          if (!uv) {
            if (side === "up" || side === "down") uv = [from[0], from[2], to[0], to[2]];
            else if (side === "south" || side === "north") uv = [from[0], from[1], to[0], to[1]];
            else uv = [from[2], from[1], to[2], to[1]];
          }

          const startIdx = i * 4;
          if (atlasUV) {
            // atlasUV: [u1, v1, u2, v2] where u, v are 0-1
            const au1 = atlasUV[0];
            const av1 = atlasUV[1];
            const au2 = atlasUV[2];
            const av2 = atlasUV[3];
            const aw = au2 - au1;
            const ah = av2 - av1;

            // Element local UVs (0-16)

            // Map local to atlas
            // NOTE: Minecraft UVs are [x1, y1, x2, y2]
            // where y is 0 at top. Atlas coordinates usually match this?
            // Misode atlas.png has 0,0 at top-left.

            // Actually, simplified:
            const uMin = au1 + (uv[0] / 16) * aw;
            const vMin = av1 + (uv[1] / 16) * ah;
            const uMax = au1 + (uv[2] / 16) * aw;
            const vMax = av1 + (uv[3] / 16) * ah;

            const coords = [
              [uMin, 1 - vMin], // 0: TL
              [uMax, 1 - vMin], // 1: TR
              [uMin, 1 - vMax], // 2: BL
              [uMax, 1 - vMax], // 3: BR
            ];

            // Minecraft UV rotation (clockwise)
            const rot = faceData.rotation || 0;
            let indices = [0, 1, 2, 3];
            if (rot === 90) indices = [2, 0, 3, 1];
            else if (rot === 180) indices = [3, 2, 1, 0];
            else if (rot === 270) indices = [1, 3, 0, 2];

            for (let j = 0; j < 4; j++) {
              const c = coords[indices[j]];
              uvAttribute.setXY(startIdx + j, c[0], c[1]);
            }
          } else {
            // Fail safe UVs
            uvAttribute.setXY(startIdx + 0, 0, 0);
            uvAttribute.setXY(startIdx + 1, 1, 0);
            uvAttribute.setXY(startIdx + 2, 0, 1);
            uvAttribute.setXY(startIdx + 3, 1, 1);
          }
        }
        uvAttribute.needsUpdate = true;
      }

      resultGeometries.push(geometry);
    }

    return resultGeometries;
  }
}
