
// Mock text index for the test
const textureIndexRaw = `
acacia_log
acacia_log_top
stone
dirt
grass_block_top
grass_block_side
oak_planks
`;
const textureList = textureIndexRaw.split(/\n/).map(s => s.trim()).filter(Boolean);
const textureSet = new Set(textureList);

function hasTexture(b) {
  return textureSet.has(b);
}

// Mock blockTextures map (partial)
const blockTextures = {
  "minecraft:grass_block": {
    top: "grass_block_top.png",
    bottom: "dirt.png",
    side: "grass_block_side.png",
  }
};

function pickCandidate(name, face, initial) {
  let base = (initial || name).replace(/\.png$/, "");
  const c = [];
  c.push(base);
  if (face && !base.endsWith("_" + face)) c.unshift(`${name}_${face}`);
  
  // Logic from blockTextures.js
  if (base.endsWith("_brick")) c.push(base + "s");
  
  for (let i = 0; i < c.length; i++) {
     // console.log(`Checking ${c[i]}`);
    if (hasTexture(c[i])) return c[i] + ".png";
  }
  return base + ".png";
}

function getTextureUrl(blockName, face = "side") {
  const definition = blockTextures[blockName];

  let filename;
  if (typeof definition === "string") {
    filename = definition;
  } else if (typeof definition === "object") {
    filename = definition[face] || definition.side || definition.top; 
  }

  if (!filename) {
    const name = blockName.replace("minecraft:", "");
    // Simplification of the logic in blockTextures.js for testing
    // ... (omitting full copy for brevity, just testing core logic)
     const MULTI_FACE_BLOCKS = new Set([
      "grass_block",
      "acacia_log"
    ]);

    if (MULTI_FACE_BLOCKS.has(name)) {
      const suffix = face && typeof face === "string" ? `_${face}` : "";
      filename = `${name}${suffix}.png`;
    } else {
        filename = `${name}.png`;
    }
  }

  const finalFile = pickCandidate(blockName.replace("minecraft:", ""), face, filename);
  return finalFile;
}

// Test cases
console.log("grass_block top:", getTextureUrl("minecraft:grass_block", "top"));
console.log("unknown_block side:", getTextureUrl("minecraft:unknown_block", "side"));
console.log("acacia_log top:", getTextureUrl("minecraft:acacia_log", "top"));
