import * as nbt from "prismarine-nbt";
import fs from "fs";
import pako from "pako";
import { promisify } from "util";

const parseNbt = promisify(nbt.parse);

async function debugFile() {
  const filePath = "./debug.litematic";

  if (!fs.existsSync(filePath)) {
    console.error(
      "No se encontró el archivo 'debug.litematic'. Por favor coloca el archivo en la raíz del proyecto con ese nombre.",
    );
    return;
  }

  const buffer = fs.readFileSync(filePath);

  let unzipped;
  try {
    unzipped = pako.ungzip(buffer);
  } catch (e) {
    console.log("No es GZIP, usando raw buffer");
    unzipped = buffer;
  }

  try {
    const { parsed } = await nbt.parse(Buffer.from(unzipped));
    console.log("Root keys:", Object.keys(parsed.value));

    if (parsed.value.Metadata) {
      console.log("Metadata keys:", Object.keys(parsed.value.Metadata.value));
    } else {
      console.log("Metadata tag missing");
    }

    if (parsed.value.Regions) {
      const regions = parsed.value.Regions.value;
      console.log("Regions found:", Object.keys(regions));

      for (const regionName in regions) {
        console.log(`\n--- Inspecting Region: ${regionName} ---`);
        const region = regions[regionName].value;
        console.log("Region keys:", Object.keys(region));

        console.log("Checking Size...");
        if (region.Size) {
          console.log("Size type:", region.Size.type);
          console.log("Size value:", region.Size.value);
          if (region.Size.value && typeof region.Size.value === "object") {
            console.log("Size contents:", region.Size.value);
          }
        } else {
          console.log("Size is MISSING");
        }

        console.log("Checking Position...");
        if (region.Position) {
          console.log("Position value:", region.Position.value);
        } else {
          console.log("Position is MISSING");
        }

        console.log("Checking Palette...");
        if (region.Palette) {
          console.log("Palette length:", region.Palette.value.value.length);
          // Check first item
          if (region.Palette.value.value.length > 0) {
            console.log(
              "First palette item:",
              JSON.stringify(
                region.Palette.value.value[0],
                (key, value) =>
                  typeof value === "bigint" ? value.toString() : value,
                2,
              ),
            );
          }
        } else {
          console.log("Palette is MISSING");
        }

        console.log("Checking BlockStates...");
        if (region.BlockStates) {
          console.log("BlockStates type:", region.BlockStates.type);
          console.log("BlockStates length:", region.BlockStates.value.length);
        } else {
          console.log(
            "BlockStates is MISSING (might be empty region or palette size 1)",
          );
        }
      }
    } else {
      console.log("Regions tag missing");
    }
  } catch (err) {
    console.error("Error parsing NBT:", err);
  }
}

debugFile();
