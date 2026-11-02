import { createCanonicalBoardKey } from "../domain/board";
import { getLegalMoves } from "../domain/legal-moves";
import { applyMove } from "../domain/moves";
import { isSolved } from "../domain/solved";
import type { Board, Move } from "../domain/types";

interface SearchNode {
  board: Board;
  parentIndex: number | null;
  previousMove: Move | null;
}

interface QueueEntry {
  nodeIndex: number;
  cost: number;
  estimate: number;
  order: number;
}

/** Min-heap ordered by score, then insertion order to preserve A* ties. */
class SearchQueue {
  private readonly entries: QueueEntry[] = [];

  get length(): number {
    return this.entries.length;
  }

  push(entry: QueueEntry): void {
    const entries = this.entries;
    let index = entries.length;
    entries.push(entry);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      const parentEntry = entries[parent]!;
      if (!SearchQueue.less(entry, parentEntry)) break;
      entries[index] = parentEntry;
      index = parent;
    }
    entries[index] = entry;
  }

  pop(): QueueEntry | undefined {
    const entries = this.entries;
    const first = entries[0];
    const last = entries.pop();
    if (entries.length === 0 || last === undefined) return first;

    let index = 0;
    while (index * 2 + 1 < entries.length) {
      let child = index * 2 + 1;
      const right = child + 1;
      if (right < entries.length && SearchQueue.less(entries[right]!, entries[child]!)) {
        child = right;
      }
      if (!SearchQueue.less(entries[child]!, last)) break;
      entries[index] = entries[child]!;
      index = child;
    }
    entries[index] = last;
    return first;
  }

  private static less(left: QueueEntry, right: QueueEntry): boolean {
    return left.estimate < right.estimate
      || (left.estimate === right.estimate && left.order < right.order);
  }
}

export type HintSearchOutcome =
  | { status: "found"; boards: readonly Board[]; moves: readonly Move[]; exploredStateCount: number }
  | { status: "unsolvable"; exploredStateCount: number }
  | { status: "limit-reached"; exploredStateCount: number };

function estimateRemainingMoves(board: Board): number {
  let runs = 0;
  for (const vial of board) {
    if (vial.length === 0) continue;
    runs += 1;
    for (let index = 1; index < vial.length; index += 1) {
      if (vial[index] !== vial[index - 1]) runs += 1;
    }
  }
  return Math.max(0, runs - new Set(board.flat()).size);
}

function reconstruct(nodes: readonly SearchNode[], goalIndex: number): {
  boards: readonly Board[];
  moves: readonly Move[];
} {
  const boards: Board[] = [];
  const moves: Move[] = [];
  let index: number | null = goalIndex;
  while (index !== null) {
    const node: SearchNode | undefined = nodes[index];
    if (node === undefined) throw new Error("Broken hint search parent chain.");
    boards.push(node.board);
    if (node.previousMove !== null) moves.push(node.previousMove);
    index = node.parentIndex;
  }
  boards.reverse();
  moves.reverse();
  return {boards, moves};
}

export function searchForHintPath(
  initialBoard: Board,
  capacity: number,
  knownPolicyKeys: ReadonlySet<string>,
  maxExploredStates = 2_000_000,
): HintSearchOutcome {
  const nodes: SearchNode[] = [{board: initialBoard, parentIndex: null, previousMove: null}];
  const queue = new SearchQueue();
  queue.push({nodeIndex: 0, cost: 0, estimate: estimateRemainingMoves(initialBoard), order: 0});
  let nextOrder = 1;
  const bestCost = new Map<string, number>([[createCanonicalBoardKey(initialBoard), 0]]);
  let exploredStateCount = 0;

  while (queue.length > 0) {
    const entry = queue.pop();
    if (entry === undefined) break;
    const node = nodes[entry.nodeIndex];
    if (node === undefined) continue;

    const key = createCanonicalBoardKey(node.board);
    if (entry.cost > (bestCost.get(key) ?? Number.POSITIVE_INFINITY)) continue;
    exploredStateCount += 1;
    if (exploredStateCount > maxExploredStates) {
      return {status: "limit-reached", exploredStateCount};
    }

    if (
      isSolved(node.board, capacity)
      || (entry.nodeIndex !== 0 && knownPolicyKeys.has(key))
    ) {
      return {status: "found", ...reconstruct(nodes, entry.nodeIndex), exploredStateCount};
    }

    for (const move of getLegalMoves(node.board, capacity)) {
      const nextBoard = applyMove(node.board, move, capacity).nextBoard;
      const nextCost = entry.cost + 1;
      const nextKey = createCanonicalBoardKey(nextBoard);
      if ((bestCost.get(nextKey) ?? Number.POSITIVE_INFINITY) <= nextCost) continue;
      bestCost.set(nextKey, nextCost);
      const nodeIndex = nodes.length;
      nodes.push({board: nextBoard, parentIndex: entry.nodeIndex, previousMove: move});
      queue.push({
        nodeIndex,
        cost: nextCost,
        estimate: nextCost + estimateRemainingMoves(nextBoard),
        order: nextOrder++,
      });
    }
  }

  return {status: "unsolvable", exploredStateCount};
}
