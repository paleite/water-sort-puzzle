import { describe, expect, test } from "bun:test";

import type { VialState } from "./artifact";
import {
  calculateVialCounts,
  COLORS_PER_VIAL,
  generatePuzzle,
  VIAL_COUNT,
} from "./artifact";

const numberOfColorVialsInPuzzle = (puzzle: VialState) => {
  return puzzle.filter((vial) => vial.length === COLORS_PER_VIAL).length;
};

const numberOfEmptyVialsInPuzzle = (puzzle: VialState) => {
  return puzzle.filter((vial) => vial.length === 0).length;
};

const indexOfLastColorVialInPuzzle = (puzzle: VialState) => {
  return puzzle.reduce((acc, vial, index) => {
    if (vial.length > 0) {
      return index;
    }
    return acc;
  }, -1);
};

const indexOfFirstEmptyVialInPuzzle = (puzzle: VialState) => {
  return puzzle.findIndex((vial) => vial.length === 0);
};

const fixture = [
  ["#FF3030", "#FF3030", "#FF3030", "#3AE12E"],
  ["#3AE12E", "#3AE12E", "#3AE12E", "#FF3030"],
  [],
];

describe("Vial sort order", () => {
  test("empty vials should be at the end with fixture", () => {
    const puzzle = fixture;

    expect(indexOfFirstEmptyVialInPuzzle(puzzle)).toBe(
      indexOfLastColorVialInPuzzle(puzzle) + 1,
    );
  });

  test.skip("empty vials should be at the end with generated puzzle", () => {
    const puzzle = generatePuzzle(2);

    expect(indexOfFirstEmptyVialInPuzzle(puzzle)).toBe(
      indexOfLastColorVialInPuzzle(puzzle) + 1,
    );
  });
});

describe("level size calculation", () => {
  test("level 2 should have 2 color vials and 1 empty vial", () => {
    const { colorVials, emptyVials, totalVials } = calculateVialCounts(2);
    expect(colorVials).toBe(2);
    expect(emptyVials).toBe(1);
    expect(totalVials).toBe(3);
  });

  test("level 3 should have 3 color vials and 2 empty vials", () => {
    const { colorVials, emptyVials, totalVials } = calculateVialCounts(3);
    expect(colorVials).toBe(3);
    expect(emptyVials).toBe(2);
    expect(totalVials).toBe(5);
  });

  test("level 5 should have 5 color vials and 2 empty vials", () => {
    const { colorVials, emptyVials, totalVials } = calculateVialCounts(5);
    expect(colorVials).toBe(5);
    expect(emptyVials).toBe(2);
    expect(totalVials).toBe(7);
  });

  test("level 10 should have 7 color vials and 2 empty vials", () => {
    const { colorVials, emptyVials, totalVials } = calculateVialCounts(10);
    expect(colorVials).toBe(7);
    expect(emptyVials).toBe(2);
    expect(totalVials).toBe(9);
  });

  test("level 31 should have 9 color vials and 2 empty vials", () => {
    const { colorVials, emptyVials, totalVials } = calculateVialCounts(31);
    expect(colorVials).toBe(9);
    expect(emptyVials).toBe(2);
    expect(totalVials).toBe(11);
  });
});

describe.skip("Level Size", () => {
  test("level 2 should have 2 color vials and 1 empty vial", () => {
    const puzzle = generatePuzzle(2);

    expect(numberOfColorVialsInPuzzle(puzzle)).toBe(2);
    expect(numberOfEmptyVialsInPuzzle(puzzle)).toBe(1);

    expect(puzzle).not.toBeNull();
    expect(puzzle.length).toBe(VIAL_COUNT);
    expect(puzzle.filter((vial) => vial.length === 0).length).toBe(1);
    expect(
      puzzle.filter((vial) => vial.length === COLORS_PER_VIAL).length,
    ).toBe(2);
  });

  test("level 3 should have 3 color vials and 2 empty vials", () => {
    const puzzle = generatePuzzle(3);
    expect(puzzle).not.toBeNull();
    expect(puzzle.length).toBe(VIAL_COUNT);
    expect(puzzle.filter((vial) => vial.length === 0).length).toBe(2);
    expect(
      puzzle.filter((vial) => vial.length === COLORS_PER_VIAL).length,
    ).toBe(3);
  });

  test("level 5 should have 5 color vials and 2 empty vials", () => {
    const puzzle = generatePuzzle(5);
    expect(puzzle).not.toBeNull();
    expect(puzzle.length).toBe(VIAL_COUNT);
    expect(puzzle.filter((vial) => vial.length === 0).length).toBe(2);
    expect(
      puzzle.filter((vial) => vial.length === COLORS_PER_VIAL).length,
    ).toBe(5);
  });

  test("level 10 should have 7 color vials and 2 empty vials", () => {
    const puzzle = generatePuzzle(10);
    expect(puzzle).not.toBeNull();
    expect(puzzle.length).toBe(VIAL_COUNT);
    expect(puzzle.filter((vial) => vial.length === 0).length).toBe(2);
    expect(
      puzzle.filter((vial) => vial.length === COLORS_PER_VIAL).length,
    ).toBe(7);
  });

  test("level 31 should have 9 color vials and 2 empty vials", () => {
    const puzzle = generatePuzzle(31);
    expect(puzzle).not.toBeNull();
    expect(puzzle.length).toBe(VIAL_COUNT);
    expect(puzzle.filter((vial) => vial.length === 0).length).toBe(2);
    expect(
      puzzle.filter((vial) => vial.length === COLORS_PER_VIAL).length,
    ).toBe(9);
  });
});
