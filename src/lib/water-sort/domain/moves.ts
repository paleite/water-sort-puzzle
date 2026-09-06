import { isCompleteVial } from "./solved";
import type { AppliedMove, Board, Move } from "./types";
import { getFreeCapacity, getTopColor, getTopRunLength } from "./vial";

export function canPour(board: Board, move: Move, capacity: number): boolean {
  if (move.sourceVialIndex === move.destinationVialIndex) return false;
  const source = board[move.sourceVialIndex];
  const destination = board[move.destinationVialIndex];
  if (source === undefined || destination === undefined) return false;
  const sourceTopColor = getTopColor(source);
  if (sourceTopColor === null || getFreeCapacity(destination, capacity) <= 0) {
    return false;
  }
  const destinationTopColor = getTopColor(destination);
  return destinationTopColor === null || destinationTopColor === sourceTopColor;
}

export function getPourAmount(board: Board, move: Move, capacity: number): number {
  if (!canPour(board, move, capacity)) return 0;
  const source = board[move.sourceVialIndex];
  const destination = board[move.destinationVialIndex];
  if (source === undefined || destination === undefined) return 0;
  return Math.min(
    getTopRunLength(source),
    getFreeCapacity(destination, capacity),
  );
}

export function applyMove(board: Board, move: Move, capacity: number): AppliedMove {
  if (!canPour(board, move, capacity)) {
    throw new Error(
      `Illegal pour from vial ${move.sourceVialIndex} to ${move.destinationVialIndex}.`,
    );
  }
  const source = board[move.sourceVialIndex];
  const destination = board[move.destinationVialIndex];
  if (source === undefined || destination === undefined) {
    throw new Error("Legal move referenced a missing vial.");
  }
  const color = getTopColor(source);
  if (color === null) throw new Error("Legal move referenced an empty source.");
  const amount = getPourAmount(board, move, capacity);
  if (amount <= 0) throw new Error("Legal move produced no transfer.");

  const nextSource = source.slice(0, source.length - amount);
  const nextDestination = [
    ...destination,
    ...Array.from({length: amount}, () => color),
  ];

  const nextBoard: Board = board.map((vial, index) => {
    if (index === move.sourceVialIndex) return nextSource;
    if (index === move.destinationVialIndex) return nextDestination;
    return vial;
  });

  const newlyCompletedVialIndices = nextBoard.flatMap((vial, index) => {
    const previousVial = board[index];
    return previousVial !== undefined &&
      !isCompleteVial(previousVial, capacity) &&
      isCompleteVial(vial, capacity)
      ? [index]
      : [];
  });

  return {
    move,
    color,
    amount,
    previousBoard: board,
    nextBoard,
    newlyCompletedVialIndices,
  };
}
