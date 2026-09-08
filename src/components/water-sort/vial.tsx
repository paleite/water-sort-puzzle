"use client";

import { forwardRef, useId, type CSSProperties } from "react";

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

const VIAL_INTERIOR_PATH =
  "M 10 10 H 90 V 194 C 90 220 73 236 50 236 C 27 236 10 220 10 194 Z";
const VIAL_OUTLINE_PATH =
  "M 10 10 V 194 C 10 220 27 236 50 236 C 73 236 90 220 90 194 V 10";

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
  const rawClipId = useId();
  const clipId = `vial-clip-${rawClipId.replaceAll(":", "")}`;
  const topColor = getTopColor(vial);
  const label = vial.length === 0
    ? `Vial ${vialIndex + 1}, empty`
    : `Vial ${vialIndex + 1}, ${vial.length} of ${capacity} filled, top color ${topColor}`;

  const outgoingBaseFill = outgoing === undefined
    ? vial.length
    : vial.length - outgoing.amount;
  const mergedIncomingBaseFill = getMergedIncomingBaseFill(vial, incoming);
  const selectionLifted = selected && outgoing === undefined;

  const staticLayerCount = outgoing !== undefined
    ? 0
    : incoming !== undefined
      ? mergedIncomingBaseFill
      : vial.length;

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
        <svg
          className={styles.vialSvg}
          viewBox="0 0 100 240"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipId}>
              <path d={VIAL_INTERIOR_PATH} />
            </clipPath>
          </defs>

          <path className={styles.vialGlassFill} d={VIAL_INTERIOR_PATH} />

          <g clipPath={`url(#${clipId})`}>
            <svg
              data-liquid-viewport=""
              x="10"
              y="10"
              width="80"
              height="226"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {vial.slice(0, staticLayerCount).map((color, index) => (
                <rect
                  key={`static-${index}-${color}`}
                  x="0"
                  y={fillToY(index + 1, capacity)}
                  width="100"
                  height={100 / capacity}
                  className={styles.liquidRect}
                  style={{"--liquid-color": LIQUID_COLORS[color]} as CSSProperties}
                />
              ))}

              {outgoing !== undefined && sourceDynamicLayers.map((layer, index) => (
                <path
                  key={`source-${index}-${layer.color}`}
                  data-source-liquid-layer=""
                  className={styles.dynamicLiquidBody}
                  d={rectangularLayerPath(layer.lowerFill, layer.upperFill, capacity)}
                  style={{"--liquid-color": LIQUID_COLORS[layer.color]} as CSSProperties}
                />
              ))}

              {incoming !== undefined && (
                <path
                  data-destination-liquid-path=""
                  className={styles.dynamicLiquidBody}
                  d={rectangularLayerPath(
                    mergedIncomingBaseFill,
                    vial.length,
                    capacity,
                  )}
                  style={{"--liquid-color": LIQUID_COLORS[incoming.color]} as CSSProperties}
                />
              )}

              {outgoing !== undefined && (
                <path
                  data-source-surface-path=""
                  className={styles.dynamicLiquidSurface}
                  d={horizontalSurfacePath(vial.length, capacity)}
                  style={{"--liquid-color": LIQUID_COLORS[outgoing.color]} as CSSProperties}
                />
              )}

              {incoming !== undefined && (
                <path
                  data-destination-surface-path=""
                  className={styles.dynamicLiquidSurface}
                  d={horizontalSurfacePath(vial.length, capacity)}
                  style={{"--liquid-color": LIQUID_COLORS[incoming.color]} as CSSProperties}
                />
              )}

              {incoming === undefined && outgoing === undefined && topColor !== null && (
                <path
                  data-liquid-surface=""
                  className={styles.dynamicLiquidSurface}
                  d={horizontalSurfacePath(vial.length, capacity)}
                  style={{"--liquid-color": LIQUID_COLORS[topColor]} as CSSProperties}
                />
              )}
            </svg>
          </g>

          <path className={styles.vialGlassOutline} d={VIAL_OUTLINE_PATH} />
          <rect className={styles.vialMouth} x="24" y="2" width="52" height="9" rx="4.5" />

          <circle data-vial-mouth-left="" cx="10" cy="10" r="0.5" fill="transparent" />
          <circle data-vial-mouth-right="" cx="90" cy="10" r="0.5" fill="transparent" />
        </svg>
      </button>
    </span>
  );
});
