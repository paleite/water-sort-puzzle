"use client";

import { useMachine } from "@xstate/react";
import { useCallback } from "react";

import type { Level } from "@/lib/water-sort/domain/types";
import { gameMachine } from "@/lib/water-sort/machine/game-machine";
import type { SavedGame } from "@/lib/water-sort/persistence/progress";

export type GamePhase =
  | "idle"
  | "sourceSelected"
  | "presentingUndo"
  | "presentingRestart"
  | "completed";

export function useWaterSortGame(level: Level, savedGame?: SavedGame) {
  const [snapshot, send] = useMachine(gameMachine, {
    input: {...(savedGame === undefined ? {} : {savedGame}), level},
  });

  const phase: GamePhase = snapshot.matches("completed")
    ? "completed"
    : snapshot.matches({playing: "sourceSelected"})
      ? "sourceSelected"
      : snapshot.matches({playing: "presentingUndo"})
        ? "presentingUndo"
        : snapshot.matches({playing: "presentingRestart"})
          ? "presentingRestart"
          : "idle";

  const pressVial = useCallback((vialIndex: number) => {
    send({type: "VIAL.PRESSED", vialIndex});
  }, [send]);

  const undo = useCallback(() => send({type: "UNDO"}), [send]);
  const restart = useCallback(() => send({type: "RESTART"}), [send]);
  const finishMovePresentation = useCallback((presentationId: number) => {
    send({type: "PRESENTATION.FINISHED", presentationId});
  }, [send]);
  const finishUndoPresentation = useCallback(
    () => send({type: "UNDO.PRESENTATION_FINISHED"}),
    [send],
  );
  const finishRestartPresentation = useCallback(
    () => send({type: "RESTART.PRESENTATION_FINISHED"}),
    [send],
  );

  return {
    snapshot,
    context: snapshot.context,
    phase,
    pressVial,
    undo,
    restart,
    finishMovePresentation,
    finishUndoPresentation,
    finishRestartPresentation,
  };
}
