"use client";

import React, { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { SkyGradient } from "./SkyGradient";

export function SceneLighting({
  lightingState,
  performanceMode,
  bounds,
  showSkyBackground,
}) {
  const { scene } = useThree();
  const directionalLightRef = useRef(null);
  const directionalTargetRef = useRef(new THREE.Object3D());

  // Sky gradient colors derived from lighting state
  const skyColors = useMemo(() => {
    if (!showSkyBackground) {
      return {
        topColor: "#0a0c14",
        bottomColor: "#1a1c28",
        horizonColor: "#141620",
      };
    }
    return {
      topColor: lightingState.skyColor || "#7ab4e6",
      bottomColor: lightingState.fogColor || "#c8ddf0",
      horizonColor: lightingState.fogColor || "#c8ddf0",
    };
  }, [lightingState.fogColor, lightingState.skyColor, showSkyBackground]);

  // Use transparent background so the sky sphere shows through
  useEffect(() => {
    const previousBackground = scene.background;
    scene.background = null;

    // Add fog for atmospheric depth
    const fogColor = new THREE.Color(
      showSkyBackground
        ? lightingState.fogColor || lightingState.backgroundColor
        : "#141418",
    );
    const modelSpan = Math.max(
      24,
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      bounds.maxZ - bounds.minZ,
    );
    const fogNear = modelSpan * 1.5;
    const fogFar = modelSpan * 6;
    scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);

    return () => {
      scene.background = previousBackground;
      scene.fog = null;
    };
  }, [
    bounds.maxX,
    bounds.maxY,
    bounds.maxZ,
    bounds.minX,
    bounds.minY,
    bounds.minZ,
    lightingState.backgroundColor,
    lightingState.fogColor,
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
      {/* Sky gradient sphere */}
      <SkyGradient
        topColor={skyColors.topColor}
        bottomColor={skyColors.bottomColor}
        horizonColor={skyColors.horizonColor}
      />

      {/* Stronger ambient for flatter, BlueMap-like lighting */}
      <ambientLight
        color={lightingState.ambientColor}
        intensity={lightingState.ambientIntensity}
      />
      <hemisphereLight
        color={lightingState.skyColor}
        groundColor={lightingState.groundColor}
        intensity={lightingState.hemisphereIntensity}
      />
      {/* Softer directional for subtle shadows */}
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
