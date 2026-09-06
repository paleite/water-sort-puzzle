import { createCanonicalBoardKey } from "../../src/lib/water-sort/domain/board";
import { getLegalMoves } from "../../src/lib/water-sort/domain/legal-moves";
import { applyMove } from "../../src/lib/water-sort/domain/moves";
import { isSolved } from "../../src/lib/water-sort/domain/solved";
import type { Board, Move } from "../../src/lib/water-sort/domain/types";

interface SearchNode {
  board: Board;
  costSoFar: number;
  parentNodeIndex: number | null;
  previousMove: Move | null;
}
interface QueueEntry {
  nodeIndex: number;
  estimatedTotalCost: number;
  insertionOrder: number;
}
export interface SolverResult {
  solution: readonly Move[];
  exploredStateCount: number;
  maximumBranchingFactor: number;
}

class MinHeap {
  private readonly values: QueueEntry[] = [];
  get size(): number { return this.values.length; }

  push(entry: QueueEntry): void {
    this.values.push(entry);
    let index = this.values.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.values[index]!, this.values[parentIndex]!) >= 0) break;
      [this.values[index], this.values[parentIndex]] =
        [this.values[parentIndex]!, this.values[index]!];
      index = parentIndex;
    }
  }

  pop(): QueueEntry | undefined {
    if (this.values.length === 0) return undefined;
    const first = this.values[0]!;
    const last = this.values.pop()!;
    if (this.values.length === 0) return first;
    this.values[0] = last;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (
        left < this.values.length &&
        this.compare(this.values[left]!, this.values[smallest]!) < 0
      ) smallest = left;
      if (
        right < this.values.length &&
        this.compare(this.values[right]!, this.values[smallest]!) < 0
      ) smallest = right;
      if (smallest === index) break;
      [this.values[index], this.values[smallest]] =
        [this.values[smallest]!, this.values[index]!];
      index = smallest;
    }
    return first;
  }

  private compare(a: QueueEntry, b: QueueEntry): number {
    return a.estimatedTotalCost !== b.estimatedTotalCost
      ? a.estimatedTotalCost - b.estimatedTotalCost
      : a.insertionOrder - b.insertionOrder;
  }
}

function countRuns(board: Board): number {
  let runs = 0;
  for (const vial of board) {
    if (vial.length === 0) continue;
    runs += 1;
    for (let i = 1; i < vial.length; i += 1) {
      if (vial[i] !== vial[i - 1]) runs += 1;
    }
  }
  return runs;
}

function estimateRemainingMoves(board: Board): number {
  return Math.max(0, countRuns(board) - new Set(board.flat()).size);
}

function reconstruct(nodes: readonly SearchNode[], goalIndex: number): readonly Move[] {
  const moves: Move[] = [];
  let index: number | null = goalIndex;
  while (index !== null) {
    const node: SearchNode | undefined = nodes[index];
    if (node === undefined) throw new Error("Broken A* parent chain.");
    if (node.previousMove !== null) moves.push(node.previousMove);
    index = node.parentNodeIndex;
  }
  return moves.reverse();
}

export function solveWithAStar(
  initialBoard: Board,
  capacity: number,
  maxExploredStates = 2_000_000,
): SolverResult | null {
  if (isSolved(initialBoard, capacity)) {
    return {solution: [], exploredStateCount: 0, maximumBranchingFactor: 0};
  }

  const nodes: SearchNode[] = [{
    board: initialBoard,
    costSoFar: 0,
    parentNodeIndex: null,
    previousMove: null,
  }];
  const queue = new MinHeap();
  let insertionOrder = 0;
  queue.push({
    nodeIndex: 0,
    estimatedTotalCost: estimateRemainingMoves(initialBoard),
    insertionOrder: insertionOrder++,
  });

  const bestCost = new Map<string, number>([
    [createCanonicalBoardKey(initialBoard), 0],
  ]);

  let exploredStateCount = 0;
  let maximumBranchingFactor = 0;

  while (queue.size > 0) {
    const entry = queue.pop();
    if (entry === undefined) break;
    const node = nodes[entry.nodeIndex];
    if (node === undefined) continue;

    const nodeKey = createCanonicalBoardKey(node.board);
    if (node.costSoFar > (bestCost.get(nodeKey) ?? Number.POSITIVE_INFINITY)) continue;

    exploredStateCount += 1;
    if (exploredStateCount > maxExploredStates) return null;

    if (isSolved(node.board, capacity)) {
      return {
        solution: reconstruct(nodes, entry.nodeIndex),
        exploredStateCount,
        maximumBranchingFactor,
      };
    }

    const legalMoves = getLegalMoves(node.board, capacity);
    maximumBranchingFactor = Math.max(maximumBranchingFactor, legalMoves.length);

    for (const move of legalMoves) {
      const nextBoard = applyMove(node.board, move, capacity).nextBoard;
      const nextCost = node.costSoFar + 1;
      const key = createCanonicalBoardKey(nextBoard);
      if ((bestCost.get(key) ?? Number.POSITIVE_INFINITY) <= nextCost) continue;

      bestCost.set(key, nextCost);
      const nodeIndex = nodes.length;
      nodes.push({
        board: nextBoard,
        costSoFar: nextCost,
        parentNodeIndex: entry.nodeIndex,
        previousMove: move,
      });
      queue.push({
        nodeIndex,
        estimatedTotalCost: nextCost + estimateRemainingMoves(nextBoard),
        insertionOrder: insertionOrder++,
      });
    }
  }

  return null;
}

export function verifySolution(
  initialBoard: Board,
  solution: readonly Move[],
  capacity: number,
): boolean {
  let board = initialBoard;
  try {
    for (const move of solution) board = applyMove(board, move, capacity).nextBoard;
  } catch {
    return false;
  }
  return isSolved(board, capacity);
}
