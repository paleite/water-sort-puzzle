/// <reference lib="webworker" />

import type { Board } from "../domain/types";
import { searchForHintPath } from "./hint-search";

export interface HintWorkerRequest {
  requestId: number;
  board: Board;
  capacity: number;
  knownPolicyKeys: readonly string[];
}

export type HintWorkerResponse =
  | {requestId: number; status: "found"; boards: readonly Board[]; exploredStateCount: number}
  | {requestId: number; status: "unsolvable"; exploredStateCount: number}
  | {requestId: number; status: "limit-reached"; exploredStateCount: number};

self.onmessage = (event: MessageEvent<HintWorkerRequest>) => {
  const {requestId, board, capacity, knownPolicyKeys} = event.data;
  const outcome = searchForHintPath(board, capacity, new Set(knownPolicyKeys));
  const response: HintWorkerResponse = outcome.status === "found"
    ? {requestId, status: "found", boards: outcome.boards, exploredStateCount: outcome.exploredStateCount}
    : {requestId, status: outcome.status, exploredStateCount: outcome.exploredStateCount};
  self.postMessage(response);
};
