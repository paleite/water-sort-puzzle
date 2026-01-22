import { describe, expect, it } from "vitest";

import { SeededRandom, shuffleArray } from "./seeded-random";

describe("SeededRandom", () => {
  it("generates the same sequence given the same seed", () => {
    const rng1 = new SeededRandom(123);
    const rng2 = new SeededRandom(123);

    // Generate a sequence of random numbers
    const sequence1 = Array.from({ length: 10 }, () => rng1.next());
    const sequence2 = Array.from({ length: 10 }, () => rng2.next());

    // Both sequences should be identical
    expect(sequence1).toEqual(sequence2);
  });

  it("generates different sequences given different seeds", () => {
    const rng1 = new SeededRandom(123);
    const rng2 = new SeededRandom(456);

    // Generate a sequence of random numbers
    const sequence1 = Array.from({ length: 10 }, () => rng1.next());
    const sequence2 = Array.from({ length: 10 }, () => rng2.next());

    // Sequences should be different
    expect(sequence1).not.toEqual(sequence2);
  });

  it("handles string seeds by converting them to numbers", () => {
    const rng1 = new SeededRandom("test-seed");
    const rng2 = new SeededRandom("test-seed");

    // Generate a sequence of random numbers
    const sequence1 = Array.from({ length: 5 }, () => rng1.next());
    const sequence2 = Array.from({ length: 5 }, () => rng2.next());

    // Both sequences should be identical
    expect(sequence1).toEqual(sequence2);
  });

  it("generates integers within the specified range", () => {
    const rng = new SeededRandom(789);
    const min = 5;
    const max = 10;

    // Generate 100 random integers
    const integers = Array.from({ length: 100 }, () => rng.nextInt(min, max));

    // All integers should be >= min and < max
    expect(integers.every((n) => n >= min && n < max)).toBe(true);

    // At least some integers should be different
    const uniqueIntegers = new Set(integers);
    expect(uniqueIntegers.size).toBeGreaterThan(1);
  });
});

describe("shuffleArray", () => {
  it("produces the same shuffle given the same seed", () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rng1 = new SeededRandom(123);
    const rng2 = new SeededRandom(123);

    const shuffled1 = shuffleArray([...array], rng1);
    const shuffled2 = shuffleArray([...array], rng2);

    // Both shuffles should be identical
    expect(shuffled1).toEqual(shuffled2);

    // The shuffled array should be different from the original
    expect(shuffled1).not.toEqual(array);
  });

  it("produces different shuffles given different seeds", () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rng1 = new SeededRandom(123);
    const rng2 = new SeededRandom(456);

    const shuffled1 = shuffleArray([...array], rng1);
    const shuffled2 = shuffleArray([...array], rng2);

    // The shuffles should be different
    expect(shuffled1).not.toEqual(shuffled2);
  });

  it("preserves all elements from the original array", () => {
    const array = [1, 2, 3, 4, 5];
    const rng = new SeededRandom(123);

    const shuffled = shuffleArray([...array], rng);

    // The shuffled array should contain all elements from the original array
    expect(shuffled.sort()).toEqual(array.sort());
  });

  it("does not modify the original array", () => {
    const array = [1, 2, 3, 4, 5];
    const originalArray = [...array];
    const rng = new SeededRandom(123);

    shuffleArray(array, rng);

    // The original array should remain unchanged
    expect(array).toEqual(originalArray);
  });
});
