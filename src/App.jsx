import React, { useState } from "react";
import { Upload } from "./components/Upload";
import { Viewer } from "./components/Viewer";
import { parseLitematic } from "./utils/litematicParser";

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileLoaded = async (file) => {
    setLoading(true);
    setError(null);
    try {
      console.log("Parsing file:", file.name);
      const parsedData = await parseLitematic(file);
      console.log("Parsed data:", parsedData);
      setData(parsedData);
    } catch (err) {
      console.error(err);
      setError(`Error al leer el archivo: ${err.message || err}`);
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
          <Viewer data={data} />
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
