import { parseAndProcessLitematic } from "./scenePreprocessor";

export async function parseLitematic(file, options) {
  const arrayBuffer = await file.arrayBuffer();
  return parseAndProcessLitematic(arrayBuffer, options);
}

