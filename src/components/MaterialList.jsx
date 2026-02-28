"use client";

import React, { useMemo, useState } from "react";

export function MaterialList({ data, onClose }) {
    const materials = useMemo(() => {
        if (!data || !data.regions) return [];

        const counts = {};

        Object.values(data.regions).forEach((region) => {
            region.blocks.forEach((block) => {
                const name = block.name.replace("minecraft:", "").replace(/_/g, " ");
                // Capitalize words
                const displayName = name.replace(/\b\w/g, (c) => c.toUpperCase());

                counts[displayName] = (counts[displayName] || 0) + 1;
            });
        });

        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a) // Sort by count descending
            .map(([name, count]) => ({ name, count }));
    }, [data]);

    return (
        <div
            style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                width: "300px",
                maxHeight: "80vh",
                backgroundColor: "rgba(20, 20, 20, 0.9)",
                backdropFilter: "blur(5px)",
                borderRadius: "10px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                fontFamily: "'Inter', sans-serif",
                border: "1px solid rgba(255,255,255,0.1)",
                zIndex: 1000
            }}
        >
            <div
                style={{
                    padding: "15px",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.05)"
                }}
            >
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "600" }}>Material List</h2>
                <button
                    onClick={onClose}
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "#aaa",
                        cursor: "pointer",
                        fontSize: "1.2rem",
                        padding: "0 5px"
                    }}
                >
                    ✕
                </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "0" }}>
                {materials.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', opacity: 0.7 }}>No blocks found</div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ textAlign: "left", fontSize: "0.8rem", color: "#888", borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <th style={{ padding: "10px 15px", fontWeight: 'normal' }}>Block Name</th>
                                <th style={{ padding: "10px 15px", textAlign: "right", fontWeight: 'normal' }}>Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {materials.map((item, index) => (
                                <tr
                                    key={item.name}
                                    style={{
                                        backgroundColor: index % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                                        borderBottom: "1px solid rgba(255,255,255,0.02)"
                                    }}
                                >
                                    <td style={{ padding: "8px 15px", fontSize: "0.9rem" }}>{item.name}</td>
                                    <td style={{ padding: "8px 15px", textAlign: "right", fontFamily: "monospace", fontSize: "1rem" }}>
                                        {item.count.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div style={{
                padding: '10px 15px',
                fontSize: '0.8rem',
                color: '#666',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                textAlign: 'center'
            }}>
                Total Blocks: {materials.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()}
            </div>
        </div>
    );
}
