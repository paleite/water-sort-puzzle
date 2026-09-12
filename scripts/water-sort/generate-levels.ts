import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { createCanonicalBoardKey } from "../../src/lib/water-sort/domain/board";
import { getColorIds, type ColorId } from "../../src/lib/water-sort/domain/colors";
import type { LevelDevelopmentMetadata } from "../../src/lib/water-sort/domain/types";
import { calculateDifficultyScore, DIFFICULTY_SCORE_VERSION } from "./difficulty";
import { calculateStructuralMetrics, createSeededRandom, createUniformShuffledBoard, isCleanGeneratedBoard } from "./generator";
import { solveWithAStarBounded, verifySolution } from "./solver";

interface ManifestEntry { id: string; file: string; development?: LevelDevelopmentMetadata; }
interface StoredLevel { vials: ColorId[][]; }
interface PendingLevel { id: string; file: string; json: {id: string; capacity: number; vials: ColorId[][]; development: LevelDevelopmentMetadata}; development: LevelDevelopmentMetadata; }
function flag(name: string): string | undefined { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }
function hasFlag(name: string): boolean { return process.argv.includes(name); }
function numberFlag(name: string, fallback: number): number { const raw = flag(name); if (raw === undefined) return fallback; const value = Number(raw); if (!Number.isFinite(value)) throw new Error(`${name} must be numeric.`); return value; }
function positiveInteger(name: string, value: number): number { if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`); return value; }
function nonNegativeInteger(name: string, value: number): number { if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer.`); return value; }
function formatId(index: number): string { return String(index).padStart(3, "0"); }
function nextStartId(manifest: readonly ManifestEntry[]): number { const numericIds = manifest.map((entry) => Number(entry.id)).filter((id) => Number.isInteger(id) && id >= 1); return numericIds.length === 0 ? 1 : Math.max(...numericIds) + 1; }
async function loadExistingManifest(output: string): Promise<ManifestEntry[]> { const parsed = JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8")) as {levels?: ManifestEntry[]}; if (!Array.isArray(parsed.levels)) throw new Error("Existing manifest is missing a levels array."); return parsed.levels; }
async function seedSeenBoards(output: string, manifest: readonly ManifestEntry[], seen: Set<string>): Promise<void> { for (const entry of manifest) { const stored = JSON.parse(await readFile(path.join(output, entry.file), "utf8")) as StoredLevel; seen.add(createCanonicalBoardKey(stored.vials.map((vial) => [...vial].reverse()))); } }
async function removeGeneratedLevelFiles(output: string): Promise<void> { for (const name of await readdir(output)) if (name === "manifest.json" || /^\d+\.json$/.test(name)) await unlink(path.join(output, name)); }
async function writeManifestAtomically(output: string, manifest: readonly ManifestEntry[]): Promise<void> { const target = path.join(output, "manifest.json"); const temporary = path.join(output, ".manifest.json.tmp"); await writeFile(temporary, `${JSON.stringify({levels: manifest}, null, 2)}\n`, "utf8"); await rename(temporary, target); }

async function main(): Promise<void> {
  const append = hasFlag("--append");
  const output = path.resolve(flag("--output") ?? "public/levels");
  const requestedCount = positiveInteger("--count", numberFlag("--count", 30));
  const colors = positiveInteger("--colors", numberFlag("--colors", 12));
  const capacity = positiveInteger("--capacity", numberFlag("--capacity", 4));
  const emptyVials = nonNegativeInteger("--empty-vials", numberFlag("--empty-vials", 2));
  const maxSolverStates = positiveInteger("--max-solver-states", numberFlag("--max-solver-states", 250_000));
  const maxSolverSeconds = numberFlag("--max-solver-seconds", 12);
  if (!(maxSolverSeconds > 0)) throw new Error("--max-solver-seconds must be greater than zero.");
  const minimumEntropy = numberFlag("--minimum-entropy", 0);
  if (minimumEntropy < 0) throw new Error("--minimum-entropy must be non-negative.");
  const seed = nonNegativeInteger("--seed", numberFlag("--seed", 20260912));
  const configuredMaximumAttempts = nonNegativeInteger("--maximum-attempts", numberFlag("--maximum-attempts", 0));
  await mkdir(output, {recursive: true});
  let manifest: ManifestEntry[] = [];
  const seen = new Set<string>();
  if (append) { manifest = await loadExistingManifest(output); await seedSeenBoards(output, manifest, seen); }
  const explicitStartId = flag("--start-id");
  const startId = positiveInteger("--start-id", explicitStartId === undefined ? (append ? nextStartId(manifest) : 1) : Number(explicitStartId));
  const occupiedIds = new Set(manifest.map((entry) => entry.id));
  for (let offset = 0; offset < requestedCount; offset += 1) { const id = formatId(startId + offset); if (occupiedIds.has(id)) throw new Error(`Cannot generate level ${id}; that id already exists.`); }
  const colorIds = getColorIds(colors);
  const maximumAttempts = configuredMaximumAttempts > 0 ? configuredMaximumAttempts : requestedCount * 50;
  const pendingLevels: PendingLevel[] = [];
  let rejectedCompletedVial = 0, rejectedEntropy = 0, rejectedDuplicate = 0, rejectedSolverBudget = 0, rejectedUnsolvable = 0;
  for (let attempt = 1; attempt <= maximumAttempts && pendingLevels.length < requestedCount; attempt += 1) {
    const generationSeed = seed + attempt;
    const board = createUniformShuffledBoard(colorIds, capacity, emptyVials, createSeededRandom(generationSeed));
    if (!isCleanGeneratedBoard(board, capacity, emptyVials)) throw new Error("Uniform generator produced a dirty starting board.");
    const metrics = calculateStructuralMetrics(board, capacity);
    if (metrics.completedVialCount > 0) { rejectedCompletedVial += 1; continue; }
    if (metrics.meanVialEntropy < minimumEntropy) { rejectedEntropy += 1; continue; }
    const canonicalKey = createCanonicalBoardKey(board);
    if (seen.has(canonicalKey)) { rejectedDuplicate += 1; continue; }
    const outcome = solveWithAStarBounded(board, capacity, {maxExploredStates: maxSolverStates, maxElapsedMilliseconds: maxSolverSeconds * 1_000});
    if (outcome.status === "aborted") { rejectedSolverBudget += 1; console.warn(`candidate seed ${generationSeed}: skipped after ${outcome.exploredStateCount} states (${outcome.reason})`); continue; }
    if (outcome.status === "unsolvable") { rejectedUnsolvable += 1; console.warn(`candidate seed ${generationSeed}: proven unsolvable`); continue; }
    const solved = outcome.result;
    if (!verifySolution(board, solved.solution, capacity)) throw new Error("A* replay verification failed.");
    const id = formatId(startId + pendingLevels.length);
    const development: LevelDevelopmentMetadata = {optimalMoveCount: solved.solution.length, exploredStateCount: solved.exploredStateCount, maximumBranchingFactor: solved.maximumBranchingFactor, meanVialEntropy: metrics.meanVialEntropy, boundaryRate: metrics.boundaryRate, totalRunCount: metrics.totalRunCount, generator: "uniform-shuffle", generationSeed, solverElapsedMilliseconds: Number(solved.elapsedMilliseconds.toFixed(2)), difficultyScore: calculateDifficultyScore({optimalMoveCount: solved.solution.length, exploredStateCount: solved.exploredStateCount}), difficultyScoreVersion: DIFFICULTY_SCORE_VERSION};
    pendingLevels.push({id, file: `${id}.json`, development, json: {id, capacity, vials: board.map((vial) => [...vial].reverse()), development}});
    seen.add(canonicalKey);
    console.log(`${id}: difficulty ${development.difficultyScore!.toFixed(4)} · ${development.optimalMoveCount} moves · ${development.exploredStateCount} states · entropy ${development.meanVialEntropy.toFixed(3)}`);
  }
  if (pendingLevels.length < requestedCount) throw new Error(`Generated only ${pendingLevels.length}/${requestedCount} levels after ${maximumAttempts} attempts. No level files were changed.`);
  if (!append) { await removeGeneratedLevelFiles(output); manifest = []; }
  for (const level of pendingLevels) { await writeFile(path.join(output, level.file), `${JSON.stringify(level.json, null, 2)}\n`, "utf8"); manifest.push({id: level.id, file: level.file, development: level.development}); }
  manifest.sort((left, right) => left.id.localeCompare(right.id));
  await writeManifestAtomically(output, manifest);
  console.log(""); console.log(`Generated ${pendingLevels.length} levels in ${output}.`); console.log(`Rejected: completed=${rejectedCompletedVial}, entropy=${rejectedEntropy}, duplicate=${rejectedDuplicate}, solver-budget=${rejectedSolverBudget}, unsolvable=${rejectedUnsolvable}.`);
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
