import React, { type CSSProperties } from "react";

import { comboFontSizePixels } from "@/lib/water-sort/presentation/combo";

export interface ComboCelebration {
  id: number;
  count: number;
  sequence: number;
}

/** Functional updates preserve every start when React batches concurrent events. */
export function addComboCelebration(
  current: readonly ComboCelebration[],
  next: ComboCelebration,
): ComboCelebration[] {
  return [...current.filter((entry) => entry.id !== next.id), next];
}

export function ComboCelebrations({
  celebrations,
  classes,
}: {
  celebrations: readonly ComboCelebration[];
  classes: {
    comboStage: string;
    comboIndicator: string;
    comboBurst: string;
    comboSpark: string;
    comboNumber: string;
    comboLabel: string;
  };
}) {
  if (celebrations.length === 0) return null;

  return (
    <div className={classes.comboStage} role="status" aria-live="polite">
      {celebrations.map(({ id, count, sequence }) => (
        <div
          key={sequence}
          data-combo-presentation-id={id}
          className={classes.comboIndicator}
          data-combo-tier={
            count >= 8
              ? "legendary"
              : count >= 5
                ? "high"
                : count >= 3
                  ? "medium"
                  : "low"
          }
          data-combo-hue={(count - 2) % 8}
          style={
            { "--combo-font-px": comboFontSizePixels(count) } as CSSProperties
          }
        >
          <span className={classes.comboBurst} aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <span key={index} className={classes.comboSpark} />
            ))}
          </span>
          <span className={classes.comboNumber}>{count}×</span>
          <span className={classes.comboLabel}>
            {count >= 8
              ? "UNSTOPPABLE"
              : count >= 5
                ? "INCREDIBLE"
                : count >= 3
                  ? "GREAT CHAIN"
                  : "COMBO"}
          </span>
        </div>
      ))}
    </div>
  );
}
