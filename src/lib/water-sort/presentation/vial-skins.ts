export interface VialSkinPoint {
  x: number;
  y: number;
}

export interface VialSkinDefinition {
  id: string;
  name: string;
  svgSource: string;
  backgroundSource?: string;
  stopperSources?: readonly string[];
  stopperBounds?: {x: number; y: number; width: number; height: number};
  viewBox: {
    width: number;
    height: number;
  };
  liquidPolygon: readonly VialSkinPoint[];
  liquidSurfaceY: number;
  mouth: {
    left: VialSkinPoint;
    right: VialSkinPoint;
  };
}

export interface VialSkinBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

function publicPath(path: string): string {
  return `${process.env["NEXT_PUBLIC_BASE_PATH"] ?? ""}${path}`;
}

export const DEFAULT_VIAL_SKIN = {
  id: "mad-alchemist",
  name: "Mad Alchemist",
  svgSource: publicPath("/vials/mad-alchemist.svg"),
  viewBox: {width: 100, height: 272},
  liquidPolygon: [
    {x: 14.5, y: 22},
    {x: 85.5, y: 22},
    {x: 85.5, y: 214},
    {x: 83.5, y: 229},
    {x: 78.5, y: 241},
    {x: 70.5, y: 251},
    {x: 60.5, y: 257},
    {x: 50, y: 259},
    {x: 39.5, y: 257},
    {x: 29.5, y: 251},
    {x: 21.5, y: 241},
    {x: 16.5, y: 229},
    {x: 14.5, y: 214},
  ],
  liquidSurfaceY: 22,
  mouth: {
    left: {x: 12, y: 18},
    right: {x: 88, y: 18},
  },
} as const satisfies VialSkinDefinition;

export const VIAL_SKIN_STORAGE_KEY = "water-sort-vial-skin";

export const CLASSIC_VIAL_SKIN = {
  ...DEFAULT_VIAL_SKIN,
  id: "classic",
  name: "Classic",
  svgSource: publicPath("/vials/classic.svg"),
} as const satisfies VialSkinDefinition;

export const COMPACT_VIAL_SKIN = {
  ...DEFAULT_VIAL_SKIN,
  id: "compact-alchemist",
  name: "Compact Alchemist",
  svgSource: publicPath("/potions/compact/vial/glass_front.png"),
  backgroundSource: publicPath("/potions/compact/vial/glass_back.png"),
  stopperSources: ["cork", "wax", "crystal", "orb", "moon"].map((name) =>
    publicPath(`/potions/compact/toppers/${name}.png`)
  ),
  stopperBounds: {x: 0, y: 0, width: 100, height: 18},
} as const satisfies VialSkinDefinition;

export const VIAL_SKINS = [COMPACT_VIAL_SKIN, DEFAULT_VIAL_SKIN, CLASSIC_VIAL_SKIN] as const;
export const DEFAULT_VIAL_SKIN_ID = COMPACT_VIAL_SKIN.id;
export type VialSkinId = (typeof VIAL_SKINS)[number]["id"];

export function getVialSkin(id: VialSkinId): VialSkinDefinition {
  return VIAL_SKINS.find((skin) => skin.id === id) ?? COMPACT_VIAL_SKIN;
}

export function isVialSkinId(value: string | null): value is VialSkinId {
  return VIAL_SKINS.some((skin) => skin.id === value);
}

export function getNextVialSkinId(currentId: VialSkinId): VialSkinId {
  const index = VIAL_SKINS.findIndex((skin) => skin.id === currentId);
  return VIAL_SKINS[(index + 1) % VIAL_SKINS.length]?.id ?? DEFAULT_VIAL_SKIN_ID;
}

export function getVialSkinLiquidBounds(skin: VialSkinDefinition): VialSkinBounds {
  if (skin.liquidPolygon.length < 3) {
    throw new Error(`Vial skin ${skin.id} must define at least three liquid polygon points.`);
  }

  const xValues = skin.liquidPolygon.map(({x}) => x);
  const yValues = skin.liquidPolygon.map(({y}) => y);
  const left = Math.min(...xValues);
  const right = Math.max(...xValues);
  const top = Math.min(...yValues);
  const bottom = Math.max(...yValues);

  return {left, right, top, bottom, width: right - left, height: bottom - top};
}

export const DEFAULT_VIAL_LIQUID_BOUNDS = getVialSkinLiquidBounds(DEFAULT_VIAL_SKIN);
