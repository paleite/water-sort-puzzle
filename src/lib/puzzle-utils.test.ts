import { describe, expect, it } from "vitest";

import { GameState } from "./game-state";
import {
  addEmptyVials,
  calculateEntropy,
  calculateFragmentation,
  countTopSegmentsOfSameColor,
  createInitialState,
  evaluateLevel,
  hasDesirableProperties,
  prioritizeMoves,
  randomizeVials,
  wouldCompleteVial,
} from "./puzzle-utils";
import { SeededRandom } from "./seeded-random";
import type { Color, Move } from "./types/puzzle-types";
import { Vial } from "./vial";

describe("countTopSegmentsOfSameColor", () => {
  it("counts consecutive same-color segments from the top", () => {
    const vial = new Vial(4);
    vial.segments = ["red", "blue", "blue", "blue"];

    const count = countTopSegmentsOfSameColor(vial, "blue");

    expect(count).toBe(3);
  });

  it("returns 0 if the color is not at the top", () => {
    const vial = new Vial(4);
    vial.segments = ["red", "blue", "green", "yellow"];

    const count = countTopSegmentsOfSameColor(vial, "blue");

    expect(count).toBe(0);
  });

  it("returns 0 for an empty vial", () => {
    const vial = new Vial(4);

    const count = countTopSegmentsOfSameColor(vial, "blue");

    expect(count).toBe(0);
  });
});

describe("createInitialState", () => {
  it("creates the correct number of filled and empty vials", () => {
    const colorCount = 3;
    const vialHeight = 4;
    const emptyVialCount = 2;

    const state = createInitialState(colorCount, vialHeight, emptyVialCount);

    expect(state.vials.length).toBe(colorCount + emptyVialCount);
    expect(state.colorCount).toBe(colorCount);
    expect(state.emptyVialCount).toBe(emptyVialCount);
  });

  it("fills each color vial with the same color", () => {
    const colorCount = 3;
    const vialHeight = 4;
    const emptyVialCount = 1;

    const state = createInitialState(colorCount, vialHeight, emptyVialCount);

    // Check first three vials are filled with unique colors
    for (let i = 0; i < colorCount; i++) {
      const vial = state.vials[i];

      // Should be filled to capacity
      expect(vial.segments.length).toBe(vialHeight);

      // All segments in a vial should be the same color
      const [color] = vial.segments;
      expect(vial.segments.every((segment) => segment === color)).toBe(true);
    }

    // Check the colors are different across vials
    const uniqueColors = new Set(
      state.vials.slice(0, colorCount).map((vial) => vial.segments[0]),
    );
    expect(uniqueColors.size).toBe(colorCount);

    // Check empty vials
    for (let i = colorCount; i < state.vials.length; i++) {
      const vial = state.vials[i];
      expect(vial.segments.length).toBe(0);
    }
  });

  it("throws an error if colorCount exceeds available colors", () => {
    const colorCount = 15; // More than the 12 defined in the palette
    const vialHeight = 4;
    const emptyVialCount = 1;

    expect(() =>
      createInitialState(colorCount, vialHeight, emptyVialCount),
    ).toThrow();
  });
});

describe("randomizeVials", () => {
  it("preserves empty vials", () => {
    const initialState = createInitialState(3, 4, 2);
    const rng = new SeededRandom(123);

    const randomizedState = randomizeVials(initialState, rng);

    // Empty vials should still be empty
    expect(randomizedState.vials[3]?.isEmpty()).toBe(true);
    expect(randomizedState.vials[4]?.isEmpty()).toBe(true);
  });

  it("shuffles segments across non-empty vials", () => {
    const initialState = createInitialState(3, 4, 1);
    const rng = new SeededRandom(123);

    const randomizedState = randomizeVials(initialState, rng);

    // Total count of each color should be preserved
    const initialColors = initialState.vials.flatMap((vial) => vial.segments);
    const randomizedColors = randomizedState.vials.flatMap(
      (vial) => vial.segments,
    );

    // Sort and compare - they should have the same elements
    expect(initialColors.sort()).toEqual(randomizedColors.sort());

    // But the original arrangement should be different
    let isDifferent = false;
    for (let i = 0; i < initialState.vials.length; i++) {
      const initialVial = initialState.vials[i];
      const randomizedVial = randomizedState.vials[i];
      if (
        JSON.stringify(initialVial.segments) !==
        JSON.stringify(randomizedVial.segments)
      ) {
        isDifferent = true;
        break;
      }
    }

    expect(isDifferent).toBe(true);
  });

  it("returns a new state without modifying the original", () => {
    const initialState = createInitialState(3, 4, 1);
    // Create a map of vial index to segments array
    const originalVials: { [key: number]: Color[] } = {};
    initialState.vials.forEach((vial, index) => {
      originalVials[index] = [...vial.segments];
    });
    const rng = new SeededRandom(123);

    randomizeVials(initialState, rng);

    // Original state should be unchanged
    // Check each vial that we recorded
    Object.entries(originalVials).forEach(([index, segments]) => {
      const vial = initialState.vials[Number(index)];
      if (vial) {
        expect(vial.segments).toEqual(segments);
      }
    });
  });
});

describe("addEmptyVials", () => {
  it("adds the correct number of empty vials", () => {
    const initialState = createInitialState(3, 4, 1);
    const targetEmptyVials = 3;

    const newState = addEmptyVials(initialState, targetEmptyVials);

    // Should add 2 more empty vials
    expect(newState.vials.length).toBe(initialState.vials.length + 2);
    expect(newState.emptyVialCount).toBe(targetEmptyVials);

    // Check that new vials are empty
    expect(newState.vials[4]?.isEmpty()).toBe(true);
    expect(newState.vials[5]?.isEmpty()).toBe(true);
  });

  it("doesn't add vials if target is already met", () => {
    const initialState = createInitialState(3, 4, 2);

    const newState = addEmptyVials(initialState, 2);

    // No vials should be added
    expect(newState.vials.length).toBe(initialState.vials.length);
    expect(newState.emptyVialCount).toBe(2);
  });

  it("correctly sets the capacity of new vials", () => {
    const vialHeight = 5;
    const initialState = createInitialState(3, vialHeight, 1);
    const targetEmptyVials = 3;

    const newState = addEmptyVials(initialState, targetEmptyVials);

    // New vials should have the same capacity
    expect(newState.vials[4]?.capacity).toBe(vialHeight);
    expect(newState.vials[5]?.capacity).toBe(vialHeight);
  });

  it("returns a new state without modifying the original", () => {
    const initialState = createInitialState(3, 4, 1);
    const originalVialCount = initialState.vials.length;

    addEmptyVials(initialState, 3);

    // Original state should be unchanged
    expect(initialState.vials.length).toBe(originalVialCount);
    expect(initialState.emptyVialCount).toBe(1);
  });
});

describe("wouldCompleteVial", () => {
  it("returns true if the move would fill a vial with same-color segments", () => {
    const vial1 = new Vial(3);
    vial1.segments = ["red", "blue", "blue"]; // blue on top

    const vial2 = new Vial(3);
    vial2.segments = ["blue"]; // Has 2 space left

    const state = new GameState([vial1, vial2], 2, 0);

    const move: Move = {
      sourceVialIndex: 0,
      targetVialIndex: 1,
      colorsToPour: 2,
    };

    expect(wouldCompleteVial(state, move)).toBe(true);
  });

  it("returns true if the move would empty a source vial", () => {
    const vial1 = new Vial(3);
    vial1.segments = ["blue", "blue"]; // two blues

    const vial2 = new Vial(3);
    vial2.segments = ["red"]; // Has space for blues

    const state = new GameState([vial1, vial2], 2, 0);

    const move: Move = {
      sourceVialIndex: 0,
      targetVialIndex: 1,
      colorsToPour: 2,
    };

    expect(wouldCompleteVial(state, move)).toBe(true);
  });

  it("returns false if the move doesn't complete any vial", () => {
    const vial1 = new Vial(4);
    vial1.segments = ["red", "blue", "blue", "blue"]; // three blues on top

    const vial2 = new Vial(4);
    vial2.segments = ["red"]; // Has space but won't be filled

    const state = new GameState([vial1, vial2], 2, 0);

    const move: Move = {
      sourceVialIndex: 0,
      targetVialIndex: 1,
      colorsToPour: 1, // Just moving one blue
    };

    expect(wouldCompleteVial(state, move)).toBe(false);
  });
});

describe("prioritizeMoves", () => {
  it("prioritizes moves that complete a vial", () => {
    // Setup a state where one move completes a vial
    const vial1 = new Vial(3);
    vial1.segments = ["red", "blue", "blue"]; // blue on top

    const vial2 = new Vial(3);
    vial2.segments = ["blue"]; // Completing move

    const vial3 = new Vial(3); // Empty vial

    const state = new GameState([vial1, vial2, vial3], 2, 1);

    const moves: Move[] = [
      { sourceVialIndex: 0, targetVialIndex: 2, colorsToPour: 2 }, // Move to empty
      { sourceVialIndex: 0, targetVialIndex: 1, colorsToPour: 2 }, // Complete vial2
    ];

    const prioritized = prioritizeMoves(moves, state);

    // Completing vial should be first
    expect(prioritized[0]).toEqual({
      sourceVialIndex: 0,
      targetVialIndex: 1,
      colorsToPour: 2,
    });
  });

  it("prioritizes consolidating the same color", () => {
    // Setup moves where one consolidates colors
    const vial1 = new Vial(3);
    vial1.segments = ["red", "green", "blue"]; // blue on top

    const vial2 = new Vial(3);
    vial2.segments = ["red", "blue"]; // blue on top - consolidating

    const vial3 = new Vial(3);
    vial3.segments = ["red"]; // Not consolidating

    const state = new GameState([vial1, vial2, vial3], 3, 0);

    const moves: Move[] = [
      { sourceVialIndex: 0, targetVialIndex: 2, colorsToPour: 1 }, // Move blue to red
      { sourceVialIndex: 0, targetVialIndex: 1, colorsToPour: 1 }, // Move blue to blue
    ];

    const prioritized = prioritizeMoves(moves, state);

    // Consolidating move should be first
    expect(prioritized[0]).toEqual({
      sourceVialIndex: 0,
      targetVialIndex: 1,
      colorsToPour: 1,
    });
  });
});

describe("calculateEntropy and calculateFragmentation", () => {
  it("calculates higher entropy for more disordered vials", () => {
    // Create a highly ordered state
    const orderedState = createInitialState(3, 4, 1);

    // Create a disordered state
    const disorderedVials = [
      new Vial(4),
      new Vial(4),
      new Vial(4),
      new Vial(4),
    ];

    // Fill with mixed colors
    if (disorderedVials[0]) {
      disorderedVials[0].segments = ["red", "blue", "red", "green"];
    }
    if (disorderedVials[1]) {
      disorderedVials[1].segments = ["blue", "green", "blue", "red"];
    }
    if (disorderedVials[2]) {
      disorderedVials[2].segments = ["green", "red", "green", "blue"];
    }
    if (disorderedVials[3]) {
      disorderedVials[3].segments = [];
    } // Empty vial

    const disorderedState = new GameState(disorderedVials, 3, 1);

    const orderedEntropy = calculateEntropy(orderedState);
    const disorderedEntropy = calculateEntropy(disorderedState);

    expect(disorderedEntropy).toBeGreaterThan(orderedEntropy);
  });

  it("calculates higher fragmentation when colors are spread across vials", () => {
    // Create a state with no fragmentation (each color in one vial)
    const noFragmentationVials = [
      new Vial(4),
      new Vial(4),
      new Vial(4),
      new Vial(4),
    ];

    if (noFragmentationVials[0]) {
      noFragmentationVials[0].segments = ["red", "red", "red", "red"];
    }
    if (noFragmentationVials[1]) {
      noFragmentationVials[1].segments = ["blue", "blue", "blue", "blue"];
    }
    if (noFragmentationVials[2]) {
      noFragmentationVials[2].segments = ["green", "green", "green", "green"];
    }
    if (noFragmentationVials[3]) {
      noFragmentationVials[3].segments = [];
    } // Empty vial

    const noFragmentationState = new GameState(noFragmentationVials, 3, 1);

    // Create a state with high fragmentation (colors spread across vials)
    const fragmentedVials = [
      new Vial(4),
      new Vial(4),
      new Vial(4),
      new Vial(4),
    ];

    if (fragmentedVials[0]) {
      fragmentedVials[0].segments = ["red", "blue", "green", "red"];
    }
    if (fragmentedVials[1]) {
      fragmentedVials[1].segments = ["blue", "green", "red", "blue"];
    }
    if (fragmentedVials[2]) {
      fragmentedVials[2].segments = ["green", "red", "blue", "green"];
    }
    if (fragmentedVials[3]) {
      fragmentedVials[3].segments = [];
    } // Empty vial

    const fragmentedState = new GameState(fragmentedVials, 3, 1);

    const noFragmentation = calculateFragmentation(noFragmentationState);
    const highFragmentation = calculateFragmentation(fragmentedState);

    expect(highFragmentation).toBeGreaterThan(noFragmentation);
    expect(noFragmentation).toBe(0); // Each color in exactly one vial
  });
});

describe("evaluateLevel", () => {
  it("calculates difficulty based on entropy, fragmentation, and solution steps", () => {
    const vials = [new Vial(4), new Vial(4), new Vial(4), new Vial(4)];

    if (vials[0]) {
      vials[0].segments = ["red", "blue", "green", "red"];
    }
    if (vials[1]) {
      vials[1].segments = ["blue", "green", "red", "blue"];
    }
    if (vials[2]) {
      vials[2].segments = ["green", "red", "blue", "green"];
    }
    if (vials[3]) {
      vials[3].segments = [];
    } // Empty vial

    const state = new GameState(vials, 3, 1);
    const solutionPath: Move[] = Array(10).reduce<Move[]>((acc) => {
      return [
        ...acc,
        {
          sourceVialIndex: 0,
          targetVialIndex: 1,
          colorsToPour: 1,
        } satisfies Move,
      ];
    }, []);

    const evaluation = evaluateLevel(state, solutionPath);

    expect(evaluation.difficulty).toBeGreaterThan(0);
    expect(evaluation.entropy).toBeGreaterThan(0);
    expect(evaluation.fragmentation).toBeGreaterThan(0);
    expect(evaluation.solutionSteps).toBe(10);
  });

  it("identifies invalid puzzles with partial vials", () => {
    const vials = [new Vial(4), new Vial(4), new Vial(4)];

    if (vials[0]) {
      vials[0].segments = ["red", "blue"];
    } // Partial vial
    if (vials[1]) {
      vials[1].segments = ["green", "red", "blue", "green"];
    }
    if (vials[2]) {
      vials[2].segments = [];
    } // Empty vial

    const state = new GameState(vials, 3, 1);
    const solutionPath: Move[] = [];

    const evaluation = evaluateLevel(state, solutionPath);

    expect(evaluation.isValid).toBe(false);
  });

  it("identifies invalid puzzles with initially solved vials", () => {
    const vials = [new Vial(4), new Vial(4), new Vial(4)];

    if (vials[0]) {
      vials[0].segments = ["red", "red", "red", "red"];
    } // Already complete
    if (vials[1]) {
      vials[1].segments = ["blue", "green", "red", "blue"];
    }
    if (vials[2]) {
      vials[2].segments = [];
    } // Empty vial

    const state = new GameState(vials, 3, 1);
    const solutionPath: Move[] = [];

    const evaluation = evaluateLevel(state, solutionPath);

    expect(evaluation.isValid).toBe(false);
  });
});

describe("hasDesirableProperties", () => {
  it("returns false for states with solved vials", () => {
    const vials = [new Vial(4), new Vial(4), new Vial(4)];

    if (vials[0]) {
      vials[0].segments = ["red", "red", "red", "red"];
    } // Already complete
    if (vials[1]) {
      vials[1].segments = ["blue", "green", "red", "blue"];
    }
    if (vials[2]) {
      vials[2].segments = [];
    } // Empty vial

    const state = new GameState(vials, 3, 1);

    expect(hasDesirableProperties(state)).toBe(false);
  });

  it("returns false for states with partial vials", () => {
    const vials = [new Vial(4), new Vial(4), new Vial(4)];

    if (vials[0]) {
      vials[0].segments = ["red", "blue"];
    } // Partial vial
    if (vials[1]) {
      vials[1].segments = ["green", "red", "blue", "green"];
    }
    if (vials[2]) {
      vials[2].segments = [];
    } // Empty vial

    const state = new GameState(vials, 3, 1);

    expect(hasDesirableProperties(state)).toBe(false);
  });

  it("returns true for states with sufficient entropy and no invalid properties", () => {
    const vials = [new Vial(4), new Vial(4), new Vial(4), new Vial(4)];

    // Fill with well-mixed colors
    if (vials[0]) {
      vials[0].segments = ["red", "blue", "green", "red"];
    }
    if (vials[1]) {
      vials[1].segments = ["blue", "green", "red", "blue"];
    }
    if (vials[2]) {
      vials[2].segments = ["green", "red", "blue", "green"];
    }
    if (vials[3]) {
      vials[3].segments = [];
    } // Empty vial

    const state = new GameState(vials, 3, 1);

    // This assumes the entropy calculation will give sufficient value
    // You might need to adjust this test if your entropy thresholds change
    expect(hasDesirableProperties(state)).toBe(true);
  });
});
