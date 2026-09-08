"use client";

import { forwardRef, type CSSProperties } from "react";

import type { ColorId } from "@/lib/water-sort/domain/colors";
import type { Vial as VialState } from "@/lib/water-sort/domain/types";
import { getTopColor } from "@/lib/water-sort/domain/vial";
import { LIQUID_COLORS } from "@/lib/water-sort/presentation/palette";

import styles from "./water-sort.module.css";

interface VialProps {
  vial: VialState;
  capacity: number;
  vialIndex: number;
  selected?: boolean;
  interactive?: boolean;
  incoming?: {color: ColorId; amount: number};
  onPress?: () => void;
}

export const Vial = forwardRef<HTMLButtonElement, VialProps>(function Vial(
  {
    vial,
    capacity,
    vialIndex,
    selected = false,
    interactive = true,
    incoming,
    onPress,
  },
  ref,
) {
  const topColor = getTopColor(vial);
  const label = vial.length === 0
    ? `Vial ${vialIndex + 1}, empty`
    : `Vial ${vialIndex + 1}, ${vial.length} of ${capacity} filled, top color ${topColor}`;

  return (
    <button
      ref={ref}
      type="button"
      className={styles.vialButton}
      data-selected={selected ? "true" : "false"}
      aria-pressed={interactive ? selected : undefined}
      aria-label={label}
      tabIndex={interactive ? 0 : -1}
      onClick={interactive ? onPress : undefined}
    >
      <span className={styles.vialGlass} aria-hidden="true">
        {vial.map((color, index) => (
          <span
            key={index}
            className={styles.liquidUnit}
            data-liquid-unit=""
            style={{
              "--liquid-color": LIQUID_COLORS[color],
              "--segment-index": index,
              "--capacity": capacity,
            } as CSSProperties}
          />
        ))}

        {topColor !== null && incoming === undefined && (
          <span
            className={styles.liquidSurface}
            data-liquid-surface=""
            style={{
              "--liquid-color": LIQUID_COLORS[topColor],
              "--fill-ratio": vial.length / capacity,
            } as CSSProperties}
          />
        )}

        {incoming !== undefined && (
          <>
            <span
              className={styles.incomingLiquid}
              data-incoming-liquid=""
              style={{
                "--liquid-color": LIQUID_COLORS[incoming.color],
                "--incoming-bottom": vial.length / capacity,
                "--incoming-height": incoming.amount / capacity,
              } as CSSProperties}
            />
            <span
              className={styles.incomingSurface}
              data-incoming-surface=""
              style={{
                "--liquid-color": LIQUID_COLORS[incoming.color],
                "--incoming-bottom": vial.length / capacity,
              } as CSSProperties}
            />
            <span
              className={styles.impactPlume}
              data-impact-plume=""
              style={{
                "--liquid-color": LIQUID_COLORS[incoming.color],
                "--incoming-bottom": vial.length / capacity,
              } as CSSProperties}
            />
          </>
        )}
      </span>
    </button>
  );
});
