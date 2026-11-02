/// <reference lib="webworker" />

import type { Board } from "../domain/types";
import { findLastSolvableHistoryIndex, type RewindSearchResult } from "./rewind-search";

export interface RewindWorkerRequest {
  requestId: number;
  historyBoards: readonly Board[];
  capacity: number;
}

export type RewindWorkerResponse = RewindSearchResult & {requestId: number};

self.onmessage = (event: MessageEvent<RewindWorkerRequest>) => {
  const {requestId, historyBoards, capacity} = event.data;
  const outcome = findLastSolvableHistoryIndex(historyBoards, capacity);
  const response: RewindWorkerResponse = {...outcome, requestId};
  self.postMessage(response);
};
