import * as THREE from "three";
import { LIGHTING_MODES, LIGHTING_PRESETS } from "./lightPresets";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mixHex(a, b, amount) {
  const colorA = new THREE.Color(a);
  const colorB = new THREE.Color(b);
  return colorA.lerp(colorB, clamp(amount, 0, 1)).getStyle();
}

export function getLightingState(mode = LIGHTING_MODES.game, timeOfDay = 12) {
  const preset = LIGHTING_PRESETS[mode] || LIGHTING_PRESETS[LIGHTING_MODES.game];
  const normalizedTime = ((timeOfDay % 24) + 24) % 24;
  const sunAngle = ((normalizedTime - 6) / 24) * Math.PI * 2;
  const daylight = clamp(Math.sin(sunAngle), 0, 1);
  const twilight = clamp(1 - Math.abs(normalizedTime - 18) / 4, 0, 1);
  const nightFactor = 1 - daylight;

  const skyBlend = mode === LIGHTING_MODES.night ? 0.15 : daylight * 0.75 + twilight * 0.2;
  const skyColor = mixHex(preset.skyTop, preset.skyBottom, 1 - skyBlend);
  const groundColor = mixHex("#2f3f25", "#141b28", 0.55 + nightFactor * 0.35);
  const fogColor = mixHex(preset.fogColor, "#0f1725", nightFactor * 0.45);

  const ambientIntensity = preset.ambientBase + daylight * preset.ambientRange;
  const hemisphereIntensity = preset.hemisphereBase + daylight * preset.hemisphereRange;
  const directionalIntensity =
    (preset.directionalBase + daylight * preset.directionalRange) *
    (daylight > 0 ? preset.shadowStrength : 1);

  const sunY = 8 + daylight * 20;
  const sunXZ = 18;
  const directionalPosition = [
    Math.cos(sunAngle) * sunXZ,
    sunY,
    Math.sin(sunAngle) * sunXZ,
  ];

  return {
    label: preset.label,
    description: preset.description,
    timeOfDay: normalizedTime,
    daylight,
    skyColor,
    groundColor,
    fogColor,
    ambientColor: mixHex("#f7f7ff", preset.warmTint, 0.35 + twilight * 0.25),
    ambientIntensity,
    hemisphereIntensity,
    directionalColor:
      daylight > 0
        ? mixHex(preset.coolTint, preset.warmTint, 0.45 + twilight * 0.45)
        : preset.coolTint,
    directionalIntensity,
    directionalPosition,
    shadowMapSize: preset.shadowMapSize,
    fogNear: 40,
    fogFar: mode === LIGHTING_MODES.cinematic ? 240 : 280,
    backgroundColor: skyColor,
  };
}
