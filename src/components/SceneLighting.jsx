"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

export function SceneLighting({
  lightingState,
  performanceMode,
  bounds,
  showSkyBackground,
}) {
  const { scene } = useThree();
  const directionalLightRef = useRef(null);
  const directionalTargetRef = useRef(new THREE.Object3D());

  useEffect(() => {
    const previousBackground = scene.background;

    scene.background = new THREE.Color(
      showSkyBackground ? lightingState.backgroundColor : "#141418",
    );
    scene.fog = null;

    return () => {
      scene.background = previousBackground;
      scene.fog = null;
    };
  }, [
    lightingState.backgroundColor,
    scene,
    showSkyBackground,
  ]);

  useEffect(() => {
    const target = directionalTargetRef.current;
    target.position.set(
      (bounds.minX + bounds.maxX) / 2,
      bounds.maxY,
      (bounds.minZ + bounds.maxZ) / 2,
    );
    scene.add(target);

    if (directionalLightRef.current) {
      directionalLightRef.current.target = target;
    }

    return () => {
      scene.remove(target);
    };
  }, [bounds.maxX, bounds.maxY, bounds.maxZ, bounds.minX, bounds.minZ, scene]);

  const shadowEnabled = !performanceMode && lightingState.daylight > 0.08;
  const shadowCenterX = (bounds.minX + bounds.maxX) / 2;
  const shadowCenterZ = (bounds.minZ + bounds.maxZ) / 2;
  const shadowCenterY = bounds.maxY;
  const shadowSpan = Math.max(
    24,
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY,
    bounds.maxZ - bounds.minZ,
  );

  return (
    <>
      <ambientLight
        color={lightingState.ambientColor}
        intensity={lightingState.ambientIntensity}
      />
      <hemisphereLight
        color={lightingState.skyColor}
        groundColor={lightingState.groundColor}
        intensity={lightingState.hemisphereIntensity}
      />
      <directionalLight
        ref={directionalLightRef}
        position={lightingState.directionalPosition}
        color={lightingState.directionalColor}
        intensity={lightingState.directionalIntensity}
        castShadow={shadowEnabled}
        shadow-mapSize-width={
          shadowEnabled ? lightingState.shadowMapSize : 512
        }
        shadow-mapSize-height={
          shadowEnabled ? lightingState.shadowMapSize : 512
        }
        shadow-camera-near={1}
        shadow-camera-far={shadowSpan * 4}
        shadow-camera-left={-shadowSpan}
        shadow-camera-right={shadowSpan}
        shadow-camera-top={shadowSpan}
        shadow-camera-bottom={-shadowSpan}
        shadow-bias={-0.00015}
      />
    </>
  );
}
