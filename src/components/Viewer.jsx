import React, { useMemo, useEffect, useRef, Suspense, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import {
  OrbitControls,
  Environment,
} from "@react-three/drei";
import * as THREE from "three";
import { MaterialList } from "./MaterialList";
import { Sidebar } from "./Sidebar";
import bgImage from "../assets/bg.png";
import { resourceManager } from "../utils/engine/ResourceManager";

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

function V2BlockInstancedMesh({ geometry, material, positions, maxLayer }) {
  const meshRef = useRef();

  useEffect(() => {
    if (!meshRef.current) return;

    const tempObject = new THREE.Object3D();
    const tempMatrix = new THREE.Matrix4();
    const rotationMatrix = new THREE.Matrix4();

    positions.forEach((pos, i) => {
      const isVisible = pos.y <= maxLayer;
      const scale = isVisible ? 1 : 0;

      tempObject.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
      tempObject.scale.set(scale, scale, scale);
      tempObject.updateMatrix();
      
      // Apply variant-specific rotation (from blockstate variants)
          if (pos.vRotation) {
            rotationMatrix.makeRotationFromEuler(new THREE.Euler(
              (-pos.vRotation.x * Math.PI) / 180,
              (-pos.vRotation.y * Math.PI) / 180,
              0,
              'XYZ' // Minecraft rotation order
            ));
        tempMatrix.multiplyMatrices(tempObject.matrix, rotationMatrix);
        meshRef.current.setMatrixAt(i, tempMatrix);
      } else {
        meshRef.current.setMatrixAt(i, tempObject.matrix);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [positions, maxLayer, geometry]);

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, positions.length]} frustumCulled={false} />
  );
}

function SceneContent({ sceneGroups, maxLayer }) {
  const [v2Groups, setV2Groups] = useState([]);

  useEffect(() => {
    const processGroups = async () => {
      const groups = new Map();
      const names = Object.keys(sceneGroups);

      // Pre-process unique states to avoid heavy await in the inner loop
      const statePromises = [];
      const stateMap = new Map(); // key -> { name, props, data }

      for (const name of names) {
        const blocks = sceneGroups[name];
        for (const block of blocks) {
          const propKey = JSON.stringify(block.props || {});
          const key = `${name}|${propKey}`;
          if (!stateMap.has(key)) {
            stateMap.set(key, { name, props: block.props || {} });
            statePromises.push((async () => {
              const data = await resourceManager.getBlockData(name, block.props || {});
              if (data) stateMap.get(key).data = data;
            })());
          }
        }
      }

      await Promise.all(statePromises);

      // Now build the groups
      for (const name of names) {
        for (const block of sceneGroups[name]) {
          const propKey = JSON.stringify(block.props || {});
          const key = `${name}|${propKey}`;
          const stateInfo = stateMap.get(key);
          if (!stateInfo || !stateInfo.data) continue;

          const data = stateInfo.data;
          if (!data.geometry) continue;
          const geoKey = data.geometry.uuid;

          if (!groups.has(geoKey)) {
            groups.set(geoKey, { 
              geometry: data.geometry, 
              material: data.material, 
              positions: [] 
            });
          }
          groups.get(geoKey).positions.push({
            ...block,
            vRotation: data.rotation
          });
        }
      }
      setV2Groups(Array.from(groups.values()));
    };
    processGroups();
  }, [sceneGroups]);

  return (
    <group>
      {v2Groups.map((group, idx) => (
        <V2BlockInstancedMesh 
          key={idx} 
          geometry={group.geometry}
          material={group.material}
          positions={group.positions} 
          maxLayer={maxLayer}
        />
      ))}
    </group>
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
  const [modelDimensions, setModelDimensions] = useState({ width: 0, height: 0, depth: 0 });
  const [modelBounds, setModelBounds] = useState({ minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 });
  const [autoRotate, setAutoRotate] = useState(false);
  const controlsRef = useRef();

  // Session 2: Visual enhancements state
  const [ambientIntensity, setAmbientIntensity] = useState(0.6);
  const [directionalIntensity, setDirectionalIntensity] = useState(1.0);
  const [environmentPreset, setEnvironmentPreset] = useState('city');
  const [shadowsEnabled, setShadowsEnabled] = useState(true);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [theme, setTheme] = useState('dark'); // 'dark' or 'light'

  // Session 3: Export & Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(50); // ms per layer
  const sceneRef = useRef();

  // Session 4: History, X-Ray, and UX
  const [xrayMode, setXrayMode] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);
  const [showRecentFiles, setShowRecentFiles] = useState(false);

  const saveToRecentFiles = (fileInfo) => {
    setRecentFiles(prev => {
      const filtered = prev.filter(f => f.name !== fileInfo.name);
      const updated = [fileInfo, ...filtered].slice(0, 10);
      localStorage.setItem('litematica_recent_files', JSON.stringify(updated));
      return updated;
    });
  };

  // Calculate Initial Bounds and Center
  useEffect(() => {
    if (!data || !data.regions) return;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

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

    // Session 4: Save to recent files
    if (data.metadata?.Name) {
      saveToRecentFiles({
        name: data.metadata.Name.value || 'Unnamed',
        timestamp: Date.now(),
        dimensions: { width, height, depth }
      });
    }

    // Set camera to look at center from a reasonable distance
    const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const dist = maxDim * 1.5 + 20;
    setCameraPosition([centerX + dist, centerY + dist / 2, centerZ + dist]);
  }, [data]);

  // Session 4: Load recent files from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('litematica_recent_files');
    if (stored) {
      try {
        setRecentFiles(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse recent files:', e);
      }
    }
  }, []);

  // Stable callbacks used by effects
  const toggleBuildAnimation = useCallback(() => {
    if (isAnimating) {
      setIsAnimating(false);
    } else {
      setMaxLayer(layerBounds.min);
      setIsAnimating(true);
    }
  }, [isAnimating, layerBounds.min]);

  const setCameraPreset = useCallback((preset) => {
    const { minX, maxX, minY, maxY, minZ, maxZ } = modelBounds;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const dist = maxDim * 1.8;

    let newPos;
    switch (preset) {
      case 'front':
        newPos = [centerX, centerY, centerZ + dist];
        break;
      case 'side':
        newPos = [centerX + dist, centerY, centerZ];
        break;
      case 'top':
        newPos = [centerX, centerY + dist, centerZ];
        break;
      case 'isometric':
        newPos = [centerX + dist * 0.7, centerY + dist * 0.7, centerZ + dist * 0.7];
        break;
      default:
        return;
    }

    setCameraPosition(newPos);
    if (controlsRef.current) {
      controlsRef.current.target.set(centerX, centerY, centerZ);
    }
  }, [modelBounds, controlsRef]);

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
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'w':
          setWireframeMode(prev => !prev);
          break;
        case 'x':
          setXrayMode(prev => !prev);
          break;
        case 'r':
          setAutoRotate(prev => !prev);
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleScreenshot();
          }
          break;
        case ' ':
          e.preventDefault();
          toggleBuildAnimation();
          break;
        case '1':
          setCameraPreset('front');
          break;
        case '2':
          setCameraPreset('side');
          break;
        case '3':
          setCameraPreset('top');
          break;
        case '4':
          setCameraPreset('isometric');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
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
    const presets = ['front', 'side', 'top', 'isometric'];
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    for (let i = 0; i < presets.length; i++) {
      setCameraPreset(presets[i]);
      // Wait for camera to update
      await new Promise(resolve => setTimeout(resolve, 500));

      const link = document.createElement("a");
      link.download = `litematica_${presets[i]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  };

  // Session 3: Export to 3D formats
  const handleExport3D = (format) => {
    if (!sceneRef.current) return;

    if (format === 'gltf') {
      const exporter = new GLTFExporter();
      exporter.parse(
        sceneRef.current,
        (gltf) => {
          const output = JSON.stringify(gltf, null, 2);
          const blob = new Blob([output], { type: 'application/json' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'litematica_model.gltf';
          link.click();
        },
        (error) => {
          console.error('GLTF export error:', error);
        },
        { binary: false }
      );
    } else if (format === 'obj') {
      // Simple OBJ export (vertices only)
      let objContent = '# Litematica Model Export\n';

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

      const blob = new Blob([objContent], { type: 'text/plain' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'litematica_model.obj';
      link.click();
    }
  };

  // Session 3: Build animation
  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setMaxLayer(prev => {
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
    <div style={{ width: "100vw", height: "100vh", background: "#000", position: 'relative', overflow: 'hidden' }}>

      {/* Blurred Background Layer */}
      <div
        style={{
          position: 'absolute',
          top: -20,
          left: -20,
          right: -20,
          bottom: -20,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(20px) brightness(0.6)',
          zIndex: 0
        }}
      />

      <Canvas
        camera={{ position: cameraPosition, fov: 50, near: 0.01, far: 10000 }}
        gl={{ preserveDrawingBuffer: true, alpha: true }}
        style={{ position: 'relative', zIndex: 1 }}
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
            <SceneContent sceneGroups={groups} maxLayer={maxLayer} />
          </group>
        </Suspense>

        <CameraController position={cameraPosition} target={modelCenter} />
        <OrbitControls ref={controlsRef} makeDefault target={modelCenter} autoRotate={autoRotate} autoRotateSpeed={4.0} />
        <Environment preset={environmentPreset} />
      </Canvas>

      <Sidebar
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
        wireframeMode={wireframeMode}
        setWireframeMode={setWireframeMode}
        theme={theme}
        setTheme={setTheme}
        onMultipleScreenshots={handleMultipleScreenshots}
        onExport3D={handleExport3D}
        isAnimating={isAnimating}
        onToggleBuildAnimation={toggleBuildAnimation}
        animationSpeed={animationSpeed}
        setAnimationSpeed={setAnimationSpeed}
        xrayMode={xrayMode}
        setXrayMode={setXrayMode}
        recentFiles={recentFiles}
        showRecentFiles={showRecentFiles}
        setShowRecentFiles={setShowRecentFiles}
      />

      {/* Render Material List separately if needed, or Sidebar could handle it. 
          For now dragging it from Sidebar might be tricky if it's separate. 
          Let's render it here as before for max flexibility. 
       */}
      {showMaterials && <MaterialList data={data} onClose={() => setShowMaterials(false)} />}
    </div>
  );
}
