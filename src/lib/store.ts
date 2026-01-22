import { create } from "zustand";
import { persist } from "zustand/middleware";

import { MAX_LEVEL, MIN_LEVEL } from "./constants";

type GameState = {
  currentLevel: number;
  highestLevel: number;
  setCurrentLevel: (level: number) => void;
  incrementHighestLevel: () => void;
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      currentLevel: MIN_LEVEL,
      highestLevel: MAX_LEVEL,
      setCurrentLevel: (level: number) => {
        set({ currentLevel: Math.max(MIN_LEVEL, Math.min(level, MAX_LEVEL)) });
      },
      incrementHighestLevel: () => {
        set((state) => ({
          highestLevel: Math.max(state.highestLevel, state.currentLevel + 1),
        }));
      },
    }),
    {
      name: "water-sort-game-storage",
    },
  ),
);
