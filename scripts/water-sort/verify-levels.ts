import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ColorId } from "../../src/lib/water-sort/domain/colors";
import type { Board } from "../../src/lib/water-sort/domain/types";
import { solveWithAStar, verifySolution } from "./solver";

interface RawLevel {
  id: string;
  capacity: number;
  vials: ColorId[][];
  development?: {optimalMoveCount?: number};
}
interface Manifest {
  levels: Array<{id: string; file: string; development?: {optimalMoveCount?: number}}>;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function hasCleanStartingShape(raw: RawLevel): boolean {
  if (raw.capacity <= 0) return false;

  const totalUnits = raw.vials.reduce((sum, vial) => sum + vial.length, 0);
  if (totalUnits % raw.capacity !== 0) return false;

  const expectedFullVials = totalUnits / raw.capacity;
  const expectedEmptyVials = raw.vials.length - expectedFullVials;
  const firstEmptyIndex = raw.vials.findIndex((vial) => vial.length === 0);

  return (
    firstEmptyIndex === expectedFullVials
    && raw.vials.every((vial, vialIndex) =>
      vialIndex < expectedFullVials
        ? vial.length === raw.capacity
        : vial.length === 0
    )
    && expectedEmptyVials >= 0
  );
}

async function main(): Promise<void> {
  const directory = path.resolve(process.argv[2] ?? "public/levels");
  const manifest = await readJson<Manifest>(path.join(directory, "manifest.json"));
  let failed = false;

  for (const entry of manifest.levels) {
    const raw = await readJson<RawLevel>(path.join(directory, entry.file));

    if (!hasCleanStartingShape(raw)) {
      console.error(`${entry.id}: FAIL · dirty starting shape or empty vials not trailing`);
      failed = true;
      continue;
    }

    const board: Board = raw.vials.map((vial) => [...vial].reverse());
    const result = solveWithAStar(board, raw.capacity, 2_000_000);
    if (result === null || !verifySolution(board, result.solution, raw.capacity)) {
      console.error(`${entry.id}: FAIL`);
      failed = true;
      continue;
    }

    const expected = entry.development?.optimalMoveCount;
    if (expected !== undefined && expected !== result.solution.length) {
      console.error(`${entry.id}: expected ${expected}, got ${result.solution.length}`);
      failed = true;
      continue;
    }
    console.log(`${entry.id}: PASS · ${result.solution.length} moves`);
  }

  if (failed) process.exitCode = 1;
  else console.log(`Verified ${manifest.levels.length} levels.`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
