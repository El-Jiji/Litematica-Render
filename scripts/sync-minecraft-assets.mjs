import fs from 'fs';
import path from 'path';

const SRC_MC = 'C:/Users/diego/AppData/Roaming/.minecraft/versions/1.21.11/1.21.11/assets/minecraft';
const DEST = path.resolve('./public/mc');
const SRC_JSON = path.join(SRC_MC, 'block_textures_map.json');
const SRC_TEX = path.join(SRC_MC, 'textures', 'block');

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
function rewritePaths(map) {
  const out = {};
  for (const k of Object.keys(map)) {
    const v = map[k];
    const o = {};
    for (const key of Object.keys(v)) {
      const val = v[key];
      if (Array.isArray(val)) {
        o[key] = val.map((x) => (typeof x === 'string' ? x.replace(/^textures\/block\//, '/mc/textures/block/') : x));
      } else if (typeof val === 'string') {
        o[key] = val.replace(/^textures\/block\//, '/mc/textures/block/');
      } else {
        const inner = {};
        for (const kk of Object.keys(val)) {
          const vv = val[kk];
          inner[kk] = typeof vv === 'string' ? vv.replace(/^textures\/block\//, '/mc/textures/block/') : vv;
        }
        o[key] = inner;
      }
    }
    out[k] = o;
  }
  return out;
}
function main() {
  ensureDir(DEST);
  const raw = fs.readFileSync(SRC_JSON, 'utf8');
  const map = JSON.parse(raw);
  const rewritten = rewritePaths(map);
  fs.writeFileSync(path.join(DEST, 'block_textures_map.json'), JSON.stringify(rewritten));
  copyDir(SRC_TEX, path.join(DEST, 'textures', 'block'));
  console.log('Synced Minecraft assets to', DEST);
}
main();
