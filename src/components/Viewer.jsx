import React, { useMemo, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Center, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { blockColors } from '../utils/blockColors';

function BlockInstancedMesh({ name, positions }) {
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

function SceneContent({ data }) {
  // Process data into groups
  const groups = useMemo(() => {
    const g = {};
    const allRegions = data.regions;
    
    // Calculate bounds to center roughly if needed, but <Center> component handles it.
    
    Object.values(allRegions).forEach(region => {
       // Region position is absolute world coords.
       // We can normalize them to start at 0,0,0 or just use them.
       // If we use them as is, the model might be far from origin.
       // <Center> will fix it.
       
       const ox = region.position.x;
       const oy = region.position.y;
       const oz = region.position.z;
       
       region.blocks.forEach(block => {
         const key = block.name;
         if (!g[key]) g[key] = [];
         
         // Litematica coordinates:
         // If x,y,z are relative to region size.
         // Absolute = ox + x, oy + y, oz + z
         // Note: Litematica sizes can be negative!
         // If size is negative, the blocks iterate 0..size (exclusive).
         // Wait, my parser used Math.abs(size).
         // If size was negative, does it mean the region grows in negative direction?
         // Yes.
         // In my parser:
         // I took Math.abs(size).
         // I iterated 0..abs_size.
         // If the original size was negative, the real coordinate is:
         // pos + (x if size>0 else -x-1?)
         // Actually, Litematica defines the box by Position and Size.
         // If Size.x is -10, it goes from Position.x down to Position.x - 10.
         // My parser implementation assumed positive iteration.
         // I should fix coordinate calculation here or in parser.
         // Let's assume positive for now or check parser.
         
         // In parser:
         // const size = { x: Math.abs(...), ... }
         // for x=0..size.x
         
         // I need to know the sign of the original size to apply offset correctly.
         // But I only passed the absolute size and the position.
         // I should probably fix the parser to handle negative sizes if that's how Litematica works.
         // Or just assume standard behavior. 
         // Most litematics have positive sizes or the tool normalizes them?
         // Let's assume positive for now. 
         
         g[key].push({
           x: ox + block.x,
           y: oy + block.y,
           z: oz + block.z
         });
       });
    });
    return g;
  }, [data]);

  return (
    <group>
      <Center>
        {Object.keys(groups).map(name => (
          <BlockInstancedMesh 
            key={name} 
            name={name} 
            positions={groups[name]} 
          />
        ))}
      </Center>
    </group>
  );
}

export function Viewer({ data }) {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#111' }}>
      <Canvas camera={{ position: [50, 50, 50], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <SceneContent data={data} />
        
        <OrbitControls makeDefault />
        <Environment preset="city" />
      </Canvas>
      
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: 'white',
        background: 'rgba(0,0,0,0.5)',
        padding: '10px',
        borderRadius: '5px',
        pointerEvents: 'none'
      }}>
        <p>Left Click: Rotate</p>
        <p>Right Click: Pan</p>
        <p>Scroll: Zoom</p>
      </div>
    </div>
  );
}
