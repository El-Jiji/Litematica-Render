"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

/**
 * Creates a dynamic sky gradient background using a custom shader on a large sphere.
 * Mimics BlueMap's sky style with a smooth gradient from zenith to horizon.
 */
export function SkyGradient({ topColor, bottomColor, horizonColor, offset = 0 }) {
  const { scene } = useThree();

  const skyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(topColor) },
        bottomColor: { value: new THREE.Color(bottomColor) },
        horizonColor: { value: new THREE.Color(horizonColor || bottomColor) },
        offset: { value: offset },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 horizonColor;
        uniform float offset;
        varying vec3 vWorldPosition;

        void main() {
          // Normalize height to 0-1 range
          float h = normalize(vWorldPosition).y;

          // Create a smooth gradient with a wider horizon band
          float horizonFactor = 1.0 - smoothstep(-0.05, 0.4, h);
          float zenithFactor = smoothstep(0.0, 0.8, h);

          // Blend: bottom -> horizon -> top
          vec3 color = mix(bottomColor, horizonColor, horizonFactor);
          color = mix(color, topColor, zenithFactor);

          // Add subtle brightness at the horizon
          float horizonGlow = exp(-abs(h - 0.02) * 8.0) * 0.06;
          color += vec3(horizonGlow);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, [topColor, bottomColor, horizonColor, offset]);

  // Update uniforms when colors change without recreating
  useMemo(() => {
    skyMaterial.uniforms.topColor.value.set(topColor);
    skyMaterial.uniforms.bottomColor.value.set(bottomColor);
    skyMaterial.uniforms.horizonColor.value.set(horizonColor || bottomColor);
    skyMaterial.uniforms.offset.value = offset;
  }, [topColor, bottomColor, horizonColor, offset, skyMaterial]);

  return (
    <mesh renderOrder={-1000}>
      <sphereGeometry args={[4500, 32, 15]} />
      <primitive object={skyMaterial} attach="material" />
    </mesh>
  );
}
