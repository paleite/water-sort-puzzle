import { isCompleteVial } from "./solved";
import type {
  AppliedPourBatch,
  AppliedPourTransfer,
  Board,
  Move,
} from "./types";
import { getFreeCapacity, getTopColor, getTopRunLength } from "./vial";

export type PourBatchValidationResult =
  | {ok: true; batch: AppliedPourBatch}
  | {ok: false; reason: string};

interface TransferDraft extends AppliedPourTransfer {
  requestedAmount: number;
}

export function validateAndApplyPourBatch(
  board: Board,
  requestedMoves: readonly Move[],
  capacity: number,
): PourBatchValidationResult {
  if (requestedMoves.length === 0) {
    return {ok: false, reason: "A pour batch must contain at least one move."};
  }

  const sourceIndices = new Set<number>();
  const destinationIndices = new Set(requestedMoves.map((move) => move.destinationVialIndex));
  const drafts: TransferDraft[] = [];

  for (const move of requestedMoves) {
    if (move.sourceVialIndex === move.destinationVialIndex) {
      return {ok: false, reason: "A vial cannot pour into itself."};
    }
    if (sourceIndices.has(move.sourceVialIndex)) {
      return {ok: false, reason: "A source vial can participate only once in a pour batch."};
    }
    if (destinationIndices.has(move.sourceVialIndex)) {
      return {
        ok: false,
        reason: "A vial cannot be both a source and destination in the same pour batch.",
      };
    }

    const source = board[move.sourceVialIndex];
    const destination = board[move.destinationVialIndex];
    if (source === undefined || destination === undefined) {
      return {ok: false, reason: "The pour batch references a missing vial."};
    }

    const color = getTopColor(source);
    if (color === null) {
      return {ok: false, reason: `Vial ${move.sourceVialIndex + 1} is empty.`};
    }

    const requestedAmount = getTopRunLength(source);
    if (requestedAmount <= 0) {
      return {ok: false, reason: `Vial ${move.sourceVialIndex + 1} cannot pour.`};
    }

    sourceIndices.add(move.sourceVialIndex);
    drafts.push({move, color, amount: 0, requestedAmount});
  }

  const uniqueDestinationIndices = [...new Set(drafts.map((draft) => draft.move.destinationVialIndex))];

  for (const destinationVialIndex of uniqueDestinationIndices) {
    const destination = board[destinationVialIndex];
    if (destination === undefined) {
      return {ok: false, reason: "The pour batch references a missing destination."};
    }

    const incomingDrafts = drafts.filter(
      (draft) => draft.move.destinationVialIndex === destinationVialIndex,
    );
    const firstIncomingColor = incomingDrafts[0]?.color;
    if (firstIncomingColor === undefined) {
      return {ok: false, reason: "A destination has no incoming transfer."};
    }
    if (incomingDrafts.some((draft) => draft.color !== firstIncomingColor)) {
      return {
        ok: false,
        reason: "Concurrent transfers into one destination must have the same color.",
      };
    }

    const destinationTopColor = getTopColor(destination);
    if (destinationTopColor !== null && destinationTopColor !== firstIncomingColor) {
      return {
        ok: false,
        reason: `Vial ${destinationVialIndex + 1} has an incompatible top color.`,
      };
    }

    let remainingCapacity = getFreeCapacity(destination, capacity);
    if (remainingCapacity <= 0) {
      return {ok: false, reason: `Vial ${destinationVialIndex + 1} is full.`};
    }

    for (const draft of incomingDrafts) {
      const amount = Math.min(draft.requestedAmount, remainingCapacity);
      if (amount <= 0) {
        return {
          ok: false,
          reason: `Vial ${destinationVialIndex + 1} has insufficient capacity for the pour batch.`,
        };
      }
      draft.amount = amount;
      remainingCapacity -= amount;
    }
  }

  const nextBoard: Board = board.map((vial) => [...vial]);

  for (const draft of drafts) {
    const source = nextBoard[draft.move.sourceVialIndex];
    if (source === undefined) {
      return {ok: false, reason: "The validated pour batch lost a source vial."};
    }
    nextBoard[draft.move.sourceVialIndex] = source.slice(0, source.length - draft.amount);
  }

  for (const destinationVialIndex of uniqueDestinationIndices) {
    const destination = nextBoard[destinationVialIndex];
    if (destination === undefined) {
      return {ok: false, reason: "The validated pour batch lost a destination vial."};
    }

    const incoming = drafts.filter(
      (draft) => draft.move.destinationVialIndex === destinationVialIndex,
    );
    const nextDestination = [...destination];
    for (const draft of incoming) {
      nextDestination.push(...Array.from({length: draft.amount}, () => draft.color));
    }
    nextBoard[destinationVialIndex] = nextDestination;
  }

  const newlyCompletedVialIndices = nextBoard.flatMap((vial, index) => {
    const previousVial = board[index];
    return previousVial !== undefined
      && !isCompleteVial(previousVial, capacity)
      && isCompleteVial(vial, capacity)
      ? [index]
      : [];
  });

  return {
    ok: true,
    batch: {
      transfers: drafts.map(({requestedAmount: _requestedAmount, ...transfer}) => transfer),
      previousBoard: board,
      nextBoard,
      newlyCompletedVialIndices,
    },
  };
}

export function canApplyPourBatch(
  board: Board,
  requestedMoves: readonly Move[],
  capacity: number,
): boolean {
  return validateAndApplyPourBatch(board, requestedMoves, capacity).ok;
}

export function applyPourBatch(
  board: Board,
  requestedMoves: readonly Move[],
  capacity: number,
): AppliedPourBatch {
  const result = validateAndApplyPourBatch(board, requestedMoves, capacity);
  if (!result.ok) throw new Error(result.reason);
  return result.batch;
}
