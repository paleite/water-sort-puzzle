import fs from "fs";
import path from "path";

/**
 * Represents a single move in the puzzle.
 */
type MoveStep = {
  fromVialIndex: number;
  toVialIndex: number;
};

/**
 * Each vial is an array of strings, each string is a color code (e.g., 'red').
 */
type Vial = string[];

/**
 * Puzzle metadata and state used for saving and tracking.
 */
type PuzzleData = {
  initialState: Vial[];
  shuffledState: Vial[];
  shuffleSteps: MoveStep[];
  solveSteps: MoveStep[];
  score: number;
};

const VIAL_CAPACITY = 4;
const NUMBER_OF_COLORS = 4;
const EMPTY_VIALS = 2;
const COLORS = ["red", "blue", "green", "yellow"];

function cloneVials(vials: Vial[]): Vial[] {
  return vials.map((vial) => [...vial]);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isLegalMove(from: Vial, to: Vial): boolean {
  if (from.length === 0 || to.length >= VIAL_CAPACITY) {
    return false;
  }
  if (to.length === 0) {
    return true;
  }
  return to[to.length - 1] === from[from.length - 1];
}

function performMove(
  vials: Vial[],
  fromIndex: number,
  toIndex: number,
): boolean {
  const from = vials[fromIndex];
  const to = vials[toIndex];
  if (!isLegalMove(from, to)) {
    return false;
  }
  const color = from.pop();
  if (color) {
    to.push(color);
  }
  return true;
}

function isFullySorted(vial: Vial): boolean {
  return vial.length === VIAL_CAPACITY && new Set(vial).size === 1;
}

function calculateEntropy(vials: Vial[]): number {
  return vials.reduce((entropy, vial) => {
    for (let i = 1; i < vial.length; i++) {
      if (vial[i] !== vial[i - 1]) {
        entropy++;
      }
    }
    return entropy;
  }, 0);
}

function generateSolvablePuzzle(): PuzzleData {
  let puzzleData: PuzzleData;
  let valid = false;

  while (!valid) {
    const vials: Vial[] = [];
    for (let i = 0; i < NUMBER_OF_COLORS; i++) {
      vials.push(Array(VIAL_CAPACITY).fill(COLORS[i]));
    }
    for (let i = 0; i < EMPTY_VIALS; i++) {
      vials.push([]);
    }

    const initialState = cloneVials(vials);
    const steps: MoveStep[] = [];
    let attempts = 0;
    let lastMove: MoveStep | null = null;

    while (attempts < 200) {
      const fromIndex = randomInt(0, vials.length - 1);
      const toIndex = randomInt(0, vials.length - 1);
      if (fromIndex === toIndex) {
        continue;
      }
      if (
        lastMove &&
        lastMove.fromVialIndex === toIndex &&
        lastMove.toVialIndex === fromIndex
      ) {
        continue;
      }

      const stateBefore = JSON.stringify(vials);
      const success = performMove(vials, fromIndex, toIndex);
      const stateAfter = JSON.stringify(vials);

      if (success && stateBefore !== stateAfter) {
        steps.push({ fromVialIndex: fromIndex, toVialIndex: toIndex });
        lastMove = { fromVialIndex: fromIndex, toVialIndex: toIndex };
        attempts++;
      }

      const partiallyFilled = vials.filter(
        (vial) => vial.length > 0 && vial.length < VIAL_CAPACITY,
      );
      const fullySorted = vials.filter(isFullySorted);

      if (
        partiallyFilled.length === 0 &&
        fullySorted.length === 0 &&
        steps.length >= 10
      ) {
        valid = true;
        const entropyScore = calculateEntropy(vials);
        puzzleData = {
          initialState,
          shuffledState: cloneVials(vials),
          shuffleSteps: [...steps],
          solveSteps: [...steps]
            .reverse()
            .map(({ fromVialIndex, toVialIndex }) => ({
              fromVialIndex: toVialIndex,
              toVialIndex: fromVialIndex,
            })),
          score: entropyScore,
        };
        break;
      }
    }
  }

  return puzzleData!;
}

function savePuzzleToFile(puzzleData: PuzzleData, filePath: string): void {
  fs.writeFileSync(filePath, JSON.stringify(puzzleData, null, 2), {
    encoding: "utf-8",
  });
}

const puzzleData = generateSolvablePuzzle();
const filePath = path.resolve("./level-1.json");
savePuzzleToFile(puzzleData, filePath);
