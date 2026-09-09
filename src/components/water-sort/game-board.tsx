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
import type { AppliedTurn, Board } from "@/lib/water-sort/domain/types";
import type { ActiveMovePresentation } from "@/lib/water-sort/machine/game-machine";
import { measureVialAnchors } from "@/lib/water-sort/rendering/dom-anchors";
import { PixiBoardRenderer } from "@/lib/water-sort/rendering/pixi-board-renderer";
import {
  buildConcurrentPourBoardRenderState,
  buildStaticBoardRenderState,
  type BoardRenderState,
  type ConcurrentPourPresentation,
  type VialAnchor,
} from "@/lib/water-sort/rendering/render-state";

import { DebugLogOverlay } from "./debug-log-overlay";
import { VialSlotButton } from "./vial-slot-button";
import styles from "./water-sort.module.css";

type TransientStateBuilder = (anchors: readonly VialAnchor[]) => BoardRenderState;

interface PresentationRuntime {
  id: number;
  geometry: ReturnType<typeof calculatePourGeometry>;
  presentation: PourPresentation;
  snapshot: PourPresentationSnapshot;
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

export function GameBoard({
  board,
  capacity,
  phase,
  selectedSourceVialIndex,
  activePresentations,
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
  activePresentations: readonly ActiveMovePresentation[];
  activeUndo: AppliedTurn | null;
  onVialPress: (vialIndex: number) => void;
  onMovePresentationFinished: (presentationId: number) => void;
  onUndoPresentationFinished: () => void;
  onRestartPresentationFinished: () => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const vialRefs = useRef(new Map<number, HTMLButtonElement>());
  const rendererRef = useRef<PixiBoardRenderer | null>(null);
  const presentationRuntimesRef = useRef(new Map<number, PresentationRuntime>());
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

  const renderLatest = useCallback((): void => {
    const renderer = rendererRef.current;
    const boardElement = boardRef.current;
    if (renderer === null || boardElement === null) return;

    const anchors = measureVialAnchors(boardElement, vialRefs.current, board.length);
    const transientStateBuilder = transientStateBuilderRef.current;

    if (transientStateBuilder !== null) {
      renderer.render(transientStateBuilder(anchors));
      return;
    }

    const presentations: ConcurrentPourPresentation[] = activePresentations.flatMap((active) => {
      const runtime = presentationRuntimesRef.current.get(active.id);
      return runtime === undefined
        ? []
        : [{
            move: active.move,
            geometry: runtime.geometry,
            presentation: runtime.snapshot,
          }];
    });

    renderer.render(
      presentations.length === 0
        ? buildStaticBoardRenderState({
            board,
            anchors,
            selectedSourceVialIndex,
            capacity,
          })
        : buildConcurrentPourBoardRenderState({
            board,
            anchors,
            presentations,
            selectedSourceVialIndex,
            capacity,
          }),
    );
  }, [activePresentations, board, capacity, selectedSourceVialIndex]);

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
    const boardElement = boardRef.current;
    if (boardElement === null) return;

    const activeIds = new Set(activePresentations.map(({id}) => id));
    for (const [presentationId, runtime] of presentationRuntimesRef.current) {
      if (activeIds.has(presentationId)) continue;
      runtime.presentation.timeline.kill();
      presentationRuntimesRef.current.delete(presentationId);
    }

    for (const active of activePresentations) {
      if (presentationRuntimesRef.current.has(active.id)) continue;

      const sourceVialIndex = active.move.move.sourceVialIndex;
      const destinationVialIndex = active.move.move.destinationVialIndex;
      const sourceElement = vialRefs.current.get(sourceVialIndex);
      const destinationElement = vialRefs.current.get(destinationVialIndex);
      if (sourceElement === undefined || destinationElement === undefined) {
        throw new Error("Missing DOM slot required for concurrent pour presentation.");
      }

      const geometry = calculatePourGeometry(boardElement, sourceElement, destinationElement);
      let runtime: PresentationRuntime;
      const presentation = createPourTimeline({
        geometry,
        move: active.move,
        sourceWidthPixels: sourceElement.getBoundingClientRect().width,
        paused: true,
        onFrame: (snapshot) => {
          runtime.snapshot = snapshot;
          renderLatestRef.current();
        },
        onDebug: (event, timeSeconds) => {
          appendDebugLog(`p${active.id} t=${timeSeconds.toFixed(3)} ${event}`);
        },
        onComplete: () => {
          appendDebugLog(`p${active.id} complete`);
          onMovePresentationFinished(active.id);
        },
      });

      runtime = {
        id: active.id,
        geometry,
        presentation,
        snapshot: presentation.getSnapshot(),
      };
      presentationRuntimesRef.current.set(active.id, runtime);

      appendDebugLog(
        `MOVE#${active.id} v${sourceVialIndex + 1}->v${destinationVialIndex + 1} `
        + `amount=${active.move.amount} `
        + `geom[dx=${formatNumber(geometry.translationX)} `
        + `dy=${formatNumber(geometry.translationY)} `
        + `rot=${formatNumber(geometry.rotationDegrees)}]`,
      );
      presentation.timeline.play(0);
    }

    renderLatestRef.current();
  }, [activePresentations, appendDebugLog, onMovePresentationFinished]);

  useEffect(() => () => {
    for (const runtime of presentationRuntimesRef.current.values()) {
      runtime.presentation.timeline.kill();
    }
    presentationRuntimesRef.current.clear();
  }, []);

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
  }, [appendDebugLog, logBoardPositions, phase]);

  useGSAP(() => {
    let cleanup: (() => void) | undefined;
    transientStateBuilderRef.current = null;

    if (phase === "presentingUndo" && activeUndo !== null) {
      const affectedVialIndices = new Set(getAffectedVialIndices(activeUndo));
      const motion = {scale: 1, alpha: 1};
      appendDebugLog(
        `UNDO ${[...affectedVialIndices].map((index) => `v${index + 1}`).join(",")}`,
      );

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
      activeUndo,
      board,
      capacity,
      selectedSourceVialIndex,
      onUndoPresentationFinished,
      onRestartPresentationFinished,
      appendDebugLog,
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
