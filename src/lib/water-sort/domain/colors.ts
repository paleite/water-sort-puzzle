export const COLOR_IDS = [
  "coral",
  "amber",
  "lemon",
  "lime",
  "emerald",
  "teal",
  "sky",
  "cobalt",
  "violet",
  "magenta",
  "rose",
  "cocoa",
] as const;

export type ColorId = (typeof COLOR_IDS)[number];

export function getColorIds(count: number): readonly ColorId[] {
  if (!Number.isInteger(count) || count < 1 || count > COLOR_IDS.length) {
    throw new Error(
      `Color count must be an integer between 1 and ${COLOR_IDS.length}.`,
    );
  }
  return COLOR_IDS.slice(0, count);
}
