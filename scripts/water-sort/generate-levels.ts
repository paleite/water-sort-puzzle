import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { createCanonicalBoardKey } from "../../src/lib/water-sort/domain/board";
import { getColorIds, type ColorId } from "../../src/lib/water-sort/domain/colors";
import {
  beamScramble,
  calculateStructuralMetrics,
  cleanGeneratedBoard,
  createSeededRandom,
  createSolvedBoard,
  isCleanGeneratedBoard,
  verifyGenerationCertificate,
} from "./generator";
import { solveWithAStar, verifySolution } from "./solver";

interface ManifestEntry {
  id: string;
  file: string;
  development: {
    optimalMoveCount: number;
    exploredStateCount: number;
    maximumBranchingFactor: number;
    meanVialEntropy: number;
    boundaryRate: number;
    totalRunCount: number;
    generationDepth: number;
  };
}

interface StoredLevel {
  vials: ColorId[][];
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}
function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}
function numberFlag(name: string, fallback: number): number {
  const raw = flag(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be numeric.`);
  return value;
}
function formatId(index: number): string {
  return String(index).padStart(3, "0");
}

async function loadExistingManifest(output: string): Promise<ManifestEntry[]> {
  const manifestPath = path.join(output, "manifest.json");
  const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as {levels?: ManifestEntry[]};
  if (!Array.isArray(parsed.levels)) {
    throw new Error("Existing manifest is missing a levels array.");
  }
  return parsed.levels;
}

async function seedSeenBoards(
  output: string,
  manifest: readonly ManifestEntry[],
  seen: Set<string>,
): Promise<void> {
  for (const entry of manifest) {
    const stored = JSON.parse(
      await readFile(path.join(output, entry.file), "utf8"),
    ) as StoredLevel;
    const board = stored.vials.map((vial) => [...vial].reverse());
    seen.add(createCanonicalBoardKey(board));
  }
}

async function main(): Promise<void> {
  const options = {
    count: numberFlag("--count", 20),
    startId: numberFlag("--start-id", 1),
    append: hasFlag("--append"),
    colors: numberFlag("--colors", 12),
    capacity: numberFlag("--capacity", 4),
    emptyVials: numberFlag("--empty-vials", 2),
    depth: numberFlag("--depth", 60),
    beamWidth: numberFlag("--beam-width", 48),
    childrenPerState: numberFlag("--children-per-state", 16),
    minimumEntropy: numberFlag("--minimum-entropy", 0.8),
    maxSolverStates: numberFlag("--max-solver-states", 2_000_000),
    seed: numberFlag("--seed", 1),
    output: flag("--output") ?? "public/levels",
  };

  if (!Number.isInteger(options.startId) || options.startId < 1) {
    throw new Error("--start-id must be a positive integer.");
  }

  const output = path.resolve(options.output);
  await mkdir(output, {recursive: true});

  let manifest: ManifestEntry[] = [];
  const seen = new Set<string>();

  if (options.append) {
    manifest = await loadExistingManifest(output);
    await seedSeenBoards(output, manifest, seen);

    const occupiedIds = new Set(manifest.map((entry) => entry.id));
    for (let offset = 0; offset < options.count; offset += 1) {
      const id = formatId(options.startId + offset);
      if (occupiedIds.has(id)) {
        throw new Error(`Cannot append level ${id}; that id already exists.`);
      }
    }
  } else {
    for (const name of await readdir(output)) {
      if (name === "manifest.json" || /^\d+\.json$/.test(name)) {
        await unlink(path.join(output, name));
      }
    }
  }

  const solvedBoard = createSolvedBoard(
    getColorIds(options.colors),
    options.capacity,
    options.emptyVials,
  );

  let accepted = 0;
  const maximumAttempts = options.count * 100;

  for (let attempt = 1; attempt <= maximumAttempts && accepted < options.count; attempt += 1) {
    const random = createSeededRandom(options.seed + attempt);
    const candidate = beamScramble(solvedBoard, {
      capacity: options.capacity,
      maximumDepth: options.depth,
      beamWidth: options.beamWidth,
      childrenPerState: options.childrenPerState,
      random,
    });

    if (!verifyGenerationCertificate(
      candidate.board,
      candidate.restoringMoves,
      options.capacity,
    )) {
      throw new Error("Generator certificate invariant failed.");
    }

    const board = cleanGeneratedBoard(
      candidate.board,
      options.capacity,
      options.emptyVials,
    );
    if (!isCleanGeneratedBoard(board, options.capacity, options.emptyVials)) {
      throw new Error("Generated board was not clean after normalization.");
    }

    const metrics = calculateStructuralMetrics(board, options.capacity);
    if (metrics.meanVialEntropy < options.minimumEntropy) continue;

    const canonicalKey = createCanonicalBoardKey(board);
    if (seen.has(canonicalKey)) continue;

    const solved = solveWithAStar(
      board,
      options.capacity,
      options.maxSolverStates,
    );
    if (solved === null) continue;
    if (!verifySolution(board, solved.solution, options.capacity)) {
      throw new Error("A* replay verification failed.");
    }

    const id = formatId(options.startId + accepted);
    accepted += 1;
    seen.add(canonicalKey);

    const development = {
      optimalMoveCount: solved.solution.length,
      exploredStateCount: solved.exploredStateCount,
      maximumBranchingFactor: solved.maximumBranchingFactor,
      meanVialEntropy: metrics.meanVialEntropy,
      boundaryRate: metrics.boundaryRate,
      totalRunCount: metrics.totalRunCount,
      generationDepth: candidate.depth,
    };

    const json = {
      id,
      capacity: options.capacity,
      vials: board.map((vial) => [...vial].reverse()),
      development,
    };

    await writeFile(
      path.join(output, `${id}.json`),
      `${JSON.stringify(json, null, 2)}\n`,
      "utf8",
    );
    manifest.push({id, file: `${id}.json`, development});
    console.log(`${id}: ${solved.solution.length} moves, entropy ${metrics.meanVialEntropy.toFixed(3)}`);
  }

  if (accepted < options.count) {
    throw new Error(`Generated only ${accepted}/${options.count} levels.`);
  }

  manifest.sort((left, right) => left.id.localeCompare(right.id));
  await writeFile(
    path.join(output, "manifest.json"),
    `${JSON.stringify({levels: manifest}, null, 2)}\n`,
    "utf8",
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
