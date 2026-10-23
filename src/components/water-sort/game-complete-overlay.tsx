"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { GAME_TIMING } from "@/lib/water-sort/animation/timing";
import { fireLevelCompleteConfetti } from "@/lib/water-sort/presentation/confetti";

export function GameCompleteOverlay({
  levelId,
  nextLevelId,
  onReplay,
}: {
  levelId: string;
  nextLevelId: string | null;
  onReplay: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const timeout = window.setTimeout(
      fireLevelCompleteConfetti,
      GAME_TIMING.completionHoldSeconds * 1000,
    );
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-5 backdrop-blur-[2px]">
      <section className="grid w-full max-w-sm gap-5 rounded-3xl bg-slate-900/95 p-6 text-center text-slate-100 shadow-2xl ring-1 ring-white/10">
        <div>
          <h2 className="text-2xl font-bold">Level complete</h2>
          <p className="mt-1 text-sm text-slate-400">Level {levelId} solved.</p>
        </div>
        <div className="grid gap-2">
          {nextLevelId !== null && (
            <Button type="button" size="lg" className="w-full" onClick={() => router.replace(`/game/${nextLevelId}`)}>Next level</Button>
          )}
          <Button type="button" variant="secondary" size="lg" onClick={onReplay}>
            Replay
          </Button>
          <Link href="/levels">
            <Button variant="ghost" size="lg" className="w-full" tabIndex={-1}>
              Level select
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
