import React, { useState } from 'react';

export function Sidebar({
    maxLayer,
    setMaxLayer,
    layerBounds,
    onToggleMaterials,
    showMaterials,
    onScreenshot
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <>
            {/* Toggle Button (Visible when collapsed) */}
            {collapsed && (
                <button
                    onClick={() => setCollapsed(false)}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        left: '20px',
                        zIndex: 100,
                        background: 'rgba(30, 30, 30, 0.8)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '10px 15px',
                        cursor: 'pointer',
                        backdropFilter: 'blur(5px)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}
                >
                    ☰ Menu
                </button>
            )}

            {/* Sidebar Container */}
            <div
                style={{
                    position: 'absolute',
                    top: '0',
                    left: collapsed ? '-320px' : '0',
                    width: '300px',
                    height: '100vh',
                    background: 'rgba(20, 20, 20, 0.85)',
                    backdropFilter: 'blur(10px)',
                    borderRight: '1px solid rgba(255,255,255,0.1)',
                    transition: 'left 0.3s ease',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'white',
                    fontFamily: "'Inter', sans-serif"
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                        Litematica Viewer
                    </h2>
                    <button
                        onClick={() => setCollapsed(true)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#aaa',
                            cursor: 'pointer',
                            fontSize: '1.2rem'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>

                    {/* Section: View Controls */}
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            color: '#888',
                            marginBottom: '15px',
                            letterSpacing: '1px'
                        }}>
                            View Configuration
                        </h3>

                        <div style={{ marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                                <span>Layer Limit</span>
                                <span style={{ fontFamily: 'monospace', color: '#3f76e4' }}>Y: {maxLayer}</span>
                            </div>
                            <input
                                type="range"
                                min={layerBounds.min}
                                max={layerBounds.max}
                                value={maxLayer}
                                onChange={(e) => setMaxLayer(Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    cursor: 'pointer',
                                    accentColor: '#3f76e4'
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#555', marginTop: '5px' }}>
                                <span>{layerBounds.min}</span>
                                <span>{layerBounds.max}</span>
                            </div>
                        </div>
                    </div>

                    {/* Section: Actions */}
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            color: '#888',
                            marginBottom: '15px',
                            letterSpacing: '1px'
                        }}>
                            Actions
                        </h3>

                        <div style={{ display: 'grid', gap: '10px' }}>
                            <button
                                onClick={onToggleMaterials}
                                style={{
                                    background: showMaterials ? '#3f76e4' : 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}
                            >
                                <span style={{ fontSize: '1.1rem' }}>📦</span>
                                Material List
                            </button>

                            <button
                                onClick={onScreenshot}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}
                            >
                                <span style={{ fontSize: '1.1rem' }}>📸</span>
                                Take Screenshot
                            </button>
                        </div>
                    </div>

                    {/* Section: Help */}
                    <div>
                        <h3 style={{
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            color: '#888',
                            marginBottom: '15px',
                            letterSpacing: '1px'
                        }}>
                            Controls
                        </h3>
                        <div style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: '1.6' }}>
                            <p style={{ margin: '5px 0' }}><strong style={{ color: '#fff' }}>Left Click:</strong> Rotate Camera</p>
                            <p style={{ margin: '5px 0' }}><strong style={{ color: '#fff' }}>Right Click:</strong> Pan Camera</p>
                            <p style={{ margin: '5px 0' }}><strong style={{ color: '#fff' }}>Scroll:</strong> Zoom</p>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div style={{
                    padding: '15px 20px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '0.7rem',
                    color: '#666',
                    textAlign: 'center'
                }}>
                    Litematica Web Viewer v1.0
                </div>
            </div>
        </>
    );
}
