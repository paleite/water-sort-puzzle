import { COLOR_IDS, type ColorId } from "../domain/colors";

interface OklchComponents {
  lightness: number;
  chroma: number;
  hue: number;
}

function categoricalOklch(index: number, total = 12): OklchComponents {
  const normalizedIndex = ((index % total) + total) % total;

  // Golden-angle stepping spreads consecutive categories around the hue circle.
  const hue = (normalizedIndex * 137.508) % 360;

  const lightness =
    0.68
    + 0.10 * Math.sin((hue - 30) * (Math.PI / 180));

  const chroma =
    0.20
    - 0.035 * Math.sin((hue - 80) * (Math.PI / 180));

  return {lightness, chroma, hue};
}

export function categoricalColor(index: number, total = 12): string {
  const {lightness, chroma, hue} = categoricalOklch(index, total);
  return `oklch(${lightness} ${chroma} ${hue})`;
}

function linearToSrgb(value: number): number {
  const converted = value <= 0.0031308
    ? 12.92 * value
    : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(1, converted));
}

function channelToHex(value: number): string {
  return Math.round(value * 255).toString(16).padStart(2, "0");
}

function categoricalColorHex(index: number, total = 12): string {
  const {lightness, chroma, hue} = categoricalOklch(index, total);
  const hueRadians = hue * (Math.PI / 180);
  const a = chroma * Math.cos(hueRadians);
  const b = chroma * Math.sin(hueRadians);

  // OKLab -> linear sRGB. Pixi consumes numeric RGB uniforms, so convert the
  // requested OKLCH palette at the presentation boundary rather than relying
  // on browser CSS color parsing.
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.2914855480 * b;

  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  const red = linearToSrgb(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
  );
  const green = linearToSrgb(
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
  );
  const blue = linearToSrgb(
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  );

  return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`;
}

export const LIQUID_COLORS = Object.fromEntries(
  COLOR_IDS.map((colorId, index) => [
    colorId,
    categoricalColorHex(index, COLOR_IDS.length),
  ]),
) as Record<ColorId, string>;
