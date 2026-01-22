export type EmptyToken = "EMPTY";
export const EMPTY_TOKEN: EmptyToken = "EMPTY";

export type ColorToken = string;
export type SlotToken = ColorToken | EmptyToken;

export type Capacity = 4;

export type Vial = readonly [SlotToken, SlotToken, SlotToken, SlotToken];
export type State = readonly Vial[];

export type Move = readonly [sourceIndex: number, destinationIndex: number];
export type MoveList = readonly Move[];

export type PuzzleJson = Readonly<{
  capacity: number;
  empty_token: EmptyToken;
  vials: readonly (readonly SlotToken[])[];
}>;

export type MovesJson = readonly (readonly [number, number])[];

export const STARTING_PUZZLE_JSON: PuzzleJson = {
  capacity: 4,
  empty_token: "EMPTY",
  vials: [
    ["brown", "pink", "dark_green", "pink"],
    ["light_blue", "purple", "brown", "orange"],
    ["light_blue", "orange", "light_blue", "orange"],
    ["red", "dark_blue", "purple", "yellow"],
    ["gray", "pink", "olive_green", "gray"],
    ["gray", "yellow", "red", "dark_green"],
    ["purple", "light_green", "light_green", "dark_green"],
    ["gray", "light_green", "dark_blue", "dark_green"],
    ["dark_blue", "olive_green", "pink", "light_blue"],
    ["brown", "olive_green", "light_green", "yellow"],
    ["dark_blue", "purple", "red", "red"],
    ["yellow", "olive_green", "orange", "brown"],
    ["EMPTY", "EMPTY", "EMPTY", "EMPTY"],
    ["EMPTY", "EMPTY", "EMPTY", "EMPTY"],
  ],
};

export const SOLUTION_40_MOVES: MoveList = [
  [4, 12],
  [0, 13],
  [4, 0],
  [5, 12],
  [11, 5],
  [9, 13],
  [4, 11],
  [4, 12],
  [10, 4],
  [7, 12],
  [6, 10],
  [7, 6],
  [8, 7],
  [7, 4],
  [8, 9],
  [0, 8],
  [7, 0],
  [6, 7],
  [6, 0],
  [9, 6],
  [9, 7],
  [5, 9],
  [3, 5],
  [3, 4],
  [10, 3],
  [5, 10],
  [0, 5],
  [8, 0],
  [11, 6],
  [2, 8],
  [11, 2],
  [11, 13],
  [1, 8],
  [3, 11],
  [1, 11],
  [3, 9],
  [1, 13],
  [2, 1],
  [2, 8],
  [2, 1],
] as const;

export const UNSOLVABLE_CANDIDATE_PREFIX: MoveList = [
  [2, 0],
  [3, 1],
  [6, 0],
  [8, 0],
  [13, 5],
] as const;

export function parsePuzzleJsonToState(puzzleJson: PuzzleJson): State {
  if (puzzleJson.capacity !== 4) {
    throw new Error(
      `Only capacity=4 is supported by this reference impl. Got ${puzzleJson.capacity}.`,
    );
  }
  if (puzzleJson.empty_token !== EMPTY_TOKEN) {
    throw new Error(`Unexpected empty_token. Got ${puzzleJson.empty_token}.`);
  }

  const vials: Vial[] = puzzleJson.vials.map((rawVial, vialIndex) => {
    if (rawVial.length !== 4) {
      throw new Error(
        `Vial ${vialIndex} length must be 4. Got ${rawVial.length}.`,
      );
    }

    return [
      rawVial[0] ?? EMPTY_TOKEN,
      rawVial[1] ?? EMPTY_TOKEN,
      rawVial[2] ?? EMPTY_TOKEN,
      rawVial[3] ?? EMPTY_TOKEN,
    ] as const;
  });

  return vials;
}

export function serializeStateToPuzzleJson(state: State): PuzzleJson {
  return {
    capacity: 4,
    empty_token: EMPTY_TOKEN,
    vials: state.map((vial) => [...vial] as const),
  };
}

export function assertEmptyOnTopInvariant(state: State): void {
  for (let vialIndex = 0; vialIndex < state.length; vialIndex++) {
    const vial = state[vialIndex];
    let seenNonEmpty = false;

    for (let slotIndex = 0; slotIndex < 4; slotIndex++) {
      const token = vial?.[slotIndex] ?? EMPTY_TOKEN;
      if (token === EMPTY_TOKEN) {
        if (seenNonEmpty) {
          throw new Error(
            `Invariant violated: EMPTY below a color. vial=${vialIndex}, slot=${slotIndex}, vial=${JSON.stringify(vial)}`,
          );
        }
      } else {
        seenNonEmpty = true;
      }
    }
  }
}

export function findTopNonEmptyIndex(vial: Vial): number | null {
  for (let i = 0; i < 4; i++) {
    if (vial[i] !== EMPTY_TOKEN) {
      return i;
    }
  }
  return null;
}

export function getTopColorAndRunLength(vial: Vial): {
  color: ColorToken | null;
  runLength: number;
  topIndex: number | null;
} {
  const topIndex = findTopNonEmptyIndex(vial);
  if (topIndex === null) {
    return { color: null, runLength: 0, topIndex: null };
  }

  const topToken = vial[topIndex];
  if (topToken === EMPTY_TOKEN) {
    return { color: null, runLength: 0, topIndex: null };
  }

  let runLength = 0;
  for (let i = topIndex; i < 4; i++) {
    if (vial[i] === topToken) {
      runLength++;
    } else {
      break;
    }
  }

  return { color: topToken, runLength, topIndex };
}

export function countEmptySlotsAtTop(vial: Vial): number {
  let count = 0;
  for (let i = 0; i < 4; i++) {
    if (vial[i] === EMPTY_TOKEN) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export function getDestinationTopColor(vial: Vial): ColorToken | null {
  const topIndex = findTopNonEmptyIndex(vial);
  if (topIndex === null) {
    return null;
  }

  const token = vial[topIndex];
  return token === EMPTY_TOKEN ? null : token;
}

export function canPour(
  state: State,
  sourceIndex: number,
  destinationIndex: number,
): boolean {
  if (sourceIndex === destinationIndex) {
    return false;
  }

  const source = state[sourceIndex];
  const destination = state[destinationIndex];

  if (!source || !destination) {
    return false;
  }

  const sourceTop = getTopColorAndRunLength(source);
  if (sourceTop.color === null) {
    return false;
  }

  const destinationEmptySlots = countEmptySlotsAtTop(destination);
  if (destinationEmptySlots === 0) {
    return false;
  }

  const destinationTopColor = getDestinationTopColor(destination);
  if (destinationTopColor === null) {
    return true;
  }

  return destinationTopColor === sourceTop.color;
}

export function applyPour(
  state: State,
  sourceIndex: number,
  destinationIndex: number,
): State {
  if (!canPour(state, sourceIndex, destinationIndex)) {
    throw new Error(`Illegal pour: ${sourceIndex} -> ${destinationIndex}`);
  }

  const source = state[sourceIndex];
  const destination = state[destinationIndex];

  if (!source || !destination) {
    throw new Error(
      `Illegal pour: missing source or destination ${sourceIndex} -> ${destinationIndex}`,
    );
  }

  const { color: sourceColor, runLength, topIndex } =
    getTopColorAndRunLength(source);
  if (sourceColor === null || topIndex === null) {
    throw new Error(
      `Illegal pour: source empty after canPour check. ${sourceIndex} -> ${destinationIndex}`,
    );
  }

  const destinationEmptySlots = countEmptySlotsAtTop(destination);
  const pourAmount = Math.min(runLength, destinationEmptySlots);

  const newSource: SlotToken[] = [...source];
  for (let offset = 0; offset < pourAmount; offset++) {
    newSource[topIndex + offset] = EMPTY_TOKEN;
  }

  const newDestination: SlotToken[] = [...destination];
  for (let offset = 0; offset < pourAmount; offset++) {
    const destinationIndexToFill = destinationEmptySlots - 1 - offset;
    newDestination[destinationIndexToFill] = sourceColor;
  }

  const nextState: Vial[] = state.map((vial, index) => {
    if (index === sourceIndex) {
      return [
        newSource[0] ?? EMPTY_TOKEN,
        newSource[1] ?? EMPTY_TOKEN,
        newSource[2] ?? EMPTY_TOKEN,
        newSource[3] ?? EMPTY_TOKEN,
      ] as const;
    }
    if (index === destinationIndex) {
      return [
        newDestination[0] ?? EMPTY_TOKEN,
        newDestination[1] ?? EMPTY_TOKEN,
        newDestination[2] ?? EMPTY_TOKEN,
        newDestination[3] ?? EMPTY_TOKEN,
      ] as const;
    }
    return vial;
  });

  return nextState;
}

export function isSolved(state: State): boolean {
  for (const vial of state) {
    const nonEmpty = vial.filter((token) => token !== EMPTY_TOKEN) as
      | ColorToken[]
      | [];

    if (nonEmpty.length === 0) {
      continue;
    }

    if (nonEmpty.length !== 4) {
      return false;
    }

    const first = nonEmpty[0];
    if (nonEmpty.some((token) => token !== first)) {
      return false;
    }
  }

  return true;
}

export function generateLegalMoves(state: State): Move[] {
  const moves: Move[] = [];
  for (let src = 0; src < state.length; src++) {
    for (let dst = 0; dst < state.length; dst++) {
      if (src === dst) {
        continue;
      }
      if (canPour(state, src, dst)) {
        moves.push([src, dst] as const);
      }
    }
  }
  return moves;
}

export function encodeState(state: State): string {
  return state.map((vial) => vial.join("|")).join(" / ");
}

export type VerificationSuccess = Readonly<{
  ok: true;
  finalState: State;
}>;

export type VerificationFailure = Readonly<{
  ok: false;
  failedAtStepIndex: number;
  move: Move;
  reason: string;
  stateBefore: State;
}>;

export type VerificationResult = VerificationSuccess | VerificationFailure;

export function verifyMoveList(
  startState: State,
  moves: MoveList,
): VerificationResult {
  let state: State = startState;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (!move) {
      return {
        ok: false,
        failedAtStepIndex: i + 1,
        move: [0, 0],
        reason: "Missing move entry",
        stateBefore: state,
      };
    }

    const [src, dst] = move;

    if (!canPour(state, src, dst)) {
      return {
        ok: false,
        failedAtStepIndex: i + 1,
        move,
        reason: "Illegal move (canPour=false)",
        stateBefore: state,
      };
    }

    try {
      state = applyPour(state, src, dst);
    } catch (error) {
      return {
        ok: false,
        failedAtStepIndex: i + 1,
        move,
        reason: `applyPour threw: ${(error as Error).message}`,
        stateBefore: state,
      };
    }
  }

  if (!isSolved(state)) {
    return {
      ok: false,
      failedAtStepIndex: moves.length,
      move: moves[moves.length - 1] ?? ([0, 0] as const),
      reason: "All moves legal but final state is not solved",
      stateBefore: state,
    };
  }

  return { ok: true, finalState: state };
}

export type SolveSuccess = Readonly<{
  ok: true;
  moves: MoveList;
  moveCount: number;
}>;

export type SolveFailure = Readonly<{
  ok: false;
  reason: string;
}>;

export type SolveResult = SolveSuccess | SolveFailure;

export function solveShortestBfs(startState: State): SolveResult {
  const startKey = encodeState(startState);

  if (isSolved(startState)) {
    return { ok: true, moves: [], moveCount: 0 };
  }

  const queue: State[] = [startState];
  let queueReadIndex = 0;

  const parentKeyByKey = new Map<string, string | null>();
  const moveByKey = new Map<string, Move | null>();

  parentKeyByKey.set(startKey, null);
  moveByKey.set(startKey, null);

  while (queueReadIndex < queue.length) {
    const currentState = queue[queueReadIndex++];
    const currentKey = encodeState(currentState);

    const legalMoves = generateLegalMoves(currentState);
    for (const move of legalMoves) {
      const [src, dst] = move;
      const nextState = applyPour(currentState, src, dst);
      const nextKey = encodeState(nextState);

      if (parentKeyByKey.has(nextKey)) {
        continue;
      }

      parentKeyByKey.set(nextKey, currentKey);
      moveByKey.set(nextKey, move);
      queue.push(nextState);

      if (isSolved(nextState)) {
        const moves = reconstructMoves(parentKeyByKey, moveByKey, nextKey);
        return { ok: true, moves, moveCount: moves.length };
      }
    }
  }

  return { ok: false, reason: "No solution found (graph exhausted)" };
}

function reconstructMoves(
  parentKeyByKey: Map<string, string | null>,
  moveByKey: Map<string, Move | null>,
  solvedKey: string,
): MoveList {
  const reversed: Move[] = [];
  let cursorKey: string | null = solvedKey;

  while (cursorKey !== null) {
    const move = moveByKey.get(cursorKey) ?? null;
    const parentKey = parentKeyByKey.get(cursorKey) ?? null;

    if (move !== null) {
      reversed.push(move);
    }
    cursorKey = parentKey;
  }

  reversed.reverse();
  return reversed;
}

export function serializeMovesToJson(moves: MoveList): MovesJson {
  return moves.map((move) => [move[0], move[1]] as const);
}

export function formatMovesHumanOneBased(moves: MoveList): string {
  return moves
    .map(([src, dst], index) => `${index + 1}. ${src + 1} -> ${dst + 1}`)
    .join("\n");
}

export function formatMovesDebug(moves: MoveList): string {
  return moves
    .map((move, index) => {
      const [src, dst] = move;
      return `${index + 1}. move: Move = [${src}, ${dst}]`;
    })
    .join("\n");
}
