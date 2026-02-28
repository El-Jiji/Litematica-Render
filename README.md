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
- Next.js 15 (App Router)
- React 19 y React DOM 19
- Three.js 0.182
- @react-three/fiber y @react-three/drei
- NBT 0.8 y Pako 2 (parseo y descompresión)
- ESLint 9 (calidad de código)

## Flujo general
1. Sincronizar assets oficiales y mapeo de texturas desde `.minecraft`.
2. Pre‐cargar `FULL_BLOCK_MAP` en `layout.jsx` antes de montar los componentes del cliente.
3. Parsear `.litematic` y agrupar bloques para instanciación.
4. Resolver datos de bloques con `ResourceManager`, que usa:
   - `AssetLoader` para obtener blockstates y modelos de Minecraft (mcmeta).
   - `BlockStateResolver` para elegir la variante correcta según las propiedades.
   - `GeometryBuilder` para construir la geometría del bloque y aplicar UVs.
   - `BlockMapper` como fallback para bloques no encontrados.
5. Renderizar con materiales optimizados en el cliente.

## Arquitectura
- App Router: Usa Next.js para el enrutamiento y SEO. La lógica principal reside en `src/app/page.jsx`.
- Parser NBT: lee paleta y posiciones desde el `.litematic`, construye grupos de bloques (name + positions). Referencia: [litematicParser.js](file:///c:/Users/User/Desktop/Litematica%20Render/Litematica-Render/src/utils/litematicParser.js)
- Viewer: componente de cliente que gestiona la escena 3D, instanced meshes y controles de UI. Referencia: [Viewer.jsx](file:///c:/Users/User/Desktop/Litematica%20Render/Litematica-Render/src/components/Viewer.jsx)

## Sincronización de assets oficiales
El script copia texturas desde tu instalación de Minecraft y genera un `block_textures_map.json` con rutas normalizadas a `/mc/textures/block/...`.

- Script: [scripts/sync-minecraft-assets.mjs](file:///c:/Users/User/Desktop/Litematica%20Render/Litematica-Render/scripts/sync-minecraft-assets.mjs)
- Ajusta `SRC_MC` según tu versión/carpeta de `.minecraft` en el script.
- Ejecuta:

```bash
npm run sync:mc
```

Esto produce:
- `public/mc/textures/block/*` (PNG oficiales)
- `public/mc/block_textures_map.json` (mapeo global por bloque/cara)

## Desarrollo
Requisitos: Node.js 18+ recomendado.

Instalación y ejecución:
```bash
npm install
npm run sync:mc      # sincroniza assets desde .minecraft (ajusta la ruta en el script)
npm run dev          # servidor de desarrollo (Next.js)
```

## Comandos
- `npm run dev`: servidor de desarrollo
- `npm run build`: build de producción
- `npm run start`: inicia el servidor con el build de producción
- `npm run lint`: análisis estático con ESLint
- `npm run sync:mc`: sincroniza texturas y genera mapeo global desde `.minecraft`

## Estructura relevante
- `src/app/page.jsx`: Página principal de la aplicación.
- `src/components/Viewer.jsx`: escena 3D, materiales y controles.
- `src/utils/litematicParser.js`: parser NBT de `.litematic`.
- `src/utils/BlockMapper.js`: mapeo oficial y base por bloque.
- `src/assets/block_mapping.json`: mapeo estático por bloque/cara.
