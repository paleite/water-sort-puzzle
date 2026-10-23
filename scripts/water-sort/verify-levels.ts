import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { createCanonicalBoardKey } from "../../src/lib/water-sort/domain/board";
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
  levels: Array<{id: string}>;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function hasCleanStartingShape(raw: RawLevel): boolean {
  if (raw.capacity <= 0) return false;
  const totalUnits = raw.vials.reduce((sum, vial) => sum + vial.length, 0);
  if (totalUnits % raw.capacity !== 0) return false;
  const expectedFullVials = totalUnits / raw.capacity;
  const fullVials = raw.vials.filter((vial) => vial.length === raw.capacity).length;
  const emptyVials = raw.vials.filter((vial) => vial.length === 0).length;
  return (
    raw.vials.every((vial) => vial.length === 0 || vial.length === raw.capacity)
    && fullVials === expectedFullVials
    && emptyVials === raw.vials.length - expectedFullVials
  );
}

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  // Accept the optional pnpm argument separator for compatibility.
  const args = process.argv.slice(2).filter((argument) => argument !== "--");
  const changedFromIndex = args.indexOf("--changed-from");
  const changedFrom = changedFromIndex < 0 ? undefined : args[changedFromIndex + 1];
  if (changedFromIndex >= 0 && (changedFrom === undefined || changedFrom.startsWith("--"))) {
    throw new Error("Expected a Git ref after --changed-from.");
  }
  const positionalArgs = args.filter((_, index) =>
    changedFromIndex < 0 || (index !== changedFromIndex && index !== changedFromIndex + 1)
  );
  if (positionalArgs.length > 1 || positionalArgs.some((argument) => argument.startsWith("--"))) {
    throw new Error("Usage: verify-levels [directory] [--changed-from <git-ref>]");
  }
  const directory = path.resolve(positionalArgs[0] ?? "levels");
  let newLevelIds: Set<string> | null = null;
  if (changedFrom !== undefined) {
    const relativeDirectory = path.relative(process.cwd(), directory).split(path.sep).join("/");
    if (relativeDirectory.startsWith("..") || path.isAbsolute(relativeDirectory)) {
      throw new Error("Changed-level verification requires a directory inside the repository.");
    }
    const { stdout } = await execFileAsync("git", [
      "diff", "--name-only", "--diff-filter=A", changedFrom, "HEAD", "--", relativeDirectory,
    ]);
    const directoryPrefix = `${relativeDirectory}/`;
    newLevelIds = new Set(
      stdout.split(/\r?\n/)
        .filter((filename) => filename.startsWith(directoryPrefix))
        .map((filename) => filename.slice(directoryPrefix.length))
        .filter((filename) => filename !== "manifest.json" && /^[^/]+\.json$/.test(filename))
        .map((filename) => filename.slice(0, -".json".length)),
    );
    if (newLevelIds.size === 0) {
      console.log("No new levels in this change; verification passed.");
      return;
    }
  }
  const manifest = await readJson<Manifest>(path.join(directory, "manifest.json"));
  if (newLevelIds !== null) {
    const manifestIds = new Set(manifest.levels.map((entry) => entry.id));
    for (const levelId of newLevelIds) {
      if (!manifestIds.has(levelId)) {
        throw new Error(`New level ${levelId} is missing from the manifest.`);
      }
    }
  }
  let failed = false;
  const seenBoards = new Map<string, string>();

  // Compare new boards against existing boards without re-solving old levels.
  if (newLevelIds !== null) {
    for (const entry of manifest.levels) {
      if (newLevelIds.has(entry.id)) continue;
      const existing = await readJson<RawLevel>(path.join(directory, `${entry.id}.json`));
      const existingBoard: Board = existing.vials.map((vial) => [...vial].reverse());
      seenBoards.set(createCanonicalBoardKey(existingBoard), entry.id);
    }
  }

  for (const entry of manifest.levels) {
    if (newLevelIds !== null && !newLevelIds.has(entry.id)) continue;
    const raw = await readJson<RawLevel>(path.join(directory, `${entry.id}.json`));
    if (raw.id !== entry.id) {
      console.error(`${entry.id}: FAIL · file id is ${raw.id}`);
      failed = true;
      continue;
    }
    if (!hasCleanStartingShape(raw)) {
      console.error(`${entry.id}: FAIL · dirty starting shape`);
      failed = true;
      continue;
    }

    const board: Board = raw.vials.map((vial) => [...vial].reverse());
    const canonicalKey = createCanonicalBoardKey(board);
    const previousLevelId = seenBoards.get(canonicalKey);
    if (previousLevelId !== undefined) {
      console.error(`${entry.id}: FAIL · duplicate canonical board of level ${previousLevelId}`);
      failed = true;
      continue;
    }
    seenBoards.set(canonicalKey, entry.id);

    const result = solveWithAStar(board, raw.capacity, 2_000_000);
    if (result === null || !verifySolution(board, result.solution, raw.capacity)) {
      console.error(`${entry.id}: FAIL`);
      failed = true;
      continue;
    }

    const expected = raw.development?.optimalMoveCount;
    if (expected !== undefined && expected !== result.solution.length) {
      console.error(`${entry.id}: expected ${expected}, got ${result.solution.length}`);
      failed = true;
      continue;
    }
    console.log(`${entry.id}: PASS · ${result.solution.length} moves`);
  }

  if (failed) process.exitCode = 1;
  else console.log(newLevelIds === null
    ? `Verified ${manifest.levels.length} levels.`
    : `Verified ${newLevelIds.size} new levels.`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
