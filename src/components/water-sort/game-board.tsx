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
  type PourPresentation,
  type PourPresentationSnapshot,
} from "@/lib/water-sort/animation/timelines";
import { GAME_TIMING } from "@/lib/water-sort/animation/timing";
import type {
  AppliedMove,
  AppliedPourBatch,
  AppliedTurn,
  Board,
} from "@/lib/water-sort/domain/types";
import { measureVialAnchors } from "@/lib/water-sort/rendering/dom-anchors";
import { PixiBoardRenderer } from "@/lib/water-sort/rendering/pixi-board-renderer";
import {
  buildPourBatchBoardRenderState,
  buildPourBoardRenderState,
  buildStaticBoardRenderState,
  type BoardRenderState,
  type PourBatchPresentation,
  type VialAnchor,
} from "@/lib/water-sort/rendering/render-state";

import { DebugLogOverlay } from "./debug-log-overlay";
import { VialSlotButton } from "./vial-slot-button";
import styles from "./water-sort.module.css";

type TransientStateBuilder = (anchors: readonly VialAnchor[]) => BoardRenderState;

interface BatchPresentationRuntime {
  transferIndex: number;
  geometry: ReturnType<typeof calculatePourGeometry>;
  presentation: PourPresentation;
}

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

function getAffectedVialIndices(turn: AppliedTurn): readonly number[] {
  if ("transfers" in turn) {
    return [...new Set(turn.transfers.flatMap((transfer) => [
      transfer.move.sourceVialIndex,
      transfer.move.destinationVialIndex,
    ]))];
  }
  return [turn.move.sourceVialIndex, turn.move.destinationVialIndex];
}

function chooseBatchDirection({
  batch,
  transferIndex,
  vialRefs,
}: {
  batch: AppliedPourBatch;
  transferIndex: number;
  vialRefs: ReadonlyMap<number, HTMLButtonElement>;
}): "left" | "right" | undefined {
  const transfer = batch.transfers[transferIndex];
  if (transfer === undefined) return undefined;

  const destinationVialIndex = transfer.move.destinationVialIndex;
  const siblingTransferIndices = batch.transfers
    .map((candidate, index) => ({candidate, index}))
    .filter(({candidate}) => candidate.move.destinationVialIndex === destinationVialIndex)
    .map(({index}) => index);

  if (siblingTransferIndices.length <= 1) return undefined;

  const sorted = siblingTransferIndices.toSorted((firstIndex, secondIndex) => {
    const firstSourceIndex = batch.transfers[firstIndex]?.move.sourceVialIndex;
    const secondSourceIndex = batch.transfers[secondIndex]?.move.sourceVialIndex;
    const firstElement = firstSourceIndex === undefined ? undefined : vialRefs.get(firstSourceIndex);
    const secondElement = secondSourceIndex === undefined ? undefined : vialRefs.get(secondSourceIndex);
    const firstX = firstElement?.getBoundingClientRect().x ?? 0;
    const secondX = secondElement?.getBoundingClientRect().x ?? 0;
    return firstX - secondX;
  });

  const position = sorted.indexOf(transferIndex);
  return position < siblingTransferIndices.length / 2 ? "right" : "left";
}

export function GameBoard({
  board,
  capacity,
  phase,
  selectedSourceVialIndex,
  parallelSelectedSourceVialIndices,
  activeMove,
  activeBatch,
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
  parallelSelectedSourceVialIndices: readonly number[];
  activeMove: AppliedMove | null;
  activeBatch: AppliedPourBatch | null;
  activeUndo: AppliedTurn | null;
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
  const debugSequenceRef = useRef(0);
  const previousPhaseRef = useRef<GamePhase | null>(null);
  const [debugEntries, setDebugEntries] = useState<string[]>([]);

  const appendDebugLog = useCallback((message: string): void => {
    debugSequenceRef.current += 1;
    const entry = `#${debugSequenceRef.current} ${getTimestamp()} ${message}`;
    setDebugEntries((current) => [...current.slice(-139), entry]);
  }, []);

  const clearDebugLogs = useCallback((): void => {
    setDebugEntries([]);
  }, []);

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

  const selectedSourceVialIndices = [
    ...(selectedSourceVialIndex === null ? [] : [selectedSourceVialIndex]),
    ...parallelSelectedSourceVialIndices,
  ];

  const renderLatest = useCallback((): void => {
    const renderer = rendererRef.current;
    const boardElement = boardRef.current;
    if (renderer === null || boardElement === null) return;

    const anchors = measureVialAnchors(boardElement, vialRefs.current, board.length);
    const transientStateBuilder = transientStateBuilderRef.current;
    renderer.render(
      transientStateBuilder === null
        ? buildStaticBoardRenderState({
            board,
            anchors,
            selectedSourceVialIndices,
            capacity,
          })
        : transientStateBuilder(anchors),
    );
  }, [board, capacity, selectedSourceVialIndices]);

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

    if (previousPhase === "presentingMove") {
      requestAnimationFrame(() => {
        appendDebugLog("post-commit:rAF1");
        requestAnimationFrame(() => logBoardPositions("post-commit:rAF2"));
      });
    }
  }, [appendDebugLog, logBoardPositions, phase]);

  useGSAP(() => {
    const boardElement = boardRef.current;
    let cleanup: (() => void) | undefined;

    transientStateBuilderRef.current = null;

    if (boardElement !== null && phase === "presentingMove" && activeBatch !== null) {
      const snapshots = new Map<number, PourPresentationSnapshot>();
      const runtimes: BatchPresentationRuntime[] = [];
      let completedPresentationCount = 0;

      activeBatch.transfers.forEach((transfer, transferIndex) => {
        const sourceVialIndex = transfer.move.sourceVialIndex;
        const destinationVialIndex = transfer.move.destinationVialIndex;
        const sourceElement = vialRefs.current.get(sourceVialIndex);
        const destinationElement = vialRefs.current.get(destinationVialIndex);
        if (sourceElement === undefined || destinationElement === undefined) {
          throw new Error("Missing DOM slot required for concurrent pour presentation.");
        }

        const preferredDirection = chooseBatchDirection({
          batch: activeBatch,
          transferIndex,
          vialRefs: vialRefs.current,
        });
        const geometry = calculatePourGeometry(
          boardElement,
          sourceElement,
          destinationElement,
          preferredDirection,
        );
        const animationMove: AppliedMove = {
          move: transfer.move,
          color: transfer.color,
          amount: transfer.amount,
          previousBoard: activeBatch.previousBoard,
          nextBoard: activeBatch.nextBoard,
          newlyCompletedVialIndices: activeBatch.newlyCompletedVialIndices,
        };

        const presentation = createPourTimeline({
          geometry,
          move: animationMove,
          sourceWidthPixels: sourceElement.getBoundingClientRect().width,
          paused: true,
          onFrame: (snapshot) => {
            snapshots.set(transferIndex, snapshot);
            renderLatestRef.current();
          },
          onComplete: () => {
            completedPresentationCount += 1;
            if (completedPresentationCount === activeBatch.transfers.length) {
              onMovePresentationFinished();
            }
          },
        });

        snapshots.set(transferIndex, presentation.getSnapshot());
        runtimes.push({transferIndex, geometry, presentation});
      });

      transientStateBuilderRef.current = (anchors) => {
        const presentations: PourBatchPresentation[] = runtimes.map((runtime) => {
          const transfer = activeBatch.transfers[runtime.transferIndex];
          if (transfer === undefined) {
            throw new Error("Concurrent pour presentation lost its transfer.");
          }
          return {
            transfer,
            geometry: runtime.geometry,
            presentation:
              snapshots.get(runtime.transferIndex) ?? runtime.presentation.getSnapshot(),
          };
        });

        return buildPourBatchBoardRenderState({
          batch: activeBatch,
          anchors,
          presentations,
          capacity,
        });
      };

      appendDebugLog(
        `BATCH ${activeBatch.transfers.map((transfer) =>
          `v${transfer.move.sourceVialIndex + 1}->v${transfer.move.destinationVialIndex + 1}`
        ).join(" + ")}`,
      );
      renderLatestRef.current();
      for (const runtime of runtimes) runtime.presentation.timeline.play(0);

      cleanup = () => {
        for (const runtime of runtimes) runtime.presentation.timeline.kill();
      };
    } else if (boardElement !== null && phase === "presentingMove" && activeMove !== null) {
      const sourceVialIndex = activeMove.move.sourceVialIndex;
      const destinationVialIndex = activeMove.move.destinationVialIndex;
      const sourceElement = vialRefs.current.get(sourceVialIndex);
      const destinationElement = vialRefs.current.get(destinationVialIndex);

      if (sourceElement === undefined || destinationElement === undefined) {
        throw new Error("Missing DOM slot required for pour presentation.");
      }

      const geometry = calculatePourGeometry(boardElement, sourceElement, destinationElement);
      appendDebugLog(
        `MOVE v${sourceVialIndex + 1}->v${destinationVialIndex + 1} `
        + `amount=${activeMove.amount} `
        + `geom[dx=${formatNumber(geometry.translationX)} `
        + `dy=${formatNumber(geometry.translationY)} `
        + `rot=${formatNumber(geometry.rotationDegrees)}]`,
      );

      const presentation = createPourTimeline({
        geometry,
        move: activeMove,
        sourceWidthPixels: sourceElement.getBoundingClientRect().width,
        onFrame: (snapshot) => {
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
          appendDebugLog(`t=${timeSeconds.toFixed(3)} ${event}`);
        },
        onComplete: onMovePresentationFinished,
      });

      cleanup = () => presentation.timeline.kill();
    } else if (phase === "presentingUndo" && activeUndo !== null) {
      const affectedVialIndices = new Set(getAffectedVialIndices(activeUndo));
      const motion = {scale: 1, alpha: 1};
      appendDebugLog(
        `UNDO ${[...affectedVialIndices].map((index) => `v${index + 1}`).join(",")}`,
      );

      transientStateBuilderRef.current = (anchors) => {
        const state = buildStaticBoardRenderState({
          board,
          anchors,
          selectedSourceVialIndices: [],
          capacity,
        });
        return {
          ...state,
          vials: state.vials.map((vial) =>
            affectedVialIndices.has(vial.vialIndex)
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

      cleanup = () => timeline.kill();
    } else if (phase === "presentingRestart") {
      appendDebugLog("RESTART");
      const motion = {alpha: 0.45, scale: 0.985};
      transientStateBuilderRef.current = (anchors) => buildStaticBoardRenderState({
        board,
        anchors,
        selectedSourceVialIndices: [],
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

      cleanup = () => timeline.kill();
    } else {
      renderLatestRef.current();
    }

    return () => {
      cleanup?.();
      transientStateBuilderRef.current = null;
    };
  }, {
    scope: boardRef,
    dependencies: [
      phase,
      activeMove,
      activeBatch,
      activeUndo,
      board,
      capacity,
      selectedSourceVialIndex,
      onMovePresentationFinished,
      onUndoPresentationFinished,
      onRestartPresentationFinished,
      appendDebugLog,
    ],
    revertOnUpdate: true,
  });

  const selectedSet = new Set(selectedSourceVialIndices);

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
              selected={selectedSet.has(vialIndex)}
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
