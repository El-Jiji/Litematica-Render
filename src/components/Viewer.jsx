import React, { useMemo, useEffect, useRef, Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
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

function ColoredBlockInstancedMesh({ name, positions, maxLayer }) {
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
    <instancedMesh ref={meshRef} args={[null, null, positions.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  );
}

function TexturedBlockInstancedMesh({ name, positions, maxLayer }) {
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
      transparent: isTransparent,
      alphaTest: isTransparent ? 0.5 : 0,
      side: isTransparent ? THREE.DoubleSide : THREE.FrontSide,
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
  }, [topTex, bottomTex, sideTex, name]);

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
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

function BlockInstancedMesh(props) {
  // If no positions, don't render anything
  if (!props.positions || props.positions.length === 0) return null;

  // Try to load texture, fallback to color while loading or on error
  return (
    <TextureErrorBoundary fallback={<ColoredBlockInstancedMesh {...props} />}>
      <Suspense fallback={<ColoredBlockInstancedMesh {...props} />}>
        <TexturedBlockInstancedMesh {...props} />
      </Suspense>
    </TextureErrorBoundary>
  );
}

function SceneContent({ sceneGroups, maxLayer }) {
  return (
    <group>
      {Object.keys(sceneGroups).map((name) => (
        <BlockInstancedMesh key={name} name={name} positions={sceneGroups[name]} maxLayer={maxLayer} />
      ))}
    </group>
  );
}

export function Viewer({ data }) {
  // State for layer slicing
  const [maxLayer, setMaxLayer] = useState(256);
  const [minLayer, setMinLayer] = useState(0);
  const [layerBounds, setLayerBounds] = useState({ min: 0, max: 256 });
  const [modelCenter, setModelCenter] = useState([0, 0, 0]);
  const [cameraPosition, setCameraPosition] = useState([50, 50, 50]);
  const [showMaterials, setShowMaterials] = useState(false);

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

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
      });
    });

    // If no blocks found (unlikely), default
    if (minX === Infinity) {
      setLayerBounds({ min: -64, max: 320 });
      return;
    }

    setLayerBounds({ min: minY, max: maxY });
    setMaxLayer(maxY); // Start showing everything
    setMinLayer(minY);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    setModelCenter([centerX, centerY, centerZ]);

    // Set camera to look at center from a reasonable distance
    const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const dist = maxDim * 1.5 + 20;
    setCameraPosition([centerX + dist, centerY + dist / 2, centerZ + dist]);

  }, [data]);

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
        camera={{ position: cameraPosition, fov: 50, near: 0.1, far: 10000 }}
        gl={{ preserveDrawingBuffer: true, alpha: true }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        <Suspense fallback={null}>
          <SceneContent sceneGroups={groups} maxLayer={maxLayer} />
        </Suspense>

        <OrbitControls makeDefault target={modelCenter} />
        <Environment preset="city" />
      </Canvas>

      <Sidebar
        maxLayer={maxLayer}
        setMaxLayer={setMaxLayer}
        layerBounds={layerBounds}
        onToggleMaterials={() => setShowMaterials(!showMaterials)}
        showMaterials={showMaterials}
        onScreenshot={handleScreenshot}
      />

      {/* Render Material List separately if needed, or Sidebar could handle it. 
          For now dragging it from Sidebar might be tricky if it's separate. 
          Let's render it here as before for max flexibility. 
       */}
      {showMaterials && <MaterialList data={data} onClose={() => setShowMaterials(false)} />}
    </div>
  );
}
