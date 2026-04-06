"use client";

import React, {
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  Suspense,
  useState,
  useCallback,
  startTransition,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { MaterialList } from "./MaterialList";
import { Sidebar } from "./Sidebar";
import bgImage from "../assets/bg.png";
import { resourceManager } from "../utils/engine/ResourceManager";

const VIEWER_PREFERENCES_KEY = "litematica-viewer-preferences";
const LARGE_BUILD_THRESHOLD = 25000;

async function createBestAvailableRenderer(defaultProps, setRenderBackend) {
  const rendererOptions = {
    ...defaultProps,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  };

  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    try {
      const { WebGPURenderer } = await import("three/webgpu");
      const renderer = new WebGPURenderer(rendererOptions);
      await renderer.init();
      startTransition(() => setRenderBackend("webgpu"));
      return renderer;
    } catch (error) {
      console.warn("[Viewer] WebGPU unavailable, using WebGL fallback.", error);
    }
  }

  const renderer = new THREE.WebGLRenderer(rendererOptions);
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

class TextureErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function BatchedBlocks({ sceneGroups, maxLayer, xrayMode, onBuildStateChange }) {
  const meshRef = useRef();
  const populatedSignatureRef = useRef(null);
  const invalidate = useThree((state) => state.invalidate);
  const [batchedConfig, setBatchedConfig] = useState(null);
  const [sharedMaterial, setSharedMaterial] = useState(null);

  // Initialize shared material once
  useEffect(() => {
    resourceManager.getSharedMaterial().then(setSharedMaterial);
  }, []);

  const renderMaterial = useMemo(() => {
    if (!sharedMaterial) return null;
    if (!xrayMode) return sharedMaterial;
    
    const m = sharedMaterial.clone();
    m.transparent = true;
    m.opacity = 0.18;
    m.depthWrite = false;
    m.depthTest = true;
    m.side = THREE.DoubleSide;
    m.blending = THREE.AdditiveBlending;
    if ("emissive" in m) {
      m.emissive = new THREE.Color(0x66ccff);
      m.emissiveIntensity = 0.25;
    }
    return m;
  }, [sharedMaterial, xrayMode]);

  useEffect(() => {
    return () => {
      if (renderMaterial !== sharedMaterial) {
        renderMaterial?.dispose?.();
      }
    };
  }, [renderMaterial, sharedMaterial]);

  useEffect(() => {
    if (!meshRef.current || !renderMaterial) return;

    meshRef.current.material = renderMaterial;
    meshRef.current.needsUpdate = true;
    invalidate();
  }, [invalidate, renderMaterial]);

  // Process groups into batched data
  useEffect(() => {
    const processGroups = async () => {
      const names = Object.keys(sceneGroups);
      if (names.length === 0) {
        onBuildStateChange?.({
          stage: "idle",
          progress: 100,
          visible: false,
          instanceCount: 0,
        });
        return;
      }

      onBuildStateChange?.({
        stage: "Resolving block states",
        progress: 10,
        visible: true,
      });

      const stateMap = new Map();
      const statePromises = [];

      for (const name of names) {
        const blocks = sceneGroups[name];
        for (const block of blocks) {
          const propKey = JSON.stringify(block.props || {});
          const key = `${name}|${propKey}`;
          if (!stateMap.has(key)) {
            stateMap.set(key, { name, props: block.props || {} });
            statePromises.push(
              (async () => {
                const data = await resourceManager.getBlockData(name, block.props || {});
                if (data) stateMap.get(key).data = data;
              })()
            );
          }
        }
      }

      await Promise.all(statePromises);
      onBuildStateChange?.({
        stage: "Building batched geometry",
        progress: 55,
        visible: true,
      });

      const uniqueGeosMap = new Map(); // geoUuid -> { geometry, id }
      const allInstances = [];
      let totalVertices = 0;
      let totalIndices = 0;

      for (const name of names) {
        for (const block of sceneGroups[name]) {
          const propKey = JSON.stringify(block.props || {});
          const key = `${name}|${propKey}`;
          const stateInfo = stateMap.get(key);
          if (!stateInfo || !stateInfo.data || !stateInfo.data.geometry) continue;

          const data = stateInfo.data;
          const geo = data.geometry;
          
          if (!uniqueGeosMap.has(geo.uuid)) {
            uniqueGeosMap.set(geo.uuid, { geometry: geo });
            totalVertices += geo.attributes.position.count;
            totalIndices += geo.index ? geo.index.count : geo.attributes.position.count;
          }

          allInstances.push({
            geoUuid: geo.uuid,
            x: block.x,
            y: block.y,
            z: block.z,
            vRotation: data.rotation
          });
        }
      }

      setBatchedConfig({
        maxInstances: allInstances.length,
        maxVertices: totalVertices,
        maxIndices: totalIndices,
        uniqueGeometries: Array.from(uniqueGeosMap.values()),
        allInstances
      });

      onBuildStateChange?.({
        stage: "Uploading scene",
        progress: 85,
        visible: true,
        instanceCount: allInstances.length,
      });
    };

    processGroups();
  }, [sceneGroups, onBuildStateChange]);

  const batchedSignature = useMemo(() => {
    if (!batchedConfig) return null;

    return [
      batchedConfig.maxInstances,
      batchedConfig.maxVertices,
      batchedConfig.maxIndices,
      ...batchedConfig.uniqueGeometries.map(({ geometry }) => geometry.uuid),
    ].join("|");
  }, [batchedConfig]);

  // Populate BatchedMesh
  useLayoutEffect(() => {
    if (!batchedConfig || !meshRef.current || !batchedSignature) return;
    const mesh = meshRef.current;

    if (populatedSignatureRef.current === batchedSignature) {
      return;
    }

    const geoToId = new Map();
    batchedConfig.uniqueGeometries.forEach(item => {
      const id = mesh.addGeometry(item.geometry);
      geoToId.set(item.geometry.uuid, id);
    });

    const tempObject = new THREE.Object3D();
    const rotationMatrix = new THREE.Matrix4();
    const tempMatrix = new THREE.Matrix4();

    batchedConfig.allInstances.forEach((inst, i) => {
      const geoId = geoToId.get(inst.geoUuid);
      const instanceId = mesh.addInstance(geoId);
      
      tempObject.position.set(inst.x + 0.5, inst.y + 0.5, inst.z + 0.5);
      tempObject.updateMatrix();

      if (inst.vRotation) {
        rotationMatrix.makeRotationFromEuler(
          new THREE.Euler(
            (-inst.vRotation.x * Math.PI) / 180,
            (-inst.vRotation.y * Math.PI) / 180,
            0,
            "XYZ"
          )
        );
        tempMatrix.multiplyMatrices(tempObject.matrix, rotationMatrix);
        mesh.setMatrixAt(instanceId, tempMatrix);
      } else {
        mesh.setMatrixAt(instanceId, tempObject.matrix);
      }
      
      // Initial visibility
      mesh.setVisibleAt(instanceId, inst.y <= maxLayer);
    });

    populatedSignatureRef.current = batchedSignature;
    onBuildStateChange?.({
      stage: "Ready",
      progress: 100,
      visible: false,
      instanceCount: batchedConfig.allInstances.length,
    });
  }, [batchedConfig, batchedSignature, maxLayer, onBuildStateChange]);

  // Update visibility on maxLayer change
  useEffect(() => {
    if (!meshRef.current || !batchedConfig) return;
    const mesh = meshRef.current;
    
    batchedConfig.allInstances.forEach((inst, i) => {
      // Instance ID corresponds to index in allInstances because of how we added them
      mesh.setVisibleAt(i, inst.y <= maxLayer);
    });
  }, [maxLayer, batchedConfig]);

  if (!batchedConfig || !renderMaterial) return null;

  return (
    <batchedMesh
      key={`${batchedConfig.maxInstances}-${batchedConfig.uniqueGeometries.length}`}
      ref={meshRef}
      args={[
        batchedConfig.maxInstances,
        batchedConfig.maxVertices,
        batchedConfig.maxIndices,
        renderMaterial
      ]}
      material={renderMaterial}
      frustumCulled={false}
      castShadow
      receiveShadow
    />
  );
}

function SceneContent({ sceneGroups, maxLayer, xrayMode, onBuildStateChange }) {
  // Simple wrapper to use the new BatchedBlocks
  return (
    <BatchedBlocks 
      sceneGroups={sceneGroups} 
      maxLayer={maxLayer} 
      xrayMode={xrayMode} 
      onBuildStateChange={onBuildStateChange}
    />
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

// Camera controller component to handle camera position updates
function CameraController({ position }) {
  const { camera } = useThree();

  useEffect(() => {
    if (position) {
      camera.position.set(position[0], position[1], position[2]);
    }
  }, [position, camera]);

  return null;
}

export function Viewer({ data }) {
  // State for layer slicing
  const [maxLayer, setMaxLayer] = useState(256);
  const [layerBounds, setLayerBounds] = useState({ min: 0, max: 256 });
  const [modelCenter, setModelCenter] = useState([0, 0, 0]);
  const [cameraPosition, setCameraPosition] = useState([50, 50, 50]);
  const [showMaterials, setShowMaterials] = useState(false);

  // Session 1: New state
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
  const controlsRef = useRef();

  // Session 2: Visual enhancements state
  const [ambientIntensity, setAmbientIntensity] = useState(0.6);
  const [directionalIntensity, setDirectionalIntensity] = useState(1.0);
  const [environmentPreset, setEnvironmentPreset] = useState("city");
  const [shadowsEnabled, setShadowsEnabled] = useState(true);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [theme, setTheme] = useState("dark"); // 'dark' or 'light'

  // Session 3: Export & Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(50); // ms per layer
  const sceneRef = useRef();

  // Session 4: X-Ray and UX
  const [xrayMode, setXrayMode] = useState(false);
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
  });
  const [performanceMode, setPerformanceMode] = useState(false);
  const [adaptiveQuality, setAdaptiveQuality] = useState(true);
  const frameLoopMode = autoRotate || isAnimating ? "always" : "demand";
  const preferencesHydratedRef = useRef(false);

  const totalBlockCount = useMemo(
    () =>
      Object.values(data?.regions || {}).reduce(
        (count, region) => count + (region.blocks?.length || 0),
        0,
      ),
    [data],
  );

  const sceneSummary = useMemo(
    () => ({
      totalBlocks: totalBlockCount,
      instances: buildState.instanceCount || 0,
    }),
    [buildState.instanceCount, totalBlockCount],
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

  const handleBuildStateChange = useCallback((nextState) => {
    setBuildState((current) => ({ ...current, ...nextState }));
  }, []);

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

  // Calculate Initial Bounds and Center
  useEffect(() => {
    if (!data || !data.regions) return;

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    Object.values(data.regions).forEach((region) => {
      const ox = region.position.x;
      const oy = region.position.y;
      const oz = region.position.z;

      region.blocks.forEach((block) => {
        const x = ox + block.x;
        const y = oy + block.y;
        const z = oz + block.z;

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      });
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    setModelCenter([centerX, centerY, centerZ]);

    setLayerBounds({ min: minY, max: maxY });
    setMaxLayer(maxY);

    // Session 1: Calculate dimensions
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const depth = maxZ - minZ + 1;
    setModelDimensions({ width, height, depth });
    setModelBounds({ minX, maxX, minY, maxY, minZ, maxZ });

    // Recent files removed

    // Set camera to look at center from a reasonable distance
    const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const dist = maxDim * 1.5 + 20;
    setCameraPosition([centerX + dist, centerY + dist / 2, centerZ + dist]);
  }, [data]);

  // Recent files removed

  // Stable callbacks used by effects
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
    [modelBounds, controlsRef],
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

  // Session 4: Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      switch (e.key.toLowerCase()) {
        case "x":
          setXrayMode((prev) => !prev);
          break;
        case "r":
          setAutoRotate((prev) => !prev);
          break;
        case "s":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleScreenshot();
          }
          break;
        case " ":
          e.preventDefault();
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
  }, [toggleBuildAnimation, setCameraPreset]);

  // Process data into groups ONCE (not dependent on maxLayer)
  const groups = useMemo(() => {
    const g = {};
    const allRegions = data.regions;

    Object.values(allRegions).forEach((region) => {
      const ox = region.position.x;
      const oy = region.position.y;
      const oz = region.position.z;

      region.blocks.forEach((block) => {
        const absY = oy + block.y;

        // We do NOT filter here anymore. We pass everything down to the mesh directly.
        // if (absY > maxLayer) return;  <-- REMOVED

        const key = block.name;
        if (!g[key]) g[key] = [];

        g[key].push({
          x: ox + block.x,
          y: absY,
          z: oz + block.z,
          props: block.props,
        });
      });
    });
    return g;
  }, [data]); // Removed maxLayer dependency

  // Session 3: Multiple screenshot export
  const handleMultipleScreenshots = async () => {
    const presets = ["front", "side", "top", "isometric"];
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    for (let i = 0; i < presets.length; i++) {
      setCameraPreset(presets[i]);
      // Wait for camera to update
      await new Promise((resolve) => setTimeout(resolve, 500));

      const link = document.createElement("a");
      link.download = `litematica_${presets[i]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      // Small delay between downloads
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  };

  // Session 3: Export to 3D formats
  const handleExport3D = (format) => {
    if (!sceneRef.current) return;

    if (format === "gltf") {
      const exporter = new GLTFExporter();
      exporter.parse(
        sceneRef.current,
        (gltf) => {
          const output = JSON.stringify(gltf, null, 2);
          const blob = new Blob([output], { type: "application/json" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = "litematica_model.gltf";
          link.click();
        },
        (error) => {
          console.error("GLTF export error:", error);
        },
        { binary: false },
      );
    } else if (format === "obj") {
      // Simple OBJ export (vertices only)
      let objContent = "# Litematica Model Export\n";

      sceneRef.current.traverse((child) => {
        if (child.isInstancedMesh) {
          const geometry = child.geometry;
          const positions = geometry.attributes.position.array;
          const matrix = new THREE.Matrix4();

          for (let i = 0; i < child.count; i++) {
            child.getMatrixAt(i, matrix);
            const position = new THREE.Vector3();
            position.setFromMatrixPosition(matrix);

            // Skip if scale is 0 (hidden)
            const scale = new THREE.Vector3();
            scale.setFromMatrixScale(matrix);
            if (scale.x === 0) continue;

            // Add vertices for this instance
            for (let j = 0; j < positions.length; j += 3) {
              const x = positions[j] + position.x;
              const y = positions[j + 1] + position.y;
              const z = positions[j + 2] + position.z;
              objContent += `v ${x} ${y} ${z}\n`;
            }
          }
        }
      });

      const blob = new Blob([objContent], { type: "text/plain" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "litematica_model.obj";
      link.click();
    }
  };

  // Session 3: Build animation
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
  }, [isAnimating, animationSpeed, layerBounds.max]);

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
      {/* Blurred Background Layer */}
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
        style={{ position: "relative", zIndex: 1 }}
      >
        <ambientLight intensity={ambientIntensity} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={directionalIntensity}
          castShadow={shadowsEnabled}
          shadow-mapSize-width={shadowsEnabled ? 2048 : 512}
          shadow-mapSize-height={shadowsEnabled ? 2048 : 512}
        />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        <Suspense fallback={null}>
          <group ref={sceneRef}>
            <SceneContent
              sceneGroups={groups}
              maxLayer={maxLayer}
              xrayMode={xrayMode}
              onBuildStateChange={handleBuildStateChange}
            />
          </group>
        </Suspense>

        <RendererStatsTracker onStats={handleRenderStats} />
        <CameraController position={cameraPosition} target={modelCenter} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={modelCenter}
          autoRotate={autoRotate}
          autoRotateSpeed={4.0}
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
            width: "min(480px, calc(100vw - 32px))",
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
        onMultipleScreenshots={handleMultipleScreenshots}
        onExport3D={handleExport3D}
        isAnimating={isAnimating}
        onToggleBuildAnimation={toggleBuildAnimation}
        animationSpeed={animationSpeed}
        setAnimationSpeed={setAnimationSpeed}
        xrayMode={xrayMode}
        setXrayMode={setXrayMode}
      />

      {/* Render Material List separately if needed, or Sidebar could handle it. 
          For now dragging it from Sidebar might be tricky if it's separate. 
          Let's render it here as before for max flexibility. 
       */}
      {showMaterials && (
        <MaterialList data={data} onClose={() => setShowMaterials(false)} />
      )}
    </div>
  );
}
