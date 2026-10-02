"use client";

import { Button } from "@/components/ui/button";

export function DeadStateOverlay({
  reason,
  canUndo,
  onUndo,
  onRestart,
  onDismiss,
}: {
  reason: "no-moves" | "unsolvable";
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-950 p-6 text-center text-white shadow-2xl">
        <h2 className="text-xl font-semibold">
          {reason === "no-moves" ? "No moves left" : "No solution from here"}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          This position can’t be completed.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button type="button" disabled={!canUndo} onClick={onUndo}>
            Undo last move
          </Button>
          <Button type="button" variant="secondary" onClick={onRestart}>
            Restart level
          </Button>
        </div>
        {onDismiss !== undefined && (
          <Button type="button" variant="ghost" className="mt-2" onClick={onDismiss}>
            Keep playing
          </Button>
        )}
      </div>
    </div>
  );
}
