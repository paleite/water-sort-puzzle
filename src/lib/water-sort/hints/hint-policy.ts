import { createCanonicalBoardKey } from "../domain/board";
import { getLegalMoves } from "../domain/legal-moves";
import { applyMove } from "../domain/moves";
import type { Board, Move } from "../domain/types";

export type HintPolicy = Map<string, string>;

export function resolveHintMove(
  board: Board,
  capacity: number,
  nextCanonicalKey: string,
): Move | null {
  for (const move of getLegalMoves(board, capacity)) {
    const nextBoard = applyMove(board, move, capacity).nextBoard;
    if (createCanonicalBoardKey(nextBoard) === nextCanonicalKey) return move;
  }
  return null;
}

export function mergeHintPath(policy: HintPolicy, boards: readonly Board[]): void {
  for (let index = 0; index + 1 < boards.length; index += 1) {
    const current = boards[index];
    const next = boards[index + 1];
    if (current === undefined || next === undefined) continue;
    policy.set(createCanonicalBoardKey(current), createCanonicalBoardKey(next));
  }
}
