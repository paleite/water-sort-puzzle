import { z } from "zod";

import { COLOR_IDS } from "../domain/colors";
import type { Board, Level } from "../domain/types";

const ColorIdSchema = z.enum(COLOR_IDS);

const DevelopmentMetadataSchema = z.object({
  optimalMoveCount: z.number().int().nonnegative(),
  exploredStateCount: z.number().int().nonnegative(),
  maximumBranchingFactor: z.number().int().nonnegative(),
  meanVialEntropy: z.number().nonnegative(),
  boundaryRate: z.number().min(0).max(1),
  totalRunCount: z.number().int().nonnegative(),
  generationDepth: z.number().int().nonnegative(),
});

export const RawLevelSchema = z
  .object({
    id: z.string().min(1),
    capacity: z.number().int().min(2).max(8),
    vials: z.array(z.array(ColorIdSchema)),
    development: DevelopmentMetadataSchema.optional(),
  })
  .superRefine((level, context) => {
    const counts = new Map<string, number>();
    level.vials.forEach((vial, vialIndex) => {
      if (vial.length > level.capacity) {
        context.addIssue({
          code: "custom",
          path: ["vials", vialIndex],
          message: `Vial exceeds capacity ${level.capacity}.`,
        });
      }
      vial.forEach((color) => counts.set(color, (counts.get(color) ?? 0) + 1));
    });
    for (const [color, count] of counts) {
      if (count !== level.capacity) {
        context.addIssue({
          code: "custom",
          path: ["vials"],
          message: `Color "${color}" occurs ${count} times; expected ${level.capacity}.`,
        });
      }
    }
  });

export type RawLevel = z.infer<typeof RawLevelSchema>;

export const LevelManifestSchema = z.object({
  levels: z.array(
    z.object({
      id: z.string().min(1),
      file: z.string().min(1),
      development: DevelopmentMetadataSchema.optional(),
    }),
  ),
});

export type LevelManifest = z.infer<typeof LevelManifestSchema>;

export function rawLevelToLevel(rawLevel: RawLevel): Level {
  const orderedVials = [
    ...rawLevel.vials.filter((vial) => vial.length > 0),
    ...rawLevel.vials.filter((vial) => vial.length === 0),
  ];
  const board: Board = orderedVials.map((vial) => [...vial].reverse());
  return {
    id: rawLevel.id,
    capacity: rawLevel.capacity,
    board,
    ...(rawLevel.development === undefined
      ? {}
      : {development: rawLevel.development}),
  };
}

export function boardToJsonVials(board: Board): RawLevel["vials"] {
  return board.map((vial) => [...vial].reverse());
}
