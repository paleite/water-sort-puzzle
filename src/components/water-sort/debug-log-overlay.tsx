"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./water-sort.module.css";

export function DebugLogOverlay({
  entries,
  phase,
  onClear,
}: {
  entries: readonly string[];
  phase: string;
  onClear: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (collapsed) return;
    const list = listRef.current;
    if (list === null) return;

    const animationFrame = requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight;
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [collapsed, entries]);

  const copyLogs = (): void => {
    if (typeof navigator === "undefined" || navigator.clipboard === undefined) return;
    void navigator.clipboard.writeText(entries.join("\n"));
  };

  return (
    <aside
      className={`${styles.debugOverlay}${collapsed ? ` ${styles.debugOverlayCollapsed}` : ""}`}
      aria-label="Animation debug log"
    >
      <div className={styles.debugHeader}>
        <strong>Animation debug</strong>
        <span className={styles.debugPhase}>phase: {phase}</span>
        <span className={styles.debugCount}>{entries.length} logs</span>
        <div className={styles.debugActions}>
          <button type="button" onClick={copyLogs}>Copy</button>
          <button type="button" onClick={onClear}>Clear</button>
          <button type="button" onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div ref={listRef} className={styles.debugLogList}>
          {entries.length === 0 ? (
            <div className={styles.debugEmpty}>Waiting for animation events…</div>
          ) : (
            entries.map((entry, index) => (
              <div key={`${index}-${entry}`} className={styles.debugLogRow}>
                {entry}
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
