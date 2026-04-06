"use client";

import React, { useState } from "react";

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
  onToggleMaterials,
  showMaterials,
  onScreenshot,
  modelDimensions,
  metadata,
  onCameraPreset,
  autoRotate,
  onToggleAutoRotate,
  ambientIntensity,
  setAmbientIntensity,
  directionalIntensity,
  setDirectionalIntensity,
  environmentPreset,
  setEnvironmentPreset,
  shadowsEnabled,
  setShadowsEnabled,
  isAnimating,
  onToggleBuildAnimation,
  animationSpeed,
  setAnimationSpeed,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  const panel = {
    position: "absolute",
    top: 0,
    left: collapsed ? "-320px" : "0",
    width: "300px",
    height: "100vh",
    padding: "18px",
    background: "rgba(20,20,20,0.88)",
    borderRight: "1px solid rgba(255,255,255,0.1)",
    color: "white",
    transition: "left 0.3s ease",
    zIndex: 100,
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    overflowY: "auto",
    fontFamily: "'Inter', sans-serif",
  };

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
        : "Detecting...";

  const cardStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    padding: "12px",
  };

  return (
    <>
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            zIndex: 110,
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "#3f76e4",
            color: "white",
            cursor: "pointer",
          }}
        >
          Menu
        </button>
      )}

      <div style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Litematica Viewer</strong>
          <button
            onClick={() => setCollapsed(true)}
            style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer" }}
          >
            x
          </button>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: "0.78rem", color: "#8eaef3", marginBottom: "8px" }}>
            MODEL
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
            {modelDimensions.width} x {modelDimensions.height} x {modelDimensions.depth}
          </div>
          <div style={{ marginTop: "8px", fontSize: "0.82rem", color: "#ccc" }}>
            Renderer: {renderBackendLabel}
          </div>
          {metadataName && (
            <div style={{ marginTop: "10px", fontSize: "0.8rem", color: "#bbb" }}>
              <button
                onClick={() => setShowMetadata((value) => !value)}
                style={{ background: "transparent", border: "none", color: "#8eaef3", padding: 0, cursor: "pointer" }}
              >
                {showMetadata ? "Hide" : "Show"} metadata
              </button>
              {showMetadata && (
                <div style={{ marginTop: "8px", lineHeight: 1.6 }}>
                  <div>Name: {metadataName}</div>
                  {metadataAuthor && <div>Author: {metadataAuthor}</div>}
                  {metadataDescription && <div>Description: {metadataDescription}</div>}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: "0.78rem", color: "#8eaef3", marginBottom: "8px" }}>
            STATS
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "0.82rem", lineHeight: 1.6 }}>
            <div>Calls: {renderStats.calls}</div>
            <div>Triangles: {renderStats.triangles.toLocaleString()}</div>
            <div>Blocks: {sceneSummary.totalBlocks.toLocaleString()}</div>
            <div>Instances: {sceneSummary.instances.toLocaleString()}</div>
            <div>Chunks: {(sceneSummary.chunks || 0).toLocaleString()}</div>
            <div>Hidden Faces: {(sceneSummary.culledFaces || 0).toLocaleString()}</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: "0.78rem", color: "#8eaef3", marginBottom: "8px" }}>
            VIEW
          </div>
          <div style={{ marginBottom: "8px", fontSize: "0.82rem" }}>
            Layer limit: {maxLayer}
          </div>
          <input
            type="range"
            min={layerBounds.min}
            max={layerBounds.max}
            value={maxLayer}
            onChange={(event) => setMaxLayer(Number(event.target.value))}
            style={{ width: "100%", accentColor: "#3f76e4" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px" }}>
            {["front", "side", "top", "isometric"].map((preset) => (
              <button
                key={preset}
                onClick={() => onCameraPreset(preset)}
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.05)",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                {preset === "isometric" ? "Iso" : preset}
              </button>
            ))}
          </div>
          <label style={{ display: "flex", gap: "8px", marginTop: "10px", fontSize: "0.82rem" }}>
            <input type="checkbox" checked={autoRotate} onChange={onToggleAutoRotate} />
            Auto-rotate
          </label>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: "0.78rem", color: "#8eaef3", marginBottom: "8px" }}>
            PERFORMANCE
          </div>
          <label style={{ display: "flex", gap: "8px", fontSize: "0.82rem", marginBottom: "8px" }}>
            <input type="checkbox" checked={adaptiveQuality} onChange={(event) => setAdaptiveQuality(event.target.checked)} />
            Adaptive quality
          </label>
          <label style={{ display: "flex", gap: "8px", fontSize: "0.82rem", marginBottom: "8px" }}>
            <input type="checkbox" checked={performanceMode} onChange={(event) => setPerformanceMode(event.target.checked)} />
            Performance mode
          </label>
          <label style={{ display: "flex", gap: "8px", fontSize: "0.82rem", marginBottom: "12px" }}>
            <input type="checkbox" checked={shadowsEnabled} onChange={(event) => setShadowsEnabled(event.target.checked)} />
            Shadows
          </label>
          <div style={{ fontSize: "0.8rem", marginBottom: "6px" }}>
            Ambient {ambientIntensity.toFixed(1)}
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={ambientIntensity}
            onChange={(event) => setAmbientIntensity(Number(event.target.value))}
            style={{ width: "100%", accentColor: "#3f76e4", marginBottom: "10px" }}
          />
          <div style={{ fontSize: "0.8rem", marginBottom: "6px" }}>
            Directional {directionalIntensity.toFixed(1)}
          </div>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={directionalIntensity}
            onChange={(event) => setDirectionalIntensity(Number(event.target.value))}
            style={{ width: "100%", accentColor: "#3f76e4", marginBottom: "10px" }}
          />
          <select
            value={environmentPreset}
            onChange={(event) => setEnvironmentPreset(event.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              color: "white",
            }}
          >
            <option value="dawn">Dawn</option>
            <option value="city">Daylight</option>
            <option value="sunset">Sunset</option>
            <option value="night">Night</option>
          </select>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: "0.78rem", color: "#8eaef3", marginBottom: "8px" }}>
            ACTIONS
          </div>
          <button
            onClick={onToggleMaterials}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "8px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: showMaterials ? "#3f76e4" : "rgba(255,255,255,0.05)",
              color: "white",
              cursor: "pointer",
            }}
          >
            Material list
          </button>
          <button
            onClick={onScreenshot}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "8px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              cursor: "pointer",
            }}
          >
            Screenshot
          </button>
          <button
            onClick={onToggleBuildAnimation}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: isAnimating ? "#3f76e4" : "rgba(255,255,255,0.05)",
              color: "white",
              cursor: "pointer",
            }}
          >
            {isAnimating ? "Stop" : "Play"} build animation
          </button>
          <div style={{ fontSize: "0.8rem", marginTop: "10px", marginBottom: "6px" }}>
            Animation speed {animationSpeed}ms
          </div>
          <input
            type="range"
            min="10"
            max="200"
            step="10"
            value={animationSpeed}
            onChange={(event) => setAnimationSpeed(Number(event.target.value))}
            style={{ width: "100%", accentColor: "#3f76e4" }}
          />
        </div>
      </div>
    </>
  );
}
