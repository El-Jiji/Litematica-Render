"use client";

import React from "react";
import TextType from "./TextType";

// I'll use native events to avoid extra deps if possible, or just install react-dropzone.
// Native is easy.

export function Upload({ onFileLoaded }) {
  const onDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileLoaded(files[0]);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileLoaded(e.target.files[0]);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1a1a1a",
        color: "#fff",
        border: "2px dashed #444",
        borderRadius: "10px",
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div style={{ textAlign: "center", padding: "20px" }}>
        <TextType 
          as="h1"
          text={[
            "Litematica Web Viewer",
            "Renderizado 3D de esquemas", 
            "Visualiza esquemas sin abrir el juego", 
            "Preview instantáneo de tus builds",
            "Carga, visualiza, construye"
          ]}
          typingSpeed={75}
          pauseDuration={1500}
          showCursor
          cursorCharacter="_"
          deletingSpeed={30}
          cursorBlinkDuration={0.5}
          style={{ 
            fontSize: "2rem", 
            margin: "0 0 20px 0",
            color: "#fff"
          }}
        />
        <p>Arrastra tu archivo .litematic aquí</p>
        <p>o</p>
        <label
          style={{
            padding: "10px 20px",
            backgroundColor: "#3f76e4",
            borderRadius: "5px",
            cursor: "pointer",
            marginTop: "10px",
            display: "inline-block",
          }}
        >
          Seleccionar Archivo
          <input
            type="file"
            accept=".litematic"
            onChange={onChange}
            style={{ display: "none" }}
          />
        </label>
      </div>
    </div>
  );
}
