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
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { MaterialList } from "./MaterialList";
import { Sidebar } from "./Sidebar";
import bgImage from "../assets/bg.png";
import { resourceManager } from "../utils/engine/ResourceManager";

const VIEWER_PREFERENCES_KEY = "litematica-viewer-preferences";
const LARGE_BUILD_THRESHOLD = 25000;
const INITIAL_CHUNK_BATCH = 8;
const PROGRESSIVE_CHUNK_BATCH = 6;
const CHUNK_BATCH_INTERVAL_MS = 120;

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

  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    try {
      const { WebGPURenderer } = await import("three/webgpu");
      const renderer = new WebGPURenderer(rendererOptions);
      syncRendererDrawingBuffer(
        renderer,
        canvas,
        initialWidth,
        initialHeight,
        initialPixelRatio,
      );
      await renderer.init();
      syncRendererDrawingBuffer(
        renderer,
        canvas,
        initialWidth,
        initialHeight,
        initialPixelRatio,
      );
      startTransition(() => setRenderBackend("webgpu"));
      return renderer;
    } catch (error) {
      console.warn("[Viewer] WebGPU unavailable, using WebGL fallback.", error);
    }
  }

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

function ChunkMesh({ chunk, maxLayer, modelCenter, onChunkBuilt }) {
  const groupRef = useRef(null);
  const meshRef = useRef(null);
  const populatedSignatureRef = useRef(null);
  const invalidate = useThree((state) => state.invalidate);
  const [batchedConfig, setBatchedConfig] = useState(null);
  const [sharedMaterial, setSharedMaterial] = useState(null);
  const [isChunkVisible, setIsChunkVisible] = useState(true);
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

  useEffect(() => {
    resourceManager.getSharedMaterial().then(setSharedMaterial);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const processChunk = async () => {
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

        allInstances.push({
          geoUuid: geometry.uuid,
          x: block.x,
          y: block.y,
          z: block.z,
          vRotation: stateInfo.data.rotation,
        });
      }

      if (isCancelled) return;

      setBatchedConfig({
        maxInstances: allInstances.length,
        maxVertices: totalVertices,
        maxIndices: totalIndices,
        uniqueGeometries: Array.from(uniqueGeometries.values()),
        allInstances,
      });
    };

    processChunk();

    return () => {
      isCancelled = true;
    };
  }, [chunk.blocks]);

  const batchedSignature = useMemo(() => {
    if (!batchedConfig) return null;

    return [
      chunk.id,
      batchedConfig.maxInstances,
      batchedConfig.maxVertices,
      batchedConfig.maxIndices,
      ...batchedConfig.uniqueGeometries.map((geometry) => geometry.uuid),
    ].join("|");
  }, [batchedConfig, chunk.id]);

  useLayoutEffect(() => {
    if (!batchedConfig || !meshRef.current || !batchedSignature) return;
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
    const rotationMatrix = new THREE.Matrix4();
    const tempMatrix = new THREE.Matrix4();

    batchedConfig.allInstances.forEach((instance) => {
      const geoId = geoToId.get(instance.geoUuid);
      const instanceId = mesh.addInstance(geoId);

      tempObject.position.set(
        instance.x + 0.5,
        instance.y + 0.5,
        instance.z + 0.5,
      );
      tempObject.updateMatrix();

      if (instance.vRotation) {
        rotationMatrix.makeRotationFromEuler(
          new THREE.Euler(
            (-instance.vRotation.x * Math.PI) / 180,
            (-instance.vRotation.y * Math.PI) / 180,
            0,
            "XYZ",
          ),
        );
        tempMatrix.multiplyMatrices(tempObject.matrix, rotationMatrix);
        mesh.setMatrixAt(instanceId, tempMatrix);
      } else {
        mesh.setMatrixAt(instanceId, tempObject.matrix);
      }

      mesh.setVisibleAt(instanceId, instance.y <= maxLayer);
    });

    populatedSignatureRef.current = batchedSignature;
    onChunkBuilt?.(chunk.id, batchedConfig.allInstances.length);
    invalidate();
  }, [
    batchedConfig,
    batchedSignature,
    chunk.id,
    invalidate,
    maxLayer,
    onChunkBuilt,
  ]);

  useEffect(() => {
    if (!meshRef.current || !batchedConfig) return;

    batchedConfig.allInstances.forEach((instance, index) => {
      meshRef.current.setVisibleAt(index, instance.y <= maxLayer);
    });

    invalidate();
  }, [batchedConfig, invalidate, maxLayer]);

  useEffect(() => {
    if (!meshRef.current || !sharedMaterial) return;
    meshRef.current.material = sharedMaterial;
    meshRef.current.needsUpdate = true;
    invalidate();
  }, [invalidate, sharedMaterial]);

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

    const centerVector = new THREE.Vector3(...modelCenter);
    const focusDistance = camera.position.distanceTo(centerVector);
    const chunkDistance = camera.position.distanceTo(chunkSphere.center);
    const distanceThreshold = Math.max(96, focusDistance * 1.9);
    const shouldShow =
      frustum.intersectsBox(chunkBox) &&
      chunkDistance <= distanceThreshold + chunkSphere.radius;

    if (visibilityStateRef.current !== shouldShow) {
      visibilityStateRef.current = shouldShow;
      setIsChunkVisible(shouldShow);
      invalidate();
    }
  });

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.visible = isChunkVisible;
    }
  }, [isChunkVisible]);

  if (!batchedConfig || !sharedMaterial || batchedConfig.maxInstances === 0) {
    return null;
  }

  return (
    <group ref={groupRef}>
      <batchedMesh
        key={batchedSignature}
        ref={meshRef}
        args={[
          batchedConfig.maxInstances,
          batchedConfig.maxVertices,
          batchedConfig.maxIndices,
          sharedMaterial,
        ]}
        material={sharedMaterial}
        frustumCulled={false}
        castShadow
        receiveShadow
      />
    </group>
  );
}

function SceneContent({ chunks, maxLayer, modelCenter, onChunkBuilt }) {
  return (
    <>
      {chunks.map((chunk) => (
        <ChunkMesh
          key={chunk.id}
          chunk={chunk}
          maxLayer={maxLayer}
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

export function Viewer({ data }) {
  const [maxLayer, setMaxLayer] = useState(256);
  const [layerBounds, setLayerBounds] = useState({ min: 0, max: 256 });
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
  const [ambientIntensity, setAmbientIntensity] = useState(0.6);
  const [directionalIntensity, setDirectionalIntensity] = useState(1.0);
  const [environmentPreset, setEnvironmentPreset] = useState("city");
  const [shadowsEnabled, setShadowsEnabled] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(50);
  const [renderBackend, setRenderBackend] = useState("detecting");
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
  const controlsRef = useRef();
  const preferencesHydratedRef = useRef(false);
  const frameLoopMode = autoRotate || isAnimating ? "always" : "demand";

  const totalBlockCount = data?.totalBlocks || 0;
  const totalChunks = data?.chunks?.length || 0;

  const visibleChunks = useMemo(
    () => (data?.chunks || []).slice(0, mountedChunkCount),
    [data?.chunks, mountedChunkCount],
  );

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
    }),
    [data?.culledFaces, renderedInstanceCount, totalBlockCount, totalChunks],
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
    if (typeof storedPreferences.shadowsEnabled === "boolean") {
      setShadowsEnabled(storedPreferences.shadowsEnabled);
    }
    if (typeof storedPreferences.ambientIntensity === "number") {
      setAmbientIntensity(storedPreferences.ambientIntensity);
    }
    if (typeof storedPreferences.directionalIntensity === "number") {
      setDirectionalIntensity(storedPreferences.directionalIntensity);
    }
    if (typeof storedPreferences.environmentPreset === "string") {
      setEnvironmentPreset(storedPreferences.environmentPreset);
    }

    preferencesHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!preferencesHydratedRef.current) return;

    saveViewerPreferences({
      performanceMode,
      adaptiveQuality,
      shadowsEnabled,
      ambientIntensity,
      directionalIntensity,
      environmentPreset,
    });
  }, [
    adaptiveQuality,
    ambientIntensity,
    directionalIntensity,
    environmentPreset,
    performanceMode,
    shadowsEnabled,
  ]);

  useEffect(() => {
    if (!adaptiveQuality || !totalBlockCount) return;

    const shouldEnablePerformanceMode =
      totalBlockCount >= LARGE_BUILD_THRESHOLD || renderBackend === "webgpu";

    setPerformanceMode(shouldEnablePerformanceMode);
    setShadowsEnabled(!shouldEnablePerformanceMode);
    setAmbientIntensity(shouldEnablePerformanceMode ? 0.75 : 0.6);
    setDirectionalIntensity(shouldEnablePerformanceMode ? 0.85 : 1.0);
    setEnvironmentPreset(shouldEnablePerformanceMode ? "dawn" : "city");
  }, [adaptiveQuality, renderBackend, totalBlockCount]);

  useEffect(() => {
    if (!data) return;

    const { minX, maxX, minY, maxY, minZ, maxZ } = data.bounds;
    const center = data.center || [
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2,
    ];

    setModelCenter(center);
    setLayerBounds({ min: minY, max: maxY });
    setMaxLayer(maxY);
    setModelBounds({ minX, maxX, minY, maxY, minZ, maxZ });
    setModelDimensions(data.dimensions || { width: 0, height: 0, depth: 0 });

    const maxDim = Math.max(
      data.dimensions?.width || 0,
      data.dimensions?.height || 0,
      data.dimensions?.depth || 0,
    );
    const dist = maxDim * 1.5 + 20;
    setCameraPosition([
      center[0] + dist,
      center[1] + dist / 2,
      center[2] + dist,
    ]);
    setMountedChunkCount(Math.min(INITIAL_CHUNK_BATCH, data.chunks.length));
    setBuiltChunkMap({});
    setBuildState({
      stage: "Loading chunks",
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
    if (!totalChunks) return;

    setBuildState((current) => ({
      ...current,
      stage:
        mountedChunkCount < totalChunks
          ? "Streaming chunks"
          : current.loadedChunks < totalChunks
            ? "Building visible chunks"
            : "Ready",
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
            loadedChunks >= totalChunks ? "Ready" : "Building visible chunks",
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

    if (enabled) {
      setShadowsEnabled(false);
      setAmbientIntensity(0.75);
      setDirectionalIntensity(0.85);
    }
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
    const canvas = document.querySelector("canvas");
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
        width: "100vw",
        height: "100vh",
        background: "#000",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -20,
          left: -20,
          right: -20,
          bottom: -20,
          backgroundImage: `url(${bgImage.src || bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(20px) brightness(0.6)",
          zIndex: 0,
        }}
      />

      <Canvas
        camera={{ position: cameraPosition, fov: 50, near: 0.01, far: 10000 }}
        dpr={performanceMode ? 1 : [1, 2]}
        frameloop={frameLoopMode}
        gl={createRenderer}
        onCreated={handleCanvasCreated}
        style={{ position: "relative", zIndex: 1 }}
      >
        <ambientLight intensity={ambientIntensity} />
        <RendererResizeSync />
        <directionalLight
          position={[10, 20, 10]}
          intensity={directionalIntensity}
          castShadow={shadowsEnabled}
          shadow-mapSize-width={shadowsEnabled ? 2048 : 512}
          shadow-mapSize-height={shadowsEnabled ? 2048 : 512}
        />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        <Suspense fallback={null}>
          <group>
            <SceneContent
              chunks={visibleChunks}
              maxLayer={maxLayer}
              modelCenter={modelCenter}
              onChunkBuilt={handleChunkBuilt}
            />
          </group>
        </Suspense>

        <RendererStatsTracker onStats={handleRenderStats} />
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
        {!performanceMode && <Environment preset={environmentPreset} />}
      </Canvas>

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
        onToggleMaterials={() => setShowMaterials(!showMaterials)}
        showMaterials={showMaterials}
        onScreenshot={handleScreenshot}
        modelDimensions={modelDimensions}
        metadata={data?.metadata || {}}
        onCameraPreset={setCameraPreset}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
        ambientIntensity={ambientIntensity}
        setAmbientIntensity={setAmbientIntensity}
        directionalIntensity={directionalIntensity}
        setDirectionalIntensity={setDirectionalIntensity}
        environmentPreset={environmentPreset}
        setEnvironmentPreset={setEnvironmentPreset}
        shadowsEnabled={shadowsEnabled}
        setShadowsEnabled={setShadowsEnabled}
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
