"use client";

import { forwardRef } from "react";

import type { Vial as VialState } from "@/lib/water-sort/domain/types";
import { getTopColor } from "@/lib/water-sort/domain/vial";

import styles from "./water-sort.module.css";

export const VialSlotButton = forwardRef<HTMLButtonElement, {
  vial: VialState;
  capacity: number;
  vialIndex: number;
  selected?: boolean;
  interactive?: boolean;
  onPress?: () => void;
}>(function VialSlotButton(
  {
    vial,
    capacity,
    vialIndex,
    selected = false,
    interactive = true,
    onPress,
  },
  ref,
) {
  const topColor = getTopColor(vial);
  const label = vial.length === 0
    ? `Vial ${vialIndex + 1}, empty`
    : `Vial ${vialIndex + 1}, ${vial.length} of ${capacity} filled, top color ${topColor}`;

  return (
    <span className={styles.vialSlot} data-vial-slot={vialIndex}>
      <button
        ref={ref}
        type="button"
        className={styles.vialButton}
        data-selected={selected ? "true" : "false"}
        aria-pressed={interactive ? selected : undefined}
        aria-label={label}
        tabIndex={interactive ? 0 : -1}
        onClick={interactive ? onPress : undefined}
      />
    </span>
  );
});
