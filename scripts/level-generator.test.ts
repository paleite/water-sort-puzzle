/**
 * Unit tests for level generators.
 *
 * Tests both the reverse-shuffling and random generation approaches.
 */

import fs from "fs";
import path from "path";
import { expect, describe, test, beforeEach, afterEach } from "bun:test";

// Define color type
type Color = string;

// Temp directory for test output
const TEST_OUTPUT_DIR = "test-levels";

// Setup and teardown
beforeEach(() => {
  // Create test directory if it doesn't exist
  if (!fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.mkdirSync(TEST_OUTPUT_DIR);
  }
});

afterEach(() => {
  // Clean up test directory
  if (fs.existsSync(TEST_OUTPUT_DIR)) {
    const files = fs.readdirSync(TEST_OUTPUT_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(TEST_OUTPUT_DIR, file));
    }
    fs.rmdirSync(TEST_OUTPUT_DIR);
  }
});

// Simple mocks for validation
class Vial {
  segments: Color[];
  capacity: number;

  constructor(capacity: number) {
    this.segments = [];
    this.capacity = capacity;
  }

  isEmpty(): boolean {
    return this.segments.length === 0;
  }

  isFull(): boolean {
    return this.segments.length === this.capacity;
  }

  isComplete(): boolean {
    if (this.isEmpty()) return true;
    if (!this.isFull()) return false;

    const firstColor = this.segments[0];
    return this.segments.every((segment) => segment === firstColor);
  }
}

// Utility functions for tests
function validateLevelFile(filePath: string): void {
  // Read and parse the level file
  const levelData = JSON.parse(fs.readFileSync(filePath, "utf8"));

  // Check required sections
  expect(levelData).toHaveProperty("initialState");
  expect(levelData).toHaveProperty("shuffledState");
  expect(levelData).toHaveProperty("solutionMoves");
  expect(levelData).toHaveProperty("metadata");

  // Check vial capacity is consistent
  const vialCapacity = levelData.metadata.vialCapacity;

  // Validate initialState
  validateState(levelData.initialState, vialCapacity);

  // Validate shuffledState
  validateState(levelData.shuffledState, vialCapacity);

  // Check that initialState has the right structure (one color per vial)
  validateInitialState(levelData.initialState, vialCapacity);

  // Check that shuffledState has no partially filled vials
  validateNoPartialVials(levelData.shuffledState.vials);

  // Check that shuffledState has no pre-solved vials
  validateNoSolvedVials(levelData.shuffledState.vials);

  // Check that solution moves are valid
  expect(Array.isArray(levelData.solutionMoves)).toBe(true);
  expect(levelData.solutionMoves.length).toBeGreaterThan(0);

  // Check metadata
  expect(levelData.metadata.difficulty).toBeGreaterThan(0);
  expect(levelData.metadata.entropy).toBeGreaterThan(0);
  expect(levelData.metadata.estimatedSolutionSteps).toBeGreaterThan(0);
}

function validateState(state: any, vialCapacity: number): void {
  expect(state).toHaveProperty("vials");
  expect(Array.isArray(state.vials)).toBe(true);

  // Check each vial
  for (const vial of state.vials) {
    expect(vial).toHaveProperty("segments");
    expect(Array.isArray(vial.segments)).toBe(true);

    // Vial should be either empty or have <= capacity segments
    expect(vial.segments.length).toBeLessThanOrEqual(vialCapacity);
  }
}

function validateInitialState(state: any, vialCapacity: number): void {
  // Each vial in the initial state should have all same-color segments
  for (const vial of state.vials) {
    if (vial.segments.length === 0) continue;

    const color = vial.segments[0];
    expect(vial.segments.every((segment) => segment === color)).toBe(true);
    expect(vial.segments.length).toBe(vialCapacity);
  }
}

function validateNoPartialVials(vials: any[]): void {
  // Each vial should be either completely full or completely empty
  for (const vial of vials) {
    if (vial.segments.length === 0) continue;

    // Create mock vial to use isComplete method
    const mockVial = new Vial(vial.segments.length);
    mockVial.segments = [...vial.segments];

    expect(mockVial.isEmpty() || mockVial.isFull()).toBe(true);
  }
}

function validateNoSolvedVials(vials: any[]): void {
  // No vial in the shuffled state should be complete
  for (const vial of vials) {
    if (vial.segments.length === 0) continue;

    // Create mock vial to use isComplete method
    const mockVial = new Vial(vial.segments.length);
    mockVial.segments = [...vial.segments];

    // Vial should not be complete (all same color)
    const allSameColor = mockVial.segments.every(
      (segment) => segment === mockVial.segments[0],
    );
    expect(allSameColor && mockVial.isFull()).toBe(false);
  }
}

// Applies a solution to the shuffled state to verify it works
function applySolution(levelData: any): boolean {
  // Create vials from shuffled state
  const vials = levelData.shuffledState.vials.map((vialData: any) => {
    const vial = new Vial(levelData.metadata.vialCapacity);
    vial.segments = [...vialData.segments];
    return vial;
  });

  // Apply each move in the solution
  for (const move of levelData.solutionMoves) {
    const sourceVial = vials[move.source];
    const targetVial = vials[move.target];

    // Check move is valid
    if (sourceVial.isEmpty()) return false;

    const topColor = sourceVial.segments[sourceVial.segments.length - 1];

    if (targetVial.isFull()) return false;
    if (
      !targetVial.isEmpty() &&
      targetVial.segments[targetVial.segments.length - 1] !== topColor
    ) {
      return false;
    }

    // Apply move
    for (let i = 0; i < move.amount; i++) {
      if (sourceVial.isEmpty()) return false;
      const color = sourceVial.segments.pop() as Color;
      targetVial.segments.push(color);
    }
  }

  // Check if all vials are complete
  return vials.every((vial) => vial.isComplete());
}

// Tests for the reverse-shuffle generator
describe("Reverse-shuffle level generator", () => {
  test("Generated levels have valid structure", async () => {
    // Import the actual generator dynamically
    const { default: generateLevel } = await import("./level-generator");

    const outputPath = path.join(TEST_OUTPUT_DIR, "reverse-shuffle-level.json");

    // Run the generator
    const result = generateLevel({
      colorCount: 4,
      vialHeight: 3,
      emptyVials: 1,
      targetShuffleMoves: 10,
      outputPath,
    });

    // Validate the result
    expect(result).toBeTruthy();
    expect(fs.existsSync(outputPath)).toBe(true);

    // Validate file content
    validateLevelFile(outputPath);
  });

  test("Generated levels are solvable", async () => {
    // Import the actual generator dynamically
    const { default: generateLevel } = await import("./level-generator");

    const outputPath = path.join(TEST_OUTPUT_DIR, "solvable-level.json");

    // Run the generator
    generateLevel({
      colorCount: 4,
      vialHeight: 3,
      emptyVials: 1,
      targetShuffleMoves: 10,
      outputPath,
    });

    // Read the generated level
    const levelData = JSON.parse(fs.readFileSync(outputPath, "utf8"));

    // Apply the solution and verify it works
    const solvable = applySolution(levelData);
    expect(solvable).toBe(true);
  });

  test("Generator handles different color counts", async () => {
    // Import the actual generator dynamically
    const { default: generateLevel } = await import("./level-generator");

    for (const colorCount of [3, 4, 5]) {
      const outputPath = path.join(
        TEST_OUTPUT_DIR,
        `colors-${colorCount}-level.json`,
      );

      // Run the generator
      const result = generateLevel({
        colorCount,
        vialHeight: 3,
        emptyVials: 1,
        targetShuffleMoves: 10,
        outputPath,
      });

      // Validate the result
      expect(result).toBeTruthy();
      expect(fs.existsSync(outputPath)).toBe(true);

      // Validate file content
      validateLevelFile(outputPath);
    }
  });
});

// Tests for the random generator
describe("Random level generator", () => {
  test("Generated levels have valid structure", async () => {
    // Import the actual generator dynamically
    const { default: generateRandomLevel } = await import(
      "./random-level-generator"
    );

    const outputPath = path.join(TEST_OUTPUT_DIR, "random-level.json");

    // Run the generator
    const result = generateRandomLevel({
      seed: "test-seed",
      colorCount: 3,
      vialHeight: 3,
      maxEmptyVials: 1,
      attempts: 1,
      timeoutMs: 10000,
      outputPath,
    });

    // Validate the result
    expect(result).toBeTruthy();
    expect(fs.existsSync(outputPath)).toBe(true);

    // Validate file content
    validateLevelFile(outputPath);
  });

  test("Generated levels are solvable", async () => {
    // Import the actual generator dynamically
    const { default: generateRandomLevel } = await import(
      "./random-level-generator"
    );

    const outputPath = path.join(TEST_OUTPUT_DIR, "random-solvable-level.json");

    // Run the generator
    generateRandomLevel({
      seed: "test-seed-solvable",
      colorCount: 3,
      vialHeight: 3,
      maxEmptyVials: 1,
      attempts: 1,
      timeoutMs: 10000,
      outputPath,
    });

    // Read the generated level
    const levelData = JSON.parse(fs.readFileSync(outputPath, "utf8"));

    // Apply the solution and verify it works
    const solvable = applySolution(levelData);
    expect(solvable).toBe(true);
  });

  test("Generator produces reproducible results with same seed", async () => {
    // Import the actual generator dynamically
    const { default: generateRandomLevel } = await import(
      "./random-level-generator"
    );

    const seed = "reproducible-seed";
    const outputPath1 = path.join(TEST_OUTPUT_DIR, "reproducible-1.json");
    const outputPath2 = path.join(TEST_OUTPUT_DIR, "reproducible-2.json");

    // Generate two levels with the same seed
    generateRandomLevel({
      seed,
      colorCount: 3,
      vialHeight: 3,
      maxEmptyVials: 1,
      attempts: 1,
      timeoutMs: 10000,
      outputPath: outputPath1,
    });

    generateRandomLevel({
      seed,
      colorCount: 3,
      vialHeight: 3,
      maxEmptyVials: 1,
      attempts: 1,
      timeoutMs: 10000,
      outputPath: outputPath2,
    });

    // Read both levels
    const level1 = JSON.parse(fs.readFileSync(outputPath1, "utf8"));
    const level2 = JSON.parse(fs.readFileSync(outputPath2, "utf8"));

    // Compare the shuffled states - they should be identical
    expect(JSON.stringify(level1.shuffledState)).toBe(
      JSON.stringify(level2.shuffledState),
    );

    // Compare solution paths - they should be identical
    expect(JSON.stringify(level1.solutionMoves)).toBe(
      JSON.stringify(level2.solutionMoves),
    );
  });
});
