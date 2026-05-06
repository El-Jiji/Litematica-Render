"use client";

import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Upload } from "../components/Upload";
import { SocialLinks } from "../components/SocialLinks";
import styles from "./page.module.css";

const MAX_LITEMATIC_FILE_SIZE_MB = 128;
const MAX_LITEMATIC_FILE_SIZE_BYTES = MAX_LITEMATIC_FILE_SIZE_MB * 1024 * 1024;
const Viewer = dynamic(
  () => import("../components/Viewer").then((module) => module.Viewer),
  {
    ssr: false,
  },
);

export default function Home() {
  const [primaryData, setPrimaryData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [loadingState, setLoadingState] = useState({
    active: false,
    stage: "En espera",
    progress: 0,
    target: "primary",
  });
  const [error, setError] = useState(null);
  const workerRef = useRef(null);
  const compareInputRef = useRef(null);

  const validateFile = (file) => {
    if (!file) {
      throw new Error("No se selecciono ningun archivo.");
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".litematic")) {
      throw new Error("Solo se permiten archivos .litematic.");
    }

    if (file.size > MAX_LITEMATIC_FILE_SIZE_BYTES) {
      throw new Error(
        `El archivo supera el limite recomendado de ${MAX_LITEMATIC_FILE_SIZE_MB} MB.`,
      );
    }
  };

  const applyParsedData = (target, parsedData) => {
    if (target === "comparison") {
      setComparisonData(parsedData);
      return;
    }

    setPrimaryData(parsedData);
  };

  const handleFileLoaded = async (file, target = "primary") => {
    try {
      setError(null);
      validateFile(file);
      setLoadingState({
        active: true,
        stage: "Leyendo archivo",
        progress: 6,
        target,
      });

      if (typeof Worker !== "undefined") {
        workerRef.current?.terminate?.();
        const worker = new Worker(
          new URL("../workers/litematicWorker.js", import.meta.url),
          { type: "module" },
        );
        workerRef.current = worker;

        const arrayBuffer = await file.arrayBuffer();

        await new Promise((resolve, reject) => {
          worker.onmessage = (event) => {
            const message = event.data || {};

            if (message.type === "progress") {
              setLoadingState({
                active: true,
                stage: message.stage || "Procesando",
                progress: message.progress || 0,
                target,
              });
              return;
            }

            if (message.type === "complete") {
              applyParsedData(target, message.data);
              setLoadingState({
                active: false,
                stage: "Completado",
                progress: 100,
                target,
              });
              resolve();
              return;
            }

            if (message.type === "error") {
              reject(new Error(message.error || "El worker fallo"));
            }
          };

          worker.onerror = (event) => {
            reject(event.error || new Error("El worker se detuvo"));
          };

          worker.postMessage(
            {
              type: "parse-litematic",
              arrayBuffer,
              options: { chunkSize: 16 },
            },
            [arrayBuffer],
          );
        });
      } else {
        const { parseLitematic } = await import("../utils/litematicParser");
        const parsedData = await parseLitematic(file, { chunkSize: 16 });
        applyParsedData(target, parsedData);
        setLoadingState({
          active: false,
          stage: "Completado",
          progress: 100,
          target,
        });
      }
    } catch (err) {
      console.error(err);
      setError(`Error al leer el archivo: ${err.message || err}`);
      setLoadingState({
        active: false,
        stage: "Error",
        progress: 0,
        target,
      });
    } finally {
      workerRef.current?.terminate?.();
      workerRef.current = null;
    }
  };

  const handleReset = (target = "primary") => {
    workerRef.current?.terminate?.();
    workerRef.current = null;
    if (target === "comparison") {
      setComparisonData(null);
    } else {
      setPrimaryData(null);
      setComparisonData(null);
    }
    setError(null);
    setLoadingState({
      active: false,
      stage: "En espera",
      progress: 0,
      target: "primary",
    });
  };

  const handleComparisonFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleFileLoaded(file, "comparison");
      event.target.value = "";
    }
  };

  const hasComparison = Boolean(comparisonData);
  const hasPrimary = Boolean(primaryData);

  return (
    <div className={styles.page}>
      {loadingState.active && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingStage}>
            {loadingState.target === "comparison"
              ? `Comparando: ${loadingState.stage}`
              : loadingState.stage}
          </div>
          <div className={styles.loadingBar}>
            <div
              className={styles.loadingBarFill}
              style={{ width: `${loadingState.progress}%` }}
            />
          </div>
          <div className={styles.loadingPercent}>
            {Math.round(loadingState.progress)}%
          </div>
        </div>
      )}

      {!hasPrimary ? (
        <>
          <Upload onFileLoaded={(file) => handleFileLoaded(file, "primary")} />
          {error && <div className={styles.errorToast}>{error}</div>}
        </>
      ) : (
        <>
          <div
            className={styles.viewerGrid}
            style={{ gridTemplateColumns: hasComparison ? "1fr 1fr" : "1fr" }}
          >
            <div className={styles.viewerCell}>
              <Viewer
                data={primaryData}
                title="Archivo principal"
                comparisonMode={hasComparison}
              />
            </div>
            {hasComparison && (
              <div className={`${styles.viewerCell} ${styles.viewerCellCompare}`}>
                <Viewer
                  data={comparisonData}
                  title="Archivo de comparacion"
                  comparisonMode
                />
              </div>
            )}
          </div>
          <div className={styles.topActions}>
            {!hasComparison && (
              <>
                <input
                  ref={compareInputRef}
                  type="file"
                  accept=".litematic"
                  onChange={handleComparisonFileChange}
                  className={styles.hiddenInput}
                />
                <button
                  onClick={() => compareInputRef.current?.click()}
                  className={styles.secondaryButton}
                >
                  Comparar otro archivo
                </button>
              </>
            )}
            {hasComparison && (
              <button
                onClick={() => handleReset("comparison")}
                className={styles.secondaryButton}
              >
                Cerrar comparacion
              </button>
            )}
            <button
              onClick={() => handleReset("primary")}
              className={styles.primaryButton}
            >
              Subir otro archivo
            </button>
          </div>
        </>
      )}

      <SocialLinks className="floating-social-links" />
    </div>
  );
}
