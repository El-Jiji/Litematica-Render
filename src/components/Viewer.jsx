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
import { Canvas, useThree } from "@react-three/fiber";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { MaterialList } from "./MaterialList";
import { Sidebar } from "./Sidebar";
import bgImage from "../assets/bg.png";
import { resourceManager } from "../utils/engine/ResourceManager";

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

function BatchedBlocks({ sceneGroups, maxLayer, xrayMode }) {
  const meshRef = useRef();
  const populatedSignatureRef = useRef(null);
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

  // Process groups into batched data
  useEffect(() => {
    const processGroups = async () => {
      const names = Object.keys(sceneGroups);
      if (names.length === 0) return;

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
    };

    processGroups();
  }, [sceneGroups]);

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
  }, [batchedConfig, batchedSignature, maxLayer]);

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
      frustumCulled={false}
      castShadow
      receiveShadow
    />
  );
}

function SceneContent({ sceneGroups, maxLayer, xrayMode }) {
  // Simple wrapper to use the new BatchedBlocks
  return (
    <BatchedBlocks 
      sceneGroups={sceneGroups} 
      maxLayer={maxLayer} 
      xrayMode={xrayMode} 
    />
  );
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
  const frameLoopMode = autoRotate || isAnimating ? "always" : "demand";

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
            />
          </group>
        </Suspense>

        <CameraController position={cameraPosition} target={modelCenter} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={modelCenter}
          autoRotate={autoRotate}
          autoRotateSpeed={4.0}
        />
        <Environment preset={environmentPreset} />
      </Canvas>

      <Sidebar
        renderBackend={renderBackend}
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
