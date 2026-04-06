import nbt from "nbt";
import pako from "pako";

const AIR_BLOCKS = new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air",
]);

const LONG_BITS = 64n;

function toUnsignedLong(value) {
  if (Array.isArray(value)) {
    const upper = BigInt(value[0] >>> 0);
    const lower = BigInt(value[1] >>> 0);
    return BigInt.asUintN(64, (upper << 32n) | lower);
  }

  return BigInt.asUintN(64, BigInt(value));
}

export function parseLitematicBuffer(arrayBuffer) {
  const uint8Array = new Uint8Array(arrayBuffer);

  let unzipped;
  try {
    unzipped = pako.ungzip(uint8Array);
  } catch {
    console.warn("File not gzipped, using raw buffer");
    unzipped = uint8Array;
  }

  const { value: parsed } = nbt.parseUncompressed(unzipped.buffer);

  if (!parsed) throw new Error("Failed to parse NBT data");

  const regions = {};
  const metadata = parsed.Metadata?.value || {};
  const regionsTag = parsed.Regions?.value || {};

  for (const regionName in regionsTag) {
    const region = regionsTag[regionName].value;
    const rawSize = {
      x: region.Size.value.x.value,
      y: region.Size.value.y.value,
      z: region.Size.value.z.value,
    };

    const size = {
      x: Math.abs(rawSize.x),
      y: Math.abs(rawSize.y),
      z: Math.abs(rawSize.z),
    };

    const position = {
      x: region.Position.value.x.value + (rawSize.x < 0 ? rawSize.x + 1 : 0),
      y: region.Position.value.y.value + (rawSize.y < 0 ? rawSize.y + 1 : 0),
      z: region.Position.value.z.value + (rawSize.z < 0 ? rawSize.z + 1 : 0),
    };

    const paletteTag = region.BlockStatePalette || region.Palette;

    if (!paletteTag) {
      console.warn(`Region ${regionName} has no palette, skipping`);
      continue;
    }

    const palette = paletteTag.value.value.map((p) => {
      const name = p.Name.value;
      const props = p.Properties?.value || {};
      const simpleProps = {};
      for (const propName in props) {
        simpleProps[propName] = props[propName].value;
      }
      return { name, props: simpleProps };
    });

    const blockStates = region.BlockStates?.value || null;
    const blocks = [];

    if (palette.length > 0) {
      const bitsPerEntry = Math.max(1, Math.ceil(Math.log2(palette.length)));

      if (palette.length === 1) {
        const state = palette[0];
        if (!AIR_BLOCKS.has(state.name)) {
          for (let x = 0; x < size.x; x++) {
            for (let y = 0; y < size.y; y++) {
              for (let z = 0; z < size.z; z++) {
                blocks.push({ x, y, z, ...state });
              }
            }
          }
        }
      } else if (blockStates) {
        const longArray = blockStates.map(toUnsignedLong);

        const totalBlocks = size.x * size.y * size.z;
        const indices = new Int32Array(totalBlocks);

        const valuesPerLong = Math.floor(64 / bitsPerEntry);
        const expectedLongs1_16 = Math.ceil(totalBlocks / valuesPerLong);
        const actualLongs = longArray.length;
        const is1_16 = actualLongs === expectedLongs1_16;
        const mask = (1n << BigInt(bitsPerEntry)) - 1n;

        let index = 0;

        if (is1_16) {
          for (let i = 0; i < longArray.length; i++) {
            const currentLong = longArray[i];
            for (
              let bit = 0;
              bit < valuesPerLong && index < totalBlocks;
              bit++
            ) {
              const shift = BigInt(bit * bitsPerEntry);
              const val = (currentLong >> shift) & mask;
              indices[index++] = Number(val);
            }
          }
        } else {
          for (let i = 0; i < totalBlocks; i++) {
            const startBit = BigInt(i) * BigInt(bitsPerEntry);
            const startLongIndex = Number(startBit / 64n);
            const startOffset = Number(startBit % 64n);
            const endBit = startBit + BigInt(bitsPerEntry) - 1n;
            const endLongIndex = Number(endBit / LONG_BITS);

            if (startLongIndex >= longArray.length) break;

            let val = BigInt.asUintN(
              64,
              longArray[startLongIndex] >> BigInt(startOffset),
            );

            if (
              endLongIndex > startLongIndex &&
              endLongIndex < longArray.length
            ) {
              const bitsFromFirst = 64 - startOffset;
              const val2 = BigInt.asUintN(
                64,
                longArray[endLongIndex] << BigInt(bitsFromFirst),
              );
              val = BigInt.asUintN(64, val | val2);
            }

            indices[i] = Number(val & mask);
          }
        }

        let idx = 0;
        for (let y = 0; y < size.y; y++) {
          for (let z = 0; z < size.z; z++) {
            for (let x = 0; x < size.x; x++) {
              if (idx < indices.length) {
                const paletteIndex = indices[idx++];
                const state = palette[paletteIndex];
                if (state && !AIR_BLOCKS.has(state.name)) {
                  blocks.push({
                    x,
                    y,
                    z,
                    name: state.name,
                    props: state.props,
                  });
                }
              }
            }
          }
        }
      }
    }

    regions[regionName] = {
      size,
      position,
      blocks,
    };
  }

  return { metadata, regions };
}

