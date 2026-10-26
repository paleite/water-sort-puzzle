"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { addComboCelebration, type ComboCelebration } from "@/components/water-sort/combo-celebrations";
import type { AppliedMove } from "@/lib/water-sort/domain/types";
import { ComboTracker } from "@/lib/water-sort/presentation/combo";

type ComboPhase = "idle" | "sourceSelected" | "presentingUndo" | "presentingRestart" | "completed";

export function useComboFeedback(phase: ComboPhase) {
  const trackerRef = useRef(new ComboTracker());
  const [visible, setVisible] = useState<ComboCelebration[]>([]);
  const sequenceRef = useRef(0);

  const onPresentationQueued = useCallback((id: number, move: AppliedMove, capacity: number) => {
    trackerRef.current.accept(id, move, capacity, performance.now());
  }, []);

  const onPresentationStarted = useCallback((id: number) => {
    const count = trackerRef.current.start(id);
    if (count === null || count < 2) return;
    const sequence = ++sequenceRef.current;
    setVisible((current) => addComboCelebration(current, {id, count, sequence}));
  }, []);

  const onPresentationFinished = useCallback((id: number) => {
    trackerRef.current.finish(id, performance.now());
    setVisible((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const reset = useCallback(() => {
    trackerRef.current.reset();
    setVisible([]);
  }, []);

  useEffect(() => {
    if (phase === "presentingUndo" || phase === "presentingRestart" || phase === "completed") {
      reset();
    }
  }, [phase, reset]);

  return {
    celebrations: visible,
    onPresentationQueued,
    onPresentationStarted,
    onPresentationFinished,
  };
}
