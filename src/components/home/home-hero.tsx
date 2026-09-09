"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { VialSlotButton } from "@/components/water-sort/vial-slot-button";
import styles from "@/components/water-sort/water-sort.module.css";
import { calculatePourGeometry } from "@/lib/water-sort/animation/pour-geometry";
import { createPourTimeline, type PourPresentation } from "@/lib/water-sort/animation/timelines";
import { applyMove } from "@/lib/water-sort/domain/moves";
import type { Board } from "@/lib/water-sort/domain/types";
import { measureVialAnchors } from "@/lib/water-sort/rendering/dom-anchors";
import { PixiBoardRenderer } from "@/lib/water-sort/rendering/pixi-board-renderer";
import {
  buildPourBoardRenderState,
  buildStaticBoardRenderState,
  type BoardRenderState,
  type VialAnchor,
} from "@/lib/water-sort/rendering/render-state";

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

type TransientStateBuilder = (anchors: readonly VialAnchor[]) => BoardRenderState;

export function HomeHero() {
  const [board, setBoard] = useState<Board>(DEMO_BOARD);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const vialRefs = useRef(new Map<number, HTMLButtonElement>());
  const rendererRef = useRef<PixiBoardRenderer | null>(null);
  const transientStateBuilderRef = useRef<TransientStateBuilder | null>(null);
  const renderLatestRef = useRef<() => void>(() => {});
  const pourPresentationRef = useRef<PourPresentation | null>(null);
  const hasPlayedRef = useRef(false);

  const renderLatest = useCallback((): void => {
    const renderer = rendererRef.current;
    const container = containerRef.current;
    if (renderer === null || container === null) return;

    const anchors = measureVialAnchors(container, vialRefs.current, board.length);
    const transientStateBuilder = transientStateBuilderRef.current;
    renderer.render(
      transientStateBuilder === null
        ? buildStaticBoardRenderState({
            board,
            anchors,
            selectedSourceVialIndex: null,
            capacity: 4,
          })
        : transientStateBuilder(anchors),
    );
  }, [board]);

  renderLatestRef.current = renderLatest;

  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvasHost = canvasHostRef.current;
    if (container === null || canvasHost === null) return;

    const renderer = new PixiBoardRenderer({boardElement: container, canvasHost});
    rendererRef.current = renderer;
    void renderer.initialize().catch((error: unknown) => {
      console.error("Failed to initialize Pixi home renderer.", error);
    });

    let frame = 0;
    const scheduleRender = (): void => {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        renderLatestRef.current();
      });
    };

    const observer = new ResizeObserver(scheduleRender);
    observer.observe(container);
    for (const element of vialRefs.current.values()) observer.observe(element);
    window.addEventListener("resize", scheduleRender);
    scheduleRender();

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleRender);
      observer.disconnect();
      renderer.destroy();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [board.length]);

  useLayoutEffect(() => {
    renderLatest();
  }, [renderLatest]);

  useGSAP(() => {
    if (hasPlayedRef.current) return;

    const container = containerRef.current;
    const source = vialRefs.current.get(0);
    const destination = vialRefs.current.get(1);
    if (container === null || source === undefined || destination === undefined) return;

    hasPlayedRef.current = true;
    const introMotions = DEMO_BOARD.map(() => ({y: 28, alpha: 0}));
    transientStateBuilderRef.current = (anchors) => {
      const state = buildStaticBoardRenderState({
        board: DEMO_BOARD,
        anchors,
        selectedSourceVialIndex: null,
        capacity: 4,
      });
      return {
        ...state,
        vials: state.vials.map((vial, index) => ({
          ...vial,
          translationY: introMotions[index]?.y ?? 0,
          alpha: introMotions[index]?.alpha ?? 1,
        })),
      };
    };
    renderLatestRef.current();

    const intro = gsap.timeline({onUpdate: () => renderLatestRef.current()});
    intro.to(introMotions, {
      y: 0,
      alpha: 1,
      duration: 0.42,
      stagger: 0.08,
      ease: "back.out(1.5)",
    });

    const delayedPour = gsap.delayedCall(0.62, () => {
      const geometry = calculatePourGeometry(container, source, destination);
      const presentation = createPourTimeline({
        geometry,
        move: DEMO_MOVE,
        sourceWidthPixels: source.getBoundingClientRect().width,
        onFrame: (snapshot) => {
          transientStateBuilderRef.current = (anchors) => buildPourBoardRenderState({
            move: DEMO_MOVE,
            anchors,
            selectedSourceVialIndex: null,
            geometry,
            presentation: snapshot,
            capacity: 4,
          });
          renderLatestRef.current();
        },
        onComplete: () => {
          transientStateBuilderRef.current = null;
          setBoard(DEMO_MOVE.nextBoard);
        },
      });
      pourPresentationRef.current = presentation;
    });

    return () => {
      intro.kill();
      delayedPour.kill();
      pourPresentationRef.current?.timeline.kill();
      pourPresentationRef.current = null;
      transientStateBuilderRef.current = null;
      hasPlayedRef.current = false;
    };
  }, {scope: containerRef});

  return (
    <div ref={containerRef} className={styles.homeHero} aria-hidden="true">
      <div ref={canvasHostRef} className={styles.pixiCanvasHost} />

      <div className={styles.homeHeroSlots}>
        {board.map((vial, index) => (
          <VialSlotButton
            key={index}
            ref={(element) => {
              if (element === null) vialRefs.current.delete(index);
              else vialRefs.current.set(index, element);
            }}
            vial={vial}
            capacity={4}
            vialIndex={index}
            interactive={false}
          />
        ))}
      </div>
    </div>
  );
}
