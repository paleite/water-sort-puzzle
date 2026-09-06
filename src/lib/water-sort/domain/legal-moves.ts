import { canPour } from "./moves";
import type { Board, Move } from "./types";

export function getLegalMoves(board: Board, capacity: number): readonly Move[] {
  const moves: Move[] = [];
  for (let sourceVialIndex = 0; sourceVialIndex < board.length; sourceVialIndex += 1) {
    for (
      let destinationVialIndex = 0;
      destinationVialIndex < board.length;
      destinationVialIndex += 1
    ) {
      const move = {sourceVialIndex, destinationVialIndex};
      if (canPour(board, move, capacity)) moves.push(move);
    }
  }
  return moves;
}
