import { canPour } from "../domain/moves";
import type {
  Board,
  InteractionResolution,
  InvalidMoveReason,
  Move,
} from "../domain/types";
import { getTopColor } from "../domain/vial";

function getInvalidMoveReason(
  board: Board,
  move: Move,
  capacity: number,
): InvalidMoveReason {
  const source = board[move.sourceVialIndex];
  const destination = board[move.destinationVialIndex];
  if (source === undefined || destination === undefined) return "destination-missing";
  if (destination.length >= capacity) return "destination-full";
  const sourceTopColor = getTopColor(source);
  const destinationTopColor = getTopColor(destination);
  if (destinationTopColor !== null && sourceTopColor !== destinationTopColor) {
    return "different-top-color";
  }
  return "destination-missing";
}

export function resolveVialPress(
  board: Board,
  selectedSourceVialIndex: number | null,
  pressedVialIndex: number,
  capacity: number,
): InteractionResolution {
  const pressedVial = board[pressedVialIndex];

  if (selectedSourceVialIndex === null) {
    if (pressedVial === undefined || pressedVial.length === 0) {
      return {type: "ignored-empty-source", vialIndex: pressedVialIndex};
    }
    return {type: "source-selected", vialIndex: pressedVialIndex};
  }

  if (selectedSourceVialIndex === pressedVialIndex) {
    return {type: "source-unselected"};
  }

  const move = {
    sourceVialIndex: selectedSourceVialIndex,
    destinationVialIndex: pressedVialIndex,
  };

  if (canPour(board, move, capacity)) return {type: "move", move};

  if (pressedVial !== undefined && pressedVial.length > 0) {
    return {type: "source-selected", vialIndex: pressedVialIndex};
  }

  return {
    type: "invalid-move",
    sourceVialIndex: selectedSourceVialIndex,
    destinationVialIndex: pressedVialIndex,
    reason: getInvalidMoveReason(board, move, capacity),
  };
}
