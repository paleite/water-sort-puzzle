export interface VialSkinPoint {
  x: number;
  y: number;
}

export interface VialSkinDefinition {
  id: string;
  name: string;
  svgSource: string;
  viewBox: {
    width: number;
    height: number;
  };
  liquidPolygon: readonly VialSkinPoint[];
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
  id: "classic",
  name: "Classic",
  svgSource: publicPath("/vials/classic.svg"),
  viewBox: {
    width: 100,
    height: 272,
  },
  liquidPolygon: [
    {x: 16, y: 12},
    {x: 84, y: 12},
    {x: 84, y: 214},
    {x: 82, y: 228},
    {x: 77, y: 241},
    {x: 69, y: 251},
    {x: 60, y: 257},
    {x: 50, y: 260},
    {x: 40, y: 257},
    {x: 31, y: 251},
    {x: 23, y: 241},
    {x: 18, y: 228},
    {x: 16, y: 214},
  ],
  mouth: {
    left: {x: 10, y: 12},
    right: {x: 90, y: 12},
  },
} as const satisfies VialSkinDefinition;

export function getVialSkinLiquidBounds(
  skin: VialSkinDefinition,
): VialSkinBounds {
  if (skin.liquidPolygon.length < 3) {
    throw new Error(`Vial skin ${skin.id} must define at least three liquid polygon points.`);
  }

  const xValues = skin.liquidPolygon.map(({x}) => x);
  const yValues = skin.liquidPolygon.map(({y}) => y);
  const left = Math.min(...xValues);
  const right = Math.max(...xValues);
  const top = Math.min(...yValues);
  const bottom = Math.max(...yValues);

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

export const DEFAULT_VIAL_LIQUID_BOUNDS = getVialSkinLiquidBounds(DEFAULT_VIAL_SKIN);
