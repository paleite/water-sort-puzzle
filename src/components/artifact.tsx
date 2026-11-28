"use client";

import { useCallback, useEffect, useState } from "react";
import { AppNavigation } from "@/components/app/app-navigation";
import { OfflineStatus } from "@/components/app/offline-status";
import { HomeScreen } from "@/components/home/home-screen";
import { LevelSelect } from "@/components/level-select/level-select";
import { GameScreen } from "@/components/water-sort/game-screen";
import { LEVEL_INDEX } from "@/lib/water-sort/levels/levels.generated";
import { getAppHref, readAppLocation, type AppDestination } from "@/lib/water-sort/navigation/app-location";

export default function Artifact() {
  const [destination, setDestination] = useState<AppDestination | null>(null);

  useEffect(() => {
    const synchronize = () => setDestination(readAppLocation(window.location.search));
    window.addEventListener("popstate", synchronize);
    synchronize();
    return () => window.removeEventListener("popstate", synchronize);
  }, []);

  const navigate = useCallback((next: AppDestination, replace: boolean) => {
    const href = getAppHref(next, process.env.NEXT_PUBLIC_BASE_PATH ?? "");
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
    setDestination(next);
    window.scrollTo(0, 0);
  }, []);

  if (destination === null) return <div role="status">Loading…</div>;

  return (
    <AppNavigation.Provider value={navigate}>
      {destination.kind === "home" && <HomeScreen />}
      {destination.kind === "home" && <OfflineStatus />}
      {destination.kind === "levels" && <LevelSelect levels={LEVEL_INDEX} />}
      {destination.kind === "game" && <GameScreen levelId={destination.levelId} />}
    </AppNavigation.Provider>
  );
}
