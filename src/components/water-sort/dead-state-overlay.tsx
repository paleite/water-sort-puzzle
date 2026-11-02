"use client";

import { Button } from "@/components/ui/button";
import type { RewindRecoveryStatus } from "@/hooks/use-solvable-rewind";

export function DeadStateOverlay({
  reason,
  canUndo,
  recoveryStatus,
  onRecover,
  onCancelRecovery,
  onUndo,
  onRestart,
  onDismiss,
}: {
  reason: "no-moves" | "unsolvable" | "exhausted";
  canUndo: boolean;
  recoveryStatus: RewindRecoveryStatus;
  onRecover: () => void;
  onCancelRecovery: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onDismiss?: () => void;
}) {
  const searching = recoveryStatus === "searching";
  const unavailable = recoveryStatus === "unavailable";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-950 p-6 text-center text-white shadow-2xl">
        <h2 className="text-xl font-semibold">
          {reason === "no-moves" ? "No moves left" : reason === "exhausted" ? "No meaningful moves left" : "No solution from here"}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          {reason === "exhausted"
            ? "The remaining pours only rearrange liquid without unlocking new colors or space."
            : "This position can’t be completed."}
        </p>
        {searching && (
          <p role="status" className="mt-3 text-sm text-slate-300">
            Finding the last solvable position…
          </p>
        )}
        {unavailable && (
          <p role="status" className="mt-3 text-sm text-slate-300">
            Couldn’t confirm the last solvable position. You can undo one move instead.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="button"
            className="w-full"
            disabled={!canUndo || searching}
            onClick={unavailable ? onUndo : onRecover}
          >
            {unavailable ? "Undo last move" : "Back to last solvable position"}
          </Button>
          {searching && (
            <Button type="button" variant="ghost" className="w-full" onClick={onCancelRecovery}>
              Cancel search
            </Button>
          )}
          <Button type="button" variant="secondary" className="w-full" disabled={searching} onClick={onRestart}>
            Restart level
          </Button>
          {onDismiss !== undefined && (
            <Button type="button" variant="ghost" className="w-full" disabled={searching} onClick={onDismiss}>
              Keep playing
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
