import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { createCanonicalBoardKey } from "../../src/lib/water-sort/domain/board";
import { getColorIds } from "../../src/lib/water-sort/domain/colors";
import {
  beamScramble,
  calculateStructuralMetrics,
  createSeededRandom,
  createSolvedBoard,
  verifyGenerationCertificate,
} from "./generator";
import { solveWithAStar, verifySolution } from "./solver";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
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

async function main(): Promise<void> {
  const options = {
    count: numberFlag("--count", 20),
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

  const output = path.resolve(options.output);
  await mkdir(output, {recursive: true});
  for (const name of await readdir(output)) {
    if (name === "manifest.json" || /^\d+\.json$/.test(name)) {
      await unlink(path.join(output, name));
    }
  }

  const solvedBoard = createSolvedBoard(
    getColorIds(options.colors),
    options.capacity,
    options.emptyVials,
  );

  const seen = new Set<string>();
  const manifest: Array<{
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
  }> = [];

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

    const metrics = calculateStructuralMetrics(candidate.board, options.capacity);
    if (metrics.meanVialEntropy < options.minimumEntropy) continue;

    const canonicalKey = createCanonicalBoardKey(candidate.board);
    if (seen.has(canonicalKey)) continue;

    const solved = solveWithAStar(
      candidate.board,
      options.capacity,
      options.maxSolverStates,
    );
    if (solved === null) continue;
    if (!verifySolution(candidate.board, solved.solution, options.capacity)) {
      throw new Error("A* replay verification failed.");
    }

    accepted += 1;
    seen.add(canonicalKey);
    const id = formatId(accepted);
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
      vials: candidate.board.map((vial) => [...vial].reverse()),
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
