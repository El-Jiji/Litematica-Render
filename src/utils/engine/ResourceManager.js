import { assetLoader } from './AssetLoader';
import { BlockStateResolver } from './BlockStateResolver';
import { GeometryBuilder } from './GeometryBuilder';
import * as THREE from 'three';
import { blockMapper } from '../BlockMapper';

class ResourceManager {
  constructor() {
    this.geometryCache = new Map(); // key: modelID (or variants identifier)
    this.sharedMaterial = null;
  }

  async getSharedMaterial() {
    await assetLoader.init();
    if (!this.sharedMaterial) {
      this.sharedMaterial = new THREE.MeshStandardMaterial({
        map: assetLoader.atlasTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.FrontSide
      });
    }
    return this.sharedMaterial;
  }

  async getBlockData(blockName, props) {
    const blockState = await assetLoader.getBlockState(blockName);
    if (!blockState) {
      if (blockName !== 'air' && blockName !== 'minecraft:air') {
        console.warn(`[ResourceManager] Missing blockstate for: ${blockName}`);
      }
      return null;
    }

    const variants = BlockStateResolver.resolve(blockState, props);
    if (variants.length === 0) {
      console.warn(`[ResourceManager] No matching variants for: ${blockName}`, props);
      return null;
    }

    // Optimization: Group by "Model Layout"
    // Variants is an array of { model, x, y, uvlock }
    // We want a unique key for the GEOMETRY (without x,y if we rotate it via instance matrix)
    // BUT some blocks need baked rotation (like those with non-90 deg rotations or complex elements)
    // For simplicity now, let's keep baking for anything that isn't a simple 90-deg rotation if needed.
    // Actually, let's group by "variants string" but WITHOUT x,y.
    const geometryKey = variants.map(v => v.model).join('|');
    
    let geometry = this.geometryCache.get(geometryKey);
    if (geometry === undefined) {
      // Build geometry WITHOUT variant rotation baked in
      geometry = await GeometryBuilder.build(variants, assetLoader, false);
      this.geometryCache.set(geometryKey, geometry);
    }

    if (!geometry) {
      const texName = blockMapper.getTexture(blockName, 'side', props || {});
      const texturePath = texName ? `minecraft:block/${texName}` : null;
      const atlasUV = texturePath ? assetLoader.getAtlasUV(texturePath) : null;
      const w = 12, h = 12, d = 1;
      const g = new THREE.BoxGeometry(w, h, d);
      g.scale(1/16, 1/16, 1/16);
      const uv = g.attributes.uv;
      if (atlasUV) {
        const u1 = atlasUV[0];
        const v1 = atlasUV[1];
        const u2 = atlasUV[2];
        const v2 = atlasUV[3];
        const coords = [
          [u1, 1 - v1],
          [u2, 1 - v1],
          [u1, 1 - v2],
          [u2, 1 - v2]
        ];
        for (let i = 0; i < uv.count; i++) {
          const c = coords[i % 4];
          uv.setXY(i, c[0], c[1]);
        }
        uv.needsUpdate = true;
      }
      geometry = g;
      this.geometryCache.set(geometryKey, geometry);
    }

    const material = await this.getSharedMaterial();

    return { 
      geometry, 
      material, 
      // Return the required rotation for the instance
      rotation: { x: variants[0].x || 0, y: variants[0].y || 0 } 
    };
  }
}

export const resourceManager = new ResourceManager();
