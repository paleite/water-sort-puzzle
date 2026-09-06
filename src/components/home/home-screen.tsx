"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { loadLevelManifest } from "@/lib/water-sort/levels/load-level";
import { loadProgress } from "@/lib/water-sort/persistence/progress";

import styles from "@/components/water-sort/water-sort.module.css";
import { HomeHero } from "./home-hero";

export function HomeScreen() {
  const [continueLevelId, setContinueLevelId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void loadLevelManifest(controller.signal).then((manifest) => {
      const progress = loadProgress();
      const requested = progress.currentLevelId;
      const levelExists =
        requested !== null && manifest.levels.some((entry) => entry.id === requested);

      setContinueLevelId(
        levelExists ? requested : (manifest.levels[0]?.id ?? null),
      );
    });

    return () => controller.abort();
  }, []);

  return (
    <main className={styles.home}>
      <div className={styles.homePanel}>
        <h1 className={styles.homeTitle}>Water<br />Sort</h1>
        <HomeHero />
        <div className={styles.homeActions}>
          {continueLevelId !== null && (
            <Link href={`/game/${continueLevelId}`}>
              <Button size="lg" className="h-12 w-full text-base" tabIndex={-1}>
                Continue
              </Button>
            </Link>
          )}
          <Link href="/levels">
            <Button
              variant="secondary"
              size="lg"
              className="h-12 w-full text-base"
              tabIndex={-1}
            >
              Level select
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
