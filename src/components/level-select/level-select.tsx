"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { LevelManifest } from "@/lib/water-sort/levels/schemas";
import { loadProgress } from "@/lib/water-sort/persistence/progress";

import styles from "@/components/water-sort/water-sort.module.css";

function getDifficultyProgressByLevelId(
  levels: LevelManifest["levels"],
): ReadonlyMap<string, number> {
  const difficultyScores = levels.flatMap(({ development }) =>
    development?.difficultyScore === undefined
      ? []
      : [development.difficultyScore],
  );
  if (difficultyScores.length === 0) {
    return new Map(levels.map((level) => [level.id, 1]));
  }

  const lowestDifficulty = Math.min(...difficultyScores);
  const highestDifficulty = Math.max(...difficultyScores);

  return new Map(
    levels.map((level) => {
      const difficultyScore = level.development?.difficultyScore;
      if (difficultyScore === undefined) return [level.id, 1];
      if (lowestDifficulty === highestDifficulty) return [level.id, 100];

      return [
        level.id,
        1 +
          ((difficultyScore - lowestDifficulty) /
            (highestDifficulty - lowestDifficulty)) *
            99,
      ];
    }),
  );
}

export function LevelSelect({ manifest }: { manifest: LevelManifest }) {
  const [completed, setCompleted] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setCompleted(new Set(loadProgress().completedLevelIds));
  }, []);

  const showDebug = process.env.NODE_ENV !== "production";
  const difficultyProgressByLevelId = getDifficultyProgressByLevelId(
    manifest.levels,
  );

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
        {manifest.levels.map((level) => {
          const difficultyProgress =
            difficultyProgressByLevelId.get(level.id) ?? 1;

          return (
            <div key={level.id} className="grid gap-1.5">
              <Link href={`/game/${level.id}`}>
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
              <div
                aria-label={`Level ${level.id} difficulty`}
                aria-valuemax={100}
                aria-valuemin={1}
                aria-valuenow={Math.round(difficultyProgress)}
                className="h-1.5 overflow-hidden rounded-full bg-white/15"
                role="progressbar"
              >
                <div
                  className="h-full rounded-full bg-sky-400"
                  style={{ width: `${difficultyProgress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
