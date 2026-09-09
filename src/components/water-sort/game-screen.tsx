"use client";

import { useEffect, useState } from "react";

import { useWaterSortGame } from "@/hooks/use-water-sort-game";
import { validateAndApplyPourBatch } from "@/lib/water-sort/domain/pour-batch";
import type { Level, Move } from "@/lib/water-sort/domain/types";
import { getTopColor } from "@/lib/water-sort/domain/vial";
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
  const [parallelMode, setParallelMode] = useState(false);
  const [parallelSources, setParallelSources] = useState<readonly number[]>([]);
  const manifestIndex = manifest.levels.findIndex((entry) => entry.id === level.id);
  const nextLevelId =
    manifestIndex < 0 ? null : (manifest.levels[manifestIndex + 1]?.id ?? null);

  const isAnimating =
    game.phase === "presentingMove" ||
    game.phase === "presentingUndo" ||
    game.phase === "presentingRestart";

  const clearParallelMode = (): void => {
    setParallelMode(false);
    setParallelSources([]);
  };

  const handleVialPress = (vialIndex: number): void => {
    if (!parallelMode) {
      game.pressVial(vialIndex);
      return;
    }

    if (parallelSources.includes(vialIndex)) {
      setParallelSources((current) => current.filter((index) => index !== vialIndex));
      return;
    }

    if (parallelSources.length < 2) {
      const vial = game.context.board[vialIndex];
      if (vial === undefined || vial.length === 0) return;

      const firstSourceIndex = parallelSources[0];
      if (firstSourceIndex !== undefined) {
        const firstSource = game.context.board[firstSourceIndex];
        if (firstSource === undefined || getTopColor(firstSource) !== getTopColor(vial)) return;
      }

      setParallelSources((current) => [...current, vialIndex]);
      return;
    }

    const requestedMoves: readonly Move[] = parallelSources.map((sourceVialIndex) => ({
      sourceVialIndex,
      destinationVialIndex: vialIndex,
    }));
    const validation = validateAndApplyPourBatch(
      game.context.board,
      requestedMoves,
      level.capacity,
    );
    if (!validation.ok) return;

    game.startPourBatch(parallelSources, vialIndex);
    clearParallelMode();
  };

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
        parallelMode={parallelMode}
        parallelSourceCount={parallelSources.length}
        canToggleParallel={game.phase === "idle"}
        onToggleParallel={() => {
          if (game.phase !== "idle") return;
          if (parallelMode) clearParallelMode();
          else {
            setParallelSources([]);
            setParallelMode(true);
          }
        }}
        {...(level.development?.optimalMoveCount === undefined
          ? {}
          : {optimalMoveCount: level.development.optimalMoveCount})}
        onUndo={() => {
          clearParallelMode();
          game.undo();
        }}
        onRestart={() => {
          clearParallelMode();
          game.restart();
        }}
      />

      <GameBoard
        board={game.context.board}
        capacity={level.capacity}
        phase={game.phase}
        selectedSourceVialIndex={game.context.selectedSourceVialIndex}
        parallelSelectedSourceVialIndices={parallelSources}
        activeMove={game.context.activeMove}
        activeBatch={game.context.activeBatch}
        activeUndo={game.context.activeUndo}
        onVialPress={handleVialPress}
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
