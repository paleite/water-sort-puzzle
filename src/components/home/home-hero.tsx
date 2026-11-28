"use client";

import { useEffect, useRef, useState } from "react";

import { calculatePourGeometry } from "@/lib/water-sort/animation/pour-geometry";
import {
  createPourTimeline,
  type PourPresentation,
} from "@/lib/water-sort/animation/timelines";
import { applyMove } from "@/lib/water-sort/domain/moves";
import type { Board } from "@/lib/water-sort/domain/types";
import { measureVialAnchors } from "@/lib/water-sort/rendering/dom-anchors";
import type { PixiBoardRenderer } from "@/lib/water-sort/rendering/pixi-board-renderer";
import {
  buildPourBoardRenderState,
  buildStaticBoardRenderState,
} from "@/lib/water-sort/rendering/render-state";

import styles from "@/components/water-sort/water-sort.module.css";

const CAPACITY = 4;
const INITIAL_BOARD: Board = [
  ["violet", "violet", "coral", "coral"],
  ["coral", "coral"],
  ["violet", "violet"],
];
const DEMO_MOVE = applyMove(
  INITIAL_BOARD,
  { sourceVialIndex: 0, destinationVialIndex: 1 },
  CAPACITY,
);
const INITIAL_HOLD_MILLISECONDS = 900;
const COMPLETION_HOLD_MILLISECONDS = 1300;

type HeroPhase = "loading" | "ready" | "pouring" | "settled" | "still" | "fallback";

export function HomeHero() {
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLSpanElement>(null);
  const destinationRef = useRef<HTMLSpanElement>(null);
  const thirdVialRef = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<HeroPhase>("loading");

  useEffect(() => {
    const board = boardRef.current;
    const host = canvasHostRef.current;
    const source = sourceRef.current;
    const destination = destinationRef.current;
    const thirdVial = thirdVialRef.current;
    if (
      board === null ||
      host === null ||
      source === null ||
      destination === null ||
      thirdVial === null
    ) return;

    const boardElement: HTMLDivElement = board;
    const canvasHost: HTMLDivElement = host;
    const sourceElement: HTMLSpanElement = source;
    const destinationElement: HTMLSpanElement = destination;
    const thirdVialElement: HTMLSpanElement = thirdVial;
    const vialElements = new Map<number, HTMLElement>([
      [0, sourceElement],
      [1, destinationElement],
      [2, thirdVialElement],
    ]);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: PixiBoardRenderer | null = null;
    let presentation: PourPresentation | null = null;
    let holdTimeout: number | undefined;
    let ready = false;
    let disposed = false;

    function stopDemo(): void {
      window.clearTimeout(holdTimeout);
      holdTimeout = undefined;
      presentation?.timeline.kill();
      presentation = null;
    }

    function renderStatic(activeRenderer: PixiBoardRenderer, board: Board): void {
      activeRenderer.render(buildStaticBoardRenderState({
        board,
        anchors: measureVialAnchors(boardElement, vialElements, board.length),
        selectedSourceVialIndex: null,
        capacity: CAPACITY,
      }));
    }

    function resetDemo(): void {
      if (disposed || !ready || renderer === null) return;
      const activeRenderer = renderer;
      stopDemo();
      renderStatic(activeRenderer, INITIAL_BOARD);
      const isPaused = document.hidden || reducedMotion.matches;
      activeRenderer.setAnimationPaused(isPaused);
      setPhase(isPaused ? "still" : "ready");
      if (isPaused) return;

      holdTimeout = window.setTimeout(() => {
        if (disposed || document.hidden || reducedMotion.matches) return;
        const anchors = measureVialAnchors(boardElement, vialElements, INITIAL_BOARD.length);
        const geometry = calculatePourGeometry(
          boardElement,
          sourceElement,
          destinationElement,
          undefined,
          DEMO_MOVE.previousBoard[DEMO_MOVE.move.sourceVialIndex]?.length,
          DEMO_MOVE.amount,
          CAPACITY,
        );
        setPhase("pouring");
        presentation = createPourTimeline({
          geometry,
          move: DEMO_MOVE,
          sourceWidthPixels: sourceElement.getBoundingClientRect().width,
          paused: true,
          onFrame: (snapshot) => {
            if (disposed) return;
            activeRenderer.render(buildPourBoardRenderState({
              move: DEMO_MOVE,
              anchors,
              selectedSourceVialIndex: null,
              geometry,
              presentation: snapshot,
              capacity: CAPACITY,
            }));
          },
          onComplete: () => {
            if (disposed) return;
            renderStatic(activeRenderer, DEMO_MOVE.nextBoard);
            setPhase("settled");
            holdTimeout = window.setTimeout(resetDemo, COMPLETION_HOLD_MILLISECONDS);
          },
        });
        presentation.timeline.play(0);
      }, INITIAL_HOLD_MILLISECONDS);
    }

    // A resize invalidates the measured geometry, so restart from a clean board.
    const resizeObserver = new ResizeObserver(resetDemo);
    resizeObserver.observe(boardElement);
    document.addEventListener("visibilitychange", resetDemo);
    reducedMotion.addEventListener("change", resetDemo);

    async function initialize(): Promise<void> {
      try {
        // Keep renderer initialization independent of the navigation controls.
        const { PixiBoardRenderer: Renderer } = await import(
          "@/lib/water-sort/rendering/pixi-board-renderer"
        );
        if (disposed) return;
        const activeRenderer = new Renderer({ boardElement: boardElement, canvasHost: canvasHost });
        renderer = activeRenderer;
        await activeRenderer.initialize();
        if (disposed) return;
        ready = true;
        resetDemo();
      } catch (error: unknown) {
        if (disposed) return;
        ready = false;
        stopDemo();
        renderer?.destroy();
        renderer = null;
        setPhase("fallback");
        console.warn("Unable to initialize home preview.", error);
      }
    }

    void initialize();
    return () => {
      disposed = true;
      ready = false;
      stopDemo();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", resetDemo);
      reducedMotion.removeEventListener("change", resetDemo);
      renderer?.destroy();
    };
  }, []);

  return (
    <div
      ref={boardRef}
      className={styles.homeHero}
      data-home-hero=""
      data-phase={phase}
      aria-hidden="true"
    >
      <span ref={sourceRef} className={styles.homeHeroAnchor} style={{ left: "20%" }} />
      <span ref={destinationRef} className={styles.homeHeroAnchor} style={{ left: "60%" }} />
      <span ref={thirdVialRef} className={styles.homeHeroAnchor} style={{ left: "85%" }} />
      {(phase === "loading" || phase === "fallback") && (
        <div
          className={styles.homeHeroFallback}
          style={{
            backgroundImage: `url("${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/offline-icon-192.png")`,
          }}
        />
      )}
      <div ref={canvasHostRef} className={styles.pixiCanvasHost} />
    </div>
  );
}
