"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COMBO_GRACE_MILLISECONDS = 500;

type ComboPhase = "idle" | "sourceSelected" | "presentingUndo" | "presentingRestart" | "completed";

export function useComboFeedback({
  moveCount,
  activePourCount,
  phase,
}: {
  moveCount: number;
  activePourCount: number;
  phase: ComboPhase;
}) {
  const [comboCount, setComboCount] = useState(0);
  const [comboSequence, setComboSequence] = useState(0);
  const lastMoveCountRef = useRef(moveCount);
  const activePourCountRef = useRef(activePourCount);
  const comboCountRef = useRef(0);
  const graceDeadlineRef = useRef(0);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearGraceTimer = useCallback(() => {
    if (graceTimerRef.current !== null) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  }, []);

  const resetCombo = useCallback(() => {
    clearGraceTimer();
    graceDeadlineRef.current = 0;
    comboCountRef.current = 0;
    setComboCount(0);
  }, [clearGraceTimer]);

  useEffect(() => {
    const previousMoveCount = lastMoveCountRef.current;
    const previouslyActive = activePourCountRef.current > 0;
    lastMoveCountRef.current = moveCount;
    activePourCountRef.current = activePourCount;

    if (phase === "presentingUndo" || phase === "presentingRestart" || moveCount < previousMoveCount) {
      resetCombo();
      return;
    }

    if (moveCount > previousMoveCount) {
      const withinGrace = performance.now() <= graceDeadlineRef.current;
      const nextCount = previouslyActive || withinGrace ? comboCountRef.current + 1 : 1;
      clearGraceTimer();
      graceDeadlineRef.current = 0;
      comboCountRef.current = nextCount;
      setComboCount(nextCount);
      if (nextCount >= 2) {
        setComboSequence((current) => current + 1);

      }
    }

    if (phase === "completed") {
      clearGraceTimer();
      return;
    }

    if (activePourCount === 0 && comboCountRef.current > 0 && graceTimerRef.current === null) {
      graceDeadlineRef.current = performance.now() + COMBO_GRACE_MILLISECONDS;
      graceTimerRef.current = setTimeout(() => {
        graceTimerRef.current = null;
        graceDeadlineRef.current = 0;
        comboCountRef.current = 0;
        setComboCount(0);
      }, COMBO_GRACE_MILLISECONDS);
    }
  }, [activePourCount, moveCount, phase, clearGraceTimer, resetCombo]);

  useEffect(() => clearGraceTimer, [clearGraceTimer]);

  return {comboCount, comboSequence};
}
