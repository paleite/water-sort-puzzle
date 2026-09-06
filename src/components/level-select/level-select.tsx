"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { loadLevelManifest } from "@/lib/water-sort/levels/load-level";
import type { LevelManifest } from "@/lib/water-sort/levels/schemas";
import { loadProgress } from "@/lib/water-sort/persistence/progress";

import styles from "@/components/water-sort/water-sort.module.css";

export function LevelSelect() {
  const [manifest, setManifest] = useState<LevelManifest | null>(null);
  const [completed, setCompleted] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const controller = new AbortController();
    void loadLevelManifest(controller.signal).then((loadedManifest) => {
      setManifest(loadedManifest);
      setCompleted(new Set(loadProgress().completedLevelIds));
    });
    return () => controller.abort();
  }, []);

  if (manifest === null) {
    return <main className="grid min-h-dvh place-items-center">Loading levels…</main>;
  }

  const showDebug = process.env.NODE_ENV !== "production";

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl p-5">
      <header className="mb-7 flex items-center gap-3">
        <Link href="/" aria-label="Home">
          <Button variant="ghost" size="icon-lg" tabIndex={-1}>
            <ArrowLeftIcon />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Levels</h1>
      </header>

      <div className={styles.levelGrid}>
        {manifest.levels.map((level) => (
          <Link key={level.id} href={`/game/${level.id}`}>
            <Button
              variant={completed.has(level.id) ? "secondary" : "outline"}
              className="h-auto min-h-20 w-full flex-col gap-1 py-3"
              tabIndex={-1}
            >
              <span className="text-base font-semibold">{level.id}</span>
              {showDebug && level.development && (
                <span className="text-[10px] font-normal opacity-65">
                  {level.development.optimalMoveCount} moves
                </span>
              )}
            </Button>
          </Link>
        ))}
      </div>
    </main>
  );
}
