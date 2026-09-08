"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, useState } from "react";

import { Vial } from "@/components/water-sort/vial";
import { calculatePourGeometry } from "@/lib/water-sort/animation/pour-geometry";
import { createPourTimeline } from "@/lib/water-sort/animation/timelines";
import { applyMove } from "@/lib/water-sort/domain/moves";
import type { Board } from "@/lib/water-sort/domain/types";
import { LIQUID_COLORS } from "@/lib/water-sort/presentation/palette";

import styles from "@/components/water-sort/water-sort.module.css";

const DEMO_BOARD: Board = [
  ["cocoa", "coral"],
  ["coral", "coral"],
  ["sky", "sky", "sky", "sky"],
];

const DEMO_MOVE = applyMove(
  DEMO_BOARD,
  {
    sourceVialIndex: 0,
    destinationVialIndex: 1,
  },
  4,
);

export function HomeHero() {
  const [board, setBoard] = useState<Board>(DEMO_BOARD);

  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLButtonElement>(null);
  const destinationRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<SVGLineElement>(null);
  const hasPlayedRef = useRef(false);

  useGSAP(
    () => {
      if (hasPlayedRef.current) return;

      const container = containerRef.current;
      const source = sourceRef.current;
      const destination = destinationRef.current;
      const stream = streamRef.current;

      if (
        container === null ||
        source === null ||
        destination === null ||
        stream === null
      ) {
        return;
      }

      hasPlayedRef.current = true;

      gsap.from(container.querySelectorAll("button"), {
        y: 28,
        opacity: 0,
        duration: 0.42,
        stagger: 0.08,
        ease: "back.out(1.5)",
      });

      const delayedPour = gsap.delayedCall(0.62, () => {
        stream.style.stroke = LIQUID_COLORS[DEMO_MOVE.color];

        createPourTimeline({
          elements: {
            sourceElement: source,
            destinationElement: destination,
            streamElement: stream,
            sourceLayerElements: Array.from(
              source.querySelectorAll<SVGPathElement>("[data-source-liquid-layer]"),
            ),
            sourceSurfaceElement:
              source.querySelector<SVGPathElement>("[data-source-surface-path]"),
            destinationLiquidElement:
              destination.querySelector<SVGPathElement>("[data-destination-liquid-path]"),
            destinationSurfaceElement:
              destination.querySelector<SVGPathElement>("[data-destination-surface-path]"),
            destinationBaseSurfaceElement:
              destination.querySelector<HTMLElement>("[data-liquid-surface]"),
          },
          geometry: calculatePourGeometry(container, source, destination),
          move: DEMO_MOVE,
          capacity: 4,
          onComplete: () => setBoard(DEMO_MOVE.nextBoard),
        });
      });

      return () => {
        delayedPour.kill();
      };
    },
    {scope: containerRef},
  );

  const isBeforePour = board === DEMO_BOARD;

  return (
    <div
      ref={containerRef}
      className={styles.homeHero}
      aria-hidden="true"
    >
      {board.map((vial, index) => (
        <Vial
          key={index}
          ref={
            index === 0
              ? sourceRef
              : index === 1
                ? destinationRef
                : undefined
          }
          vial={vial}
          capacity={4}
          vialIndex={index}
          interactive={false}
          {...(
            index === 0 && isBeforePour
              ? {
                  outgoing: {
                    color: DEMO_MOVE.color,
                    amount: DEMO_MOVE.amount,
                  },
                }
              : {}
          )}
          {...(
            index === 1 && isBeforePour
              ? {
                  incoming: {
                    color: DEMO_MOVE.color,
                    amount: DEMO_MOVE.amount,
                  },
                }
              : {}
          )}
        />
      ))}

      <svg
        className={styles.streamLayer}
        aria-hidden="true"
      >
        <line
          ref={streamRef}
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
