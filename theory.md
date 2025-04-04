# Water Sort Puzzle: Theory & Design

## What Is the Water Sort Puzzle?

A water sort puzzle is a logic-based sorting game where:

- You have `N` vials (or tubes), each with a fixed height (usually 4 units).
- Each vial contains a mixture of colored liquid segments.
- The goal is to sort the colors so each vial contains liquid of only one color, or is empty.
- You can only pour liquid on top of the same color or into an empty vial.
- No color mixing is allowed.

## Terminology

- **C** = Number of distinct colors
- **H** = Height of each vial (segments per vial, usually 4)
- **T** = Total segments = `C × H`
- **V** = Total number of vials
- **E** = Number of empty vials (`V = C + E`)

## Empty Vials: Purpose and Requirements

Empty vials serve as **buffer space**, allowing you to move colors around temporarily. They provide the necessary degrees of freedom for rearranging color segments.

### Minimum Empty Vials Required

#### Empirical Observations

- **1 empty vial**: Some puzzles can be solved, especially with fewer colors.
- **2 empty vials**: Most puzzles (even hard ones) can be solved.
- **More than 2**: Typically unnecessary unless the puzzle is intentionally difficult.

#### Mathematical Rule of Thumb

The minimum number of empty vials required depends on the number of colors and height:

> You generally need at least `ceil(C / H)` empty vials to ensure enough buffer space.

However, in practice, this can be too conservative.

#### Better Heuristic

A more accurate heuristic is:

> You can solve almost any well-designed puzzle with `E = 2` (two empty vials), if there are no deliberate traps.

This heuristic comes from:

- **Permutations:** You need enough flexibility to rearrange color stacks.
- **Cycle sort analogy:** To sort `C` items, you may need `C - 1` swaps, and having two temp variables is usually enough to manage swap chains.

## Designing Guaranteed-Solvable Puzzles

The most reliable method to create solvable puzzles is through **reverse-engineering**:

### Reverse Design Strategy

1. **Choose the number of colors (`C`)** and the height (`H`, e.g., 4).
2. **Prepare `C` complete sorted vials** (e.g., one vial of red, one of blue, etc.).
3. **Create `E` empty vials**, where `E = N - C`.
4. **Simulate random valid moves backwards**:
   - Pick a random color from a full vial.
   - Pour it onto a compatible target (either empty, or on top of the same color if space allows).
   - Repeat this to shuffle the colors across the tubes, following the Water Sort rules **in reverse**.
5. **Record the final state** as the starting puzzle.

This ensures:

- The puzzle is solvable.
- You don't rely on brute-force solvability testing.
- You only use the `N` tubes given, guaranteeing it works with exactly `N`.

### Design Constraints

When shuffling:

- **Never pour a color onto a vial where the top color is different** (that would be illegal in a forward solve).
- **Never overfill a vial** (respect the max height).
- **Don't break reversibility** — ensure you don't create a state that requires an extra temporary vial to restore.

## Characteristics of a Well-Designed Puzzle

### Starting State Properties

- Only completely filled or completely empty vials.
- No partially filled vials (all vials contain exactly 0 or H layers).
- High entropy in the distribution of colored segments.
- No vial is fully sorted at the beginning.
- Even distribution of colors across vials (avoid heavy clustering).

### Avoiding Redundant Shuffling

To avoid shuffles that cancel each other:

#### Use Cycle Detection

Model the shuffle sequence as a directed graph where each move is an edge from source to target. Detect and eliminate cycles using algorithms such as:

- Tarjan's Strongly Connected Components Algorithm
- Floyd's Cycle Detection Algorithm

#### Hash Seen States

Keep a hash of all visited states and prevent reapplication of actions that result in known states.

## Measuring Puzzle Difficulty

Difficulty can be quantified by several parameters:

### Fragmentation

Defined as the number of color changes across all vials. High fragmentation indicates high interleaving and sorting complexity.

### Steps to Solve

A level requiring more steps to reach a solution is usually harder. This can be measured using breadth-first or depth-first search.

### Color Mixing Index

Measures how many different colors are in each vial. Higher average color count per vial correlates with higher complexity.

### Available Moves Heuristic

A low branching factor (few valid moves at each step) can increase difficulty due to fewer viable strategies.

## Mathematical Insights

### Permutation Graph Model

If you model the segments as a **graph of cycles** (think cycle sort), each color's segments must be rearranged into a contiguous block.

To perform a full sort with only `E` empty vials, the configuration must:

- Allow swap chains without blocking
- Not require temporary storage of more than `E × H` segments at any point

### Minimum Vial Calculation

To solve a water sort puzzle, the following must hold:

```
V × H ≥ T + H × E
```

The minimum `V` can be derived by binary search or brute force generation of solvable configurations.

## Guaranteeing Solvability

To ensure a puzzle is solvable:

- Use a **solver algorithm** to verify a configuration (e.g., A\* or BFS with visited state pruning).
- Ensure no color segment is trapped (blocked by incompatible colors with no intermediate destination).
- Avoid over-fragmentation unless ample empty space is provided.
- Generate levels through reverse-solving from a valid end state.

## Conclusion

A well-designed Water Sort Puzzle balances complexity, solvability, and engagement. Most puzzles can be solved with 2 empty vials, providing enough degrees of freedom without making the solution trivial. The reverse-engineering approach to level design ensures puzzles are both challenging and fair.
