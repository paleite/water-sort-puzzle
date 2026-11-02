"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createCanonicalBoardKey } from "@/lib/water-sort/domain/board";
import type { AppliedTurn, Board } from "@/lib/water-sort/domain/types";
import type {
  RewindWorkerRequest,
  RewindWorkerResponse,
} from "@/lib/water-sort/recovery/rewind-worker";

export type RewindRecoveryStatus = "idle" | "searching" | "unavailable";
const SEARCH_WATCHDOG_MILLISECONDS = 15_000;

export function useSolvableRewind({
  board,
  history,
  capacity,
  onRewind,
}: {
  board: Board;
  history: readonly AppliedTurn[];
  capacity: number;
  onRewind: (historyIndex: number) => void;
}) {
  const boardKey = createCanonicalBoardKey(board);
  const [status, setStatus] = useState<RewindRecoveryStatus>("idle");
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const terminate = useCallback(() => {
    requestIdRef.current += 1;
    if (watchdogRef.current !== null) clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    terminate();
    setStatus("idle");
  }, [terminate]);

  useEffect(() => {
    setStatus("idle");
    return () => terminate();
  }, [boardKey, history.length, terminate]);

  const start = useCallback(() => {
    if (history.length === 0 || status === "searching") return;
    terminate();

    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../lib/water-sort/recovery/rewind-worker.ts", import.meta.url),
        {type: "module"},
      );
    } catch {
      setStatus("unavailable");
      return;
    }

    const requestId = ++requestIdRef.current;
    workerRef.current = worker;
    setStatus("searching");

    const fail = () => {
      if (requestId !== requestIdRef.current) return;
      terminate();
      setStatus("unavailable");
    };

    worker.onmessage = (event: MessageEvent<RewindWorkerResponse>) => {
      if (requestId !== requestIdRef.current || event.data.requestId !== requestId) return;
      const result = event.data;
      terminate();
      if (result.status !== "found") {
        setStatus("unavailable");
        return;
      }
      // The machine validates the index again and applies the rewind atomically.
      setStatus("idle");
      onRewind(result.historyIndex);
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
    watchdogRef.current = setTimeout(fail, SEARCH_WATCHDOG_MILLISECONDS);

    const request: RewindWorkerRequest = {
      requestId,
      historyBoards: history.map((turn) => turn.previousBoard),
      capacity,
    };
    try {
      worker.postMessage(request);
    } catch {
      fail();
    }
  }, [capacity, history, onRewind, status, terminate]);

  return {status, start, cancel};
}
