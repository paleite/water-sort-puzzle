"use client";

import { forwardRef, type CSSProperties } from "react";

import type { ColorId } from "@/lib/water-sort/domain/colors";
import type { Vial as VialState } from "@/lib/water-sort/domain/types";
import { getTopColor } from "@/lib/water-sort/domain/vial";
import { LIQUID_COLORS } from "@/lib/water-sort/presentation/palette";

import styles from "./water-sort.module.css";

interface MovingLiquid {
  color: ColorId;
  amount: number;
}

interface VialProps {
  vial: VialState;
  capacity: number;
  vialIndex: number;
  selected?: boolean;
  interactive?: boolean;
  incoming?: MovingLiquid;
  outgoing?: MovingLiquid;
  onPress?: () => void;
}

function fillToY(fill: number, capacity: number): number {
  return 100 * (1 - fill / capacity);
}

function rectangularLayerPath(
  lowerFill: number,
  upperFill: number,
  capacity: number,
): string {
  const upperY = fillToY(upperFill, capacity);
  const lowerY = fillToY(lowerFill, capacity);
  return `M 0 ${upperY} L 100 ${upperY} L 100 ${lowerY} L 0 ${lowerY} Z`;
}

function horizontalSurfacePath(fill: number, capacity: number): string {
  const y = fillToY(fill, capacity);
  return `M 0 ${y} L 100 ${y}`;
}

function getMergedIncomingBaseFill(vial: VialState, incoming: MovingLiquid | undefined): number {
  if (incoming === undefined) return vial.length;

  let baseFill = vial.length;
  while (baseFill > 0 && vial[baseFill - 1] === incoming.color) {
    baseFill -= 1;
  }
  return baseFill;
}

export const Vial = forwardRef<HTMLButtonElement, VialProps>(function Vial(
  {
    vial,
    capacity,
    vialIndex,
    selected = false,
    interactive = true,
    incoming,
    outgoing,
    onPress,
  },
  ref,
) {
  const topColor = getTopColor(vial);
  const label = vial.length === 0
    ? `Vial ${vialIndex + 1}, empty`
    : `Vial ${vialIndex + 1}, ${vial.length} of ${capacity} filled, top color ${topColor}`;

  const outgoingBaseFill = outgoing === undefined
    ? vial.length
    : vial.length - outgoing.amount;

  const sourceDynamicLayers = outgoing === undefined
    ? []
    : [
        ...vial.slice(0, outgoingBaseFill).map((color, index) => ({
          color,
          lowerFill: index,
          upperFill: index + 1,
        })),
        {
          color: outgoing.color,
          lowerFill: outgoingBaseFill,
          upperFill: vial.length,
        },
      ];

  const incomingBaseFill = vial.length;
  const mergedIncomingBaseFill = getMergedIncomingBaseFill(vial, incoming);
  const selectionLifted = selected && outgoing === undefined;

  return (
    <span
      className={styles.vialSlot}
      data-selection-lifted={selectionLifted ? "true" : "false"}
    >
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
          {vial.map((color, index) => {
            const hiddenForOutgoing = outgoing !== undefined;
            const hiddenForIncomingMerge =
              incoming !== undefined && index >= mergedIncomingBaseFill;
            const hidden = hiddenForOutgoing || hiddenForIncomingMerge;

            return (
              <span
                key={index}
                className={`${styles.liquidUnit}${hidden ? ` ${styles.liquidUnitHidden}` : ""}`}
                data-liquid-unit=""
                style={{
                  "--liquid-color": LIQUID_COLORS[color],
                  "--segment-index": index,
                  "--capacity": capacity,
                } as CSSProperties}
              />
            );
          })}

          {topColor !== null && outgoing === undefined && incoming === undefined && (
            <span
              className={styles.liquidSurface}
              data-liquid-surface=""
              style={{
                "--liquid-color": LIQUID_COLORS[topColor],
                "--fill-ratio": vial.length / capacity,
              } as CSSProperties}
            />
          )}

          {outgoing !== undefined && (
            <svg
              className={styles.dynamicLiquidLayer}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {sourceDynamicLayers.map((layer, index) => (
                <path
                  key={`${index}-${layer.color}`}
                  data-source-liquid-layer=""
                  className={styles.dynamicLiquidBody}
                  d={rectangularLayerPath(layer.lowerFill, layer.upperFill, capacity)}
                  style={{
                    "--liquid-color": LIQUID_COLORS[layer.color],
                  } as CSSProperties}
                />
              ))}
              <path
                data-source-surface-path=""
                className={styles.dynamicLiquidSurface}
                d={horizontalSurfacePath(vial.length, capacity)}
                style={{
                  "--liquid-color": LIQUID_COLORS[outgoing.color],
                } as CSSProperties}
              />
            </svg>
          )}

          {incoming !== undefined && (
            <svg
              className={styles.dynamicLiquidLayer}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                data-destination-liquid-path=""
                className={styles.dynamicLiquidBody}
                d={rectangularLayerPath(
                  mergedIncomingBaseFill,
                  incomingBaseFill,
                  capacity,
                )}
                style={{
                  "--liquid-color": LIQUID_COLORS[incoming.color],
                } as CSSProperties}
              />
              <path
                data-destination-surface-path=""
                className={styles.dynamicLiquidSurface}
                d={horizontalSurfacePath(incomingBaseFill, capacity)}
                style={{
                  "--liquid-color": LIQUID_COLORS[incoming.color],
                } as CSSProperties}
              />
            </svg>
          )}
        </span>
      </button>
    </span>
  );
});
