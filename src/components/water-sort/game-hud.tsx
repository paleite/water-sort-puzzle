"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCcwIcon,
  Undo2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export function GameHud({
  levelId,
  moveCount,
  canUndo,
  isAnimating,
  isDeadEnd,
  optimalMoveCount,
  paletteAnnouncement,
  onPreviousPalette,
  onNextPalette,
  onUndo,
  onRestart,
}: {
  levelId: string;
  moveCount: number;
  canUndo: boolean;
  isAnimating: boolean;
  isDeadEnd: boolean;
  optimalMoveCount?: number;
  paletteAnnouncement: string | null;
  onPreviousPalette: () => void;
  onNextPalette: () => void;
  onUndo: () => void;
  onRestart: () => void;
}) {
  const showDebug = process.env.NODE_ENV !== "production";

  return (
    <header className="relative mx-auto w-full max-w-3xl px-4 pb-3 pt-2">
      <div
        role="group"
        aria-label="Liquid color palette"
        className="mx-auto mb-1 flex w-fit overflow-hidden rounded-lg border border-white/20 bg-black/15"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-none border-r border-white/15"
          aria-label="Previous color palette"
          onClick={onPreviousPalette}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-none"
          aria-label="Next color palette"
          onClick={onNextPalette}
        >
          <ChevronRightIcon />
        </Button>
      </div>

      {paletteAnnouncement !== null && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-full z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white shadow-lg"
        >
          {paletteAnnouncement}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="justify-self-start">
          <Link href="/levels" aria-label="Choose level" className="rounded-xl">
            <Button variant="ghost" size="icon-lg" tabIndex={-1}>
              <ArrowLeftIcon />
            </Button>
          </Link>
        </div>

        <div className="text-center">
          <div className="font-semibold">Level {levelId}</div>
          {showDebug && (
            <div className="text-xs text-slate-500">
              Moves {moveCount}
              {optimalMoveCount === undefined ? "" : ` · Optimal ${optimalMoveCount}`}
              {isDeadEnd ? " · DEAD END" : ""}
            </div>
          )}
        </div>

        <div className="flex justify-self-end gap-1">
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
      </div>
    </header>
  );
}
