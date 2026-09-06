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

async function main(): Promise<void> {
  const directory = path.resolve(process.argv[2] ?? "public/levels");
  const manifest = await readJson<Manifest>(path.join(directory, "manifest.json"));
  let failed = false;

  for (const entry of manifest.levels) {
    const raw = await readJson<RawLevel>(path.join(directory, entry.file));
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
