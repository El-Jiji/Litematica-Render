"use client";

import React, { useState } from "react";
import { SocialLinks } from "./SocialLinks";
import styles from "./Sidebar.module.css";

export function Sidebar({
  renderBackend,
  renderStats,
  sceneSummary,
  performanceMode,
  setPerformanceMode,
  adaptiveQuality,
  setAdaptiveQuality,
  maxLayer,
  setMaxLayer,
  layerBounds,
  sliceAxis,
  setSliceAxis,
  sliceAxisLabel,
  onToggleMaterials,
  showMaterials,
  onScreenshot,
  modelDimensions,
  metadata,
  comparisonMode,
  onCameraPreset,
  autoRotate,
  onToggleAutoRotate,
  lightingMode,
  setLightingMode,
  timeOfDay,
  setTimeOfDay,
  lightingDescription,
  showSkyBackground,
  setShowSkyBackground,
  isAnimating,
  onToggleBuildAnimation,
  animationSpeed,
  setAnimationSpeed,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  const metadataName = metadata?.Name?.value || metadata?.Name || metadata?.name;
  const metadataAuthor =
    metadata?.Author?.value || metadata?.Author || metadata?.author;
  const metadataDescription =
    metadata?.Description?.value ||
    metadata?.Description ||
    metadata?.description;

  const renderBackendLabel =
    renderBackend === "webgpu"
      ? "WebGPU"
      : renderBackend === "webgl"
        ? "WebGL"
        : "Detectando...";

  return (
    <>
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className={styles.collapsedButton}
        >
          Menu
        </button>
      )}

      <div
        className={`${styles.panel} ${collapsed ? styles.panelCollapsed : ""}`}
      >
        <div className={styles.header}>
          <strong>{comparisonMode ? "Comparador" : "Visualizador Litematica"}</strong>
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Cerrar menu"
            className={styles.closeButton}
          >
            x
          </button>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionLabel}>MODELO</div>
          <div className={styles.monoValue}>
            {modelDimensions.width} x {modelDimensions.height} x {modelDimensions.depth}
          </div>
          <div className={styles.mutedText}>Renderizador: {renderBackendLabel}</div>
          {metadataName && (
            <div className={styles.metaBlock}>
              <button
                onClick={() => setShowMetadata((value) => !value)}
                className={styles.metaToggle}
              >
                {showMetadata ? "Ocultar" : "Mostrar"} metadatos
              </button>
              {showMetadata && (
                <div className={styles.metaDetails}>
                  <div>Nombre: {metadataName}</div>
                  {metadataAuthor && <div>Autor: {metadataAuthor}</div>}
                  {metadataDescription && <div>Descripcion: {metadataDescription}</div>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.sectionLabel}>ESTADISTICAS</div>
          <div className={styles.stats}>
            <div>Llamadas de dibujo: {renderStats.calls}</div>
            <div>Triangulos: {renderStats.triangles.toLocaleString()}</div>
            <div>Bloques: {sceneSummary.totalBlocks.toLocaleString()}</div>
            <div>Instancias: {sceneSummary.instances.toLocaleString()}</div>
            <div>Chunks: {(sceneSummary.chunks || 0).toLocaleString()}</div>
            <div>Caras ocultas: {(sceneSummary.culledFaces || 0).toLocaleString()}</div>
            <div>Slice activo: {sliceAxisLabel}</div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionLabel}>VISTA</div>
          <div className={styles.viewValue}>
            Corte {sliceAxisLabel}: {maxLayer}
          </div>
          <select
            value={sliceAxis}
            onChange={(event) => setSliceAxis(event.target.value)}
            className={styles.select}
          >
            <option value="x">Eje X</option>
            <option value="y">Eje Y</option>
            <option value="z">Eje Z</option>
          </select>
          <input
            type="range"
            min={layerBounds.min}
            max={layerBounds.max}
            value={maxLayer}
            onChange={(event) => setMaxLayer(Number(event.target.value))}
            className={styles.rangeInput}
          />
          <div className={styles.buttonGrid}>
            {["front", "side", "top", "isometric"].map((preset) => (
              <button
                key={preset}
                onClick={() => onCameraPreset(preset)}
                className={styles.presetButton}
              >
                {preset === "front"
                  ? "Frente"
                  : preset === "side"
                    ? "Lado"
                    : preset === "top"
                      ? "Superior"
                      : "Iso"}
              </button>
            ))}
          </div>
          <label className={styles.toggleRow}>
            <input type="checkbox" checked={autoRotate} onChange={onToggleAutoRotate} />
            Auto-rotacion
          </label>
        </div>

        <div className={`${styles.card} ${comparisonMode ? styles.hiddenOnCompare : ""}`}>
          <div className={styles.sectionLabel}>ILUMINACION</div>
          <select
            value={lightingMode}
            onChange={(event) => setLightingMode(event.target.value)}
            className={styles.select}
          >
            <option value="game">Juego</option>
            <option value="cinematic">Cinematica</option>
            <option value="night">Noche</option>
          </select>
          <div className={styles.lightingHelp}>{lightingDescription}</div>
          <div className={styles.label}>Hora del dia {timeOfDay}:00</div>
          <input
            type="range"
            min="0"
            max="23"
            step="1"
            value={timeOfDay}
            onChange={(event) => setTimeOfDay(Number(event.target.value))}
            className={styles.rangeInput}
          />
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={showSkyBackground}
              onChange={(event) => setShowSkyBackground(event.target.checked)}
            />
            Fondo azul estilo Minecraft
          </label>
        </div>

        <div className={`${styles.card} ${comparisonMode ? styles.hiddenOnCompare : ""}`}>
          <div className={styles.sectionLabel}>RENDIMIENTO</div>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={adaptiveQuality}
              onChange={(event) => setAdaptiveQuality(event.target.checked)}
            />
            Calidad adaptativa
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={performanceMode}
              onChange={(event) => setPerformanceMode(event.target.checked)}
            />
            Modo rendimiento
          </label>
          <div className={styles.lightingHelp}>
            Las sombras se ajustan solas segun el modo y la hora.
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionLabel}>ACCIONES</div>
          <button
            onClick={onToggleMaterials}
            className={`${styles.fullButton} ${showMaterials ? styles.activeButton : ""}`}
          >
            Lista de materiales
          </button>
          <button onClick={onScreenshot} className={styles.fullButton}>
            Captura
          </button>
          <button
            onClick={onToggleBuildAnimation}
            className={`${styles.fullButton} ${isAnimating ? styles.activeButton : ""}`}
          >
            {isAnimating ? "Detener" : "Iniciar"} animacion de construccion
          </button>
          <div className={styles.label}>Velocidad de animacion {animationSpeed} ms</div>
          <input
            type="range"
            min="10"
            max="200"
            step="10"
            value={animationSpeed}
            onChange={(event) => setAnimationSpeed(Number(event.target.value))}
            className={styles.rangeInput}
          />
        </div>

        <div className={`sidebar-mobile-links ${styles.card}`}>
          <div className={styles.sectionLabel}>ENLACES</div>
          <SocialLinks inline />
        </div>
      </div>
    </>
  );
}
