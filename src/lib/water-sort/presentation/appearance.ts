import {
  BACKGROUND_STORAGE_KEY,
  DEFAULT_GAME_BACKGROUND_ID,
  isGameBackgroundId,
  type GameBackgroundId,
} from "./backgrounds";
import {
  DEFAULT_LIQUID_PALETTE_ID,
  isLiquidPaletteId,
  PALETTE_STORAGE_KEY,
  type LiquidPaletteId,
} from "./palette";
import {
  DEFAULT_VIAL_SKIN_ID,
  isVialSkinId,
  VIAL_SKIN_STORAGE_KEY,
  type VialSkinId,
} from "./vial-skins";

export interface Appearance {
  paletteId: LiquidPaletteId;
  backgroundId: GameBackgroundId;
  vialSkinId: VialSkinId;
}

export const DEFAULT_APPEARANCE: Appearance = {
  paletteId: DEFAULT_LIQUID_PALETTE_ID,
  backgroundId: DEFAULT_GAME_BACKGROUND_ID,
  vialSkinId: DEFAULT_VIAL_SKIN_ID,
};

const APPEARANCE_MIGRATION_KEY = "water-sort-appearance:classic-defaults";
type AppearanceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readAppearance(storage: AppearanceStorage): Appearance {
  const paletteId = storage.getItem(PALETTE_STORAGE_KEY);
  const backgroundId = storage.getItem(BACKGROUND_STORAGE_KEY);
  const vialSkinId = storage.getItem(VIAL_SKIN_STORAGE_KEY);

  // Older releases saved all three defaults even without user input.
  const needsMigration = storage.getItem(APPEARANCE_MIGRATION_KEY) === null;
  const hasOldDefaults = needsMigration &&
    paletteId === "mad_alchemist" &&
    backgroundId === "arcane" &&
    vialSkinId === "compact-alchemist";

  if (needsMigration) {
    try {
      if (hasOldDefaults) {
        storage.removeItem(PALETTE_STORAGE_KEY);
        storage.removeItem(BACKGROUND_STORAGE_KEY);
        storage.removeItem(VIAL_SKIN_STORAGE_KEY);
      }
      storage.setItem(APPEARANCE_MIGRATION_KEY, "1");
    } catch {
      // Reading appearance must not depend on writable storage.
    }
  }
  if (hasOldDefaults) return DEFAULT_APPEARANCE;

  return {
    paletteId: isLiquidPaletteId(paletteId) ? paletteId : DEFAULT_APPEARANCE.paletteId,
    backgroundId: isGameBackgroundId(backgroundId) ? backgroundId : DEFAULT_APPEARANCE.backgroundId,
    vialSkinId: isVialSkinId(vialSkinId) ? vialSkinId : DEFAULT_APPEARANCE.vialSkinId,
  };
}

export function loadAppearance(): Appearance {
  try {
    return readAppearance(window.localStorage);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}
