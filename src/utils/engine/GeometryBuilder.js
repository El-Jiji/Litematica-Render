import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';

export class GeometryBuilder {
  /**
   * Builds a geometry for a set of model variants.
   * IMPROVEMENT: Rotations (x, y) are NOT baked into the geometry here anymore
   * if we want to move them to the instance matrix.
   */
  static async build(variants, assetLoader, bakeVariantRotation = true) {
    const geometries = [];

    for (const entry of variants) {
      const modelData = await assetLoader.getModel(entry.model);
      if (!modelData || !modelData.elements) continue;

      const modelGeometries = await this.buildModelGeometries(modelData, entry, assetLoader, bakeVariantRotation);
      geometries.push(...modelGeometries);
    }

    if (geometries.length === 0) return null;
    
    return BufferGeometryUtils.mergeGeometries(geometries);
  }

  static async buildModelGeometries(modelData, entry, assetLoader, bakeVariantRotation) {
    const { x = 0, y = 0 } = entry;
    const resultGeometries = [];

    for (const element of modelData.elements) {
      const { from, to, faces, rotation } = element;
      const size = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
      const center = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];

      let geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
      geometry.translate(center[0] - 8, center[1] - 8, center[2] - 8);
      geometry.scale(1/16, 1/16, 1/16);

      // Element rotation (baked)
      if (rotation) {
        const { origin, axis, angle, rescale } = rotation;
        const rad = (angle * Math.PI) / 180;
        const pivot = new THREE.Vector3((origin[0] - 8) / 16, (origin[1] - 8) / 16, (origin[2] - 8) / 16);
        
        geometry.translate(-pivot.x, -pivot.y, -pivot.z);
        if (axis === 'x') geometry.rotateX(rad);
        else if (axis === 'y') geometry.rotateY(rad);
        else if (axis === 'z') geometry.rotateZ(rad);

        if (rescale) {
          const scale = 1 / Math.cos(rad);
          if (axis === 'x') geometry.scale(1, scale, scale);
          else if (axis === 'y') geometry.scale(scale, 1, scale);
          else if (axis === 'z') geometry.scale(scale, scale, 1);
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
        const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'];
        
        for (let i = 0; i < faceOrder.length; i++) {
          const side = faceOrder[i];
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
            if (side === 'up' || side === 'down') uv = [from[0], from[2], to[0], to[2]];
            else if (side === 'south' || side === 'north') uv = [from[0], from[1], to[0], to[1]];
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
