"use client";

import Link from "next/link";
import { ArrowLeftIcon, RotateCcwIcon, Undo2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function GameHud({
  levelId,
  moveCount,
  canUndo,
  isAnimating,
  isDeadEnd,
  optimalMoveCount,
  parallelMode,
  parallelSourceCount,
  canToggleParallel,
  onToggleParallel,
  onUndo,
  onRestart,
}: {
  levelId: string;
  moveCount: number;
  canUndo: boolean;
  isAnimating: boolean;
  isDeadEnd: boolean;
  optimalMoveCount?: number;
  parallelMode: boolean;
  parallelSourceCount: number;
  canToggleParallel: boolean;
  onToggleParallel: () => void;
  onUndo: () => void;
  onRestart: () => void;
}) {
  const showDebug = process.env.NODE_ENV !== "production";

  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
      <Link href="/levels" aria-label="Choose level" className="rounded-xl">
        <Button variant="ghost" size="icon-lg" tabIndex={-1}>
          <ArrowLeftIcon />
        </Button>
      </Link>

      <div className="text-center">
        <div className="font-semibold">Level {levelId}</div>
        {parallelMode && (
          <div className="text-xs font-medium text-sky-700">
            Parallel: choose {parallelSourceCount < 2 ? `${2 - parallelSourceCount} source${parallelSourceCount === 1 ? "" : "s"}` : "destination"}
          </div>
        )}
        {showDebug && (
          <div className="text-xs text-slate-500">
            Moves {moveCount}
            {optimalMoveCount === undefined ? "" : ` · Optimal ${optimalMoveCount}`}
            {isDeadEnd ? " · DEAD END" : ""}
          </div>
        )}
      </div>

      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          disabled={!canToggleParallel || isAnimating}
          aria-label="Toggle parallel pour mode"
          aria-pressed={parallelMode}
          title="Parallel pour"
          className={parallelMode ? "bg-sky-100 text-sky-800" : undefined}
          onClick={onToggleParallel}
        >
          <span className="text-sm font-bold">2×</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          disabled={!canUndo || isAnimating}
          aria-label="Undo"
          onClick={onUndo}
        >
          <Undo2Icon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          disabled={isAnimating}
          aria-label="Restart level"
          onClick={onRestart}
        >
          <RotateCcwIcon />
        </Button>
      </div>
    </header>
  );
}
