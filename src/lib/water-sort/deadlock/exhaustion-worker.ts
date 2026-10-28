/// <reference lib="webworker" />

import type { Board } from "../domain/types";
import { searchForFunctionalExhaustion, type ExhaustionSearchResult } from "./functional-exhaustion";

export interface ExhaustionWorkerRequest {
  requestId: number;
  boardKey: string;
  board: Board;
  capacity: number;
}

export type ExhaustionWorkerResponse = ExhaustionSearchResult & {
  requestId: number;
  boardKey: string;
};

self.onmessage = (event: MessageEvent<ExhaustionWorkerRequest>) => {
  const {requestId, boardKey, board, capacity} = event.data;
  const result = searchForFunctionalExhaustion(board, capacity);
  const response: ExhaustionWorkerResponse = {requestId, boardKey, ...result};
  self.postMessage(response);
};
