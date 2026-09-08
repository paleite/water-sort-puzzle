"use client";

import gsap from "gsap";
import {
  useCallback,
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
import { calculatePourGeometry } from "@/lib/water-sort/animation/pour-geometry";
import {
  createPourTimeline,
  type PourPresentation,
  type PourPresentationSnapshot,
} from "@/lib/water-sort/animation/timelines";
import { GAME_TIMING } from "@/lib/water-sort/animation/timing";
import { LIQUID_COLORS } from "@/lib/water-sort/presentation/palette";

import { Vial } from "./vial";
import debugStyles from "./animation-debug.module.css";

interface PourStageProps {
  scenario: AnimationDebugScenario;
  initialTimeSeconds: number;
  committed?: boolean;
  debugGeometry?: boolean;
  onPresentationReady?: (presentation: PourPresentation | null) => void;
  onFrame?: (snapshot: PourPresentationSnapshot) => void;
}

function formatNumber(value: number): string {
  return value.toFixed(3);
}

function PourStage({
  scenario,
  initialTimeSeconds,
  committed = false,
  debugGeometry = false,
  onPresentationReady,
  onFrame,
}: PourStageProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<SVGPathElement>(null);
  const vialRefs = useRef(new Map<number, HTMLButtonElement>());

  useLayoutEffect(() => {
    if (committed) {
      onPresentationReady?.(null);
      return;
    }

    const boardElement = boardRef.current;
    const streamElement = streamRef.current;
    const sourceVialIndex = scenario.move.move.sourceVialIndex;
    const destinationVialIndex = scenario.move.move.destinationVialIndex;
    const sourceElement = vialRefs.current.get(sourceVialIndex);
    const destinationElement = vialRefs.current.get(destinationVialIndex);

    if (
      boardElement === null
      || streamElement === null
      || sourceElement === undefined
      || destinationElement === undefined
    ) {
      return;
    }

    const geometry = calculatePourGeometry(
      boardElement,
      sourceElement,
      destinationElement,
    );

    streamElement.style.fill = LIQUID_COLORS[scenario.move.color];

    const presentation = createPourTimeline({
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
      move: scenario.move,
      capacity: scenario.capacity,
      paused: true,
      onComplete: () => {},
      ...(onFrame === undefined ? {} : {onFrame}),
    });

    presentation.seek(initialTimeSeconds);
    onPresentationReady?.(presentation);

    return () => {
      onPresentationReady?.(null);
      presentation.timeline.revert();
    };
  }, [
    committed,
    debugGeometry,
    initialTimeSeconds,
    onFrame,
    onPresentationReady,
    scenario,
  ]);

  const displayBoard = committed ? scenario.move.nextBoard : scenario.initialBoard;

  return (
    <div ref={boardRef} className={debugStyles.stageBoard} data-debug-stage="">
      <div className={debugStyles.stageGrid}>
        {displayBoard.map((vial, vialIndex) => {
          const isSource = !committed && vialIndex === scenario.move.move.sourceVialIndex;
          const isDestination = !committed && vialIndex === scenario.move.move.destinationVialIndex;
          const outgoing = isSource
            ? {color: scenario.move.color, amount: scenario.move.amount}
            : undefined;
          const incoming = isDestination
            ? {color: scenario.move.color, amount: scenario.move.amount}
            : undefined;

          return (
            <Vial
              key={vialIndex}
              ref={(element) => {
                if (element === null) vialRefs.current.delete(vialIndex);
                else vialRefs.current.set(vialIndex, element);
              }}
              vial={vial}
              capacity={scenario.capacity}
              vialIndex={vialIndex}
              interactive={false}
              debugGeometry={debugGeometry}
              {...(outgoing === undefined ? {} : {outgoing})}
              {...(incoming === undefined ? {} : {incoming})}
            />
          );
        })}
      </div>

      {!committed && (
        <svg className={debugStyles.streamLayer} aria-hidden="true">
          <path ref={streamRef} style={{opacity: 0}} />
          {debugGeometry && (
            <>
              <circle
                data-debug-stream-source=""
                r="4"
                className={debugStyles.streamSourceGuide}
              />
              <circle
                data-debug-stream-destination=""
                r="4"
                className={debugStyles.streamDestinationGuide}
              />
            </>
          )}
        </svg>
      )}
    </div>
  );
}

function SelectionStatePreview() {
  return (
    <section className={debugStyles.section}>
      <div>
        <h2 className={debugStyles.sectionTitle}>Selection states</h2>
        <p className={debugStyles.sectionDescription}>
          The selected vial must lift through the outer vial slot. The button itself remains at
          GSAP transform identity.
        </p>
      </div>

      <div className={debugStyles.selectionGrid}>
        <article className={debugStyles.selectionCard}>
          <span className={debugStyles.cardLabel}>Resting</span>
          <div className={debugStyles.selectionStage}>
            <Vial
              vial={["amber", "violet"]}
              capacity={4}
              vialIndex={0}
              interactive={false}
            />
          </div>
        </article>

        <article className={debugStyles.selectionCard}>
          <span className={debugStyles.cardLabel}>Selected</span>
          <div className={debugStyles.selectionStage}>
            <Vial
              vial={["amber", "violet"]}
              capacity={4}
              vialIndex={0}
              selected
              interactive={false}
            />
          </div>
        </article>
      </div>
    </section>
  );
}

function Inspector({snapshot}: {snapshot: PourPresentationSnapshot | null}) {
  if (snapshot === null) {
    return <div className={debugStyles.inspector}>Waiting for presentation state.</div>;
  }

  return (
    <dl className={debugStyles.inspector} data-debug-inspector="">
      <div><dt>time</dt><dd>{formatNumber(snapshot.timeSeconds)} s</dd></div>
      <div><dt>progress</dt><dd>{formatNumber(snapshot.progress * 100)} %</dd></div>
      <div><dt>source x</dt><dd>{formatNumber(snapshot.sourceX)} px</dd></div>
      <div><dt>source y</dt><dd>{formatNumber(snapshot.sourceY)} px</dd></div>
      <div><dt>source rotation</dt><dd>{formatNumber(snapshot.sourceRotationDegrees)}°</dd></div>
      <div>
        <dt>surface world angle</dt>
        <dd>{formatNumber(snapshot.liquid.sourceWorldAngleDegrees)}°</dd>
      </div>
      <div>
        <dt>surface angular velocity</dt>
        <dd>{formatNumber(snapshot.liquid.sourceAngularVelocity)}</dd>
      </div>
      <div>
        <dt>destination wave</dt>
        <dd>{formatNumber(snapshot.liquid.destinationMaximumDisplacement)}</dd>
      </div>
    </dl>
  );
}

export function AnimationDebugLab() {
  const defaultScenario = ANIMATION_DEBUG_SCENARIOS[0];
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    defaultScenario?.id ?? "normal-non-empty",
  );
  const [showGeometryGuides, setShowGeometryGuides] = useState(false);
  const selectedScenario = useMemo(
    () => ANIMATION_DEBUG_SCENARIOS.find((scenario) => scenario.id === selectedScenarioId)
      ?? defaultScenario,
    [defaultScenario, selectedScenarioId],
  );

  const presentationRef = useRef<PourPresentation | null>(null);
  const requestedTimeRef = useRef(0);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [snapshot, setSnapshot] = useState<PourPresentationSnapshot | null>(null);

  const handlePresentationReady = useCallback((presentation: PourPresentation | null): void => {
    presentationRef.current = presentation;
    if (presentation === null) return;
    presentation.seek(requestedTimeRef.current);
    setSnapshot(presentation.getSnapshot());
  }, []);

  const handleFrame = useCallback((nextSnapshot: PourPresentationSnapshot): void => {
    setSnapshot(nextSnapshot);
    setPlayheadTime(nextSnapshot.timeSeconds);
  }, []);

  const seek = useCallback((timeSeconds: number): void => {
    const clamped = gsap.utils.clamp(0, GAME_TIMING.pour.totalSeconds, timeSeconds);
    requestedTimeRef.current = clamped;
    setPlayheadTime(clamped);
    const presentation = presentationRef.current;
    if (presentation === null) return;
    presentation.seek(clamped);
    setSnapshot(presentation.getSnapshot());
  }, []);

  if (selectedScenario === undefined) return null;

  return (
    <main className={debugStyles.page}>
      <header className={debugStyles.header}>
        <p className={debugStyles.eyebrow}>Water Sort</p>
        <h1>Animation Debug Lab</h1>
        <p>Render deterministic states from the production GSAP and liquid presentation.</p>
      </header>

      <section className={debugStyles.section}>
        <div className={debugStyles.scenarioRow}>
          <label className={debugStyles.scenarioControl}>
            <span>Scenario</span>
            <select
              value={selectedScenarioId}
              onChange={(event) => {
                const nextId = event.currentTarget.value;
                requestedTimeRef.current = 0;
                setPlayheadTime(0);
                setSnapshot(null);
                setSelectedScenarioId(nextId);
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
            Dragging the timeline performs a deterministic replay from zero. It does not wait for
            wall-clock animation time.
          </p>
        </div>

        <div className={debugStyles.interactiveLayout}>
          <div>
            <PourStage
              key={`${selectedScenario.id}-${showGeometryGuides ? "guides" : "plain"}`}
              scenario={selectedScenario}
              initialTimeSeconds={0}
              debugGeometry={showGeometryGuides}
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
                  const presentation = presentationRef.current;
                  if (presentation === null) return;
                  if (presentation.timeline.time() >= GAME_TIMING.pour.totalSeconds) {
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
          <h2 className={debugStyles.sectionTitle}>Checkpoint gallery</h2>
          <p className={debugStyles.sectionDescription}>
            Every card is paused at a deterministic presentation time. The Settled card renders
            the committed next board, matching production after presentation completion.
          </p>
        </div>

        <div className={debugStyles.gallery} data-debug-gallery="">
          {POUR_DEBUG_CHECKPOINTS.map((checkpoint) => (
            <article
              key={`${selectedScenario.id}-${checkpoint.id}-${showGeometryGuides ? "guides" : "plain"}`}
              className={debugStyles.checkpointCard}
              data-debug-card={checkpoint.id}
            >
              <header>
                <strong>{checkpoint.label}</strong>
                <span>{formatNumber(checkpoint.timeSeconds)} s</span>
              </header>
              <PourStage
                scenario={selectedScenario}
                initialTimeSeconds={checkpoint.timeSeconds}
                committed={checkpoint.id === "settled"}
                debugGeometry={showGeometryGuides}
              />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
