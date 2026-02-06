import * as THREE from 'three';

const MCMETA_SUMMARY_BASE = 'https://raw.githubusercontent.com/misode/mcmeta/summary/assets/';
const MCMETA_ASSETS_BASE = 'https://raw.githubusercontent.com/misode/mcmeta/assets/';
const MCMETA_ATLAS_BASE = 'https://raw.githubusercontent.com/misode/mcmeta/atlas/all/';

class AssetLoader {
  constructor() {
    this.blockstates = null;
    this.models = null;
    this.atlasImage = null;
    this.atlasUVs = null;
    this.atlasTexture = null;
    this.textures = new Map();
    this.loadingPromise = null;
  }

  async init() {
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        const [bsData, mData, uvData, atlasTexture] = await Promise.all([
          fetch(`${MCMETA_SUMMARY_BASE}block_definition/data.min.json`).then(r => r.json()),
          fetch(`${MCMETA_SUMMARY_BASE}model/data.min.json`).then(r => r.json()),
          fetch(`${MCMETA_ATLAS_BASE}data.min.json`).then(r => r.json()),
          this.loadAtlasTexture()
        ]);
        this.blockstates = bsData;
        this.models = mData;
        this.atlasUVs = uvData;
        this.atlasTexture = atlasTexture;
      } catch (e) {
        console.error("Failed to load Minecraft assets", e);
      }
    })();

    return this.loadingPromise;
  }

  async loadAtlasTexture() {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(`${MCMETA_ATLAS_BASE}atlas.png`, (texture) => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        resolve(texture);
      }, undefined, (err) => {
        console.error("Failed to load atlas texture", err);
        resolve(null);
      });
    });
  }

  getAtlasUV(texturePath) {
    if (!this.atlasUVs) return null;
    const path = texturePath.startsWith('minecraft:') ? texturePath.split(':')[1] : texturePath;
    // misode summary prefix is "block/" or "item/"
    const key = path.startsWith('block/') || path.startsWith('item/') ? path : `block/${path}`;
    const uv = this.atlasUVs[key];
    if (!uv) return null;

    const atlasWidth = this.atlasTexture.image.width;
    const atlasHeight = this.atlasTexture.image.height;
    // misode uv: [x, y, w, h] in pixels
    return [
      uv[0] / atlasWidth,
      uv[1] / atlasHeight,
      (uv[0] + uv[2]) / atlasWidth,
      (uv[1] + uv[3]) / atlasHeight
    ];
  }

  async getBlockState(blockName) {
    await this.init();
    const id = blockName.startsWith('minecraft:') ? blockName.split(':')[1] : blockName;
    return this.blockstates?.[id] || null;
  }

  async getModel(modelPath) {
    if (!this.models) return null;
    await this.init();
    
    const id = modelPath.includes(':') ? modelPath.split(':')[1] : modelPath;
    
    // Try multiple ID formats to handle inconsistent naming in mcmeta summary
    const possibleIds = [
      id,
      id.startsWith('block/') ? id : `block/${id}`,
      id.startsWith('item/') ? id : `item/${id}`,
      id.includes('/') ? id.split('/').pop() : id 
    ];

    let data = null;
    let foundId = null;

    for (const pid of possibleIds) {
      if (this.models[pid]) {
        data = JSON.parse(JSON.stringify(this.models[pid])); // Deep clone to avoid mutating cache
        foundId = pid;
        break;
      }
    }

    if (!data) {
      console.error(`[AssetLoader] Model not found: ${modelPath} (tried: ${possibleIds.join(', ')})`);
      return null;
    }

    if (data.parent) {
      const parentData = await this.getModel(data.parent);
      if (parentData) {
        data = this.mergeModel(parentData, data);
      }
    }
    return data;
  }

  mergeModel(parent, child) {
    return {
      ...parent,
      ...child,
      textures: { ...(parent.textures || {}), ...(child.textures || {}) },
      elements: child.elements || parent.elements,
    };
  }

  resolveTexture(textureRef, textures) {
    if (!textureRef) return null;
    let current = textureRef;
    let depth = 0;
    while (current.startsWith('#') && depth < 10) {
      const key = current.slice(1);
      current = textures?.[key];
      if (!current) return null;
      depth++;
    }
    return current;
  }
}

export const assetLoader = new AssetLoader();
