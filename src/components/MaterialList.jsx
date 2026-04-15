"use client";

import React from "react";
import styles from "./MaterialList.module.css";

export function MaterialList({ data, onClose }) {
  const materials = Array.isArray(data?.materials) ? data.materials : [];
  const totalBlocks = materials.reduce((sum, material) => sum + material.count, 0);

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <h2 className={styles.title}>Lista de materiales</h2>
        <button onClick={onClose} className={styles.closeButton}>
          x
        </button>
      </div>

      <div className={styles.content}>
        {materials.length === 0 ? (
          <div className={styles.empty}>No se encontraron bloques</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr className={styles.headRow}>
                <th className={styles.headCell}>Bloque</th>
                <th className={styles.headCellRight}>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((item, index) => (
                <tr
                  key={item.name}
                  className={`${styles.row} ${index % 2 === 0 ? "" : styles.rowAlt}`}
                >
                  <td className={styles.nameCell}>{item.name}</td>
                  <td className={styles.countCell}>{item.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.footer}>Total de bloques: {totalBlocks.toLocaleString()}</div>
    </div>
  );
}
