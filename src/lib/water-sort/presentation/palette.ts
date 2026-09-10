import { COLOR_IDS, type ColorId } from "../domain/colors";

export const PALETTE_STORAGE_KEY = "water-sort-palette";

export const LIQUID_PALETTES = [
  {
    id: "previous_ciede2000",
    name: "Previous CIEDE2000",
    values: [
      "#3dcff2",
      "#3474ef",
      "#f8c0e7",
      "#379889",
      "#d1e41f",
      "#c336e4",
      "#ffbb81",
      "#14a207",
      "#a96b81",
      "#fe3d38",
      "#8f7c30",
      "#32f9b3",
    ],
  },
  {
    id: "previous_cue_balanced",
    name: "Previous CUE Balanced",
    values: [
      "#37d2f3",
      "#4476e6",
      "#fdb2fd",
      "#2e9367",
      "#c0ec26",
      "#b668f3",
      "#fbcc9e",
      "#b29d1f",
      "#e71132",
      "#fb2da7",
      "#fd701d",
      "#3abd25",
    ],
  },
  {
    id: "reoptimized_cue_balanced",
    name: "Reoptimized CUE Balanced",
    values: [
      "#41c3f9",
      "#2a77fa",
      "#fdb3bf",
      "#1c9172",
      "#4ffb4e",
      "#97689f",
      "#f8ba19",
      "#7a9d08",
      "#f31921",
      "#fb4dc0",
      "#bd8865",
      "#2bf8ec",
    ],
  },
  {
    id: "boundary_aware",
    name: "Boundary Aware",
    values: [
      "#79d0f3",
      "#3692fb",
      "#fac5f7",
      "#0b8d8f",
      "#4ffb4e",
      "#a23ef9",
      "#f5ae10",
      "#7fa10e",
      "#be556e",
      "#f679c2",
      "#c78867",
      "#40ce96",
    ],
  },
  {
    id: "boundary_plus_surface",
    name: "Boundary + Surface",
    values: [
      "#59bfec",
      "#4e89fa",
      "#fac5f7",
      "#299b54",
      "#8ddb03",
      "#a23ef9",
      "#f9ac89",
      "#a5a163",
      "#f93c4d",
      "#ef7db1",
      "#b06a04",
      "#23fae0",
    ],
  },
] as const;

export type LiquidPaletteId = (typeof LIQUID_PALETTES)[number]["id"];
export type LiquidPalette = (typeof LIQUID_PALETTES)[number];

export const DEFAULT_LIQUID_PALETTE_ID: LiquidPaletteId = LIQUID_PALETTES[0].id;

function valuesToColorMap(values: readonly string[]): Record<ColorId, string> {
  return Object.fromEntries(
    COLOR_IDS.map((colorId, index) => [colorId, values[index] ?? "#ffffff"]),
  ) as Record<ColorId, string>;
}

export const LIQUID_COLORS: Record<ColorId, string> = valuesToColorMap(
  LIQUID_PALETTES[0].values,
);

export function isLiquidPaletteId(value: string | null): value is LiquidPaletteId {
  return LIQUID_PALETTES.some((palette) => palette.id === value);
}

export function getLiquidPalette(id: LiquidPaletteId): LiquidPalette {
  return LIQUID_PALETTES.find((palette) => palette.id === id) ?? LIQUID_PALETTES[0];
}

export function applyLiquidPalette(id: LiquidPaletteId): LiquidPalette {
  const palette = getLiquidPalette(id);
  const colors = valuesToColorMap(palette.values);

  for (const colorId of COLOR_IDS) {
    LIQUID_COLORS[colorId] = colors[colorId];
  }

  return palette;
}

export function getAdjacentPaletteId(
  currentId: LiquidPaletteId,
  direction: -1 | 1,
): LiquidPaletteId {
  const currentIndex = LIQUID_PALETTES.findIndex((palette) => palette.id === currentId);
  const safeIndex = currentIndex < 0 ? 0 : currentIndex;
  const nextIndex = (safeIndex + direction + LIQUID_PALETTES.length) % LIQUID_PALETTES.length;
  return LIQUID_PALETTES[nextIndex]?.id ?? DEFAULT_LIQUID_PALETTE_ID;
}
