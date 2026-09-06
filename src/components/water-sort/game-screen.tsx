"use client";

import { useEffect, useState } from "react";

import { useWaterSortGame } from "@/hooks/use-water-sort-game";
import type { Level } from "@/lib/water-sort/domain/types";
import { loadLevel, loadLevelManifest } from "@/lib/water-sort/levels/load-level";
import type { LevelManifest } from "@/lib/water-sort/levels/schemas";
import {
  loadProgress,
  saveProgress,
  type SavedGame,
} from "@/lib/water-sort/persistence/progress";

import { GameBoard } from "./game-board";
import { GameCompleteOverlay } from "./game-complete-overlay";
import { GameHud } from "./game-hud";
import styles from "./water-sort.module.css";

export function GameScreen({levelId}: {levelId: string}) {
  const [level, setLevel] = useState<Level | null>(null);
  const [manifest, setManifest] = useState<LevelManifest | null>(null);
  const [savedGame, setSavedGame] = useState<SavedGame | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void Promise.all([
      loadLevel(levelId, controller.signal),
      loadLevelManifest(controller.signal),
    ]).then(([loadedLevel, loadedManifest]) => {
      const progress = loadProgress();
      setSavedGame(progress.savedGame?.levelId === levelId ? progress.savedGame : undefined);
      setLevel(loadedLevel);
      setManifest(loadedManifest);
    }).catch((loadError: unknown) => {
      if (controller.signal.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load level.");
    });

    return () => controller.abort();
  }, [levelId]);

  if (error !== null) {
    return <main className="grid min-h-dvh place-items-center p-6">{error}</main>;
  }
  if (level === null || manifest === null) {
    return <main className="grid min-h-dvh place-items-center p-6">Loading level…</main>;
  }

  return (
    <GameRuntime
      key={level.id}
      level={level}
      manifest={manifest}
      {...(savedGame === undefined ? {} : {savedGame})}
    />
  );
}

function GameRuntime({
  level,
  manifest,
  savedGame,
}: {
  level: Level;
  manifest: LevelManifest;
  savedGame?: SavedGame;
}) {
  const game = useWaterSortGame(level, savedGame);
  const manifestIndex = manifest.levels.findIndex((entry) => entry.id === level.id);
  const nextLevelId =
    manifestIndex < 0 ? null : (manifest.levels[manifestIndex + 1]?.id ?? null);

  const isAnimating =
    game.phase === "presentingMove" ||
    game.phase === "presentingUndo" ||
    game.phase === "presentingRestart";

  useEffect(() => {
    if (
      game.phase !== "idle" &&
      game.phase !== "sourceSelected" &&
      game.phase !== "completed"
    ) {
      return;
    }

    const progress = loadProgress();

    if (game.phase === "completed") {
      saveProgress({
        version: 1,
        currentLevelId: nextLevelId ?? level.id,
        completedLevelIds: Array.from(
          new Set([...progress.completedLevelIds, level.id]),
        ),
        savedGame: null,
      });
      return;
    }

    saveProgress({
      version: 1,
      currentLevelId: level.id,
      completedLevelIds: progress.completedLevelIds,
      savedGame: {
        levelId: level.id,
        board: game.context.board,
        history: game.context.history,
      },
    });
  }, [
    game.phase,
    game.context.board,
    game.context.history,
    level.id,
    nextLevelId,
  ]);

  return (
    <main className={styles.gameShell}>
      <GameHud
        levelId={level.id}
        moveCount={game.context.history.length}
        canUndo={game.context.history.length > 0}
        isAnimating={isAnimating}
        isDeadEnd={game.context.isDeadEnd}
        {...(level.development?.optimalMoveCount === undefined
          ? {}
          : {optimalMoveCount: level.development.optimalMoveCount})}
        onUndo={game.undo}
        onRestart={game.restart}
      />

      <GameBoard
        board={game.context.board}
        capacity={level.capacity}
        phase={game.phase}
        selectedSourceVialIndex={game.context.selectedSourceVialIndex}
        activeMove={game.context.activeMove}
        activeUndo={game.context.activeUndo}
        onVialPress={game.pressVial}
        onMovePresentationFinished={game.finishMovePresentation}
        onUndoPresentationFinished={game.finishUndoPresentation}
        onRestartPresentationFinished={game.finishRestartPresentation}
      />

      {game.phase === "completed" && (
        <GameCompleteOverlay
          levelId={level.id}
          nextLevelId={nextLevelId}
          onReplay={game.restart}
        />
      )}
    </main>
  );
}
