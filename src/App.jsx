import React, { useState, useRef, useEffect } from "react";
import { Upload } from "./components/Upload";
import { Viewer } from "./components/Viewer";
import { parseLitematic } from "./utils/litematicParser";

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dbRef = useRef(null);
  const dbReadyRef = useRef(Promise.resolve());

  useEffect(() => {
    const req = indexedDB.open("litematica_db", 1);
    dbReadyRef.current = new Promise((resolve, reject) => {
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files", { keyPath: "name" });
        }
      };
      req.onsuccess = (e) => {
        dbRef.current = e.target.result;
        resolve();
      };
      req.onerror = () => {
        console.error("IndexedDB init failed");
        reject(req.error);
      };
    });
  }, []);

  const saveFileToDB = (file) => {
    const db = dbRef.current;
    if (!db) return;
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    store.put({ name: file.name, blob: file });
  };

  const loadFileFromDB = async (name) => {
    await dbReadyRef.current;
    const db = dbRef.current;
    if (!db) throw new Error("DB no inicializada");
    const tx = db.transaction("files", "readonly");
    const store = tx.objectStore("files");
    const req = store.get(name);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result?.blob || null);
      req.onerror = () => reject(req.error);
    });
  };

  const handleFileLoaded = async (file) => {
    setLoading(true);
    setError(null);
    try {
      console.log("Parsing file:", file.name);
      const parsedData = await parseLitematic(file);
      console.log("Parsed data:", parsedData);
      setData(parsedData);
      saveFileToDB(file);
    } catch (err) {
      console.error(err);
      setError(`Error al leer el archivo: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadRecentByName = async (name) => {
    setLoading(true);
    setError(null);
    try {
      const blob = await loadFileFromDB(name);
      if (!blob) {
        throw new Error("Archivo no encontrado en recientes");
      }
      const parsedData = await parseLitematic(blob);
      setData(parsedData);
    } catch (err) {
      setError(`No se pudo cargar el archivo reciente: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setData(null);
    setError(null);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            color: "white",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Cargando...
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
          <Viewer data={data} onLoadRecentFile={handleLoadRecentByName} />
          <button
            onClick={handleReset}
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
              zIndex: 100,
            }}
          >
            Subir otro archivo
          </button>
        </>
      )}
    </div>
  );
}

export default App;
