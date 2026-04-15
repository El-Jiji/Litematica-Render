import * as THREE from 'three';

const LOCAL_RENDER_ASSETS_BASE = '/mc/render-assets';
const BLOCKSTATE_SOURCES = [
  `${LOCAL_RENDER_ASSETS_BASE}/blockstates.min.json`,
  'https://raw.githubusercontent.com/misode/mcmeta/summary/assets/block_definition/data.min.json',
];
const MODEL_SOURCES = [
  `${LOCAL_RENDER_ASSETS_BASE}/models.min.json`,
  'https://raw.githubusercontent.com/misode/mcmeta/summary/assets/model/data.min.json',
];
const ATLAS_UV_SOURCES = [
  `${LOCAL_RENDER_ASSETS_BASE}/atlas-uv.min.json`,
  'https://raw.githubusercontent.com/misode/mcmeta/atlas/all/data.min.json',
];
const ATLAS_TEXTURE_SOURCES = [
  `${LOCAL_RENDER_ASSETS_BASE}/atlas.png`,
  'https://raw.githubusercontent.com/misode/mcmeta/atlas/all/atlas.png',
];
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
          this.loadJsonWithFallback(BLOCKSTATE_SOURCES, "blockstates"),
          this.loadJsonWithFallback(MODEL_SOURCES, "models"),
          this.loadJsonWithFallback(ATLAS_UV_SOURCES, "atlas UVs"),
          this.loadAtlasTextureWithFallback(),
        ]);

        if (!bsData || !mData || !uvData || !atlasTexture) {
          throw new Error("One or more Minecraft render assets failed to load.");
        }

        this.blockstates = bsData;
        this.models = mData;
        this.atlasUVs = uvData;
        this.atlasTexture = atlasTexture;
      } catch (e) {
        console.error("Failed to load Minecraft assets", e);
        throw e;
      }
    })();

    return this.loadingPromise;
  }

  async loadJsonWithFallback(urls, label) {
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        console.warn(`[AssetLoader] Failed to load ${label} from ${url}`, error);
      }
    }

    return null;
  }

  async loadTexture(url) {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(url, (texture) => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        resolve(texture);
      }, undefined, (err) => {
        resolve(null);
      });
    });
  }

  async loadAtlasTextureWithFallback() {
    for (const url of ATLAS_TEXTURE_SOURCES) {
      const texture = await this.loadTexture(url);
      if (texture) {
        return texture;
      }

      console.warn(`[AssetLoader] Failed to load atlas texture from ${url}`);
    }

    return null;
  }

  getAtlasUV(texturePath) {
    if (!this.atlasUVs || typeof texturePath !== 'string') return null;
    const path = texturePath.startsWith('minecraft:') ? texturePath.split(':')[1] : texturePath;
    // misode summary prefix is "block/" or "item/"
    const key = path.startsWith('block/') || path.startsWith('item/') ? path : `block/${path}`;
    const uv = this.atlasUVs[key];
    if (!uv || !this.atlasTexture?.image) return null;

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

    for (const pid of possibleIds) {
      if (this.models[pid]) {
        data = JSON.parse(JSON.stringify(this.models[pid])); // Deep clone to avoid mutating cache
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

    if (typeof current === 'object') {
      current = current.id || current.texture || current.path || null;
    }

    if (typeof current !== 'string') {
      return null;
    }

    let depth = 0;
    while (typeof current === 'string' && current.startsWith('#') && depth < 10) {
      const key = current.slice(1);
      current = textures?.[key];
      if (typeof current === 'object') {
        current = current?.id || current?.texture || current?.path || null;
      }
      if (!current) return null;
      depth++;
    }

    return typeof current === 'string' ? current : null;
  }
}

export const assetLoader = new AssetLoader();
