"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import type { GamePhase } from "@/hooks/use-water-sort-game";
import { calculatePourGeometry } from "@/lib/water-sort/animation/pour-geometry";
import {
  createPourTimeline,
  createRestartTimeline,
  createUndoTimeline,
} from "@/lib/water-sort/animation/timelines";
import type { AppliedMove, Board } from "@/lib/water-sort/domain/types";
import { LIQUID_COLORS } from "@/lib/water-sort/presentation/palette";

import { DebugLogOverlay } from "./debug-log-overlay";
import { Vial } from "./vial";
import styles from "./water-sort.module.css";

interface LastMoveDebugState {
  sourceVialIndex: number;
  destinationVialIndex: number;
}

function setVialRef(
  refs: MutableRefObject<Map<number, HTMLButtonElement>>,
  vialIndex: number,
  element: HTMLButtonElement | null,
): void {
  if (element === null) refs.current.delete(vialIndex);
  else refs.current.set(vialIndex, element);
}

function getGsapNumber(element: HTMLElement, property: string): number {
  const value = gsap.getProperty(element, property);
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number): string {
  return value.toFixed(1);
}

function getTimestamp(): string {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
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
  const streamRef = useRef<SVGPathElement>(null);
  const vialRefs = useRef(new Map<number, HTMLButtonElement>());
  const debugSequenceRef = useRef(0);
  const previousPhaseRef = useRef<GamePhase | null>(null);
  const lastMoveDebugRef = useRef<LastMoveDebugState | null>(null);
  const [debugEntries, setDebugEntries] = useState<string[]>([]);

  const appendDebugLog = useCallback((message: string): void => {
    debugSequenceRef.current += 1;
    const entry = `#${debugSequenceRef.current} ${getTimestamp()} ${message}`;
    setDebugEntries((current) => [...current.slice(-139), entry]);
  }, []);

  const clearDebugLogs = useCallback((): void => {
    setDebugEntries([]);
  }, []);

  const logVialSnapshot = useCallback((
    label: string,
    role: "src" | "dst",
    vialIndex: number,
    element: HTMLButtonElement,
  ): void => {
    const boardElement = boardRef.current;
    const boardRect = boardElement?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const computedStyle = getComputedStyle(element);
    const relativeX = boardRect === undefined ? rect.left : rect.left - boardRect.left;
    const relativeY = boardRect === undefined ? rect.top : rect.top - boardRect.top;
    const x = getGsapNumber(element, "x");
    const y = getGsapNumber(element, "y");
    const rotation = getGsapNumber(element, "rotation");
    const scaleX = getGsapNumber(element, "scaleX");
    const scaleY = getGsapNumber(element, "scaleY");

    appendDebugLog(
      `${label} ${role}=v${vialIndex + 1} `
      + `rect=(${formatNumber(relativeX)},${formatNumber(relativeY)}) `
      + `offset=(${element.offsetLeft},${element.offsetTop}) `
      + `gsap[x=${formatNumber(x)} y=${formatNumber(y)} r=${formatNumber(rotation)} `
      + `sx=${formatNumber(scaleX)} sy=${formatNumber(scaleY)}] `
      + `selected=${element.dataset.selected ?? "?"} `
      + `css.translate=${computedStyle.translate || "none"} `
      + `inline.transform=${element.style.transform || "∅"} `
      + `computed.transform=${computedStyle.transform || "none"}`,
    );
  }, [appendDebugLog]);

  const logBoardPositions = useCallback((label: string): void => {
    const boardElement = boardRef.current;
    if (boardElement === null) return;
    const boardRect = boardElement.getBoundingClientRect();

    const positions = [...vialRefs.current.entries()]
      .sort(([firstIndex], [secondIndex]) => firstIndex - secondIndex)
      .map(([vialIndex, element]) => {
        const rect = element.getBoundingClientRect();
        const x = getGsapNumber(element, "x");
        const y = getGsapNumber(element, "y");
        const rotation = getGsapNumber(element, "rotation");
        const relativeTop = rect.top - boardRect.top;
        return `v${vialIndex + 1}:top=${formatNumber(relativeTop)}`
          + `/off=${element.offsetTop}`
          + `/x=${formatNumber(x)}`
          + `/y=${formatNumber(y)}`
          + `/r=${formatNumber(rotation)}`;
      });

    appendDebugLog(`${label} BOARD ${positions.join(" | ")}`);
  }, [appendDebugLog]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = phase;

    if (previousPhase === null) {
      appendDebugLog(`phase:init ${phase}`);
      requestAnimationFrame(() => logBoardPositions("initial"));
      return;
    }

    if (previousPhase === phase) return;
    appendDebugLog(`phase ${previousPhase} -> ${phase}`);

    if (previousPhase !== "presentingMove") return;
    const lastMove = lastMoveDebugRef.current;
    if (lastMove === null) return;

    requestAnimationFrame(() => {
      const sourceElement = vialRefs.current.get(lastMove.sourceVialIndex);
      const destinationElement = vialRefs.current.get(lastMove.destinationVialIndex);
      appendDebugLog("post-commit:rAF1");
      if (sourceElement !== undefined) {
        logVialSnapshot("post-commit:rAF1", "src", lastMove.sourceVialIndex, sourceElement);
      }
      if (destinationElement !== undefined) {
        logVialSnapshot("post-commit:rAF1", "dst", lastMove.destinationVialIndex, destinationElement);
      }

      requestAnimationFrame(() => {
        const secondSourceElement = vialRefs.current.get(lastMove.sourceVialIndex);
        const secondDestinationElement = vialRefs.current.get(lastMove.destinationVialIndex);
        appendDebugLog("post-commit:rAF2");
        if (secondSourceElement !== undefined) {
          logVialSnapshot(
            "post-commit:rAF2",
            "src",
            lastMove.sourceVialIndex,
            secondSourceElement,
          );
        }
        if (secondDestinationElement !== undefined) {
          logVialSnapshot(
            "post-commit:rAF2",
            "dst",
            lastMove.destinationVialIndex,
            secondDestinationElement,
          );
        }
        logBoardPositions("post-commit:rAF2");
      });
    });
  }, [appendDebugLog, logBoardPositions, logVialSnapshot, phase]);

  useGSAP(() => {
    const boardElement = boardRef.current;
    if (boardElement === null) return;

    if (phase === "presentingMove" && activeMove !== null) {
      const sourceVialIndex = activeMove.move.sourceVialIndex;
      const destinationVialIndex = activeMove.move.destinationVialIndex;
      const sourceElement = vialRefs.current.get(sourceVialIndex);
      const destinationElement = vialRefs.current.get(destinationVialIndex);
      const streamElement = streamRef.current;

      if (sourceElement === undefined || destinationElement === undefined || streamElement === null) {
        throw new Error("Missing DOM element required for pour presentation.");
      }

      lastMoveDebugRef.current = {sourceVialIndex, destinationVialIndex};
      const geometry = calculatePourGeometry(
        boardElement,
        sourceElement,
        destinationElement,
      );

      appendDebugLog(
        `MOVE v${sourceVialIndex + 1}->v${destinationVialIndex + 1} `
        + `amount=${activeMove.amount} `
        + `geom[dx=${formatNumber(geometry.translationX)} `
        + `dy=${formatNumber(geometry.translationY)} `
        + `rot=${formatNumber(geometry.rotationDegrees)}]`,
      );
      logVialSnapshot("before", "src", sourceVialIndex, sourceElement);
      logVialSnapshot("before", "dst", destinationVialIndex, destinationElement);

      streamElement.style.fill = LIQUID_COLORS[activeMove.color];

      createPourTimeline({
        elements: {
          sourceElement,
          destinationElement,
          streamElement,
          sourceLayerElements: Array.from(
            sourceElement.querySelectorAll<SVGPathElement>("[data-source-liquid-layer]"),
          ),
          sourceSurfaceElement:
            sourceElement.querySelector<SVGPathElement>("[data-source-surface-path]"),
          destinationLiquidElement:
            destinationElement.querySelector<SVGPathElement>("[data-destination-liquid-path]"),
          destinationSurfaceElement:
            destinationElement.querySelector<SVGPathElement>("[data-destination-surface-path]"),
        },
        geometry,
        move: activeMove,
        capacity,
        onDebug: (event, timeSeconds) => {
          const label = `t=${timeSeconds.toFixed(3)} ${event}`;
          appendDebugLog(label);
          logVialSnapshot(label, "src", sourceVialIndex, sourceElement);
          logVialSnapshot(label, "dst", destinationVialIndex, destinationElement);
        },
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
      appendDebugLog(
        `UNDO v${activeUndo.move.sourceVialIndex + 1}<->v${activeUndo.move.destinationVialIndex + 1}`,
      );
      createUndoTimeline(sourceElement, destinationElement, onUndoPresentationFinished);
      return;
    }

    if (phase === "presentingRestart") {
      appendDebugLog("RESTART");
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
      appendDebugLog,
      logVialSnapshot,
    ],
    revertOnUpdate: true,
  });

  return (
    <>
      <div ref={boardRef} className={styles.board}>
        <div className={styles.vialGrid}>
          {board.map((vial, vialIndex) => {
            const isPresentingMove = phase === "presentingMove" && activeMove !== null;
            const incoming =
              isPresentingMove && activeMove.move.destinationVialIndex === vialIndex
                ? {color: activeMove.color, amount: activeMove.amount}
                : undefined;
            const outgoing =
              isPresentingMove && activeMove.move.sourceVialIndex === vialIndex
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
                {...(outgoing === undefined ? {} : {outgoing})}
                onPress={() => onVialPress(vialIndex)}
              />
            );
          })}
        </div>

        <svg className={styles.streamLayer} aria-hidden="true">
          <path ref={streamRef} style={{opacity: 0}} />
        </svg>
      </div>

      <DebugLogOverlay
        entries={debugEntries}
        phase={phase}
        onClear={clearDebugLogs}
      />
    </>
  );
}
