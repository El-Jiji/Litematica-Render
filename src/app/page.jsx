"use client";

import React, { useRef, useState } from "react";
import { Upload } from "../components/Upload";
import { Viewer } from "../components/Viewer";
import { SocialLinks } from "../components/SocialLinks";
import { parseLitematic } from "../utils/litematicParser";

export default function Home() {
  const [data, setData] = useState(null);
  const [loadingState, setLoadingState] = useState({
    active: false,
    stage: "Waiting",
    progress: 0,
  });
  const [error, setError] = useState(null);
  const workerRef = useRef(null);

  const handleFileLoaded = async (file) => {
    setError(null);
    setLoadingState({
      active: true,
      stage: "Reading file",
      progress: 6,
    });

    try {
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
                stage: message.stage || "Processing",
                progress: message.progress || 0,
              });
              return;
            }

            if (message.type === "complete") {
              setData(message.data);
              setLoadingState({
                active: false,
                stage: "Complete",
                progress: 100,
              });
              resolve();
              return;
            }

            if (message.type === "error") {
              reject(new Error(message.error || "Worker failed"));
            }
          };

          worker.onerror = (event) => {
            reject(event.error || new Error("Worker crashed"));
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
        const parsedData = await parseLitematic(file, { chunkSize: 16 });
        setData(parsedData);
        setLoadingState({
          active: false,
          stage: "Complete",
          progress: 100,
        });
      }
    } catch (err) {
      console.error(err);
      setError(`Error al leer el archivo: ${err.message || err}`);
      setLoadingState({
        active: false,
        stage: "Error",
        progress: 0,
      });
    } finally {
      workerRef.current?.terminate?.();
      workerRef.current = null;
    }
  };

  const handleReset = () => {
    workerRef.current?.terminate?.();
    workerRef.current = null;
    setData(null);
    setError(null);
    setLoadingState({
      active: false,
      stage: "Waiting",
      progress: 0,
    });
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      {loadingState.active && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            color: "white",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "1rem" }}>{loadingState.stage}</div>
          <div
            style={{
              width: "min(360px, calc(100vw - 64px))",
              height: "8px",
              background: "rgba(255,255,255,0.12)",
              borderRadius: "999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${loadingState.progress}%`,
                height: "100%",
                background:
                  "linear-gradient(90deg, rgba(63,118,228,1) 0%, rgba(121,195,255,1) 100%)",
              }}
            />
          </div>
          <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
            {Math.round(loadingState.progress)}%
          </div>
        </div>
      )}

      {!data ? (
        <>
          <Upload onFileLoaded={handleFileLoaded} />
          {error && (
            <div
              style={{
                position: "absolute",
                bottom: "20px",
                left: "50%",
                transform: "translateX(-50%)",
                color: "red",
                background: "rgba(0,0,0,0.8)",
                padding: "10px",
                borderRadius: "5px",
              }}
            >
              {error}
            </div>
          )}
        </>
      ) : (
        <>
          <Viewer data={data} />
          <button
            onClick={handleReset}
            className="reset-upload-button"
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              padding: "10px 20px",
              background: "#3f76e4",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              zIndex: 90,
            }}
          >
            Subir otro archivo
          </button>
        </>
      )}

      <SocialLinks className="floating-social-links" />
    </div>
  );
}
