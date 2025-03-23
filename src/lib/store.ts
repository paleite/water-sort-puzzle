import { create } from "zustand";
import { persist } from "zustand/middleware";

type GameState = {
  currentLevel: number;
  highestLevel: number;
  setCurrentLevel: (level: number) => void;
  incrementHighestLevel: () => void;
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      currentLevel: 1,
      highestLevel: 1,
      setCurrentLevel: (level: number) => {
        set({ currentLevel: level });
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
