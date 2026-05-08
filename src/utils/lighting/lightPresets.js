export const LIGHTING_MODES = {
  game: "game",
  cinematic: "cinematic",
  night: "night",
};

export const LIGHTING_MODE_OPTIONS = [
  { value: LIGHTING_MODES.game, label: "Juego" },
  { value: LIGHTING_MODES.cinematic, label: "Cinematica" },
  { value: LIGHTING_MODES.night, label: "Noche" },
];

export const LIGHTING_PRESETS = {
  [LIGHTING_MODES.game]: {
    label: "Juego",
    description: "Iluminación estilo BlueMap, clara y natural.",
    // Sky gradient colors (zenith -> horizon)
    skyTop: "#5b9bd5",
    skyBottom: "#c0daf0",
    fogColor: "#b8d4eb",
    // Stronger ambient for flatter look (BlueMap relies on baked AO, not dynamic shadows)
    ambientBase: 0.72,
    ambientRange: 0.18,
    hemisphereBase: 0.55,
    hemisphereRange: 0.15,
    // Softer directional (AO + face shading does the heavy lifting)
    directionalBase: 0.5,
    directionalRange: 0.35,
    shadowStrength: 0.85,
    warmTint: "#fff5dd",
    coolTint: "#d4e8ff",
    shadowMapSize: 2048,
  },
  [LIGHTING_MODES.cinematic]: {
    label: "Cinematica",
    description: "Mas contraste y profundidad para capturas.",
    skyTop: "#4a7ec2",
    skyBottom: "#f0c896",
    fogColor: "#d9b99f",
    ambientBase: 0.45,
    ambientRange: 0.18,
    hemisphereBase: 0.4,
    hemisphereRange: 0.15,
    directionalBase: 0.7,
    directionalRange: 0.5,
    shadowStrength: 1.0,
    warmTint: "#ffd59a",
    coolTint: "#9cc7ff",
    shadowMapSize: 2048,
  },
  [LIGHTING_MODES.night]: {
    label: "Noche",
    description: "Ambiente nocturno visible, sin perder lectura.",
    skyTop: "#0a1225",
    skyBottom: "#1a2a44",
    fogColor: "#141e34",
    ambientBase: 0.2,
    ambientRange: 0.08,
    hemisphereBase: 0.22,
    hemisphereRange: 0.06,
    directionalBase: 0.18,
    directionalRange: 0.15,
    shadowStrength: 0.45,
    warmTint: "#aac8ff",
    coolTint: "#5d83c8",
    shadowMapSize: 1024,
  },
};
