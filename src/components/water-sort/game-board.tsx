"use client";

import { useGSAP } from "@gsap/react";
import { useRef, type MutableRefObject } from "react";

import type { GamePhase } from "@/hooks/use-water-sort-game";
import { calculatePourGeometry } from "@/lib/water-sort/animation/pour-geometry";
import {
  createPourTimeline,
  createRestartTimeline,
  createUndoTimeline,
} from "@/lib/water-sort/animation/timelines";
import type { AppliedMove, Board } from "@/lib/water-sort/domain/types";
import { LIQUID_COLORS } from "@/lib/water-sort/presentation/palette";

import { Vial } from "./vial";
import styles from "./water-sort.module.css";

function setVialRef(
  refs: MutableRefObject<Map<number, HTMLButtonElement>>,
  vialIndex: number,
  element: HTMLButtonElement | null,
): void {
  if (element === null) refs.current.delete(vialIndex);
  else refs.current.set(vialIndex, element);
}

export function GameBoard({
  board,
  capacity,
  phase,
  selectedSourceVialIndex,
  activeMove,
  activeUndo,
  onVialPress,
  onMovePresentationFinished,
  onUndoPresentationFinished,
  onRestartPresentationFinished,
}: {
  board: Board;
  capacity: number;
  phase: GamePhase;
  selectedSourceVialIndex: number | null;
  activeMove: AppliedMove | null;
  activeUndo: AppliedMove | null;
  onVialPress: (vialIndex: number) => void;
  onMovePresentationFinished: () => void;
  onUndoPresentationFinished: () => void;
  onRestartPresentationFinished: () => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<SVGLineElement>(null);
  const vialRefs = useRef(new Map<number, HTMLButtonElement>());

  useGSAP(() => {
    const boardElement = boardRef.current;
    if (boardElement === null) return;

    if (phase === "presentingMove" && activeMove !== null) {
      const sourceElement = vialRefs.current.get(activeMove.move.sourceVialIndex);
      const destinationElement = vialRefs.current.get(activeMove.move.destinationVialIndex);
      const streamElement = streamRef.current;

      if (sourceElement === undefined || destinationElement === undefined || streamElement === null) {
        throw new Error("Missing DOM element required for pour presentation.");
      }

      streamElement.style.stroke = LIQUID_COLORS[activeMove.color];

      const geometry = calculatePourGeometry(
        boardElement,
        sourceElement,
        destinationElement,
      );

      const sourceUnits = Array.from(
        sourceElement.querySelectorAll<HTMLElement>("[data-liquid-unit]"),
      );

      createPourTimeline({
        elements: {
          sourceElement,
          destinationElement,
          streamElement,
          sourceTransferredElements: sourceUnits.slice(-activeMove.amount),
          sourceSurfaceElement:
            sourceElement.querySelector<HTMLElement>("[data-liquid-surface]"),
          incomingLiquidElement:
            destinationElement.querySelector<HTMLElement>("[data-incoming-liquid]"),
          incomingSurfaceElement:
            destinationElement.querySelector<HTMLElement>("[data-incoming-surface]"),
          impactPlumeElement:
            destinationElement.querySelector<HTMLElement>("[data-impact-plume]"),
        },
        geometry,
        move: activeMove,
        capacity,
        onComplete: onMovePresentationFinished,
      });
      return;
    }

    if (phase === "presentingUndo" && activeUndo !== null) {
      const sourceElement = vialRefs.current.get(activeUndo.move.sourceVialIndex);
      const destinationElement = vialRefs.current.get(activeUndo.move.destinationVialIndex);
      if (sourceElement === undefined || destinationElement === undefined) {
        onUndoPresentationFinished();
        return;
      }
      createUndoTimeline(sourceElement, destinationElement, onUndoPresentationFinished);
      return;
    }

    if (phase === "presentingRestart") {
      createRestartTimeline(boardElement, onRestartPresentationFinished);
    }
  }, {
    scope: boardRef,
    dependencies: [
      phase,
      activeMove,
      activeUndo,
      capacity,
      onMovePresentationFinished,
      onUndoPresentationFinished,
      onRestartPresentationFinished,
    ],
    revertOnUpdate: true,
  });

  return (
    <div ref={boardRef} className={styles.board}>
      <div className={styles.vialGrid}>
        {board.map((vial, vialIndex) => {
          const incoming =
            phase === "presentingMove" &&
            activeMove !== null &&
            activeMove.move.destinationVialIndex === vialIndex
              ? {color: activeMove.color, amount: activeMove.amount}
              : undefined;

          return (
            <Vial
              key={vialIndex}
              ref={(element) => setVialRef(vialRefs, vialIndex, element)}
              vial={vial}
              capacity={capacity}
              vialIndex={vialIndex}
              selected={selectedSourceVialIndex === vialIndex}
              {...(incoming === undefined ? {} : {incoming})}
              onPress={() => onVialPress(vialIndex)}
            />
          );
        })}
      </div>

      <svg className={styles.streamLayer} aria-hidden="true">
        <line ref={streamRef} strokeWidth="7" strokeLinecap="round" />
      </svg>
    </div>
  );
}
