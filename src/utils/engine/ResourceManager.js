import { assetLoader } from "./AssetLoader";
import { BlockStateResolver } from "./BlockStateResolver";
import { GeometryBuilder } from "./GeometryBuilder";
import * as THREE from "three";
import { blockMapper } from "../BlockMapper";

class ResourceManager {
  constructor() {
    this.geometryCache = new Map();
    this.sharedMaterial = null;
  }

  async getSharedMaterial() {
    try {
      await assetLoader.init();
    } catch (error) {
      console.warn("[ResourceManager] Falling back to untextured material.", error);
    }

    if (!this.sharedMaterial) {
      this.sharedMaterial = new THREE.MeshStandardMaterial({
        map: assetLoader.atlasTexture || null,
        color: assetLoader.atlasTexture ? 0xffffff : 0xbfc7d5,
        transparent: Boolean(assetLoader.atlasTexture),
        alphaTest: assetLoader.atlasTexture ? 0.5 : 0,
        side: THREE.FrontSide,
        vertexColors: false,
      });
    }
    return this.sharedMaterial;
  }

  async getBlockData(blockName, props, visibleFaces = 63) {
    let blockState = null;

    try {
      blockState = await assetLoader.getBlockState(blockName);
    } catch (error) {
      console.warn(`[ResourceManager] Blockstate load failed for: ${blockName}`, error);
    }

    if (!blockState) {
      if (blockName !== "air" && blockName !== "minecraft:air") {
        console.warn(`[ResourceManager] Missing blockstate for: ${blockName}`);
      }
      const fallback = this.createFallbackGeometry(blockName, props, visibleFaces);
      const material = await this.getSharedMaterial();
      return fallback ? { ...fallback, material, kind: "fallback" } : null;
    }

    const variants = BlockStateResolver.resolve(blockState, props);
    if (variants.length === 0) {
      console.warn(`[ResourceManager] No matching variants for: ${blockName}`, props);
      const fallback = this.createFallbackGeometry(blockName, props, visibleFaces);
      const material = await this.getSharedMaterial();
      return fallback ? { ...fallback, material, kind: "fallback" } : null;
    }

    // Optimization: Group by "Model Layout"
    // Variants is an array of { model, x, y, uvlock }
    // We want a unique key for the GEOMETRY (without x,y if we rotate it via instance matrix)
    // BUT some blocks need baked rotation (like those with non-90 deg rotations or complex elements)
    // For simplicity now, let's keep baking for anything that isn't a simple 90-deg rotation if needed.
    // Actually, let's group by "variants string" but WITHOUT x,y.
    const geometryKey = `${variants
      .map(
        (variant) =>
          `${variant.model}@x${variant.x || 0}@y${variant.y || 0}@u${
            variant.uvlock ? 1 : 0
          }`,
      )
      .join("|")}::${visibleFaces}`;
    
    let geometry = this.geometryCache.get(geometryKey);
    if (geometry === undefined) {
      geometry = await GeometryBuilder.build(
        variants,
        assetLoader,
        true,
        visibleFaces,
      );
      this.geometryCache.set(geometryKey, geometry);
    }

    if (!geometry) {
      geometry = this.createFallbackGeometry(blockName, props, visibleFaces)?.geometry;
      this.geometryCache.set(geometryKey, geometry);
    }

    const material = await this.getSharedMaterial();

    return { 
      geometry, 
      material, 
      rotation: null,
      kind: geometry ? "model" : "fallback",
    };
  }

  createFallbackGeometry(blockName, props = {}, visibleFaces = 63) {
    const texName = blockMapper.getTexture(blockName, "side", props);
    const texturePath = texName ? `minecraft:block/${texName}` : null;
    const atlasUV = texturePath ? assetLoader.getAtlasUV(texturePath) : null;
    const geometry = new THREE.BoxGeometry(12, 12, 12);
    geometry.scale(1 / 16, 1 / 16, 1 / 16);

    if (visibleFaces !== 63 && geometry.index) {
      const baseIndex = geometry.index.array;
      const filtered = [];
      const faceOrder = ["east", "west", "up", "down", "south", "north"];
      const faceBits = {
        east: 1,
        west: 2,
        up: 4,
        down: 8,
        south: 16,
        north: 32,
      };

      for (let faceIndex = 0; faceIndex < faceOrder.length; faceIndex += 1) {
        const faceName = faceOrder[faceIndex];
        if ((visibleFaces & faceBits[faceName]) === 0) {
          continue;
        }

        const start = faceIndex * 6;
        for (let i = 0; i < 6; i += 1) {
          filtered.push(baseIndex[start + i]);
        }
      }

      geometry.setIndex(filtered);
      geometry.computeVertexNormals();
    }

    const uv = geometry.attributes.uv;
    if (atlasUV && uv) {
      const [u1, v1, u2, v2] = atlasUV;
      const coords = [
        [u1, 1 - v1],
        [u2, 1 - v1],
        [u1, 1 - v2],
        [u2, 1 - v2],
      ];

      for (let i = 0; i < uv.count; i += 1) {
        const coord = coords[i % 4];
        uv.setXY(i, coord[0], coord[1]);
      }
      uv.needsUpdate = true;
    }

    return { geometry };
  }
}

export const resourceManager = new ResourceManager();
