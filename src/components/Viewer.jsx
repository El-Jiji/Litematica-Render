"use client";

import React, {
  Suspense,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { MaterialList } from "./MaterialList";
import { Sidebar } from "./Sidebar";
import { SceneLighting } from "./SceneLighting";
import { resourceManager } from "../utils/engine/ResourceManager";
import { getLightingState } from "../utils/lighting/getLightingState";
import {
  LIGHTING_MODES,
  LIGHTING_MODE_OPTIONS,
} from "../utils/lighting/lightPresets";

const VIEWER_PREFERENCES_KEY = "litematica-viewer-preferences";
const LARGE_BUILD_THRESHOLD = 25000;
const INITIAL_CHUNK_BATCH = 8;
const PROGRESSIVE_CHUNK_BATCH = 6;
const CHUNK_BATCH_INTERVAL_MS = 120;
const SLICE_LABELS = {
  x: "X",
  y: "Y",
  z: "Z",
};

function syncRendererDrawingBuffer(
  renderer,
  canvas,
  width,
  height,
  pixelRatio,
) {
  if (!renderer || !canvas || !width || !height) return;

  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const safePixelRatio = Math.max(1, pixelRatio || 1);

  if (typeof renderer.setPixelRatio === "function") {
    renderer.setPixelRatio(safePixelRatio);
  }

  if (typeof renderer.setDrawingBufferSize === "function") {
    renderer.setDrawingBufferSize(safeWidth, safeHeight, safePixelRatio);
  } else if (typeof renderer.setSize === "function") {
    renderer.setSize(safeWidth, safeHeight, false);
  }

  if (typeof renderer.setViewport === "function") {
    renderer.setViewport(0, 0, safeWidth, safeHeight);
  }

  if (typeof renderer.setScissor === "function") {
    renderer.setScissor(0, 0, safeWidth, safeHeight);
  }

  if (typeof renderer.setScissorTest === "function") {
    renderer.setScissorTest(false);
  }

  if (canvas.style.width !== `${safeWidth}px`) {
    canvas.style.width = `${safeWidth}px`;
  }
  if (canvas.style.height !== `${safeHeight}px`) {
    canvas.style.height = `${safeHeight}px`;
  }
}

async function createBestAvailableRenderer(defaultProps, setRenderBackend) {
  const rendererOptions = {
    ...defaultProps,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  };
  const canvas = defaultProps.canvas;
  const initialWidth =
    canvas?.clientWidth ||
    canvas?.parentElement?.clientWidth ||
    window.innerWidth;
  const initialHeight =
    canvas?.clientHeight ||
    canvas?.parentElement?.clientHeight ||
    window.innerHeight;
  const initialPixelRatio = window.devicePixelRatio || 1;

  const renderer = new THREE.WebGLRenderer(rendererOptions);
  syncRendererDrawingBuffer(
    renderer,
    canvas,
    initialWidth,
    initialHeight,
    initialPixelRatio,
  );
  startTransition(() => setRenderBackend("webgl"));
  return renderer;
}

function loadViewerPreferences() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(VIEWER_PREFERENCES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("[Viewer] Failed to read viewer preferences.", error);
    return null;
  }
}

function saveViewerPreferences(preferences) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      VIEWER_PREFERENCES_KEY,
      JSON.stringify(preferences),
    );
  } catch (error) {
    console.warn("[Viewer] Failed to persist viewer preferences.", error);
  }
}

function getSliceBounds(bounds, axis) {
  if (axis === "x") {
    return { min: bounds.minX, max: bounds.maxX };
  }
  if (axis === "z") {
    return { min: bounds.minZ, max: bounds.maxZ };
  }

  return { min: bounds.minY, max: bounds.maxY };
}

function isWithinSlice(block, axis, limit) {
  if (axis === "x") return block.x <= limit;
  if (axis === "z") return block.z <= limit;
  return block.y <= limit;
}

function BatchedInstancesMesh({
  batchedConfig,
  material,
  scaleScalar = 1,
  renderOrder = 0,
  castShadow = true,
  receiveShadow = true,
  onBuilt,
}) {
  const meshRef = useRef(null);
  const populatedSignatureRef = useRef(null);
  const invalidate = useThree((state) => state.invalidate);

  const batchedSignature = useMemo(() => {
    if (!batchedConfig || !material) return null;

    return [
      material.uuid,
      batchedConfig.maxInstances,
      batchedConfig.maxVertices,
      batchedConfig.maxIndices,
      scaleScalar,
      ...batchedConfig.uniqueGeometries.map((geometry) => geometry.uuid),
    ].join("|");
  }, [batchedConfig, material, scaleScalar]);

  useLayoutEffect(() => {
    if (!batchedConfig || !material || !meshRef.current || !batchedSignature) {
      return;
    }

    const mesh = meshRef.current;
    if (populatedSignatureRef.current === batchedSignature) {
      return;
    }

    const geoToId = new Map();
    batchedConfig.uniqueGeometries.forEach((geometry) => {
      const id = mesh.addGeometry(geometry);
      geoToId.set(geometry.uuid, id);
    });

    const tempObject = new THREE.Object3D();
    batchedConfig.allInstances.forEach((instance) => {
      const geoId = geoToId.get(instance.geoUuid);
      const instanceId = mesh.addInstance(geoId);

      tempObject.position.set(
        instance.x + 0.5,
        instance.y + 0.5,
        instance.z + 0.5,
      );
      tempObject.scale.setScalar(scaleScalar);
      tempObject.updateMatrix();
      mesh.setMatrixAt(instanceId, tempObject.matrix);
      mesh.setVisibleAt(instanceId, true);
    });

    populatedSignatureRef.current = batchedSignature;
    onBuilt?.(batchedConfig.allInstances.length);
    invalidate();
  }, [batchedConfig, batchedSignature, invalidate, material, onBuilt, scaleScalar]);

  if (!batchedConfig || !material || batchedConfig.maxInstances === 0) {
    return null;
  }

  return (
    <batchedMesh
      key={batchedSignature}
      ref={meshRef}
      args={[
        batchedConfig.maxInstances,
        batchedConfig.maxVertices,
        batchedConfig.maxIndices,
        material,
      ]}
      material={material}
      frustumCulled={false}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      renderOrder={renderOrder}
    />
  );
}

function ChunkMesh({
  chunk,
  sliceAxis,
  sliceLimit,
  modelCenter,
  onChunkBuilt,
}) {
  const groupRef = useRef(null);
  const invalidate = useThree((state) => state.invalidate);
  const [batchedConfig, setBatchedConfig] = useState(null);
  const [sharedMaterial, setSharedMaterial] = useState(null);
  const visibilityStateRef = useRef(true);
  const lastVisibilityCheckRef = useRef(0);

  const chunkBox = useMemo(
    () =>
      new THREE.Box3(
        new THREE.Vector3(
          chunk.bounds.minX,
          chunk.bounds.minY,
          chunk.bounds.minZ,
        ),
        new THREE.Vector3(
          chunk.bounds.maxX + 1,
          chunk.bounds.maxY + 1,
          chunk.bounds.maxZ + 1,
        ),
      ),
    [chunk.bounds],
  );

  const chunkSphere = useMemo(() => {
    const sphere = new THREE.Sphere();
    chunkBox.getBoundingSphere(sphere);
    return sphere;
  }, [chunkBox]);
  const modelCenterVector = useMemo(
    () => new THREE.Vector3(...modelCenter),
    [modelCenter],
  );

  useEffect(() => {
    resourceManager.getSharedMaterial().then(setSharedMaterial);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const processChunk = async () => {
      try {
        const stateMap = new Map();
        const statePromises = [];

        for (const block of chunk.blocks) {
          const propKey = JSON.stringify(block.props || {});
          const key = `${block.name}|${propKey}|${block.visibleFaces}`;

          if (!stateMap.has(key)) {
            stateMap.set(key, {
              name: block.name,
              props: block.props || {},
              visibleFaces: block.visibleFaces,
            });
            statePromises.push(
              (async () => {
                const data = await resourceManager.getBlockData(
                  block.name,
                  block.props || {},
                  block.visibleFaces,
                );
                if (data) {
                  stateMap.get(key).data = data;
                }
              })(),
            );
          }
        }

        await Promise.all(statePromises);
        if (isCancelled) return;

        const uniqueGeometries = new Map();
        const allInstances = [];
        let totalVertices = 0;
        let totalIndices = 0;

        for (const block of chunk.blocks) {
          const propKey = JSON.stringify(block.props || {});
          const key = `${block.name}|${propKey}|${block.visibleFaces}`;
          const stateInfo = stateMap.get(key);

          if (!stateInfo?.data?.geometry) continue;

          const geometry = stateInfo.data.geometry;
          if (!uniqueGeometries.has(geometry.uuid)) {
            uniqueGeometries.set(geometry.uuid, geometry);
            totalVertices += geometry.attributes.position.count;
            totalIndices += geometry.index
              ? geometry.index.count
              : geometry.attributes.position.count;
          }

          if (!isWithinSlice(block, sliceAxis, sliceLimit)) {
            continue;
          }

          const instance = {
            geoUuid: geometry.uuid,
            x: block.x,
            y: block.y,
            z: block.z,
          };

          allInstances.push(instance);
        }

        if (isCancelled) return;

        if (allInstances.length === 0) {
          onChunkBuilt?.(chunk.id, 0);
        }

        setBatchedConfig({
          maxInstances: allInstances.length,
          maxVertices: totalVertices,
          maxIndices: totalIndices,
          uniqueGeometries: Array.from(uniqueGeometries.values()),
          allInstances,
        });
      } catch (error) {
        console.error(`[Viewer] Failed to process chunk ${chunk.id}`, error);
        if (!isCancelled) {
          onChunkBuilt?.(chunk.id, 0);
          setBatchedConfig({
            maxInstances: 0,
            maxVertices: 0,
            maxIndices: 0,
            uniqueGeometries: [],
            allInstances: [],
          });
        }
      }
    };

    processChunk();

    return () => {
      isCancelled = true;
    };
  }, [
    chunk.blocks,
    chunk.id,
    onChunkBuilt,
    sliceAxis,
    sliceLimit,
  ]);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;

    const now = performance.now();
    if (now - lastVisibilityCheckRef.current < 180) return;
    lastVisibilityCheckRef.current = now;

    const frustum = new THREE.Frustum();
    const projectionMatrix = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    frustum.setFromProjectionMatrix(projectionMatrix);

    const focusDistance = camera.position.distanceTo(modelCenterVector);
    const chunkDistance = camera.position.distanceTo(chunkSphere.center);
    const distanceThreshold = Math.max(96, focusDistance * 1.9);
    const shouldShow =
      frustum.intersectsBox(chunkBox) &&
      chunkDistance <= distanceThreshold + chunkSphere.radius;

    if (visibilityStateRef.current !== shouldShow) {
      visibilityStateRef.current = shouldShow;
      groupRef.current.visible = shouldShow;
      invalidate();
    }
  });

  if (!batchedConfig || !sharedMaterial || batchedConfig.maxInstances === 0) {
    return null;
  }

  return (
    <group ref={groupRef}>
      <BatchedInstancesMesh
        batchedConfig={batchedConfig}
        material={sharedMaterial}
        onBuilt={(instanceCount) => onChunkBuilt?.(chunk.id, instanceCount)}
      />
    </group>
  );
}

function SceneContent({
  chunks,
  sliceAxis,
  sliceLimit,
  modelCenter,
  onChunkBuilt,
}) {
  return (
    <>
      {chunks.map((chunk) => (
        <ChunkMesh
          key={chunk.id}
          chunk={chunk}
          sliceAxis={sliceAxis}
          sliceLimit={sliceLimit}
          modelCenter={modelCenter}
          onChunkBuilt={onChunkBuilt}
        />
      ))}
    </>
  );
}

function RendererStatsTracker({ onStats }) {
  const lastUpdateRef = useRef(0);

  useFrame(({ gl, scene }) => {
    const now = performance.now();
    if (now - lastUpdateRef.current < 250) return;

    lastUpdateRef.current = now;
    const { render, memory } = gl.info;

    onStats({
      calls: render.calls,
      triangles: render.triangles,
      lines: render.lines,
      points: render.points,
      geometries: memory.geometries,
      textures: memory.textures,
      objects: scene.children.length,
    });
  });

  return null;
}

function AtlasAnimationTicker() {
  const invalidate = useThree((state) => state.invalidate);

  useFrame(({ clock }) => {
    resourceManager.updateAtlasAnimations(clock.elapsedTime);
    invalidate();
  });

  return null;
}

function FpsTracker({ onFps }) {
  const accumulatorRef = useRef(0);
  const framesRef = useRef(0);

  useFrame((_, delta) => {
    accumulatorRef.current += delta;
    framesRef.current += 1;

    if (accumulatorRef.current < 0.5) return;

    const fps = Math.round(framesRef.current / accumulatorRef.current);
    onFps(fps);
    accumulatorRef.current = 0;
    framesRef.current = 0;
  });

  return null;
}

function RendererResizeSync() {
  const { gl, camera, size, viewport, invalidate } = useThree();

  useLayoutEffect(() => {
    const canvas = gl?.domElement;
    if (!canvas || !size.width || !size.height) return;

    let frameId = 0;
    let resizeObserver = null;

    const syncRendererSize = () => {
      const clientWidth = Math.max(
        1,
        Math.round(
          canvas.parentElement?.clientWidth || canvas.clientWidth || size.width,
        ),
      );
      const clientHeight = Math.max(
        1,
        Math.round(
          canvas.parentElement?.clientHeight ||
            canvas.clientHeight ||
            size.height,
        ),
      );
      syncRendererDrawingBuffer(
        gl,
        canvas,
        clientWidth,
        clientHeight,
        viewport.dpr,
      );

      if (camera?.isPerspectiveCamera) {
        const nextAspect = clientWidth / clientHeight;
        if (Number.isFinite(nextAspect) && camera.aspect !== nextAspect) {
          camera.aspect = nextAspect;
          camera.updateProjectionMatrix();
        }
      }

      invalidate();
    };

    syncRendererSize();
    frameId = window.requestAnimationFrame(syncRendererSize);
    if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
      resizeObserver = new ResizeObserver(() => {
        syncRendererSize();
      });
      resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
    };
  }, [camera, gl, invalidate, size.height, size.width, viewport.dpr]);

  return null;
}

function CameraController({ position, target, controlsRef }) {
  const { camera, size, invalidate } = useThree();

  useLayoutEffect(() => {
    if (!position || !target) return;

    camera.position.set(position[0], position[1], position[2]);

    if (camera?.isPerspectiveCamera) {
      const nextAspect =
        size.width && size.height ? size.width / size.height : 1;
      if (Number.isFinite(nextAspect) && nextAspect > 0) {
        camera.aspect = nextAspect;
      }
    }

    camera.lookAt(target[0], target[1], target[2]);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    if (controlsRef?.current) {
      controlsRef.current.target.set(target[0], target[1], target[2]);
      controlsRef.current.update();
    }

    invalidate();
    const frameId = window.requestAnimationFrame(() => {
      if (controlsRef?.current) {
        controlsRef.current.target.set(target[0], target[1], target[2]);
        controlsRef.current.update();
      }
      camera.lookAt(target[0], target[1], target[2]);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      invalidate();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    camera,
    controlsRef,
    invalidate,
    position,
    size.height,
    size.width,
    target,
  ]);

  return null;
}

function CircularGridFloor({ bounds, dimensions, majorColor, minorColor, opacity }) {
  const floorSize = useMemo(() => {
    const width = dimensions?.width || bounds.maxX - bounds.minX + 1 || 0;
    const depth = dimensions?.depth || bounds.maxZ - bounds.minZ + 1 || 0;
    return Math.max(24, Math.ceil(Math.max(width, depth) * 1.8));
  }, [
    bounds.maxX,
    bounds.maxZ,
    bounds.minX,
    bounds.minZ,
    dimensions?.depth,
    dimensions?.width,
  ]);

  const gridHelper = useMemo(() => {
    if (floorSize <= 0) {
      return null;
    }

    const helper = new THREE.GridHelper(
      floorSize,
      floorSize,
      majorColor,
      minorColor,
    );

    helper.material.transparent = true;
    helper.material.opacity = opacity;
    helper.material.depthWrite = false;
    helper.material.toneMapped = false;
    helper.renderOrder = -1;

    return helper;
  }, [floorSize, majorColor, minorColor, opacity]);

  useEffect(
    () => () => {
      if (!gridHelper) return;
      gridHelper.geometry.dispose();
      gridHelper.material.dispose();
    },
    [gridHelper],
  );

  const position = useMemo(
    () => {
      const modelSpanX = bounds.maxX - bounds.minX + 1;
      const modelSpanZ = bounds.maxZ - bounds.minZ + 1;
      const floorMinX = Math.floor(
        bounds.minX - (floorSize - modelSpanX) / 2,
      );
      const floorMinZ = Math.floor(
        bounds.minZ - (floorSize - modelSpanZ) / 2,
      );

      return [
        floorMinX + floorSize / 2,
        bounds.minY - 0.02,
        floorMinZ + floorSize / 2,
      ];
    },
    [bounds.maxX, bounds.maxZ, bounds.minX, bounds.minY, bounds.minZ, floorSize],
  );

  if (!gridHelper || floorSize <= 0) return null;

  return <primitive object={gridHelper} position={position} />;
}

export function Viewer({ data, comparisonMode = false, title = "" }) {
  const [maxLayer, setMaxLayer] = useState(256);
  const [layerBounds, setLayerBounds] = useState({ min: 0, max: 256 });
  const [sliceAxis, setSliceAxis] = useState("y");
  const [modelCenter, setModelCenter] = useState([0, 0, 0]);
  const [cameraPosition, setCameraPosition] = useState([50, 50, 50]);
  const [showMaterials, setShowMaterials] = useState(false);
  const [modelDimensions, setModelDimensions] = useState({
    width: 0,
    height: 0,
    depth: 0,
  });
  const [modelBounds, setModelBounds] = useState({
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    minZ: 0,
    maxZ: 0,
  });
  const [autoRotate, setAutoRotate] = useState(false);
  const [lightingMode, setLightingMode] = useState(LIGHTING_MODES.game);
  const [timeOfDay, setTimeOfDay] = useState(12);
  const [showSkyBackground, setShowSkyBackground] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(50);
  const [renderBackend, setRenderBackend] = useState("detecting");
  const [fps, setFps] = useState(0);
  const [renderStats, setRenderStats] = useState({
    calls: 0,
    triangles: 0,
    lines: 0,
    points: 0,
    geometries: 0,
    textures: 0,
    objects: 0,
  });
  const [buildState, setBuildState] = useState({
    stage: "Idle",
    progress: 0,
    visible: false,
    instanceCount: 0,
    loadedChunks: 0,
    totalChunks: 0,
  });
  const [performanceMode, setPerformanceMode] = useState(false);
  const [adaptiveQuality, setAdaptiveQuality] = useState(true);
  const [mountedChunkCount, setMountedChunkCount] = useState(0);
  const [builtChunkMap, setBuiltChunkMap] = useState({});
  const [sceneVersion, setSceneVersion] = useState(0);
  const [sceneConfigured, setSceneConfigured] = useState(false);
  const [hasAtlasAnimations, setHasAtlasAnimations] = useState(false);
  const controlsRef = useRef();
  const canvasRef = useRef(null);
  const preferencesHydratedRef = useRef(false);
  const frameLoopMode =
    autoRotate || isAnimating || buildState.visible || hasAtlasAnimations
      ? "always"
      : "demand";

  const totalBlockCount = data?.totalBlocks || 0;
  const totalChunks = data?.chunks?.length || 0;

  const visibleChunks = useMemo(
    () => (data?.chunks || []).slice(0, mountedChunkCount),
    [data?.chunks, mountedChunkCount],
  );
  const lightingState = useMemo(
    () => getLightingState(lightingMode, timeOfDay),
    [lightingMode, timeOfDay],
  );
  const gridStyle = useMemo(() => {
    if (!showSkyBackground || lightingMode === LIGHTING_MODES.night) {
      return {
        majorColor: "#f5f7ff",
        minorColor: "#d6e4ff",
        opacity: 0.14,
      };
    }

    return {
      majorColor: "#2a3f66",
      minorColor: "#4f6894",
      opacity: 0.22,
    };
  }, [lightingMode, showSkyBackground]);

  const renderedInstanceCount = useMemo(
    () => Object.values(builtChunkMap).reduce((sum, value) => sum + value, 0),
    [builtChunkMap],
  );

  const sceneSummary = useMemo(
    () => ({
      totalBlocks: totalBlockCount,
      instances: renderedInstanceCount,
      chunks: totalChunks,
      culledFaces: data?.culledFaces || 0,
      sliceAxis,
    }),
    [
      data?.culledFaces,
      renderedInstanceCount,
      sliceAxis,
      totalBlockCount,
      totalChunks,
    ],
  );

  const handleRendererDetected = useCallback((backend) => {
    startTransition(() => {
      setRenderBackend((current) => (current === backend ? current : backend));
    });
  }, []);

  const createRenderer = useCallback(
    (defaultProps) =>
      createBestAvailableRenderer(defaultProps, handleRendererDetected),
    [handleRendererDetected],
  );

  const handleCanvasCreated = useCallback((state) => {
    const canvas = state.gl?.domElement;
    canvasRef.current = canvas || null;
    syncRendererDrawingBuffer(
      state.gl,
      canvas,
      state.size.width,
      state.size.height,
      state.viewport.dpr,
    );
    state.invalidate();
  }, []);

  useEffect(() => {
    const storedPreferences = loadViewerPreferences();
    if (!storedPreferences) {
      preferencesHydratedRef.current = true;
      return;
    }

    if (typeof storedPreferences.performanceMode === "boolean") {
      setPerformanceMode(storedPreferences.performanceMode);
    }
    if (typeof storedPreferences.adaptiveQuality === "boolean") {
      setAdaptiveQuality(storedPreferences.adaptiveQuality);
    }
    if (
      typeof storedPreferences.lightingMode === "string" &&
      LIGHTING_MODE_OPTIONS.some(
        (option) => option.value === storedPreferences.lightingMode,
      )
    ) {
      setLightingMode(storedPreferences.lightingMode);
    }
    if (typeof storedPreferences.timeOfDay === "number") {
      setTimeOfDay(storedPreferences.timeOfDay);
    }
    if (typeof storedPreferences.showSkyBackground === "boolean") {
      setShowSkyBackground(storedPreferences.showSkyBackground);
    }

    preferencesHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!preferencesHydratedRef.current) return;

    saveViewerPreferences({
      performanceMode,
      adaptiveQuality,
      lightingMode,
      timeOfDay,
      showSkyBackground,
    });
  }, [
    adaptiveQuality,
    lightingMode,
    performanceMode,
    showSkyBackground,
    timeOfDay,
  ]);

  useEffect(() => {
    if (!adaptiveQuality || !totalBlockCount) return;

    const shouldEnablePerformanceMode =
      totalBlockCount >= LARGE_BUILD_THRESHOLD || renderBackend === "webgpu";

    setPerformanceMode(shouldEnablePerformanceMode);
  }, [adaptiveQuality, renderBackend, totalBlockCount]);

  useEffect(() => {
    let isCancelled = false;

    resourceManager.getSharedMaterial().then(() => {
      if (!isCancelled) {
        setHasAtlasAnimations(resourceManager.hasAtlasAnimations());
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (!data) return;

    setSceneConfigured(false);
    const { minX, maxX, minY, maxY, minZ, maxZ } = data.bounds;
    const center = data.center || [
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2,
    ];

    setModelCenter(center);
    setSliceAxis("y");
    setLayerBounds(getSliceBounds({ minX, maxX, minY, maxY, minZ, maxZ }, "y"));
    setMaxLayer(maxY);
    setModelBounds({ minX, maxX, minY, maxY, minZ, maxZ });
    setModelDimensions(data.dimensions || { width: 0, height: 0, depth: 0 });

    const maxDim = Math.max(
      data.dimensions?.width || 0,
      data.dimensions?.height || 0,
      data.dimensions?.depth || 0,
    );
    const dist = Math.max(18, maxDim * 1.15 + 10);
    setCameraPosition([
      center[0] + dist,
      center[1] + dist / 2,
      center[2] + dist,
    ]);
    setMountedChunkCount(Math.min(INITIAL_CHUNK_BATCH, data.chunks.length));
    setBuiltChunkMap({});
    setBuildState({
      stage: "Cargando chunks",
      progress: data.chunks.length
        ? (Math.min(INITIAL_CHUNK_BATCH, data.chunks.length) /
            data.chunks.length) *
          100
        : 100,
      visible: data.chunks.length > 0,
      instanceCount: 0,
      loadedChunks: 0,
      totalChunks: data.chunks.length,
    });
    setSceneVersion((current) => current + 1);
    setSceneConfigured(true);
  }, [data]);

  useEffect(() => {
    if (!data?.chunks?.length) return;
    if (mountedChunkCount >= data.chunks.length) return;

    const interval = window.setInterval(() => {
      setMountedChunkCount((current) => {
        const next = Math.min(
          current + PROGRESSIVE_CHUNK_BATCH,
          data.chunks.length,
        );
        return next;
      });
    }, CHUNK_BATCH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [data?.chunks, mountedChunkCount]);

  useEffect(() => {
    const nextBounds = getSliceBounds(modelBounds, sliceAxis);
    setLayerBounds(nextBounds);
    setMaxLayer(nextBounds.max);
  }, [modelBounds, sliceAxis]);

  useEffect(() => {
    if (!totalChunks) return;

    setBuildState((current) => ({
      ...current,
      stage:
        mountedChunkCount < totalChunks
          ? "Transmitiendo chunks"
          : current.loadedChunks < totalChunks
            ? "Construyendo chunks visibles"
            : "Listo",
      progress:
        current.loadedChunks < totalChunks
          ? Math.min(
              99,
              (mountedChunkCount / totalChunks) * 55 +
                (current.loadedChunks / totalChunks) * 45,
            )
          : 100,
      visible: current.loadedChunks < totalChunks,
      totalChunks,
    }));
  }, [mountedChunkCount, totalChunks]);

  const handleChunkBuilt = useCallback(
    (chunkId, instanceCount) => {
      setBuiltChunkMap((current) => {
        if (current[chunkId] === instanceCount) {
          return current;
        }

        const next = { ...current, [chunkId]: instanceCount };
        const loadedChunks = Object.keys(next).length;
        const totalInstances = Object.values(next).reduce(
          (sum, value) => sum + value,
          0,
        );

        setBuildState((previous) => ({
          ...previous,
          stage:
            loadedChunks >= totalChunks
              ? "Listo"
              : "Construyendo chunks visibles",
          progress: totalChunks
            ? Math.min(
                100,
                (mountedChunkCount / totalChunks) * 55 +
                  (loadedChunks / totalChunks) * 45,
              )
            : 100,
          visible: loadedChunks < totalChunks,
          loadedChunks,
          totalChunks,
          instanceCount: totalInstances,
        }));

        return next;
      });
    },
    [mountedChunkCount, totalChunks],
  );

  const handleRenderStats = useCallback((nextStats) => {
    setRenderStats((current) => {
      if (
        current.calls === nextStats.calls &&
        current.triangles === nextStats.triangles &&
        current.lines === nextStats.lines &&
        current.points === nextStats.points &&
        current.geometries === nextStats.geometries &&
        current.textures === nextStats.textures &&
        current.objects === nextStats.objects
      ) {
        return current;
      }

      return nextStats;
    });
  }, []);

  const handlePerformanceModeChange = useCallback((enabled) => {
    setPerformanceMode(enabled);
  }, []);

  const handleAdaptiveQualityChange = useCallback((enabled) => {
    setAdaptiveQuality(enabled);
  }, []);

  const toggleBuildAnimation = useCallback(() => {
    if (isAnimating) {
      setIsAnimating(false);
    } else {
      setMaxLayer(layerBounds.min);
      setIsAnimating(true);
    }
  }, [isAnimating, layerBounds.min]);

  const setCameraPreset = useCallback(
    (preset) => {
      const { minX, maxX, minY, maxY, minZ, maxZ } = modelBounds;
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
      const dist = maxDim * 1.8;

      let newPos;
      switch (preset) {
        case "front":
          newPos = [centerX, centerY, centerZ + dist];
          break;
        case "side":
          newPos = [centerX + dist, centerY, centerZ];
          break;
        case "top":
          newPos = [centerX, centerY + dist, centerZ];
          break;
        case "isometric":
          newPos = [
            centerX + dist * 0.7,
            centerY + dist * 0.7,
            centerZ + dist * 0.7,
          ];
          break;
        default:
          return;
      }

      setCameraPosition(newPos);
      if (controlsRef.current) {
        controlsRef.current.target.set(centerX, centerY, centerZ);
      }
    },
    [modelBounds],
  );

  const handleScreenshot = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const link = document.createElement("a");
      link.download = "litematica_render.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  };

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (
        event.target.tagName === "INPUT" ||
        event.target.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "r":
          setAutoRotate((prev) => !prev);
          break;
        case "s":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleScreenshot();
          }
          break;
        case " ":
          event.preventDefault();
          toggleBuildAnimation();
          break;
        case "1":
          setCameraPreset("front");
          break;
        case "2":
          setCameraPreset("side");
          break;
        case "3":
          setCameraPreset("top");
          break;
        case "4":
          setCameraPreset("isometric");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [setCameraPreset, toggleBuildAnimation]);

  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setMaxLayer((prev) => {
        if (prev >= layerBounds.max) {
          setIsAnimating(false);
          return layerBounds.max;
        }
        return prev + 1;
      });
    }, animationSpeed);

    return () => clearInterval(interval);
  }, [animationSpeed, isAnimating, layerBounds.max]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#141418",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {comparisonMode && title && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 140,
            padding: "8px 12px",
            borderRadius: "999px",
            background: "rgba(10, 12, 20, 0.72)",
            color: "#f5f7ff",
            fontSize: "0.82rem",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {title}
        </div>
      )}
      {sceneConfigured && (
        <Canvas
          key={sceneVersion}
          camera={{ position: cameraPosition, fov: 50, near: 0.01, far: 10000 }}
          dpr={performanceMode ? 1 : [1, 2]}
          frameloop={frameLoopMode}
          gl={createRenderer}
          onCreated={handleCanvasCreated}
          style={{ position: "relative", zIndex: 1 }}
        >
          <RendererResizeSync />
          <SceneLighting
            lightingState={lightingState}
            performanceMode={performanceMode}
            bounds={modelBounds}
            showSkyBackground={showSkyBackground}
          />

          <Suspense fallback={null}>
            <group>
              <CircularGridFloor
                bounds={modelBounds}
                dimensions={modelDimensions}
                majorColor={gridStyle.majorColor}
                minorColor={gridStyle.minorColor}
                opacity={gridStyle.opacity}
              />
              <SceneContent
                chunks={visibleChunks}
                sliceAxis={sliceAxis}
                sliceLimit={maxLayer}
                modelCenter={modelCenter}
                onChunkBuilt={handleChunkBuilt}
              />
            </group>
          </Suspense>

          <RendererStatsTracker onStats={handleRenderStats} />
          {hasAtlasAnimations && <AtlasAnimationTicker />}
          <FpsTracker onFps={setFps} />
          <CameraController
            position={cameraPosition}
            target={modelCenter}
            controlsRef={controlsRef}
          />
          <OrbitControls
            ref={controlsRef}
            makeDefault
            target={modelCenter}
            autoRotate={autoRotate}
            autoRotateSpeed={4}
          />
        </Canvas>
      )}

      {buildState.visible && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "24px",
            transform: "translateX(-50%)",
            zIndex: 115,
            width: "min(520px, calc(100vw - 32px))",
            padding: "14px 16px",
            borderRadius: "14px",
            background: "rgba(10, 12, 20, 0.86)",
            border: "1px solid rgba(120, 160, 255, 0.2)",
            color: "#f5f7ff",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.82rem",
              marginBottom: "8px",
            }}
          >
            <span>{buildState.stage}</span>
            <span>{Math.round(buildState.progress)}%</span>
          </div>
          <div
            style={{
              fontSize: "0.76rem",
              color: "rgba(245,247,255,0.76)",
              marginBottom: "10px",
            }}
          >
            Chunks {buildState.loadedChunks}/{buildState.totalChunks} ·
            Instancias {buildState.instanceCount.toLocaleString()}
          </div>
          <div
            style={{
              height: "8px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${buildState.progress}%`,
                height: "100%",
                background:
                  "linear-gradient(90deg, rgba(63,118,228,1) 0%, rgba(121,195,255,1) 100%)",
              }}
            />
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: "12px",
          bottom: "12px",
          zIndex: 118,
          padding: "4px 7px",
          borderRadius: "8px",
          background: "rgba(10, 12, 20, 0.68)",
          color: "rgba(245,247,255,0.88)",
          fontSize: "0.72rem",
          fontFamily: "monospace",
          pointerEvents: "none",
        }}
      >
        {fps} FPS
      </div>

      <Sidebar
        renderBackend={renderBackend}
        renderStats={renderStats}
        sceneSummary={sceneSummary}
        performanceMode={performanceMode}
        setPerformanceMode={handlePerformanceModeChange}
        adaptiveQuality={adaptiveQuality}
        setAdaptiveQuality={handleAdaptiveQualityChange}
        maxLayer={maxLayer}
        setMaxLayer={setMaxLayer}
        layerBounds={layerBounds}
        sliceAxis={sliceAxis}
        setSliceAxis={setSliceAxis}
        sliceAxisLabel={SLICE_LABELS[sliceAxis]}
        onToggleMaterials={() => setShowMaterials(!showMaterials)}
        showMaterials={showMaterials}
        onScreenshot={handleScreenshot}
        modelDimensions={modelDimensions}
        metadata={data?.metadata || {}}
        comparisonMode={comparisonMode}
        onCameraPreset={setCameraPreset}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
        lightingMode={lightingMode}
        setLightingMode={setLightingMode}
        timeOfDay={timeOfDay}
        setTimeOfDay={setTimeOfDay}
        lightingDescription={lightingState.description}
        showSkyBackground={showSkyBackground}
        setShowSkyBackground={setShowSkyBackground}
        isAnimating={isAnimating}
        onToggleBuildAnimation={toggleBuildAnimation}
        animationSpeed={animationSpeed}
        setAnimationSpeed={setAnimationSpeed}
      />

      {showMaterials && (
        <MaterialList data={data} onClose={() => setShowMaterials(false)} />
      )}
    </div>
  );
}
