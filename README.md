# Litematica Render

Renderizador web de esquemas `.litematic` para Minecraft, construido con Next.js, React Three Fiber y Three.js.

## Caracteristicas

- Carga y parseo de archivos `.litematic` directamente en el navegador.
- Renderizado 3D con chunks progresivos para mejorar la percepcion de carga.
- Culling de caras internas para reducir geometria y mejorar FPS en builds grandes.
- Lista de materiales, presets de camara, captura de pantalla y animacion de construccion.
- Pipeline de assets con prioridad local: atlas, UVs, modelos y blockstates servidos desde `public/mc/render-assets` con fallback remoto.

## Stack

- Next.js 15
- React 19
- Three.js
- `@react-three/fiber`
- `@react-three/drei`
- `nbt`
- `pako`

## Flujo general

1. El usuario sube un archivo `.litematic`.
2. Un Web Worker parsea el NBT y preprocesa la escena.
3. El preprocesado calcula bounds, chunks, materiales y caras visibles.
4. El viewer resuelve blockstates/modelos, construye geometrias y renderiza la escena.

## Assets de render

Los assets usados por el renderer viven en:

- `public/mc/render-assets/blockstates.min.json`
- `public/mc/render-assets/models.min.json`
- `public/mc/render-assets/atlas-uv.min.json`
- `public/mc/render-assets/atlas.png`

El mapeo de texturas sincronizado desde `.minecraft` sigue disponible en:

- `public/mc/block_textures_map.json`
- `public/mc/textures/block/*`

## Desarrollo

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev`: desarrollo
- `npm run build`: build de produccion
- `npm run start`: correr el build
- `npm run lint`: lint con ESLint CLI
- `npm run sync:mc`: sincroniza texturas y genera el mapeo desde `.minecraft`

## Estructura relevante

- `src/app/page.jsx`: entrada principal y flujo de carga del archivo
- `src/components/Viewer.jsx`: escena 3D y controles
- `src/utils/scenePreprocessor.js`: chunking, materiales y culling
- `src/utils/litematicParserCore.js`: parseo NBT de `.litematic`
- `src/utils/engine/*`: loader de assets, resolucion de blockstates y construccion de geometria
