import React, { useMemo, useEffect, useRef, Suspense, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import {
  OrbitControls,
  Environment,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import { blockColors } from "../utils/blockColors";
import { getTextureUrl } from "../utils/blockTextures";
import { MaterialList } from "./MaterialList";
import { Sidebar } from "./Sidebar";
import bgImage from "../assets/bg.png";

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

function ColoredBlockInstancedMesh({ name, positions, maxLayer, wireframeMode, xrayMode }) {
  const meshRef = useRef();
  const color = blockColors[name] || 0xff00ff; // Default pink if unknown

  useEffect(() => {
    if (!meshRef.current) return;

    const tempObject = new THREE.Object3D();

    positions.forEach((pos, i) => {
      // Filter visibility by Y-level efficiently via scale
      // We keep the instance count constant to prevent flickering (unmounting/remounting)
      const isVisible = pos.y <= maxLayer;
      const scale = isVisible ? 1 : 0;

      tempObject.position.set(pos.x, pos.y, pos.z);
      tempObject.scale.set(scale, scale, scale);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [positions, maxLayer]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, positions.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        wireframe={wireframeMode}
        transparent={xrayMode}
        opacity={xrayMode ? 0.3 : 1.0}
      />
    </instancedMesh>
  );
}

function TexturedBlockInstancedMesh({ name, positions, maxLayer, wireframeMode, xrayMode }) {
  const meshRef = useRef();

  // We need to handle properties. 
  // Since we are instancing, all blocks in this mesh *share* the same texture.
  // BUT the grouping in SceneContent groups by "name" only, effectively ignoring props.
  // This is a flaw in the current Viewer logic if we want per-state textures (like vertical vs horizontal logs in the same group).
  // FOR NOW, we will just use the props of the first item to determine the texture for the group.
  // A proper fix would require grouping by "name + unique_texture_key".
  const firstBlockProps = positions[0]?.props || {};

  const topUrl = getTextureUrl(name, "top", firstBlockProps);
  const bottomUrl = getTextureUrl(name, "bottom", firstBlockProps);
  const sideUrl = getTextureUrl(name, "side", firstBlockProps);

  // Load textures
  const [topTex, bottomTex, sideTex] = useTexture([topUrl, bottomUrl, sideUrl]);

  // Configure textures for Minecraft look (pixelated)
  useMemo(() => {
    [topTex, bottomTex, sideTex].forEach((t) => {
      if (t) {
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.colorSpace = THREE.SRGBColorSpace;
      }
    });
  }, [topTex, bottomTex, sideTex]);

  const materials = useMemo(() => {
    // If we want to support transparency (e.g. glass), we should set transparent={true}
    // and maybe alphaTest to handle cutouts (like leaves/grass).
    const isTransparent =
      name.includes("glass") ||
      name.includes("leaf") ||
      name.includes("sapling") ||
      name.includes("rail") ||
      name.includes("flower") ||
      name.includes("grass") ||
      name.includes("door") ||
      name.includes("trapdoor");

    const matProps = {
      transparent: isTransparent || xrayMode,
      alphaTest: isTransparent ? 0.5 : 0,
      side: isTransparent ? THREE.DoubleSide : THREE.FrontSide,
      wireframe: wireframeMode,
      opacity: xrayMode ? 0.3 : 1.0,
    };

    const matSide = new THREE.MeshStandardMaterial({
      map: sideTex,
      ...matProps,
    });
    const matTop = new THREE.MeshStandardMaterial({ map: topTex, ...matProps });
    const matBottom = new THREE.MeshStandardMaterial({
      map: bottomTex,
      ...matProps,
    });

    // Order: px, nx, py, ny, pz, nz
    // Right, Left, Top, Bottom, Front, Back
    return [
      matSide, // Right
      matSide, // Left
      matTop, // Top
      matBottom, // Bottom
      matSide, // Front
      matSide, // Back
    ];
  }, [topTex, bottomTex, sideTex, name, wireframeMode, xrayMode]);

  useEffect(() => {
    if (!meshRef.current) return;

    const tempObject = new THREE.Object3D();

    positions.forEach((pos, i) => {
      const { x, y, z, props } = pos;

      const isVisible = pos.y <= maxLayer;

      if (!isVisible) {
        // Hide by scaling to 0
        tempObject.position.set(x, y, z); // Position doesn't strictly matter if scale is 0, but good to keep valid
        tempObject.scale.set(0, 0, 0);
        tempObject.updateMatrix();
        meshRef.current.setMatrixAt(i, tempObject.matrix);
        return;
      }

      tempObject.position.set(x, y, z);
      tempObject.rotation.set(0, 0, 0);
      tempObject.scale.set(1, 1, 1);

      // Simple model adjustments based on name and properties
      // Note: This is a basic approximation. Full model support requires loading JSON models.

      // Slabs
      if (name.includes("slab")) {
        const type = props?.type?.value;
        if (type === "bottom") {
          tempObject.scale.set(1, 0.5, 1);
          tempObject.position.y -= 0.25;
        } else if (type === "top") {
          tempObject.scale.set(1, 0.5, 1);
          tempObject.position.y += 0.25;
        }
        // double is full block (default)
      }
      // Carpet
      else if (name.includes("carpet")) {
        tempObject.scale.set(1, 0.0625, 1);
        tempObject.position.y -= 0.5 - 0.03125;
      }
      // Trapdoors (approximate as thin blocks)
      else if (name.includes("trapdoor")) {
        const half = props?.half?.value;
        // Simplified: just flat on bottom or top if closed, or side if open
        // Handling rotation is complex without full state parsing.
        // For now, let's just make them thin.
        tempObject.scale.set(1, 0.1875, 1);
        if (half === "top") {
          tempObject.position.y += 0.5 - 0.09375;
        } else {
          tempObject.position.y -= 0.5 - 0.09375;
        }
      }

      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [positions, name, maxLayer]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, positions.length]}
      material={materials}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

function BlockInstancedMesh({ name, positions, maxLayer, wireframeMode, xrayMode }) {
  if (!positions || positions.length === 0) return null;

  const hasTexture = getTextureUrl(name, 'top') !== null;

  if (hasTexture) {
    return (
      <TextureErrorBoundary fallback={<ColoredBlockInstancedMesh name={name} positions={positions} maxLayer={maxLayer} wireframeMode={wireframeMode} xrayMode={xrayMode} />}>
        <Suspense fallback={<ColoredBlockInstancedMesh name={name} positions={positions} maxLayer={maxLayer} wireframeMode={wireframeMode} xrayMode={xrayMode} />}>
          <TexturedBlockInstancedMesh name={name} positions={positions} maxLayer={maxLayer} wireframeMode={wireframeMode} xrayMode={xrayMode} />
        </Suspense>
      </TextureErrorBoundary>
    );
  } else {
    return <ColoredBlockInstancedMesh name={name} positions={positions} maxLayer={maxLayer} wireframeMode={wireframeMode} xrayMode={xrayMode} />;
  }
}

function SceneContent({ sceneGroups, maxLayer, wireframeMode, xrayMode }) {
  return (
    <group>
      {Object.keys(sceneGroups).map((name) => (
        <BlockInstancedMesh key={name} name={name} positions={sceneGroups[name]} maxLayer={maxLayer} wireframeMode={wireframeMode} xrayMode={xrayMode} />
      ))}
    </group>
  );
}
// Camera controller component to handle camera position updates
function CameraController({ position, target }) {
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
  const [minLayer, setMinLayer] = useState(0);
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

  // Session 4: Save to recent files
  const saveToRecentFiles = (fileInfo) => {
    setRecentFiles(prev => {
      const filtered = prev.filter(f => f.name !== fileInfo.name);
      const updated = [fileInfo, ...filtered].slice(0, 10); // Keep last 10
      localStorage.setItem('litematica_recent_files', JSON.stringify(updated));
      return updated;
    });
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
  }, []);


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


  const handleScreenshot = () => {
    const canvas = document.querySelector("canvas");
    if (canvas) {
      const link = document.createElement("a");
      link.download = "litematica_render.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  };

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

  const toggleBuildAnimation = () => {
    if (isAnimating) {
      setIsAnimating(false);
    } else {
      setMaxLayer(layerBounds.min);
      setIsAnimating(true);
    }
  };
  const setCameraPreset = (preset) => {
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
  };

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
            <SceneContent sceneGroups={groups} maxLayer={maxLayer} wireframeMode={wireframeMode} xrayMode={xrayMode} />
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
