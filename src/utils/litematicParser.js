import nbt from "nbt";
import pako from "pako";

export const parseLitematic = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Ungzip
  let unzipped;
  try {
    unzipped = pako.ungzip(uint8Array);
  } catch {
    console.warn("File not gzipped, using raw buffer");
    unzipped = uint8Array;
  }

  // Use nbt.parseUncompressed to parse the data.
  // It returns { name, value } where value is the root compound.
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

    // nbt (standard) uses nested { type, value } for lists
    // paletteTag.value is { type: 'compound', value: [...] }
    const palette = paletteTag.value.value.map((p) => {
      const name = p.Name.value;
      const props = p.Properties?.value || {};
      // Simplify properties
      const simpleProps = {};
      for (const propName in props) {
        simpleProps[propName] = props[propName].value;
      }
      return { name, props: simpleProps };
    });

    const blockStates = region.BlockStates?.value || null;

    // Decode blocks
    const blocks = [];

    if (palette.length > 0) {
      // Calculate bits per entry
      let bitsPerEntry = Math.max(1, Math.ceil(Math.log2(palette.length)));

      // Special case: Palette size 1 -> 0 bits per entry, no BlockStates needed.
      if (palette.length === 1) {
        const state = palette[0];
        if (
          state.name !== "minecraft:air" &&
          state.name !== "minecraft:cave_air" &&
          state.name !== "minecraft:void_air"
        ) {
          for (let x = 0; x < size.x; x++) {
            for (let y = 0; y < size.y; y++) {
              for (let z = 0; z < size.z; z++) {
                blocks.push({ x, y, z, ...state });
              }
            }
          }
        }
      } else if (blockStates) {
        // nbt.js handles longs as [upper, lower] 32-bit integers
        const longArray = blockStates.map((l) => {
          if (Array.isArray(l)) {
            // Combine high and low 32-bit integers into a 64-bit BigInt
            // We use >>> 0 on low bit to ensure it's treated as unsigned
            return (BigInt(l[0]) << 32n) | BigInt(l[1] >>> 0);
          }
          return BigInt(l);
        });

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

            if (startLongIndex >= longArray.length) break;

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
};
