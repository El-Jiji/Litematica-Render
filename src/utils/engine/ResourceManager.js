import { assetLoader } from "./AssetLoader";
import { BlockStateResolver } from "./BlockStateResolver";
import { GeometryBuilder } from "./GeometryBuilder";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";
import { blockMapper } from "../BlockMapper";

const ATLAS_ANIMATION_LIMIT = 48;
const TEXTURE_ALIASES = {
  "minecraft:block/chain": "minecraft:block/iron_chain",
};
const AQUATIC_PLANTS = new Set([
  "kelp",
  "kelp_plant",
  "seagrass",
  "tall_seagrass",
]);

function hexToRgb(color) {
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  return [r, g, b];
}

function getTintColor(blockName, props = {}) {
  const simpleName = blockName.replace("minecraft:", "");

  if (simpleName === "water") return hexToRgb(0x3f76e4);
  if (simpleName === "lava") return hexToRgb(0xff6b18);
  if (simpleName.includes("grass") || simpleName.includes("fern")) {
    return hexToRgb(0x79c05a);
  }
  if (simpleName.endsWith("_leaves") || simpleName.includes("vine")) {
    return hexToRgb(0x59ae30);
  }
  if (simpleName === "redstone_wire") {
    const power = Math.max(0, Math.min(15, Number(props.power || 0)));
    const intensity = power / 15;
    return [0.28 + intensity * 0.72, 0, 0];
  }

  return [1, 1, 1];
}

function normalizeTexturePath(texturePath) {
  return TEXTURE_ALIASES[texturePath] || texturePath;
}

function shouldRenderWaterOverlay(blockName, props = {}) {
  const simpleName = blockName.replace("minecraft:", "");
  return (
    props?.waterlogged === "true" ||
    props?.waterlogged === true ||
    AQUATIC_PLANTS.has(simpleName)
  );
}

function ensureColorAttribute(geometry, color = [1, 1, 1]) {
  if (!geometry) return geometry;

  const position = geometry.getAttribute("position");
  if (!position) return geometry;

  if (!geometry.getAttribute("color")) {
    const colors = [];
    for (let i = 0; i < position.count; i += 1) {
      colors.push(color[0], color[1], color[2]);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }

  if (!geometry.getAttribute("ao")) {
    const aoValues = new Float32Array(position.count).fill(1.0);
    geometry.setAttribute("ao", new THREE.Float32BufferAttribute(aoValues, 1));
  }

  return geometry;
}

function patchAtlasAnimationShader(material, animationRegions) {
  if (!animationRegions.length || material.userData.atlasAnimationPatched) {
    return;
  }

  const paddedRegions = Array.from({ length: ATLAS_ANIMATION_LIMIT }, (_, index) => {
    const region = animationRegions[index];
    return new THREE.Vector4(...(region?.region || [0, 0, 0, 0]));
  });
  const paddedFrameCounts = Array.from(
    { length: ATLAS_ANIMATION_LIMIT },
    (_, index) => animationRegions[index]?.frameCount || 1,
  );
  const paddedFrameHeights = Array.from(
    { length: ATLAS_ANIMATION_LIMIT },
    (_, index) => animationRegions[index]?.frameHeight || 0,
  );

  material.userData.atlasAnimationUniforms = {
    atlasAnimationTime: { value: 0 },
    atlasAnimationRegionCount: { value: animationRegions.length },
    atlasAnimationRegions: { value: paddedRegions },
    atlasAnimationFrameCounts: { value: paddedFrameCounts },
    atlasAnimationFrameHeights: { value: paddedFrameHeights },
  };

  // Store the previous onBeforeCompile if any
  const prevOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader) => {
    // Run AO patch first if it was set
    if (prevOnBeforeCompile) prevOnBeforeCompile(shader);

    Object.assign(shader.uniforms, material.userData.atlasAnimationUniforms);
    shader.fragmentShader = `
      uniform float atlasAnimationTime;
      uniform int atlasAnimationRegionCount;
      uniform vec4 atlasAnimationRegions[${ATLAS_ANIMATION_LIMIT}];
      uniform float atlasAnimationFrameCounts[${ATLAS_ANIMATION_LIMIT}];
      uniform float atlasAnimationFrameHeights[${ATLAS_ANIMATION_LIMIT}];
    ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
      #ifdef USE_MAP
        vec2 animatedMapUv = vMapUv;
        for (int i = 0; i < ${ATLAS_ANIMATION_LIMIT}; i++) {
          if (i >= atlasAnimationRegionCount) break;
          vec4 region = atlasAnimationRegions[i];
          if (
            animatedMapUv.x >= region.x &&
            animatedMapUv.x <= region.z &&
            animatedMapUv.y >= region.y &&
            animatedMapUv.y <= region.w
          ) {
            float frameCount = atlasAnimationFrameCounts[i];
            float frameIndex = mod(floor(atlasAnimationTime * 8.0), frameCount);
            animatedMapUv.y -= frameIndex * atlasAnimationFrameHeights[i];
            break;
          }
        }

        vec4 sampledDiffuseColor = texture2D(map, animatedMapUv);
        diffuseColor *= sampledDiffuseColor;
      #endif
      `,
    );
  };
  material.userData.atlasAnimationPatched = true;
  material.needsUpdate = true;
}

class ResourceManager {
  constructor() {
    this.geometryCache = new Map();
    this.sharedMaterial = null;
    this.maxCachedGeometries = 4000;
  }

  async getSharedMaterial() {
    try {
      await assetLoader.init();
    } catch (error) {
      console.warn("[ResourceManager] Falling back to untextured material.", error);
    }

    if (!this.sharedMaterial) {
      const animationRegions = assetLoader.getAtlasAnimationRegions();
      this.sharedMaterial = new THREE.MeshStandardMaterial({
        map: assetLoader.atlasTexture || null,
        color: assetLoader.atlasTexture ? 0xffffff : 0xbfc7d5,
        transparent: true,
        alphaTest: assetLoader.atlasTexture ? 0.08 : 0,
        depthWrite: true,
        side: THREE.FrontSide,
        vertexColors: true,
        roughness: 1.0,
        metalness: 0.0,
        flatShading: false,
        fog: true,
      });

      // Inject AO vertex attribute into the shader
      this.sharedMaterial.onBeforeCompile = (shader) => {
        // Add AO varying and attribute to vertex shader
        shader.vertexShader = shader.vertexShader.replace(
          'void main() {',
          `attribute float ao;
           varying float vAO;
           void main() {
             vAO = ao;`,
        );

        // Apply AO darkening in fragment shader after color/lighting
        shader.fragmentShader = shader.fragmentShader.replace(
          'void main() {',
          `varying float vAO;
           void main() {`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          `gl_FragColor.rgb *= vAO;
           #include <dithering_fragment>`,
        );
      };

      patchAtlasAnimationShader(this.sharedMaterial, animationRegions);
    }
    return this.sharedMaterial;
  }

  hasAtlasAnimations() {
    return Boolean(
      this.sharedMaterial?.userData?.atlasAnimationUniforms?.atlasAnimationTime,
    );
  }

  updateAtlasAnimations(elapsedTime) {
    const uniform =
      this.sharedMaterial?.userData?.atlasAnimationUniforms?.atlasAnimationTime;
    if (uniform) uniform.value = elapsedTime;
  }

  async getBlockData(blockName, props, visibleFaces = 63, occlusionMap = null, blockX = 0, blockY = 0, blockZ = 0) {
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

    const seed = `${blockName}|${JSON.stringify(props || {})}`;
    const variants = BlockStateResolver.resolve(blockState, props, seed).filter(
      (variant) => variant?.model,
    );
    if (variants.length === 0) {
      console.warn(`[ResourceManager] No matching variants for: ${blockName}`, props);
      const fallback = this.createFallbackGeometry(blockName, props, visibleFaces);
      const material = await this.getSharedMaterial();
      return fallback ? { ...fallback, material, kind: "fallback" } : null;
    }

    const waterOverlay = shouldRenderWaterOverlay(blockName, props);
    // Include AO-relevant position in geometry key when occlusionMap is available
    const aoSuffix = occlusionMap ? `::ao${blockX},${blockY},${blockZ}` : '';
    const geometryKey = `${variants
      .map(
        (variant) =>
          `${variant.model}@x${variant.x || 0}@y${variant.y || 0}@u${
            variant.uvlock ? 1 : 0
          }@z${variant.z || 0}`,
      )
      .join("|")}::${visibleFaces}::t${getTintColor(blockName, props).join(",")}::w${waterOverlay}${aoSuffix}`;
    
    let geometry = this.geometryCache.get(geometryKey);
    let didCreateGeometry = false;
    if (geometry === undefined) {
      const buildOptions = { tintColor: getTintColor(blockName, props) };
      if (occlusionMap) {
        buildOptions.aoData = {
          blockX, blockY, blockZ,
          occlusionMap,
        };
      }
      geometry = await GeometryBuilder.build(
        variants,
        assetLoader,
        true,
        visibleFaces,
        buildOptions,
      );
      didCreateGeometry = true;
    }

    if (!geometry) {
      geometry = this.createFallbackGeometry(blockName, props, visibleFaces)?.geometry;
      didCreateGeometry = true;
    }

    if (geometry && didCreateGeometry && waterOverlay) {
      const waterOverlay = this.createLiquidFallbackGeometry(
        "water",
        assetLoader.getAtlasUV("minecraft:block/water_still"),
      )?.geometry;

      if (waterOverlay) {
        ensureColorAttribute(geometry);
        ensureColorAttribute(waterOverlay);
        geometry = BufferGeometryUtils.mergeGeometries([geometry, waterOverlay]);
      }
    }

    ensureColorAttribute(geometry);
    if (didCreateGeometry) {
      this.setCachedGeometry(geometryKey, geometry);
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
    const simpleName = blockName.replace("minecraft:", "");
    const liquidTexture =
      simpleName === "water"
        ? "water_still"
        : simpleName === "lava"
          ? "lava_still"
          : null;
    const texName = liquidTexture || blockMapper.getTexture(blockName, "side", props);
    const texturePath = normalizeTexturePath(
      texName ? `minecraft:block/${texName}` : null,
    );
    const atlasUV = texturePath ? assetLoader.getAtlasUV(texturePath) : null;
    if (liquidTexture) {
      return this.createLiquidFallbackGeometry(simpleName, atlasUV);
    }
    const size = liquidTexture ? 16 : 12;
    const geometry = new THREE.BoxGeometry(size, size, size);
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
    if (uv) {
      const safeAtlasUV = atlasUV || assetLoader.getFallbackAtlasUV();
      if (!safeAtlasUV) {
        ensureColorAttribute(geometry);
        return { geometry };
      }

      const [u1, v1, u2, v2] = safeAtlasUV;
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

    ensureColorAttribute(geometry);
    return { geometry };
  }

  createLiquidFallbackGeometry(simpleName, atlasUV) {
    const safeAtlasUV = atlasUV || assetLoader.getFallbackAtlasUV();
    if (!safeAtlasUV) return null;

    const height = simpleName === "lava" ? 0.92 : 0.86;
    const y = height - 0.5;
    const [u1, v1, u2, v2] = safeAtlasUV;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -0.5, y, -0.5,
          -0.5, y, 0.5,
          0.5, y, 0.5,
          0.5, y, -0.5,
        ],
        3,
      ),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(
        [
          0, 1, 0,
          0, 1, 0,
          0, 1, 0,
          0, 1, 0,
        ],
        3,
      ),
    );
    geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(
        [
          u1, 1 - v2,
          u1, 1 - v1,
          u2, 1 - v1,
          u2, 1 - v2,
        ],
        2,
      ),
    );
    const color = simpleName === "lava" ? hexToRgb(0xff6b18) : hexToRgb(0x3f76e4);
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute([...color, ...color, ...color, ...color], 3),
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { geometry };
  }

  setCachedGeometry(key, geometry) {
    if (this.geometryCache.size >= this.maxCachedGeometries) {
      const oldestKey = this.geometryCache.keys().next().value;
      const oldestGeometry = this.geometryCache.get(oldestKey);
      this.geometryCache.delete(oldestKey);
      oldestGeometry?.dispose?.();
    }

    this.geometryCache.set(key, geometry);
  }
}

export const resourceManager = new ResourceManager();
