import type { AppliedMove, Board } from "../domain/types";

export function applyPresentationMoveToBoard(
  board: Board,
  appliedMove: AppliedMove,
  capacity: number,
): Board {
  const sourceIndex = appliedMove.move.sourceVialIndex;
  const destinationIndex = appliedMove.move.destinationVialIndex;
  const source = board[sourceIndex];
  const destination = board[destinationIndex];

  if (source === undefined || destination === undefined) {
    throw new Error("Presentation move referenced a missing vial.");
  }
  if (appliedMove.amount <= 0) {
    throw new Error("Presentation move must transfer at least one unit.");
  }
  if (destination.length + appliedMove.amount > capacity) {
    throw new Error("Presentation move would overflow the visible destination vial.");
  }

  const movingColors = source.slice(source.length - appliedMove.amount);
  if (
    movingColors.length !== appliedMove.amount
    || movingColors.some((color) => color !== appliedMove.color)
  ) {
    throw new Error("Visible board is out of sync with the presentation queue.");
  }

  const nextSource = source.slice(0, source.length - appliedMove.amount);
  const nextDestination = [
    ...destination,
    ...Array.from({length: appliedMove.amount}, () => appliedMove.color),
  ];

  return board.map((vial, vialIndex) => {
    if (vialIndex === sourceIndex) return nextSource;
    if (vialIndex === destinationIndex) return nextDestination;
    return vial;
  });
}
