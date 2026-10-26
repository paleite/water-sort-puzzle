"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AppliedMove } from "@/lib/water-sort/domain/types";
import { ComboTracker } from "@/lib/water-sort/presentation/combo";

type ComboPhase = "idle" | "sourceSelected" | "presentingUndo" | "presentingRestart" | "completed";

export function useComboFeedback(phase: ComboPhase) {
  const trackerRef = useRef(new ComboTracker());
  const [visible, setVisible] = useState<{id: number; count: number; sequence: number} | null>(null);
  const sequenceRef = useRef(0);

  const onPresentationQueued = useCallback((id: number, move: AppliedMove, capacity: number) => {
    trackerRef.current.accept(id, move, capacity, performance.now());
  }, []);

  const onPresentationStarted = useCallback((id: number) => {
    const count = trackerRef.current.start(id);
    if (count === null || count < 2) return;
    sequenceRef.current += 1;
    setVisible({id, count, sequence: sequenceRef.current});
  }, []);

  const onPresentationFinished = useCallback((id: number) => {
    trackerRef.current.finish(id, performance.now());
    setVisible((current) => current?.id === id ? null : current);
  }, []);

  const reset = useCallback(() => {
    trackerRef.current.reset();
    setVisible(null);
  }, []);

  useEffect(() => {
    if (phase === "presentingUndo" || phase === "presentingRestart" || phase === "completed") {
      reset();
    }
  }, [phase, reset]);

  return {
    comboCount: visible?.count ?? 0,
    comboSequence: visible?.sequence ?? 0,
    onPresentationQueued,
    onPresentationStarted,
    onPresentationFinished,
  };
}
