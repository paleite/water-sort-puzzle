"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createCanonicalBoardKey } from "@/lib/water-sort/domain/board";
import type { Board } from "@/lib/water-sort/domain/types";
import { shouldSearchForExhaustion } from "@/lib/water-sort/deadlock/functional-exhaustion";
import type {
  ExhaustionWorkerRequest,
  ExhaustionWorkerResponse,
} from "@/lib/water-sort/deadlock/exhaustion-worker";

type DetectionStatus = "exhausted" | "playable" | "unknown";
type GamePhase = "idle" | "sourceSelected" | "presentingUndo" | "presentingRestart" | "completed";
const DEBOUNCE_MILLISECONDS = 250;
const WORKER_WATCHDOG_MILLISECONDS = 150;
const MAX_CACHED_STATES = 128;

export function useFunctionalExhaustion({
  board,
  capacity,
  phase,
  activePourCount,
  historyCount,
  hardDeadEnd,
  hintSearching,
}: {
  board: Board;
  capacity: number;
  phase: GamePhase;
  activePourCount: number;
  historyCount: number;
  hardDeadEnd: boolean;
  hintSearching: boolean;
}) {
  const boardKey = createCanonicalBoardKey(board);
  const [visiblePage, setVisiblePage] = useState(true);
  const [detected, setDetected] = useState<string | null>(null);
  const cacheRef = useRef(new Map<string, DetectionStatus>());
  const dismissedRef = useRef(new Set<string>());
  const requestIdRef = useRef(0);

  const ready = visiblePage && historyCount > 0 && activePourCount === 0
    && (phase === "idle" || phase === "sourceSelected")
    && !hardDeadEnd && !hintSearching;

  useEffect(() => {
    const onVisibilityChange = () => setVisiblePage(document.visibilityState === "visible");
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    if (!ready) return;
    if (dismissedRef.current.has(boardKey)) return;

    const cached = cacheRef.current.get(boardKey);
    if (cached !== undefined) {
      if (cached === "exhausted") setDetected(boardKey);
      return;
    }
    if (!shouldSearchForExhaustion(board, capacity)) return;

    let worker: Worker | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const debounce = setTimeout(() => {
      if (document.visibilityState !== "visible" || requestId !== requestIdRef.current) return;
      try {
        worker = new Worker(
          new URL("../lib/water-sort/deadlock/exhaustion-worker.ts", import.meta.url),
          {type: "module"},
        );
      } catch {
        return; // Detection is optional: fail open.
      }
      const runningWorker = worker;
      const stop = () => {
        if (watchdog !== null) clearTimeout(watchdog);
        runningWorker.terminate();
        if (worker === runningWorker) worker = null;
      };

      runningWorker.onmessage = (event: MessageEvent<ExhaustionWorkerResponse>) => {
        const response = event.data;
        if (response.requestId !== requestId || response.boardKey !== boardKey
          || requestIdRef.current !== requestId) return;
        stop();

        const cache = cacheRef.current;
        if (cache.size >= MAX_CACHED_STATES) {
          const first = cache.keys().next().value;
          if (first !== undefined) cache.delete(first);
        }
        cache.set(boardKey, response.status);
        if (response.status === "exhausted" && !dismissedRef.current.has(boardKey)) {
          setDetected(boardKey);
        }
      };
      runningWorker.onerror = () => stop(); // Never block gameplay on worker failures.

      const message: ExhaustionWorkerRequest = {requestId, boardKey, board, capacity};
      runningWorker.postMessage(message);
      watchdog = setTimeout(stop, WORKER_WATCHDOG_MILLISECONDS);
    }, DEBOUNCE_MILLISECONDS);

    return () => {
      clearTimeout(debounce);
      if (watchdog !== null) clearTimeout(watchdog);
      worker?.terminate();
      requestIdRef.current += 1;
    };
  }, [board, boardKey, capacity, ready]);

  const dismiss = useCallback(() => {
    dismissedRef.current.add(boardKey);
    setDetected(null);
  }, [boardKey]);

  return {exhausted: ready && detected === boardKey && !dismissedRef.current.has(boardKey), dismiss};
}
