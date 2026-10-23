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
  const audioContextRef = useRef<AudioContext | null>(null);

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

  // Called from a direct vial interaction to satisfy mobile audio gesture policies.
  const unlockComboAudio = useCallback(() => {
    try {
      audioContextRef.current ??= new AudioContext();
      if (audioContextRef.current.state === "suspended") {
        void audioContextRef.current.resume().catch(() => {});
      }
    } catch {
      // Combo visuals remain available on devices without Web Audio.
    }
  }, []);

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
        const context = audioContextRef.current;
        if (context !== null && context.state === "running") {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const startedAt = context.currentTime;
          const frequency = Math.min(1100, 320 * Math.pow(1.13, nextCount - 2));
          oscillator.type = nextCount >= 5 ? "triangle" : "sine";
          oscillator.frequency.setValueAtTime(frequency, startedAt);
          oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.22, startedAt + 0.11);
          gain.gain.setValueAtTime(0.0001, startedAt);
          gain.gain.exponentialRampToValueAtTime(0.075, startedAt + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.17);
          oscillator.connect(gain).connect(context.destination);
          oscillator.start(startedAt);
          oscillator.stop(startedAt + 0.18);
        }
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

  useEffect(() => () => {
    clearGraceTimer();
    if (audioContextRef.current !== null) {
      void audioContextRef.current.close().catch(() => {});
    }
  }, [clearGraceTimer]);

  return {comboCount, comboSequence, unlockComboAudio};
}
