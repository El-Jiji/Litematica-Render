import { parseAndProcessLitematic } from "../utils/scenePreprocessor";

self.onmessage = async (event) => {
  const { type, arrayBuffer, options } = event.data || {};

  if (type !== "parse-litematic") {
    return;
  }

  try {
    self.postMessage({
      type: "progress",
      stage: "Analizando esquema",
      progress: 18,
    });

    const processed = await parseAndProcessLitematic(arrayBuffer, options);

    self.postMessage({
      type: "progress",
      stage: "Preparando chunks",
      progress: 78,
    });

    self.postMessage({
      type: "complete",
      data: processed,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error?.message || String(error),
    });
  }
};
