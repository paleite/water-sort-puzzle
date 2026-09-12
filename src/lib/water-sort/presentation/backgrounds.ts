export const BACKGROUND_STORAGE_KEY = "water-sort-background";

export const GAME_BACKGROUNDS = [
  {
    id: "charcoal",
    name: "Charcoal",
    css: "#222",
  },
  {
    id: "midnight",
    name: "Midnight",
    css: "radial-gradient(circle at 50% 14%, #26354d 0%, #111827 46%, #090d14 100%)",
  },
  {
    id: "deep_teal",
    name: "Deep Teal",
    css: "radial-gradient(circle at 50% 16%, #214244 0%, #132c2e 45%, #0a1718 100%)",
  },
  {
    id: "plum_night",
    name: "Plum Night",
    css: "radial-gradient(circle at 50% 14%, #493046 0%, #281b2b 46%, #120d15 100%)",
  },
  {
    id: "ember",
    name: "Ember",
    css: "radial-gradient(circle at 50% 14%, #4a3329 0%, #2a211d 48%, #15110f 100%)",
  },
] as const;

export type GameBackgroundId = (typeof GAME_BACKGROUNDS)[number]["id"];
export type GameBackground = (typeof GAME_BACKGROUNDS)[number];

export const DEFAULT_GAME_BACKGROUND_ID: GameBackgroundId = GAME_BACKGROUNDS[0].id;

export function isGameBackgroundId(value: string | null): value is GameBackgroundId {
  return GAME_BACKGROUNDS.some((background) => background.id === value);
}

export function getGameBackground(id: GameBackgroundId): GameBackground {
  return GAME_BACKGROUNDS.find((background) => background.id === id) ?? GAME_BACKGROUNDS[0];
}

export function getNextGameBackgroundId(currentId: GameBackgroundId): GameBackgroundId {
  const currentIndex = GAME_BACKGROUNDS.findIndex((background) => background.id === currentId);
  const safeIndex = currentIndex < 0 ? 0 : currentIndex;
  const nextIndex = (safeIndex + 1) % GAME_BACKGROUNDS.length;
  return GAME_BACKGROUNDS[nextIndex]?.id ?? DEFAULT_GAME_BACKGROUND_ID;
}
