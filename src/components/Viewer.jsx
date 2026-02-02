import React, { useMemo, useEffect, useRef, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Center,
  Environment,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import { blockColors } from "../utils/blockColors";
import { getTextureUrl } from "../utils/blockTextures";

class TextureErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function ColoredBlockInstancedMesh({ name, positions }) {
  const meshRef = useRef();
  const color = blockColors[name] || 0xff00ff; // Default pink if unknown

  useEffect(() => {
    if (!meshRef.current) return;

    const tempObject = new THREE.Object3D();

    positions.forEach((pos, i) => {
      tempObject.position.set(pos.x, pos.y, pos.z);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, positions.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  );
}

function TexturedBlockInstancedMesh({ name, positions }) {
  const meshRef = useRef();

  const topUrl = getTextureUrl(name, "top");
  const bottomUrl = getTextureUrl(name, "bottom");
  const sideUrl = getTextureUrl(name, "side");

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
  }, [positions, name]);

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
  // Try to load texture, fallback to color while loading or on error
  return (
    <TextureErrorBoundary fallback={<ColoredBlockInstancedMesh {...props} />}>
      <Suspense fallback={<ColoredBlockInstancedMesh {...props} />}>
        <TexturedBlockInstancedMesh {...props} />
      </Suspense>
    </TextureErrorBoundary>
  );
}

function SceneContent({ data }) {
  // Process data into groups
  const groups = useMemo(() => {
    const g = {};
    const allRegions = data.regions;

    Object.values(allRegions).forEach((region) => {
      const ox = region.position.x;
      const oy = region.position.y;
      const oz = region.position.z;

      region.blocks.forEach((block) => {
        const key = block.name;
        if (!g[key]) g[key] = [];

        g[key].push({
          x: ox + block.x,
          y: oy + block.y,
          z: oz + block.z,
          props: block.props,
        });
      });
    });
    return g;
  }, [data]);

  return (
    <group>
      <Center>
        {Object.keys(groups).map((name) => (
          <BlockInstancedMesh key={name} name={name} positions={groups[name]} />
        ))}
      </Center>
    </group>
  );
}

export function Viewer({ data }) {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#111" }}>
      <Canvas camera={{ position: [50, 50, 50], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        <Suspense fallback={null}>
          <SceneContent data={data} />
        </Suspense>

        <OrbitControls makeDefault />
        <Environment preset="city" />
      </Canvas>

      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          color: "white",
          background: "rgba(0,0,0,0.5)",
          padding: "10px",
          borderRadius: "5px",
          pointerEvents: "none",
        }}
      >
        <p>Left Click: Rotate</p>
        <p>Right Click: Pan</p>
        <p>Scroll: Zoom</p>
      </div>
    </div>
  );
}
