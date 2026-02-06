# Litematica Render

Renderizador web de esquemas `.litematic` (Minecraft) con texturas oficiales, usando React Three Fiber y mapeo de rutas sincronizado desde la carpeta `.minecraft`. Diseñado para renderizar grandes builds de forma eficiente mediante instanced meshes y selección de texturas por cara del bloque.

## Características
- Carga y parseo de archivos `.litematic` (formato NBT) directamente en el navegador.
- Renderizado con Three.js y React Three Fiber, usando instanced meshes para alto rendimiento.
- Uso de texturas oficiales de Minecraft sincronizadas localmente.
- Resolución de textura por cara del bloque (top/bottom/side/north/south/east/west).
- Pre‐carga de un mapeo global de texturas (`FULL_BLOCK_MAP`) generado desde `.minecraft`.
- Sistema de fallbacks inteligente para nombres alternativos y estados de bloque.
- Filtros de visualización: wireframe, rayos X, límite por capas, animación “build up”.

## Tecnologías y librerías
- Vite 7 (dev server y bundling)
- React 19 y React DOM 19
- Three.js 0.182
- @react-three/fiber y @react-three/drei
- NBT 0.8 y Pako 2 (parseo y descompresión)
- ESLint 9 (calidad de código)

## Flujo general
1. Sincronizar assets oficiales y mapeo de texturas desde `.minecraft`.
2. Pre‐cargar `FULL_BLOCK_MAP` en `index.html` antes de montar React.
3. Parsear `.litematic` y agrupar bloques para instanciación.
4. Resolver URL de texturas con `getTextureUrl`, que usa:
   - `FULL_BLOCK_MAP` (si existe)
   - Mapeo base estático (`block_mapping.json`)
   - Índice real de texturas (`blocknombres_texturas.txt`)
   - Reglas de fallback y normalización
5. Renderizar con materiales por cara (top, bottom, side).

## Arquitectura
- Parser NBT: lee paleta y posiciones desde el `.litematic`, construye grupos de bloques (name + positions). Referencia: [litematicParser.js](file:///c:/Users/diego/OneDrive/Desktop/Litematica_Render/Litematica-Render/src/utils/litematicParser.js)
- Viewer: genera instanced meshes por tipo de bloque, calcula materiales por cara, y maneja controles/UI. Referencia: [Viewer.jsx](file:///c:/Users/diego/OneDrive/Desktop/Litematica_Render/Litematica-Render/src/components/Viewer.jsx)
- Selección de textura:
  - `BlockMapper` usa el mapeo global `FULL_BLOCK_MAP` si existe, y si no cae al mapeo base. Referencia: [BlockMapper.js](file:///c:/Users/diego/OneDrive/Desktop/Litematica_Render/Litematica-Render/src/utils/BlockMapper.js)
  - `blockTextures.js` es el núcleo de la resolución de URLs: normaliza nombres, consulta el índice de archivos, prueba candidatos por cara y aplica fallbacks para nombres no estándar. Referencia: [blockTextures.js](file:///c:/Users/diego/OneDrive/Desktop/Litematica_Render/Litematica-Render/src/utils/blockTextures.js)
- Mapeo base: `src/assets/block_mapping.json` contiene reglas por bloque y por cara (top/bottom/side, etc.). Referencia: [block_mapping.json](file:///c:/Users/diego/OneDrive/Desktop/Litematica_Render/Litematica-Render/src/assets/block_mapping.json)
- Índice de texturas: `blocknombres_texturas.txt` lista los archivos reales disponibles (sin extensión) para ayudar a validar rutas. Referencia: [blocknombres_texturas.txt](file:///c:/Users/diego/OneDrive/Desktop/Litematica_Render/Litematica-Render/blocknombres_texturas.txt)

## Sincronización de assets oficiales
El script copia texturas desde tu instalación de Minecraft y genera un `block_textures_map.json` con rutas normalizadas a `/mc/textures/block/...`.

- Script: [scripts/sync-minecraft-assets.mjs](file:///c:/Users/diego/OneDrive/Desktop/Litematica_Render/Litematica-Render/scripts/sync-minecraft-assets.mjs)
- Ajusta `SRC_MC` según tu versión/carpeta de `.minecraft` en el script.
- Ejecuta:

```bash
npm run sync:mc
```

Esto produce:
- `public/mc/textures/block/*` (PNG oficiales)
- `public/mc/block_textures_map.json` (mapeo global por bloque/cara)

## Pre‐carga del mapeo global
`index.html` carga `block_textures_map.json` antes de React y lo expone como `globalThis.FULL_BLOCK_MAP`:

- Referencia: [index.html](file:///c:/Users/diego/OneDrive/Desktop/Litematica_Render/Litematica-Render/index.html)

## Resolución de texturas
`getTextureUrl(name, face, props)` realiza:
- Uso directo de rutas absolutas del mapeo global (si ya vienen como `/mc/textures/block/...`).
- Resolución mediante índice de archivos y candidatos por cara (`_top`, `_bottom`, `_side`).
- Fallbacks para casos comunes:
  - fluidos (water_top → water_still)
  - fuego (fire_* → fire_0; soul_fire_* → soul_fire_0)
  - barreras/luz/void → glass
  - metales singulares → `*_block`
  - corales de pared → `*_coral_fan`
  - cultivos a etapa madura (potatoes → potatoes_stage3, wheat → wheat_stage7, etc.)
  - especiales (redstone_wire → redstone_dust_line0, moving_piston → piston_top, etc.)

## Desarrollo
Requisitos: Node.js 18+ recomendado.

Instalación y ejecución:
```bash
npm install
npm run sync:mc      # sincroniza assets desde .minecraft (ajusta la ruta en el script)
npm run dev          # servidor de desarrollo (Vite)
```

Variables de entorno (opcional):
- `VITE_TEXTURES_BASE`: cambia el prefijo de texturas si no usas `/mc/textures/block/`.

## Comandos
- `npm run dev`: servidor de desarrollo
- `npm run build`: build de producción
- `npm run preview`: servidor de preview sobre el build
- `npm run lint`: análisis estático con ESLint
- `npm run sync:mc`: sincroniza texturas y genera mapeo global desde `.minecraft`

## Estructura relevante
- `src/components/Viewer.jsx`: escena 3D, materiales y controles.
- `src/utils/litematicParser.js`: parser NBT de `.litematic`.
- `src/utils/blockTextures.js`: resolución de URLs de textura.
- `src/utils/BlockMapper.js`: mapeo oficial y base por bloque.
- `src/assets/block_mapping.json`: mapeo estático por bloque/cara.
- `public/mc/*`: assets oficiales sincronizados.
- `blocknombres_texturas.txt`: índice de nombres de textura presentes.

## Limitaciones y notas
- Agrupación por “name” ignora propiedades (e.g. orientación de logs) cuando varias variantes coexisten en el mismo grupo. Un futuro refactor debería agrupar por “name + clave única de textura”.
- Algunos nombres “no estándar” (p. ej. `jack_o_top`) requieren fallbacks; el mapeo oficial suele ser preferible si está presente.
- Transparencias se manejan con alphaTest y materiales double‐sided para panes/hojas/plantas; algunos casos pueden requerir ajustes finos.

## Roadmap
- Agrupación por textura efectiva para distinguir variantes en instanced meshes.
- Mejora de soporte para bloques con geometría no cúbica (slabs, stairs) usando geometrías dedicadas.
- Generación automática del índice `blocknombres_texturas.txt` a partir de `public/mc`.

## Créditos
- Mojang/Microsoft: assets y formatos de Minecraft.
- Ecosistema React/Three: @react-three/fiber, @react-three/drei.

