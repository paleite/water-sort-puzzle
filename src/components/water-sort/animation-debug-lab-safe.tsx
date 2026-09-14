"use client";

import gsap from "gsap";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ANIMATION_DEBUG_SCENARIOS,
  POUR_DEBUG_CHECKPOINTS,
  type AnimationDebugScenario,
} from "@/lib/water-sort/animation/debug-fixtures";
import {calculatePourGeometry, type PourGeometry} from "@/lib/water-sort/animation/pour-geometry";
import {getPourVisualPhase} from "@/lib/water-sort/animation/pour-visuals";
import {
  createPourTimeline,
  type PourPresentation,
  type PourPresentationSnapshot,
} from "@/lib/water-sort/animation/timelines";
import {GAME_TIMING} from "@/lib/water-sort/animation/timing";
import type {AppliedMove, Board} from "@/lib/water-sort/domain/types";
import {measureVialAnchors} from "@/lib/water-sort/rendering/dom-anchors";
import {PixiBoardRenderer} from "@/lib/water-sort/rendering/pixi-board-renderer";
import {
  buildConcurrentPourBoardRenderState,
  buildStaticBoardRenderState,
  type ConcurrentPourPresentation,
} from "@/lib/water-sort/rendering/render-state";

import debugStyles from "./animation-debug.module.css";
import {VialSlotButton} from "./vial-slot-button";

const PLAYBACK_RATES = [0.1, 0.25, 0.5, 1] as const;

interface DebugPresentationController {
  play(): void;
  pause(): void;
  seek(timeSeconds: number): void;
  setPlaybackRate(playbackRate: number): void;
  getTime(): number;
  getSnapshot(): PourPresentationSnapshot | null;
}

interface DebugPresentationRuntime {
  move: AppliedMove;
  geometry: PourGeometry;
  presentation: PourPresentation;
  snapshot: PourPresentationSnapshot;
}

interface PourStageProps {
  scenario: AnimationDebugScenario;
  initialTimeSeconds: number;
  committed?: boolean;
  debugGeometry?: boolean;
  playbackRate?: number;
  onPresentationReady?: (controller: DebugPresentationController | null) => void;
  onFrame?: (snapshot: PourPresentationSnapshot) => void;
}

function formatNumber(value: number): string {
  return value.toFixed(3);
}

function createDebugController(
  runtimes: readonly DebugPresentationRuntime[],
): DebugPresentationController {
  return {
    play(): void {
      for (const runtime of runtimes) {
        runtime.presentation.timeline.play();
      }
    },
    pause(): void {
      for (const runtime of runtimes) {
        runtime.presentation.timeline.pause();
      }
    },
    seek(timeSeconds: number): void {
      for (const runtime of runtimes) {
        runtime.presentation.seek(timeSeconds);
      }
    },
    setPlaybackRate(playbackRate: number): void {
      for (const runtime of runtimes) {
        runtime.presentation.setPlaybackRate(playbackRate);
      }
    },
    getTime(): number {
      return runtimes[0]?.presentation.timeline.time() ?? 0;
    },
    getSnapshot(): PourPresentationSnapshot | null {
      return runtimes[0]?.presentation.getSnapshot() ?? null;
    },
  };
}

function PourStage({
  scenario,
  initialTimeSeconds,
  committed = false,
  debugGeometry = false,
  playbackRate = 1,
  onPresentationReady,
  onFrame,
}: PourStageProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const vialRefs = useRef(new Map<number, HTMLButtonElement>());
  const runtimesRef = useRef<DebugPresentationRuntime[]>([]);

  useLayoutEffect(() => {
    const boardElement = boardRef.current;
    const canvasHost = canvasHostRef.current;
    if (boardElement === null || canvasHost === null) return;

    const displayBoard = committed ? scenario.settledBoard : scenario.initialBoard;
    const renderer = new PixiBoardRenderer({boardElement, canvasHost});
    void renderer.initialize().catch((error: unknown) => {
      console.error("Failed to initialize Pixi debug renderer.", error);
    });

    const renderCurrent = (): void => {
      const anchors = measureVialAnchors(boardElement, vialRefs.current, displayBoard.length);
      const runtimes = runtimesRef.current;

      if (committed || runtimes.length === 0) {
        renderer.render(buildStaticBoardRenderState({
          board: displayBoard,
          anchors,
          selectedSourceVialIndex: null,
          capacity: scenario.capacity,
          debugGeometry,
        }));
        return;
      }

      const presentations: ConcurrentPourPresentation[] = runtimes.map((runtime) => ({
        move: runtime.move,
        geometry: runtime.geometry,
        presentation: runtime.snapshot,
        started: true,
        contentCommitted: false,
      }));

      renderer.render(buildConcurrentPourBoardRenderState({
        board: scenario.initialBoard,
        anchors,
        presentations,
        selectedSourceVialIndex: null,
        capacity: scenario.capacity,
        debugGeometry,
      }));
    };

    let frame = 0;
    const scheduleRender = (): void => {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        renderCurrent();
      });
    };

    const observer = new ResizeObserver(scheduleRender);
    observer.observe(boardElement);
    for (const element of vialRefs.current.values()) observer.observe(element);
    window.addEventListener("resize", scheduleRender);

    if (!committed) {
      const runtimes: DebugPresentationRuntime[] = [];

      scenario.moves.forEach((move, moveIndex) => {
        const sourceVialIndex = move.move.sourceVialIndex;
        const destinationVialIndex = move.move.destinationVialIndex;
        const sourceElement = vialRefs.current.get(sourceVialIndex);
        const destinationElement = vialRefs.current.get(destinationVialIndex);
        if (sourceElement === undefined || destinationElement === undefined) {
          throw new Error("Missing DOM slot required for debug pour presentation.");
        }

        const sourceFillUnits = move.previousBoard[sourceVialIndex]?.length;
        const geometry = calculatePourGeometry(
          boardElement,
          sourceElement,
          destinationElement,
          undefined,
          sourceFillUnits,
          move.amount,
          scenario.capacity,
        );
        const presentation = createPourTimeline({
          geometry,
          move,
          sourceWidthPixels: sourceElement.getBoundingClientRect().width,
          paused: true,
          onComplete: () => {},
          onFrame: (nextSnapshot) => {
            const runtime = runtimesRef.current[moveIndex];
            if (runtime !== undefined) {
              runtime.snapshot = nextSnapshot;
            }
            renderCurrent();
            if (moveIndex === 0) onFrame?.(nextSnapshot);
          },
        });

        runtimes.push({
          move,
          geometry,
          presentation,
          snapshot: presentation.getSnapshot(),
        });
      });

      runtimesRef.current = runtimes;
      const controller = createDebugController(runtimes);
      controller.setPlaybackRate(playbackRate);
      controller.seek(initialTimeSeconds);
      onPresentationReady?.(controller);
    } else {
      runtimesRef.current = [];
      onPresentationReady?.(null);
      renderCurrent();
    }

    scheduleRender();

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleRender);
      observer.disconnect();
      for (const runtime of runtimesRef.current) {
        runtime.presentation.timeline.kill();
      }
      runtimesRef.current = [];
      onPresentationReady?.(null);
      renderer.destroy();
    };
  }, [
    committed,
    debugGeometry,
    initialTimeSeconds,
    onFrame,
    onPresentationReady,
    scenario,
  ]);

  useEffect(() => {
    for (const runtime of runtimesRef.current) {
      runtime.presentation.setPlaybackRate(playbackRate);
    }
  }, [playbackRate]);

  const displayBoard = committed ? scenario.settledBoard : scenario.initialBoard;
  const columnCount = Math.max(1, Math.min(displayBoard.length, 4));

  return (
    <div ref={boardRef} className={debugStyles.stageBoard} data-debug-stage="">
      <div ref={canvasHostRef} className={debugStyles.pixiCanvasHost} aria-hidden="true" />
      <div
        className={debugStyles.stageGrid}
        style={{
          gridTemplateColumns: `repeat(${columnCount}, var(--vial-width))`,
          gap: displayBoard.length > 2 ? "clamp(18px, 5vw, 52px)" : undefined,
        }}
      >
        {displayBoard.map((vial, vialIndex) => (
          <VialSlotButton
            key={vialIndex}
            ref={(element) => {
              if (element === null) vialRefs.current.delete(vialIndex);
              else vialRefs.current.set(vialIndex, element);
            }}
            vial={vial}
            capacity={scenario.capacity}
            vialIndex={vialIndex}
            interactive={false}
          />
        ))}
      </div>
    </div>
  );
}

function SelectionPreviewStage() {
  const board: Board = [
    ["amber", "violet"],
    ["amber", "violet"],
  ];
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const vialRefs = useRef(new Map<number, HTMLButtonElement>());

  useLayoutEffect(() => {
    const boardElement = boardRef.current;
    const canvasHost = canvasHostRef.current;
    if (boardElement === null || canvasHost === null) return;

    const renderer = new PixiBoardRenderer({boardElement, canvasHost});
    void renderer.initialize().catch((error: unknown) => {
      console.error("Failed to initialize Pixi selection preview.", error);
    });

    const render = (): void => {
      const anchors = measureVialAnchors(boardElement, vialRefs.current, board.length);
      renderer.render(buildStaticBoardRenderState({
        board,
        anchors,
        selectedSourceVialIndex: 1,
        capacity: 4,
      }));
    };

    const observer = new ResizeObserver(render);
    observer.observe(boardElement);
    for (const element of vialRefs.current.values()) observer.observe(element);
    render();

    return () => {
      observer.disconnect();
      renderer.destroy();
    };
  }, []);

  return (
    <div ref={boardRef} className={debugStyles.selectionPreviewStage}>
      <div ref={canvasHostRef} className={debugStyles.pixiCanvasHost} aria-hidden="true" />
      <div className={debugStyles.selectionPreviewGrid}>
        {board.map((vial, vialIndex) => (
          <div key={vialIndex} className={debugStyles.selectionPreviewItem}>
            <span className={debugStyles.cardLabel}>{vialIndex === 0 ? "Resting" : "Selected"}</span>
            <VialSlotButton
              ref={(element) => {
                if (element === null) vialRefs.current.delete(vialIndex);
                else vialRefs.current.set(vialIndex, element);
              }}
              vial={vial}
              capacity={4}
              vialIndex={vialIndex}
              selected={vialIndex === 1}
              interactive={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SelectionStatePreview() {
  return (
    <section className={debugStyles.section}>
      <div>
        <h2 className={debugStyles.sectionTitle}>Selection states</h2>
        <p className={debugStyles.sectionDescription}>
          DOM slots remain fixed. The selected Pixi vial is translated 10 px upward in render state.
        </p>
      </div>
      <SelectionPreviewStage />
    </section>
  );
}

function Inspector({snapshot}: {snapshot: PourPresentationSnapshot | null}) {
  const phase = getPourVisualPhase(snapshot?.timeSeconds ?? 0);

  return (
    <dl className={debugStyles.inspector} data-debug-inspector="">
      <div><dt>time</dt><dd>{formatNumber(snapshot?.timeSeconds ?? 0)} s</dd></div>
      <div><dt>progress</dt><dd>{formatNumber((snapshot?.progress ?? 0) * 100)} %</dd></div>
      <div><dt>source x</dt><dd>{formatNumber(snapshot?.sourceX ?? 0)} px</dd></div>
      <div><dt>source y</dt><dd>{formatNumber(snapshot?.sourceY ?? 0)} px</dd></div>
      <div><dt>source rotation</dt><dd>{formatNumber(snapshot?.sourceRotationDegrees ?? 0)}°</dd></div>
      <div><dt>surface world angle</dt><dd>{formatNumber(snapshot?.liquid.sourceWorldAngleDegrees ?? 0)}°</dd></div>
      <div><dt>surface local angle</dt><dd>{formatNumber(snapshot?.liquid.sourceLocalAngleDegrees ?? 0)}°</dd></div>
      <div><dt>surface angular velocity</dt><dd>{formatNumber(snapshot?.liquid.sourceAngularVelocity ?? 0)}</dd></div>
      <div><dt>destination wave</dt><dd>{formatNumber(snapshot?.liquid.destinationMaximumDisplacement ?? 0)}</dd></div>
      <div><dt>transfer progress</dt><dd>{formatNumber(phase.transferProgress * 100)} %</dd></div>
      <div><dt>stream strength</dt><dd>{formatNumber(phase.streamStrength)}</dd></div>
      <div><dt>stream width</dt><dd>{formatNumber(phase.streamWidthScale)}</dd></div>
      <div><dt>surface activity</dt><dd>{formatNumber(phase.surfaceActivity)}</dd></div>
      <div><dt>splash opacity</dt><dd>{formatNumber(phase.splashOpacity)}</dd></div>
      <div><dt>terminal droplet</dt><dd>{formatNumber(phase.terminalDropletOpacity)}</dd></div>
    </dl>
  );
}

export function AnimationDebugLabSafe() {
  const defaultScenario = ANIMATION_DEBUG_SCENARIOS[0];
  const defaultCheckpoint = POUR_DEBUG_CHECKPOINTS[0];
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    defaultScenario?.id ?? "normal-non-empty",
  );
  const [selectedCheckpointId, setSelectedCheckpointId] = useState(
    defaultCheckpoint?.id ?? "idle",
  );
  const [showGeometryGuides, setShowGeometryGuides] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const selectedScenario = useMemo(
    () => ANIMATION_DEBUG_SCENARIOS.find((scenario) => scenario.id === selectedScenarioId)
      ?? defaultScenario,
    [defaultScenario, selectedScenarioId],
  );
  const selectedCheckpoint = useMemo(
    () => POUR_DEBUG_CHECKPOINTS.find((checkpoint) => checkpoint.id === selectedCheckpointId)
      ?? defaultCheckpoint,
    [defaultCheckpoint, selectedCheckpointId],
  );

  const controllerRef = useRef<DebugPresentationController | null>(null);
  const requestedTimeRef = useRef(0);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [snapshot, setSnapshot] = useState<PourPresentationSnapshot | null>(null);

  const handlePresentationReady = useCallback((controller: DebugPresentationController | null): void => {
    controllerRef.current = controller;
    if (controller === null) return;
    controller.setPlaybackRate(playbackRate);
    controller.seek(requestedTimeRef.current);
    setSnapshot(controller.getSnapshot());
  }, [playbackRate]);

  const handleFrame = useCallback((nextSnapshot: PourPresentationSnapshot): void => {
    setSnapshot(nextSnapshot);
    setPlayheadTime(nextSnapshot.timeSeconds);
  }, []);

  const seek = useCallback((timeSeconds: number): void => {
    const clamped = gsap.utils.clamp(0, GAME_TIMING.pour.totalSeconds, timeSeconds);
    requestedTimeRef.current = clamped;
    setPlayheadTime(clamped);
    const controller = controllerRef.current;
    if (controller === null) return;
    controller.seek(clamped);
    setSnapshot(controller.getSnapshot());
  }, []);

  useEffect(() => {
    controllerRef.current?.setPlaybackRate(playbackRate);
  }, [playbackRate]);

  if (selectedScenario === undefined || selectedCheckpoint === undefined) return null;

  return (
    <main className={debugStyles.page}>
      <header className={debugStyles.header}>
        <p className={debugStyles.eyebrow}>Water Sort</p>
        <h1>Animation Debug Lab</h1>
        <p>
          Production Pixi rendering with bounded WebGL contexts. Only the interactive stage,
          selection preview, and selected checkpoint are mounted at the same time.
        </p>
      </header>

      <section className={debugStyles.section}>
        <div className={debugStyles.scenarioRow}>
          <label className={debugStyles.scenarioControl}>
            <span>Scenario</span>
            <select
              value={selectedScenarioId}
              onChange={(event) => {
                requestedTimeRef.current = 0;
                setPlayheadTime(0);
                setSnapshot(null);
                setSelectedScenarioId(event.currentTarget.value);
              }}
              data-debug-scenario=""
            >
              {ANIMATION_DEBUG_SCENARIOS.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>{scenario.title}</option>
              ))}
            </select>
          </label>

          <label className={debugStyles.guideToggle}>
            <input
              type="checkbox"
              checked={showGeometryGuides}
              onChange={(event) => setShowGeometryGuides(event.currentTarget.checked)}
            />
            <span>Geometry guides</span>
          </label>
        </div>
        <p className={debugStyles.sectionDescription}>{selectedScenario.description}</p>
      </section>

      <SelectionStatePreview />

      <section className={debugStyles.section}>
        <div>
          <h2 className={debugStyles.sectionTitle}>Interactive preview</h2>
          <p className={debugStyles.sectionDescription}>
            Scrubbing resets and deterministically replays the production presentation.
          </p>
        </div>

        <div className={debugStyles.interactiveLayout}>
          <div>
            <PourStage
              key={`${selectedScenario.id}-${showGeometryGuides ? "guides" : "plain"}`}
              scenario={selectedScenario}
              initialTimeSeconds={0}
              debugGeometry={showGeometryGuides}
              playbackRate={playbackRate}
              onPresentationReady={handlePresentationReady}
              onFrame={handleFrame}
            />

            <div className={debugStyles.timeReadout}>
              {formatNumber(playheadTime)} / {formatNumber(GAME_TIMING.pour.totalSeconds)} s
            </div>

            <div className={debugStyles.transport}>
              <button
                type="button"
                onClick={() => {
                  const controller = controllerRef.current;
                  if (controller === null) return;
                  if (controller.getTime() >= GAME_TIMING.pour.totalSeconds - 0.0001) {
                    controller.seek(0);
                  }
                  controller.play();
                }}
              >Play</button>
              <button type="button" onClick={() => controllerRef.current?.pause()}>
                Pause
              </button>
              <button
                type="button"
                onClick={() => {
                  seek(0);
                  controllerRef.current?.play();
                }}
              >Restart</button>
            </div>

            <div className={debugStyles.transport} aria-label="Playback speed">
              {PLAYBACK_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  aria-pressed={playbackRate === rate}
                  onClick={() => setPlaybackRate(rate)}
                >
                  {rate}×
                </button>
              ))}
            </div>

            <input
              className={debugStyles.scrubber}
              type="range"
              min={0}
              max={GAME_TIMING.pour.totalSeconds}
              step={0.005}
              value={playheadTime}
              onChange={(event) => seek(Number(event.currentTarget.value))}
              aria-label="Pour timeline"
              data-debug-scrubber=""
            />

            <div className={debugStyles.checkpointButtons}>
              {POUR_DEBUG_CHECKPOINTS.map((checkpoint) => (
                <button
                  key={checkpoint.id}
                  type="button"
                  data-debug-checkpoint={checkpoint.id}
                  onClick={() => seek(checkpoint.timeSeconds)}
                >
                  {checkpoint.label}
                </button>
              ))}
            </div>
          </div>
          <Inspector snapshot={snapshot} />
        </div>
      </section>

      <section className={debugStyles.section}>
        <div>
          <h2 className={debugStyles.sectionTitle}>Checkpoint stepper</h2>
          <p className={debugStyles.sectionDescription}>
            This preserves the old checkpoint previews without mounting one WebGL context for every frame.
            Select a checkpoint to mount and inspect that exact production frame.
          </p>
        </div>

        <div className={debugStyles.checkpointButtons}>
          {POUR_DEBUG_CHECKPOINTS.map((checkpoint) => (
            <button
              key={checkpoint.id}
              type="button"
              aria-pressed={selectedCheckpoint.id === checkpoint.id}
              onClick={() => setSelectedCheckpointId(checkpoint.id)}
            >
              {checkpoint.label}
            </button>
          ))}
        </div>

        <article
          key={`${selectedScenario.id}-${selectedCheckpoint.id}-${showGeometryGuides ? "guides" : "plain"}`}
          className={debugStyles.checkpointCard}
          data-debug-card={selectedCheckpoint.id}
          style={{marginTop: 14}}
        >
          <header>
            <strong>{selectedCheckpoint.label}</strong>
            <span>{formatNumber(selectedCheckpoint.timeSeconds)} s</span>
          </header>
          <PourStage
            scenario={selectedScenario}
            initialTimeSeconds={selectedCheckpoint.timeSeconds}
            committed={selectedCheckpoint.id === "settled"}
            debugGeometry={showGeometryGuides}
          />
        </article>
      </section>
    </main>
  );
}
