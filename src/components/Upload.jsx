"use client";

import React from "react";
import TextType from "./TextType";
import styles from "./Upload.module.css";

export function Upload({ onFileLoaded }) {
  const onDrop = (event) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      onFileLoaded(files[0]);
    }
  };

  const onDragOver = (event) => {
    event.preventDefault();
  };

  const onChange = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      onFileLoaded(event.target.files[0]);
    }
  };

  return (
    <div className={styles.wrapper} onDrop={onDrop} onDragOver={onDragOver}>
      <div className={styles.inner}>
        <TextType
          as="h1"
          text={[
            "Visualizador web de Litematica",
            "Renderizado 3D de esquemas",
            "Visualiza esquemas sin abrir el juego",
            "Vista previa instantanea de tus construcciones",
            "Carga, visualiza, construye",
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
            color: "#fff",
          }}
        />
        <p>Arrastra tu archivo `.litematic` aqui</p>
        <p>o</p>
        <label className={styles.fileLabel}>
          Seleccionar archivo
          <input
            type="file"
            accept=".litematic"
            onChange={onChange}
            className={styles.fileInput}
          />
        </label>
      </div>
    </div>
  );
}
