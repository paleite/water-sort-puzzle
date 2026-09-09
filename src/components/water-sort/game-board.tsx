"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import type { GamePhase } from "@/hooks/use-water-sort-game";
import { calculatePourGeometry } from "@/lib/water-sort/animation/pour-geometry";
import {
  createPourTimeline,
  type PourPresentationSnapshot,
} from "@/lib/water-sort/animation/timelines";
import { GAME_TIMING } from "@/lib/water-sort/animation/timing";
import type { AppliedMove, Board } from "@/lib/water-sort/domain/types";
import { measureVialAnchors } from "@/lib/water-sort/rendering/dom-anchors";
import { PixiBoardRenderer } from "@/lib/water-sort/rendering/pixi-board-renderer";
import {
  buildPourBoardRenderState,
  buildStaticBoardRenderState,
  type BoardRenderState,
  type VialAnchor,
} from "@/lib/water-sort/rendering/render-state";

import { DebugLogOverlay } from "./debug-log-overlay";
import { VialSlotButton } from "./vial-slot-button";
import styles from "./water-sort.module.css";

interface LastMoveDebugState {
  sourceVialIndex: number;
  destinationVialIndex: number;
}

type TransientStateBuilder = (anchors: readonly VialAnchor[]) => BoardRenderState;

function setVialRef(
  refs: MutableRefObject<Map<number, HTMLButtonElement>>,
  vialIndex: number,
  element: HTMLButtonElement | null,
): void {
  if (element === null) refs.current.delete(vialIndex);
  else refs.current.set(vialIndex, element);
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
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const vialRefs = useRef(new Map<number, HTMLButtonElement>());
  const rendererRef = useRef<PixiBoardRenderer | null>(null);
  const transientStateBuilderRef = useRef<TransientStateBuilder | null>(null);
  const renderLatestRef = useRef<() => void>(() => {});
  const lastPourSnapshotRef = useRef<PourPresentationSnapshot | null>(null);
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
    const presentation = lastPourSnapshotRef.current;

    appendDebugLog(
      `${label} ${role}=v${vialIndex + 1} `
      + `slot=(${formatNumber(relativeX)},${formatNumber(relativeY)}) `
      + `offset=(${element.offsetLeft},${element.offsetTop}) `
      + `selected=${element.dataset.selected ?? "?"} `
      + `dom.transform=${computedStyle.transform || "none"}`
      + (role === "src" && presentation !== null
        ? ` render[x=${formatNumber(presentation.sourceX)} `
          + `y=${formatNumber(presentation.sourceY)} `
          + `r=${formatNumber(presentation.sourceRotationDegrees)}]`
        : ""),
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
        const relativeTop = rect.top - boardRect.top;
        return `v${vialIndex + 1}:top=${formatNumber(relativeTop)}/off=${element.offsetTop}`;
      });

    appendDebugLog(`${label} BOARD ${positions.join(" | ")}`);
  }, [appendDebugLog]);

  const renderLatest = useCallback((): void => {
    const renderer = rendererRef.current;
    const boardElement = boardRef.current;
    if (renderer === null || boardElement === null) return;

    const anchors = measureVialAnchors(boardElement, vialRefs.current, board.length);
    const transientStateBuilder = transientStateBuilderRef.current;
    const state = transientStateBuilder === null
      ? buildStaticBoardRenderState({
          board,
          anchors,
          selectedSourceVialIndex,
          capacity,
        })
      : transientStateBuilder(anchors);

    renderer.render(state);
  }, [board, capacity, selectedSourceVialIndex]);

  renderLatestRef.current = renderLatest;

  useLayoutEffect(() => {
    const boardElement = boardRef.current;
    const canvasHost = canvasHostRef.current;
    if (boardElement === null || canvasHost === null) return;

    const renderer = new PixiBoardRenderer({boardElement, canvasHost});
    rendererRef.current = renderer;
    void renderer.initialize().catch((error: unknown) => {
      console.error("Failed to initialize Pixi board renderer.", error);
    });

    let scheduledFrame = 0;
    const scheduleRender = (): void => {
      if (scheduledFrame !== 0) cancelAnimationFrame(scheduledFrame);
      scheduledFrame = requestAnimationFrame(() => {
        scheduledFrame = 0;
        renderLatestRef.current();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleRender);
    resizeObserver.observe(boardElement);
    for (const element of vialRefs.current.values()) resizeObserver.observe(element);
    window.addEventListener("resize", scheduleRender);
    scheduleRender();

    return () => {
      if (scheduledFrame !== 0) cancelAnimationFrame(scheduledFrame);
      window.removeEventListener("resize", scheduleRender);
      resizeObserver.disconnect();
      renderer.destroy();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [board.length]);

  useLayoutEffect(() => {
    renderLatest();
  }, [phase, renderLatest]);

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
        appendDebugLog("post-commit:rAF2");
        logBoardPositions("post-commit:rAF2");
      });
    });
  }, [appendDebugLog, logBoardPositions, logVialSnapshot, phase]);

  useGSAP(() => {
    const boardElement = boardRef.current;
    if (boardElement === null) return;

    transientStateBuilderRef.current = null;
    lastPourSnapshotRef.current = null;

    if (phase === "presentingMove" && activeMove !== null) {
      const sourceVialIndex = activeMove.move.sourceVialIndex;
      const destinationVialIndex = activeMove.move.destinationVialIndex;
      const sourceElement = vialRefs.current.get(sourceVialIndex);
      const destinationElement = vialRefs.current.get(destinationVialIndex);

      if (sourceElement === undefined || destinationElement === undefined) {
        throw new Error("Missing DOM slot required for pour presentation.");
      }

      lastMoveDebugRef.current = {sourceVialIndex, destinationVialIndex};
      const geometry = calculatePourGeometry(boardElement, sourceElement, destinationElement);

      appendDebugLog(
        `MOVE v${sourceVialIndex + 1}->v${destinationVialIndex + 1} `
        + `amount=${activeMove.amount} `
        + `geom[dx=${formatNumber(geometry.translationX)} `
        + `dy=${formatNumber(geometry.translationY)} `
        + `rot=${formatNumber(geometry.rotationDegrees)}]`,
      );
      logVialSnapshot("before", "src", sourceVialIndex, sourceElement);
      logVialSnapshot("before", "dst", destinationVialIndex, destinationElement);

      const presentation = createPourTimeline({
        geometry,
        move: activeMove,
        sourceWidthPixels: sourceElement.getBoundingClientRect().width,
        onFrame: (snapshot) => {
          lastPourSnapshotRef.current = snapshot;
          transientStateBuilderRef.current = (anchors) => buildPourBoardRenderState({
            move: activeMove,
            anchors,
            selectedSourceVialIndex,
            geometry,
            presentation: snapshot,
            capacity,
          });
          renderLatestRef.current();
        },
        onDebug: (event, timeSeconds) => {
          const label = `t=${timeSeconds.toFixed(3)} ${event}`;
          appendDebugLog(label);
          logVialSnapshot(label, "src", sourceVialIndex, sourceElement);
          logVialSnapshot(label, "dst", destinationVialIndex, destinationElement);
        },
        onComplete: onMovePresentationFinished,
      });

      return () => {
        presentation.timeline.kill();
        transientStateBuilderRef.current = null;
        lastPourSnapshotRef.current = null;
      };
    }

    if (phase === "presentingUndo" && activeUndo !== null) {
      appendDebugLog(
        `UNDO v${activeUndo.move.sourceVialIndex + 1}<->v${activeUndo.move.destinationVialIndex + 1}`,
      );

      const motion = {scale: 1, alpha: 1};
      const sourceIndex = activeUndo.move.sourceVialIndex;
      const destinationIndex = activeUndo.move.destinationVialIndex;
      transientStateBuilderRef.current = (anchors) => {
        const state = buildStaticBoardRenderState({
          board,
          anchors,
          selectedSourceVialIndex: null,
          capacity,
        });
        return {
          ...state,
          vials: state.vials.map((vial) =>
            vial.vialIndex === sourceIndex || vial.vialIndex === destinationIndex
              ? {...vial, scale: motion.scale, alpha: motion.alpha}
              : vial
          ),
        };
      };
      renderLatestRef.current();

      const timeline = gsap
        .timeline({
          onUpdate: () => renderLatestRef.current(),
          onComplete: onUndoPresentationFinished,
        })
        .to(motion, {
          scale: 0.97,
          alpha: 0.72,
          duration: GAME_TIMING.undoSeconds / 2,
          ease: "power2.out",
        })
        .to(motion, {
          scale: 1,
          alpha: 1,
          duration: GAME_TIMING.undoSeconds / 2,
          ease: "power2.in",
        });

      return () => {
        timeline.kill();
        transientStateBuilderRef.current = null;
      };
    }

    if (phase === "presentingRestart") {
      appendDebugLog("RESTART");
      const motion = {alpha: 0.45, scale: 0.985};
      transientStateBuilderRef.current = (anchors) => buildStaticBoardRenderState({
        board,
        anchors,
        selectedSourceVialIndex: null,
        capacity,
        boardAlpha: motion.alpha,
        boardScale: motion.scale,
      });
      renderLatestRef.current();

      const timeline = gsap.timeline({
        onUpdate: () => renderLatestRef.current(),
        onComplete: onRestartPresentationFinished,
      }).to(motion, {
        alpha: 1,
        scale: 1,
        duration: GAME_TIMING.restartSeconds,
        ease: "power2.out",
      });

      return () => {
        timeline.kill();
        transientStateBuilderRef.current = null;
      };
    }

    renderLatestRef.current();
  }, {
    scope: boardRef,
    dependencies: [
      phase,
      activeMove,
      activeUndo,
      board,
      capacity,
      selectedSourceVialIndex,
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
        <div ref={canvasHostRef} className={styles.pixiCanvasHost} aria-hidden="true" />

        <div className={styles.vialGrid}>
          {board.map((vial, vialIndex) => (
            <VialSlotButton
              key={vialIndex}
              ref={(element) => setVialRef(vialRefs, vialIndex, element)}
              vial={vial}
              capacity={capacity}
              vialIndex={vialIndex}
              selected={selectedSourceVialIndex === vialIndex}
              onPress={() => onVialPress(vialIndex)}
            />
          ))}
        </div>
      </div>

      <DebugLogOverlay
        entries={debugEntries}
        phase={phase}
        onClear={clearDebugLogs}
      />
    </>
  );
}
