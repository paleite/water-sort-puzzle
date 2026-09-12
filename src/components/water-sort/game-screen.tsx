"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useWaterSortGame } from "@/hooks/use-water-sort-game";
import type { Level } from "@/lib/water-sort/domain/types";
import { loadLevel, loadLevelManifest } from "@/lib/water-sort/levels/load-level";
import type { LevelManifest } from "@/lib/water-sort/levels/schemas";
import {
  loadProgress,
  saveProgress,
  type SavedGame,
} from "@/lib/water-sort/persistence/progress";
import {
  BACKGROUND_STORAGE_KEY,
  DEFAULT_GAME_BACKGROUND_ID,
  getGameBackground,
  getNextGameBackgroundId,
  isGameBackgroundId,
  type GameBackgroundId,
} from "@/lib/water-sort/presentation/backgrounds";
import {
  applyLiquidPalette,
  DEFAULT_LIQUID_PALETTE_ID,
  getAdjacentPaletteId,
  isLiquidPaletteId,
  PALETTE_STORAGE_KEY,
  type LiquidPaletteId,
} from "@/lib/water-sort/presentation/palette";

import { GameBoard } from "./game-board";
import { GameCompleteOverlay } from "./game-complete-overlay";
import { GameHud } from "./game-hud";
import styles from "./water-sort.module.css";

const DRAG_THRESHOLD_PIXELS = 8;
const DRAG_CLICK_SUPPRESSION_MILLISECONDS = 250;

function getVialSlot(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>("[data-vial-slot]")
    : null;
}

function getVialSlotAtPoint(clientX: number, clientY: number): HTMLElement | null {
  return document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>("[data-vial-slot]") ?? null;
}

function getVialIndex(slot: HTMLElement | null): number | null {
  if (slot === null) return null;
  const vialIndex = Number(slot.dataset.vialSlot);
  return Number.isInteger(vialIndex) ? vialIndex : null;
}

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
  const [paletteId, setPaletteId] = useState<LiquidPaletteId>(DEFAULT_LIQUID_PALETTE_ID);
  const [backgroundId, setBackgroundId] = useState<GameBackgroundId>(
    DEFAULT_GAME_BACKGROUND_ID,
  );
  const [appearanceAnnouncement, setAppearanceAnnouncement] = useState<string | null>(null);
  const appearanceAnnouncementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressDragClickUntilRef = useRef(0);
  const manifestIndex = manifest.levels.findIndex((entry) => entry.id === level.id);
  const nextLevelId =
    manifestIndex < 0 ? null : (manifest.levels[manifestIndex + 1]?.id ?? null);
  const background = getGameBackground(backgroundId);

  const isTransitionAnimating =
    game.phase === "presentingUndo" || game.phase === "presentingRestart";
  const hasActivePours = game.context.activePresentations.length > 0;
  const isHudAnimating = isTransitionAnimating || hasActivePours;

  const forceBoardRender = useCallback((): void => {
    window.dispatchEvent(new Event("resize"));
  }, []);

  const announceAppearance = useCallback((message: string): void => {
    if (appearanceAnnouncementTimeoutRef.current !== null) {
      clearTimeout(appearanceAnnouncementTimeoutRef.current);
    }

    setAppearanceAnnouncement(message);
    appearanceAnnouncementTimeoutRef.current = setTimeout(() => {
      setAppearanceAnnouncement(null);
      appearanceAnnouncementTimeoutRef.current = null;
    }, 1100);
  }, []);

  const cyclePalette = useCallback((direction: -1 | 1): void => {
    const nextPaletteId = getAdjacentPaletteId(paletteId, direction);
    const nextPalette = applyLiquidPalette(nextPaletteId);
    setPaletteId(nextPaletteId);

    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, nextPaletteId);
    } catch {
      // Persistence is optional when storage is unavailable.
    }

    announceAppearance(nextPalette.name);
    forceBoardRender();
  }, [announceAppearance, forceBoardRender, paletteId]);

  const cycleBackground = useCallback((): void => {
    const nextBackgroundId = getNextGameBackgroundId(backgroundId);
    const nextBackground = getGameBackground(nextBackgroundId);
    setBackgroundId(nextBackgroundId);

    try {
      window.localStorage.setItem(BACKGROUND_STORAGE_KEY, nextBackgroundId);
    } catch {
      // Persistence is optional when storage is unavailable.
    }

    announceAppearance(`Background: ${nextBackground.name}`);
  }, [announceAppearance, backgroundId]);

  useEffect(() => {
    let storedPaletteId: string | null = null;
    let storedBackgroundId: string | null = null;
    try {
      storedPaletteId = window.localStorage.getItem(PALETTE_STORAGE_KEY);
      storedBackgroundId = window.localStorage.getItem(BACKGROUND_STORAGE_KEY);
    } catch {
      // Fall back to defaults when storage is unavailable.
    }

    const resolvedPaletteId = isLiquidPaletteId(storedPaletteId)
      ? storedPaletteId
      : DEFAULT_LIQUID_PALETTE_ID;
    const resolvedBackgroundId = isGameBackgroundId(storedBackgroundId)
      ? storedBackgroundId
      : DEFAULT_GAME_BACKGROUND_ID;

    applyLiquidPalette(resolvedPaletteId);
    setPaletteId(resolvedPaletteId);
    setBackgroundId(resolvedBackgroundId);

    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, resolvedPaletteId);
      window.localStorage.setItem(BACKGROUND_STORAGE_KEY, resolvedBackgroundId);
    } catch {
      // Persistence is optional when storage is unavailable.
    }

    forceBoardRender();

    return () => {
      if (appearanceAnnouncementTimeoutRef.current !== null) {
        clearTimeout(appearanceAnnouncementTimeoutRef.current);
      }
    };
  }, [forceBoardRender]);

  useEffect(() => {
    if (game.phase !== "idle" && game.phase !== "sourceSelected") return;

    let activePointerId: number | null = null;
    let sourceVialIndex: number | null = null;
    let sourceSlot: HTMLElement | null = null;
    let dragTargetSlot: HTMLElement | null = null;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let dragging = false;

    const clearDragVisuals = (): void => {
      sourceSlot?.removeAttribute("data-drag-source");
      dragTargetSlot?.removeAttribute("data-drag-target");
      dragTargetSlot = null;
    };

    const resetGesture = (): void => {
      clearDragVisuals();
      activePointerId = null;
      sourceVialIndex = null;
      sourceSlot = null;
      dragging = false;
    };

    const setDragTarget = (nextTarget: HTMLElement | null): void => {
      if (dragTargetSlot === nextTarget) return;
      dragTargetSlot?.removeAttribute("data-drag-target");
      dragTargetSlot = nextTarget;
      dragTargetSlot?.setAttribute("data-drag-target", "true");
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (!event.isPrimary || event.button !== 0 || activePointerId !== null) return;

      const slot = getVialSlot(event.target);
      const vialIndex = getVialIndex(slot);
      if (slot === null || vialIndex === null) return;
      if ((game.context.board[vialIndex]?.length ?? 0) === 0) return;

      activePointerId = event.pointerId;
      sourceVialIndex = vialIndex;
      sourceSlot = slot;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId || sourceVialIndex === null) return;

      if (!dragging) {
        const distance = Math.hypot(
          event.clientX - pointerStartX,
          event.clientY - pointerStartY,
        );
        if (distance < DRAG_THRESHOLD_PIXELS) return;

        dragging = true;
        sourceSlot?.setAttribute("data-drag-source", "true");
      }

      event.preventDefault();
      const targetSlot = getVialSlotAtPoint(event.clientX, event.clientY);
      const targetIndex = getVialIndex(targetSlot);
      setDragTarget(
        targetIndex !== null && targetIndex !== sourceVialIndex
          ? targetSlot
          : null,
      );
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId || sourceVialIndex === null) return;

      const dragSourceVialIndex = sourceVialIndex;
      const wasDragging = dragging;
      const targetVialIndex = wasDragging
        ? getVialIndex(getVialSlotAtPoint(event.clientX, event.clientY))
        : null;

      resetGesture();
      if (!wasDragging) return;

      event.preventDefault();
      suppressDragClickUntilRef.current =
        performance.now() + DRAG_CLICK_SUPPRESSION_MILLISECONDS;

      if (targetVialIndex === null || targetVialIndex === dragSourceVialIndex) return;

      if (game.context.selectedSourceVialIndex !== dragSourceVialIndex) {
        game.pressVial(dragSourceVialIndex);
      }
      game.pressVial(targetVialIndex);
    };

    const onPointerCancel = (event: PointerEvent): void => {
      if (event.pointerId === activePointerId) resetGesture();
    };

    const onClickCapture = (event: MouseEvent): void => {
      if (performance.now() > suppressDragClickUntilRef.current) return;
      if (getVialSlot(event.target) === null) return;

      suppressDragClickUntilRef.current = 0;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, {passive: false});
    window.addEventListener("pointerup", onPointerUp, {passive: false});
    window.addEventListener("pointercancel", onPointerCancel);
    document.addEventListener("click", onClickCapture, true);

    return () => {
      resetGesture();
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [
    game.context.board,
    game.context.selectedSourceVialIndex,
    game.phase,
    game.pressVial,
  ]);

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
    <main className={styles.gameShell} style={{background: background.css}}>
      <GameHud
        levelId={level.id}
        moveCount={game.context.history.length}
        canUndo={game.context.history.length > 0 && !hasActivePours}
        isAnimating={isHudAnimating}
        isDeadEnd={game.context.isDeadEnd}
        appearanceAnnouncement={appearanceAnnouncement}
        onPreviousPalette={() => cyclePalette(-1)}
        onNextPalette={() => cyclePalette(1)}
        onCycleBackground={cycleBackground}
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
        activePresentations={game.context.activePresentations}
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
