import * as nbt from "prismarine-nbt";
import { Buffer } from "buffer";
import pako from "pako";

// Polyfill Buffer for browser
if (typeof window !== "undefined") {
  window.Buffer = Buffer;
}

export const parseLitematic = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Ungzip
  let unzipped;
  try {
    unzipped = pako.ungzip(buffer);
  } catch (e) {
    console.warn("File not gzipped, using raw buffer");
    unzipped = buffer;
  }

  const { parsed } = await nbt.parse(Buffer.from(unzipped));

  if (!parsed) throw new Error("Failed to parse NBT data");

  const regions = {};
  const metadata = parsed.value.Metadata?.value || {};
  const regionsTag = parsed.value.Regions?.value || {};

  for (const regionName in regionsTag) {
    const region = regionsTag[regionName].value;
    const rawSize = {
      x: region.Size.value.x.value,
      y: region.Size.value.y.value,
      z: region.Size.value.z.value,
    };

    // Calculate normalized origin and size
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
      const props = p.Properties ? p.Properties.value : {};
      return { name, props };
    });

    const blockStates = region.BlockStates ? region.BlockStates.value : null;

    // Decode blocks
    const blocks = [];

    if (palette.length > 0) {
      // Calculate bits per entry
      // For Litematica, it's strictly Ceil(Log2(PaletteSize))
      // But must be at least 1 bit if palette > 1.
      let bitsPerEntry = Math.max(1, Math.ceil(Math.log2(palette.length)));

      // Special case: Palette size 1 -> 0 bits per entry, no BlockStates needed.
      if (palette.length === 1) {
        for (let x = 0; x < size.x; x++) {
          for (let y = 0; y < size.y; y++) {
            for (let z = 0; z < size.z; z++) {
              // Check if air
              const state = palette[0];
              if (
                state.name !== "minecraft:air" &&
                state.name !== "minecraft:cave_air" &&
                state.name !== "minecraft:void_air"
              ) {
                blocks.push({ x, y, z, ...state });
              }
            }
          }
        }
      } else if (blockStates) {
        const data = blockStates;

        // Convert to BigInt array for consistency
        const longArray = data.map((l) => {
          if (typeof l === "bigint") return l;
          if (Array.isArray(l)) {
            // prismarine-nbt [high, low]
            return (BigInt(l[0]) << 32n) | BigInt(l[1] >>> 0);
          }
          // Fallback if it's a number (unlikely for longs > 53 bits but possible for small values)
          return BigInt(l);
        });

        const totalBlocks = size.x * size.y * size.z;
        const indices = new Int32Array(totalBlocks);

        // Determine packing strategy
        // Strategy A: 1.16+ (No crossing boundaries)
        // valuesPerLong = 64 / bitsPerEntry
        // expectedLongs = ceil(totalBlocks / valuesPerLong)

        // Strategy B: Tight packing (Crossing boundaries)
        // totalBits = totalBlocks * bitsPerEntry
        // expectedLongs = ceil(totalBits / 64)

        const valuesPerLong = Math.floor(64 / bitsPerEntry);
        const expectedLongs1_16 = Math.ceil(totalBlocks / valuesPerLong);
        const actualLongs = longArray.length;

        // Heuristic: If actualLongs matches 1.16+ expectation exactly, use it.
        // Otherwise use tight packing.
        // Note: Sometimes tight packing might coincide, but 1.16+ is safer default for modern files.
        // However, if actualLongs is drastically smaller, it must be tight packing.

        const is1_16 = actualLongs === expectedLongs1_16;
        const mask = (1n << BigInt(bitsPerEntry)) - 1n;

        let index = 0;

        if (is1_16) {
          for (let i = 0; i < longArray.length; i++) {
            let currentLong = longArray[i];
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
          // Tight packing implementation
          for (let i = 0; i < totalBlocks; i++) {
            const startBit = BigInt(i) * BigInt(bitsPerEntry);
            const startLongIndex = Number(startBit / 64n);
            const startOffset = Number(startBit % 64n);
            const endBit = startBit + BigInt(bitsPerEntry) - 1n;
            const endLongIndex = Number(endBit / 64n);

            if (startLongIndex >= longArray.length) {
              // Out of bounds, stop (should not happen if valid)
              break;
            }

            let val = longArray[startLongIndex] >> BigInt(startOffset);

            if (
              endLongIndex > startLongIndex &&
              endLongIndex < longArray.length
            ) {
              const bitsFromFirst = 64 - startOffset;
              const val2 = longArray[endLongIndex];
              val |= val2 << BigInt(bitsFromFirst);
            }

            indices[i] = Number(val & mask);
          }
        }

        // Map to blocks (YZX order)
        let idx = 0;
        for (let y = 0; y < size.y; y++) {
          for (let z = 0; z < size.z; z++) {
            for (let x = 0; x < size.x; x++) {
              if (idx < indices.length) {
                const paletteIndex = indices[idx++];
                const state = palette[paletteIndex];
                if (
                  state &&
                  state.name !== "minecraft:air" &&
                  state.name !== "minecraft:cave_air" &&
                  state.name !== "minecraft:void_air"
                ) {
                  blocks.push({
                    x: x,
                    y: y,
                    z: z,
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
};
