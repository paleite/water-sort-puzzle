/// <reference lib="webworker" />

import type { Board } from "../domain/types";
import { findLastSolvableHistoryIndex, type RewindSearchResult } from "./rewind-search";

export interface RewindWorkerRequest {
  requestId: number;
  historyBoards: readonly Board[];
  capacity: number;
  knownPolicyKeys: readonly string[];
  knownUnsolvableKeys: readonly string[];
}

export type RewindWorkerResponse = RewindSearchResult & {requestId: number};

self.onmessage = (event: MessageEvent<RewindWorkerRequest>) => {
  const {requestId, historyBoards, capacity, knownPolicyKeys, knownUnsolvableKeys} = event.data;
  const outcome = findLastSolvableHistoryIndex(historyBoards, capacity, {
    knownPolicyKeys: new Set(knownPolicyKeys),
    knownUnsolvableKeys: new Set(knownUnsolvableKeys),
  });
  const response: RewindWorkerResponse = {...outcome, requestId};
  self.postMessage(response);
};
