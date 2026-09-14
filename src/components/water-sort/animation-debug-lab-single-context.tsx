"use client";

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
} from "@/lib/water-sort/animation/debug-fixtures";
import { calculatePourGeometry } from "@/lib/water-sort/animation/pour-geometry";
import { getPourVisualPhase } from "@/lib/water-sort/animation/pour-visuals";
import {
  createPourTimeline,
  type PourPresentation,
  type PourPresentationSnapshot,
} from "@/lib/water-sort/animation/timelines";
import { GAME_TIMING } from "@/lib/water-sort/animation/timing";
import { measureVialAnchors } from "@/lib/water-sort/rendering/dom-anchors";
import { PixiBoardRenderer } from "@/lib/water-sort/rendering/pixi-board-renderer";
import { buildPourBoardRenderState } from "@/lib/water-sort/rendering/render-state";

import debugStyles from "./animation-debug.module.css";
import { VialSlotButton } from "./vial-slot-button";

const PLAYBACK_RATES = [0.1, 0.25, 0.5, 1] as const;

function formatNumber(value: number): string {
  return value.toFixed(3);
}

export function AnimationDebugLabSingleContext() {
  const defaultScenario = ANIMATION_DEBUG_SCENARIOS[0];
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    defaultScenario?.id ?? "normal-non-empty",
  );
  const [showGeometryGuides, setShowGeometryGuides] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [snapshot, setSnapshot] = useState<PourPresentationSnapshot | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const vialRefs = useRef(new Map<number, HTMLButtonElement>());
  const presentationRef = useRef<PourPresentation | null>(null);
  const rendererRef = useRef<PixiBoardRenderer | null>(null);
  const latestSnapshotRef = useRef<PourPresentationSnapshot | null>(null);

  const selectedScenario = useMemo(
    () => ANIMATION_DEBUG_SCENARIOS.find((scenario) => scenario.id === selectedScenarioId)
      ?? defaultScenario,
    [defaultScenario, selectedScenarioId],
  );

  const renderSnapshot = useCallback((nextSnapshot: PourPresentationSnapshot): void => {
    const scenario = selectedScenario;
    const boardElement = boardRef.current;
    const renderer = rendererRef.current;
    if (scenario === undefined || boardElement === null || renderer === null) return;

    const sourceElement = vialRefs.current.get(scenario.move.move.sourceVialIndex);
    const destinationElement = vialRefs.current.get(scenario.move.move.destinationVialIndex);
    if (sourceElement === undefined || destinationElement === undefined) return;

    const anchors = measureVialAnchors(
      boardElement,
      vialRefs.current,
      scenario.initialBoard.length,
    );
    const geometry = calculatePourGeometry(boardElement, sourceElement, destinationElement);

    renderer.render(buildPourBoardRenderState({
      move: scenario.move,
      anchors,
      selectedSourceVialIndex: null,
      geometry,
      presentation: nextSnapshot,
      capacity: scenario.capacity,
      debugGeometry: showGeometryGuides,
    }));
  }, [selectedScenario, showGeometryGuides]);

  useLayoutEffect(() => {
    const scenario = selectedScenario;
    const boardElement = boardRef.current;
    const canvasHost = canvasHostRef.current;
    if (scenario === undefined || boardElement === null || canvasHost === null) return;

    const sourceElement = vialRefs.current.get(scenario.move.move.sourceVialIndex);
    const destinationElement = vialRefs.current.get(scenario.move.move.destinationVialIndex);
    if (sourceElement === undefined || destinationElement === undefined) return;

    const renderer = new PixiBoardRenderer({boardElement, canvasHost});
    rendererRef.current = renderer;
    void renderer.initialize().catch((error: unknown) => {
      console.error("Failed to initialize Pixi debug renderer.", error);
    });

    const geometry = calculatePourGeometry(boardElement, sourceElement, destinationElement);
    const presentation = createPourTimeline({
      geometry,
      move: scenario.move,
      sourceWidthPixels: sourceElement.getBoundingClientRect().width,
      paused: true,
      onComplete: () => {},
      onFrame: (nextSnapshot) => {
        latestSnapshotRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);
        setPlayheadTime(nextSnapshot.timeSeconds);

        const anchors = measureVialAnchors(
          boardElement,
          vialRefs.current,
          scenario.initialBoard.length,
        );
        renderer.render(buildPourBoardRenderState({
          move: scenario.move,
          anchors,
          selectedSourceVialIndex: null,
          geometry,
          presentation: nextSnapshot,
          capacity: scenario.capacity,
          debugGeometry: showGeometryGuides,
        }));
      },
    });

    presentationRef.current = presentation;
    presentation.setPlaybackRate(playbackRate);
    presentation.seek(0);

    let scheduledFrame = 0;
    const scheduleRender = (): void => {
      if (scheduledFrame !== 0) cancelAnimationFrame(scheduledFrame);
      scheduledFrame = requestAnimationFrame(() => {
        scheduledFrame = 0;
        const currentSnapshot = latestSnapshotRef.current;
        if (currentSnapshot === null) return;

        const anchors = measureVialAnchors(
          boardElement,
          vialRefs.current,
          scenario.initialBoard.length,
        );
        const currentGeometry = calculatePourGeometry(
          boardElement,
          sourceElement,
          destinationElement,
        );
        renderer.render(buildPourBoardRenderState({
          move: scenario.move,
          anchors,
          selectedSourceVialIndex: null,
          geometry: currentGeometry,
          presentation: currentSnapshot,
          capacity: scenario.capacity,
          debugGeometry: showGeometryGuides,
        }));
      });
    };

    const observer = new ResizeObserver(scheduleRender);
    observer.observe(boardElement);
    observer.observe(sourceElement);
    observer.observe(destinationElement);
    window.addEventListener("resize", scheduleRender);

    return () => {
      if (scheduledFrame !== 0) cancelAnimationFrame(scheduledFrame);
      window.removeEventListener("resize", scheduleRender);
      observer.disconnect();
      presentation.timeline.kill();
      presentationRef.current = null;
      latestSnapshotRef.current = null;
      renderer.destroy();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [selectedScenario, showGeometryGuides]);

  useEffect(() => {
    presentationRef.current?.setPlaybackRate(playbackRate);
  }, [playbackRate]);

  const seek = useCallback((timeSeconds: number): void => {
    const presentation = presentationRef.current;
    if (presentation === null) return;
    const clamped = Math.max(0, Math.min(GAME_TIMING.pour.totalSeconds, timeSeconds));
    presentation.seek(clamped);
  }, []);

  useEffect(() => {
    const currentSnapshot = latestSnapshotRef.current;
    if (currentSnapshot !== null) renderSnapshot(currentSnapshot);
  }, [renderSnapshot]);

  if (selectedScenario === undefined) return null;

  const phase = snapshot === null
    ? getPourVisualPhase(0)
    : getPourVisualPhase(snapshot.timeSeconds);

  return (
    <main className={debugStyles.page}>
      <header className={debugStyles.header}>
        <p className={debugStyles.eyebrow}>Water Sort</p>
        <h1>Animation Debug Lab</h1>
        <p>
          This version uses one Pixi/WebGL context. It avoids the Safari GPU-process crash
          caused by mounting one WebGL canvas for every checkpoint at the same time.
        </p>
      </header>

      <section className={debugStyles.section}>
        <div className={debugStyles.scenarioRow}>
          <label className={debugStyles.scenarioControl}>
            <span>Scenario</span>
            <select
              value={selectedScenarioId}
              onChange={(event) => {
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

      <section className={debugStyles.section}>
        <div>
          <h2 className={debugStyles.sectionTitle}>Interactive preview</h2>
          <p className={debugStyles.sectionDescription}>
            Use the checkpoint buttons or scrubber to inspect deterministic production frames.
          </p>
        </div>

        <div className={debugStyles.interactiveLayout}>
          <div>
            <div ref={boardRef} className={debugStyles.stageBoard} data-debug-stage="">
              <div ref={canvasHostRef} className={debugStyles.pixiCanvasHost} aria-hidden="true" />
              <div className={debugStyles.stageGrid}>
                {selectedScenario.initialBoard.map((vial, vialIndex) => (
                  <VialSlotButton
                    key={vialIndex}
                    ref={(element) => {
                      if (element === null) vialRefs.current.delete(vialIndex);
                      else vialRefs.current.set(vialIndex, element);
                    }}
                    vial={vial}
                    capacity={selectedScenario.capacity}
                    vialIndex={vialIndex}
                    interactive={false}
                  />
                ))}
              </div>
            </div>

            <div className={debugStyles.timeReadout}>
              {formatNumber(playheadTime)} / {formatNumber(GAME_TIMING.pour.totalSeconds)} s
            </div>

            <div className={debugStyles.transport}>
              <button
                type="button"
                onClick={() => {
                  const presentation = presentationRef.current;
                  if (presentation === null) return;
                  if (presentation.timeline.time() >= GAME_TIMING.pour.totalSeconds - 0.0001) {
                    presentation.seek(0);
                  }
                  presentation.timeline.play();
                }}
              >
                Play
              </button>
              <button type="button" onClick={() => presentationRef.current?.timeline.pause()}>
                Pause
              </button>
              <button
                type="button"
                onClick={() => {
                  seek(0);
                  presentationRef.current?.timeline.play();
                }}
              >
                Restart
              </button>
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
        </div>
      </section>
    </main>
  );
}
