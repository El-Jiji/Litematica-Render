import React, { useState } from "react";

export function Sidebar({
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
  onMultipleScreenshots,
  onExport3D,
  isAnimating,
  onToggleBuildAnimation,
  animationSpeed,
  setAnimationSpeed,
  xrayMode,
  setXrayMode,
  recentFiles,
  showRecentFiles,
  setShowRecentFiles,
  onLoadRecentFile,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const staggerColors = ["#B19EEF", "#5227FF"];

  // Theme colors
  const colors = {
    bg: "rgba(20, 20, 20, 0.85)",
    border: "rgba(255,255,255,0.1)",
    text: "white",
    textSecondary: "#ccc",
    textMuted: "#888",
    accent: "#3f76e4",
    buttonBg: "rgba(255,255,255,0.05)",
    buttonHover: "rgba(63, 118, 228, 0.2)",
  };

  return (
    <>
      {!collapsed && (
        <div
          className="staggered-overlay"
          onClick={() => setCollapsed(true)}
          style={{ zIndex: 80, backdropFilter: "none" }}
        />
      )}
      {!collapsed &&
        staggerColors.map((c, i) => (
          <div
            key={i}
            className="staggered-layer"
            style={{
              left: 0,
              width: `${300 + i * 24}px`,
              background: c,
              zIndex: 90 - i,
              transform: `translateX(${-(12 * i)}px)`,
              opacity: 0.25 + i * 0.1,
              borderRight: `1px solid ${colors.border}`,
            }}
          />
        ))}
      {/* Toggle Button (Visible when collapsed) */}
      {collapsed && (
        <button
          className="menu-toggle"
          onClick={() => setCollapsed(false)}
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            zIndex: 100,
            background: colors.accent,
            color: "#fff",
            border: `1px solid ${colors.border} `,
            borderRadius: "8px",
            padding: "10px 15px",
            cursor: "pointer",
            boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
          }}
        >
          ☰ Menu
        </button>
      )}

      {/* Sidebar Container */}
      <div
        style={{
          position: "absolute",
          top: "0",
          left: collapsed ? "-320px" : "0",
          width: "300px",
          height: "100vh",
          background: colors.bg,
          borderRight: `1px solid ${colors.border} `,
          transition: "left 0.3s ease",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          color: colors.text,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px",
            borderBottom: `1px solid ${colors.border} `,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.2rem",
              fontWeight: "600",
              letterSpacing: "0.5px",
            }}
          >
            Litematica Viewer
          </h2>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => setCollapsed(true)}
              style={{
                background: "transparent",
                border: "none",
                color: colors.textMuted,
                cursor: "pointer",
                fontSize: "1.2rem",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          style={{ padding: "20px", flex: 1, overflowY: "auto" }}
          className={!collapsed ? "staggered-enter" : ""}
        >
          {/* Session 1: Model Info */}
          <div style={{ marginBottom: "30px" }} className="staggered-child">
            <h3
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                color: colors.textMuted,
                marginBottom: "15px",
                letterSpacing: "1px",
              }}
            >
              Model Information
            </h3>

            <div
              style={{
                background: colors.buttonBg,
                padding: "12px",
                borderRadius: "6px",
                border: `1px solid ${colors.border} `,
              }}
            >
              <div style={{ fontSize: "0.85rem", marginBottom: "8px" }}>
                <strong style={{ color: colors.accent }}>Dimensions:</strong>
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: colors.textSecondary,
                  fontFamily: "monospace",
                }}
              >
                {modelDimensions.width} × {modelDimensions.height} ×{" "}
                {modelDimensions.depth}
              </div>

              {metadata.Name && (
                <>
                  <div
                    style={{
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: `1px solid ${colors.border} `,
                    }}
                  >
                    <button
                      onClick={() => setShowMetadata(!showMetadata)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: colors.accent,
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        padding: 0,
                      }}
                    >
                      {showMetadata ? "▼" : "▶"} Metadata
                    </button>
                  </div>
                  {showMetadata && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: colors.textMuted,
                        marginTop: "8px",
                        lineHeight: "1.6",
                      }}
                    >
                      {metadata.Name && (
                        <div>
                          <strong>Name:</strong> {metadata.Name.value}
                        </div>
                      )}
                      {metadata.Author && (
                        <div>
                          <strong>Author:</strong> {metadata.Author.value}
                        </div>
                      )}
                      {metadata.Description && (
                        <div>
                          <strong>Desc:</strong> {metadata.Description.value}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Session 2: Lighting Controls */}
          <div style={{ marginBottom: "30px" }} className="staggered-child">
            <h3
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                color: colors.textMuted,
                marginBottom: "15px",
                letterSpacing: "1px",
              }}
            >
              Lighting
            </h3>

            <div style={{ marginBottom: "15px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "5px",
                  fontSize: "0.85rem",
                }}
              >
                <span>Ambient</span>
                <span style={{ fontFamily: "monospace", color: colors.accent }}>
                  {ambientIntensity.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={ambientIntensity}
                onChange={(e) => setAmbientIntensity(Number(e.target.value))}
                style={{
                  width: "100%",
                  cursor: "pointer",
                  accentColor: colors.accent,
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "5px",
                  fontSize: "0.85rem",
                }}
              >
                <span>Directional</span>
                <span style={{ fontFamily: "monospace", color: colors.accent }}>
                  {directionalIntensity.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={directionalIntensity}
                onChange={(e) =>
                  setDirectionalIntensity(Number(e.target.value))
                }
                style={{
                  width: "100%",
                  cursor: "pointer",
                  accentColor: colors.accent,
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <div style={{ fontSize: "0.85rem", marginBottom: "8px" }}>
                Environment
              </div>
              <select
                value={environmentPreset}
                onChange={(e) => setEnvironmentPreset(e.target.value)}
                className="staggered-select"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: `1px solid ${colors.border} `,
                  background: colors.buttonBg,
                  color: colors.text,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                <option value="dawn">Dawn</option>
                <option value="city">Daylight</option>
                <option value="sunset">Sunset</option>
                <option value="night">Night</option>
              </select>
            </div>

            {/* removed High Quality Shadows option */}
          </div>

          {/* Section: Visual Modes */}
          <div style={{ marginBottom: "30px" }} className="staggered-child">
            <h3
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                color: colors.textMuted,
                marginBottom: "15px",
                letterSpacing: "1px",
              }}
            >
              Visual Modes
            </h3>

            <div style={{ display: "grid", gap: "10px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={xrayMode}
                  onChange={(e) => setXrayMode(e.target.checked)}
                  style={{ cursor: "pointer", accentColor: colors.accent }}
                />
                X-Ray Mode
              </label>
            </div>
          </div>

          {/* Session 1: Camera Presets */}
          <div style={{ marginBottom: "30px" }} className="staggered-child">
            <h3
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                color: colors.textMuted,
                marginBottom: "15px",
                letterSpacing: "1px",
              }}
            >
              Camera Views
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              {["front", "side", "top", "isometric"].map((preset) => (
                <button
                  key={preset}
                  onClick={() => onCameraPreset(preset)}
                  style={{
                    background: colors.buttonBg,
                    color: colors.text,
                    border: `1px solid ${colors.border} `,
                    padding: "10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    textTransform: "capitalize",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.target.style.background = colors.buttonHover)
                  }
                  onMouseLeave={(e) =>
                    (e.target.style.background = colors.buttonBg)
                  }
                >
                  {preset === "isometric" ? "Iso" : preset}
                </button>
              ))}
            </div>

            <div style={{ marginTop: "12px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={onToggleAutoRotate}
                  style={{ cursor: "pointer", accentColor: colors.accent }}
                />
                Auto-Rotate
              </label>
            </div>
          </div>

          {/* Section: View Controls */}
          <div style={{ marginBottom: "30px" }} className="staggered-child">
            <h3
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                color: colors.textMuted,
                marginBottom: "15px",
                letterSpacing: "1px",
              }}
            >
              View Configuration
            </h3>

            <div style={{ marginBottom: "10px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                  fontSize: "0.9rem",
                }}
              >
                <span>Layer Limit</span>
                <span style={{ fontFamily: "monospace", color: colors.accent }}>
                  Y: {maxLayer}
                </span>
              </div>
              <input
                type="range"
                min={layerBounds.min}
                max={layerBounds.max}
                value={maxLayer}
                onChange={(e) => setMaxLayer(Number(e.target.value))}
                style={{
                  width: "100%",
                  cursor: "pointer",
                  accentColor: colors.accent,
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.7rem",
                  color: colors.textMuted,
                  marginTop: "5px",
                }}
              >
                <span>{layerBounds.min}</span>
                <span>{layerBounds.max}</span>
              </div>
            </div>
          </div>

          {/* Section: Actions */}
          <div style={{ marginBottom: "30px" }} className="staggered-child">
            <h3
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                color: colors.textMuted,
                marginBottom: "15px",
                letterSpacing: "1px",
              }}
            >
              Actions
            </h3>

            <div style={{ display: "grid", gap: "10px" }}>
              <button
                onClick={onToggleMaterials}
                style={{
                  background: showMaterials ? colors.accent : colors.buttonBg,
                  color: "white",
                  border: `1px solid ${colors.border} `,
                  padding: "12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>📦</span>
                Material List
              </button>

              <button
                onClick={onScreenshot}
                style={{
                  background: colors.buttonBg,
                  color: colors.text,
                  border: `1px solid ${colors.border} `,
                  padding: "12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>📸</span>
                Take Screenshot
              </button>
            </div>
          </div>

          {/* Export options removed */}

          {/* Session 3: Build Animation */}
          <div style={{ marginBottom: "30px" }}>
            <h3
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                color: colors.textMuted,
                marginBottom: "15px",
                letterSpacing: "1px",
              }}
            >
              Build Animation
            </h3>

            <button
              onClick={onToggleBuildAnimation}
              style={{
                background: isAnimating ? colors.accent : colors.buttonBg,
                color: "white",
                border: `1px solid ${colors.border} `,
                padding: "12px",
                borderRadius: "6px",
                cursor: "pointer",
                width: "100%",
                textAlign: "center",
                transition: "all 0.2s",
                fontSize: "0.9rem",
                fontWeight: "500",
                marginBottom: "12px",
              }}
            >
              {isAnimating ? "⏸️ Stop" : "▶️ Play"} Animation
            </button>

            <div style={{ marginTop: "12px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "5px",
                  fontSize: "0.85rem",
                }}
              >
                <span>Speed</span>
                <span style={{ fontFamily: "monospace", color: colors.accent }}>
                  {animationSpeed}ms
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={animationSpeed}
                onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                style={{
                  width: "100%",
                  cursor: "pointer",
                  accentColor: colors.accent,
                }}
              />
              <div
                style={{
                  fontSize: "0.7rem",
                  color: colors.textMuted,
                  marginTop: "3px",
                  textAlign: "center",
                }}
              >
                {animationSpeed < 50
                  ? "Fast"
                  : animationSpeed < 100
                    ? "Normal"
                    : "Slow"}
              </div>
            </div>
          </div>

          {/* Session 4: Recent Files */}
          {recentFiles && recentFiles.length > 0 && (
            <div style={{ marginBottom: "30px" }} className="staggered-child">
              <h3
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  color: colors.textMuted,
                  marginBottom: "15px",
                  letterSpacing: "1px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                Recent Files
                <button
                  onClick={() => setShowRecentFiles(!showRecentFiles)}
                  style={{
                    background: "none",
                    border: "none",
                    color: colors.accent,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  {showRecentFiles ? "▼" : "▶"}
                </button>
              </h3>

              {showRecentFiles && (
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {recentFiles.map((file, idx) => (
                    <div
                      key={idx}
                      onClick={() => onLoadRecentFile && onLoadRecentFile(file.name)}
                      style={{
                        background: colors.buttonBg,
                        border: `1px solid ${colors.border} `,
                        borderRadius: "6px",
                        padding: "10px",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: "500", marginBottom: "4px" }}>
                        {file.name}
                      </div>
                      <div
                        style={{ color: colors.textMuted, fontSize: "0.7rem" }}
                      >
                        {file.dimensions.width}×{file.dimensions.height}×
                        {file.dimensions.depth}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section: Help */}
          <div className="staggered-child">
            <h3
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                color: colors.textMuted,
                marginBottom: "15px",
                letterSpacing: "1px",
              }}
            >
              Keyboard Shortcuts
            </h3>
            <div
              style={{
                fontSize: "0.75rem",
                color: colors.textMuted,
                lineHeight: "1.8",
              }}
            >
              <div>
                <kbd
                  style={{
                    background: colors.buttonBg,
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontFamily: "monospace",
                  }}
                >
                  W
                </kbd>{" "}
                - Toggle Wireframe
              </div>
              <div>
                <kbd
                  style={{
                    background: colors.buttonBg,
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontFamily: "monospace",
                  }}
                >
                  X
                </kbd>{" "}
                - Toggle X-Ray
              </div>
              <div>
                <kbd
                  style={{
                    background: colors.buttonBg,
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontFamily: "monospace",
                  }}
                >
                  R
                </kbd>{" "}
                - Toggle Rotation
              </div>
              <div>
                <kbd
                  style={{
                    background: colors.buttonBg,
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontFamily: "monospace",
                  }}
                >
                  Space
                </kbd>{" "}
                - Play/Stop Animation
              </div>
              <div>
                <kbd
                  style={{
                    background: colors.buttonBg,
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontFamily: "monospace",
                  }}
                >
                  1-4
                </kbd>{" "}
                - Camera Presets
              </div>
              <div>
                <kbd
                  style={{
                    background: colors.buttonBg,
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontFamily: "monospace",
                  }}
                >
                  Ctrl+S
                </kbd>{" "}
                - Screenshot
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "15px 20px",
            borderTop: `1px solid ${colors.border} `,
            fontSize: "0.7rem",
            color: colors.textMuted,
            textAlign: "center",
          }}
        >
          Litematica Web Viewer v1.2
        </div>
      </div>
    </>
  );
}
