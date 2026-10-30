/// <reference lib="webworker" />

import type { Board } from "../domain/types";
import { searchForFunctionalExhaustion, type ExhaustionSearchResult } from "./functional-exhaustion";

export interface ExhaustionWorkerRequest {
  requestId: number;
  boardKey: string;
  board: Board;
  capacity: number;
}

export type ExhaustionWorkerResponse =
  | {type: "ready"}
  | (ExhaustionSearchResult & {
      type: "result";
      requestId: number;
      boardKey: string;
    });

self.onmessage = (event: MessageEvent<ExhaustionWorkerRequest>) => {
  const {requestId, boardKey, board, capacity} = event.data;
  const result = searchForFunctionalExhaustion(board, capacity);
  const response: ExhaustionWorkerResponse = {type: "result", requestId, boardKey, ...result};
  self.postMessage(response);
};

// Module loading and evaluation have finished; startup time must not count
// towards the short search execution watchdog on the main thread.
self.postMessage({type: "ready"} satisfies ExhaustionWorkerResponse);
