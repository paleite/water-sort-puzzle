"use client";

import { forwardRef, useId, type CSSProperties } from "react";

import type { ColorId } from "@/lib/water-sort/domain/colors";
import type { Vial as VialState } from "@/lib/water-sort/domain/types";
import { getTopColor } from "@/lib/water-sort/domain/vial";
import { LIQUID_COLORS } from "@/lib/water-sort/presentation/palette";
import {
  fillToVialY,
  liquidLayerRect,
  VIAL_INNER_BOTTOM,
  VIAL_INNER_LEFT,
  VIAL_INNER_RIGHT,
  VIAL_INNER_TOP,
  VIAL_INNER_WIDTH,
  VIAL_INTERIOR_PATH,
  VIAL_MOUTH,
  VIAL_OUTLINE_PATH,
  VIAL_VIEWBOX_HEIGHT,
  VIAL_VIEWBOX_WIDTH,
} from "@/lib/water-sort/presentation/vial-geometry";

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
  debugGeometry?: boolean;
  onPress?: () => void;
}

const DEBUG_SURFACE_POINT_COUNT = 11;

function flatLiquidBodyPath(
  baseFill: number,
  topFill: number,
  capacity: number,
): string {
  const topY = fillToVialY(topFill, capacity);
  const baseY = fillToVialY(baseFill, capacity);

  return [
    `M ${VIAL_INNER_LEFT} ${topY}`,
    `L ${VIAL_INNER_RIGHT} ${topY}`,
    `L ${VIAL_INNER_RIGHT} ${baseY}`,
    `L ${VIAL_INNER_LEFT} ${baseY}`,
    "Z",
  ].join(" ");
}

function flatSurfacePath(fill: number, capacity: number): string {
  const y = fillToVialY(fill, capacity);
  return `M ${VIAL_INNER_LEFT} ${y} L ${VIAL_INNER_RIGHT} ${y}`;
}

function getMergedIncomingBaseFill(
  vial: VialState,
  incoming: MovingLiquid | undefined,
): number {
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
    debugGeometry = false,
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
    ? outgoingBaseFill
    : incoming !== undefined
      ? mergedIncomingBaseFill
      : vial.length;

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
          viewBox={`0 0 ${VIAL_VIEWBOX_WIDTH} ${VIAL_VIEWBOX_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipId}>
              <path d={VIAL_INTERIOR_PATH} />
            </clipPath>
          </defs>

          <path className={styles.vialGlassFill} d={VIAL_INTERIOR_PATH} />

          <g clipPath={`url(#${clipId})`}>
            {vial.slice(0, staticLayerCount).map((color, index) => {
              const rect = liquidLayerRect(index, capacity);
              return (
                <rect
                  key={`static-${index}-${color}`}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  className={styles.liquidRect}
                  style={{"--liquid-color": LIQUID_COLORS[color]} as CSSProperties}
                />
              );
            })}

            {outgoing !== undefined && (
              <path
                data-source-liquid-layer=""
                className={styles.dynamicLiquidBody}
                d={flatLiquidBodyPath(outgoingBaseFill, vial.length, capacity)}
                style={{"--liquid-color": LIQUID_COLORS[outgoing.color]} as CSSProperties}
              />
            )}

            {incoming !== undefined && (
              <path
                data-destination-liquid-path=""
                className={styles.dynamicLiquidBody}
                d={flatLiquidBodyPath(
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
                d={flatSurfacePath(vial.length, capacity)}
                style={{"--liquid-color": LIQUID_COLORS[outgoing.color]} as CSSProperties}
              />
            )}

            {incoming !== undefined && (
              <path
                data-destination-surface-path=""
                className={styles.dynamicLiquidSurface}
                d={flatSurfacePath(vial.length, capacity)}
                style={{"--liquid-color": LIQUID_COLORS[incoming.color]} as CSSProperties}
              />
            )}

            {incoming === undefined && outgoing === undefined && topColor !== null && (
              <path
                data-liquid-surface=""
                className={styles.dynamicLiquidSurface}
                d={flatSurfacePath(vial.length, capacity)}
                style={{"--liquid-color": LIQUID_COLORS[topColor]} as CSSProperties}
              />
            )}
          </g>

          <rect
            data-liquid-bounds=""
            x={VIAL_INNER_LEFT}
            y={VIAL_INNER_TOP}
            width={VIAL_INNER_WIDTH}
            height={VIAL_INNER_BOTTOM - VIAL_INNER_TOP}
            fill="transparent"
            pointerEvents="none"
          />

          <path className={styles.vialGlassOutline} d={VIAL_OUTLINE_PATH} />
          <rect className={styles.vialMouth} x="24" y="2" width="52" height="10" rx="5" />

          <circle
            data-vial-mouth-left=""
            cx={VIAL_MOUTH.left.x}
            cy={VIAL_MOUTH.left.y}
            r="0.7"
            fill="transparent"
          />
          <circle
            data-vial-mouth-right=""
            cx={VIAL_MOUTH.right.x}
            cy={VIAL_MOUTH.right.y}
            r="0.7"
            fill="transparent"
          />

          {debugGeometry && (
            <g className={styles.vialGeometryGuides} pointerEvents="none">
              <path d={VIAL_INTERIOR_PATH} className={styles.debugVialInterior} />
              <rect
                x={VIAL_INNER_LEFT}
                y={VIAL_INNER_TOP}
                width={VIAL_INNER_WIDTH}
                height={VIAL_INNER_BOTTOM - VIAL_INNER_TOP}
                className={styles.debugLiquidBounds}
              />
              <circle
                cx={VIAL_MOUTH.left.x}
                cy={VIAL_MOUTH.left.y}
                r="2.5"
                className={styles.debugMouthAnchor}
              />
              <circle
                cx={VIAL_MOUTH.right.x}
                cy={VIAL_MOUTH.right.y}
                r="2.5"
                className={styles.debugMouthAnchor}
              />
              {Array.from({length: DEBUG_SURFACE_POINT_COUNT}, (_, index) => (
                <circle
                  key={index}
                  data-debug-destination-point=""
                  cx={
                    VIAL_INNER_LEFT
                    + (index / (DEBUG_SURFACE_POINT_COUNT - 1)) * VIAL_INNER_WIDTH
                  }
                  cy={VIAL_INNER_BOTTOM}
                  r="1.7"
                  className={styles.debugSurfacePoint}
                />
              ))}
            </g>
          )}
        </svg>
      </button>
    </span>
  );
});
