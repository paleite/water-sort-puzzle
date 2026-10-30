"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createCanonicalBoardKey } from "@/lib/water-sort/domain/board";
import type { Board } from "@/lib/water-sort/domain/types";
import { createRunLayoutKey, shouldSearchForExhaustion } from "@/lib/water-sort/deadlock/functional-exhaustion";
import type {
  ExhaustionWorkerRequest,
  ExhaustionWorkerResponse,
} from "@/lib/water-sort/deadlock/exhaustion-worker";

type DetectionStatus = "exhausted" | "playable" | "unknown";
type GamePhase = "idle" | "sourceSelected" | "presentingUndo" | "presentingRestart" | "completed";
const DEBOUNCE_MILLISECONDS = 250;
const WORKER_STARTUP_TIMEOUT_MILLISECONDS = 3_000;
const WORKER_SEARCH_WATCHDOG_MILLISECONDS = 150;
const FAILURE_RETRY_COOLDOWN_MILLISECONDS = 10_000;
const MAX_CACHED_STATES = 128;

function debugExhaustion(event: string, details?: unknown): void {
  if (process.env.NODE_ENV !== "production") {
    console.debug("[functional-exhaustion]", event, details);
  }
}

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
  const layoutKey = createRunLayoutKey(board);
  const [visiblePage, setVisiblePage] = useState(true);
  const [detected, setDetected] = useState<string | null>(null);
  const cacheRef = useRef(new Map<string, DetectionStatus>());
  const dismissedLayoutsRef = useRef(new Set<string>());
  const requestIdRef = useRef(0);
  const retryNotBeforeRef = useRef(0);

  const ready = visiblePage && historyCount > 0 && activePourCount === 0
    && phase === "idle"
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
    if (dismissedLayoutsRef.current.has(layoutKey)) return;

    const cached = cacheRef.current.get(boardKey);
    if (cached !== undefined) {
      debugExhaustion("cached", {status: cached});
      if (cached === "exhausted") setDetected(boardKey);
      return;
    }
    if (Date.now() < retryNotBeforeRef.current) {
      debugExhaustion("temporary-backoff");
      return;
    }
    if (!shouldSearchForExhaustion(board, capacity)) {
      debugExhaustion("preflight-skipped");
      return;
    }

    let worker: Worker | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const debounce = setTimeout(() => {
      if (document.visibilityState !== "visible" || requestId !== requestIdRef.current) return;
      if (Date.now() < retryNotBeforeRef.current) return;

      try {
        worker = new Worker(
          new URL("../lib/water-sort/deadlock/exhaustion-worker.ts", import.meta.url),
          {type: "module"},
        );
      } catch (error) {
        retryNotBeforeRef.current = Date.now() + FAILURE_RETRY_COOLDOWN_MILLISECONDS;
        debugExhaustion("worker-construction-failed", error);
        return; // Detection must never block gameplay.
      }

      const runningWorker = worker;
      let stopped = false;
      let searchStarted = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        if (watchdog !== null) clearTimeout(watchdog);
        runningWorker.terminate();
        if (worker === runningWorker) worker = null;
      };
      const fail = (reason: string, detail?: unknown) => {
        if (stopped) return;
        // Do not permanently cache transient worker failures as "unknown".
        // A short global backoff avoids retry loops on devices where workers fail.
        if (requestId === requestIdRef.current) {
          retryNotBeforeRef.current = Date.now() + FAILURE_RETRY_COOLDOWN_MILLISECONDS;
        }
        debugExhaustion(reason, detail);
        stop();
      };

      runningWorker.onmessage = (event: MessageEvent<ExhaustionWorkerResponse>) => {
        if (stopped || requestId !== requestIdRef.current) return;
        const response = event.data;
        if (response.type === "ready") {
          if (searchStarted) return;
          searchStarted = true;
          if (watchdog !== null) clearTimeout(watchdog);
          debugExhaustion("worker-ready");
          // Count only search execution/response time, not module loading.
          watchdog = setTimeout(
            () => fail("search-watchdog-timeout"),
            WORKER_SEARCH_WATCHDOG_MILLISECONDS,
          );
          const message: ExhaustionWorkerRequest = {requestId, boardKey, board, capacity};
          try {
            runningWorker.postMessage(message);
          } catch (error) {
            fail("worker-post-message-failed", error);
          }
          return;
        }

        if (!searchStarted || response.requestId !== requestId || response.boardKey !== boardKey) {
          return;
        }
        stop();

        const cache = cacheRef.current;
        if (cache.size >= MAX_CACHED_STATES) {
          const first = cache.keys().next().value;
          if (first !== undefined) cache.delete(first);
        }
        cache.set(boardKey, response.status);
        debugExhaustion("search-complete", {
          status: response.status,
          exploredStateCount: response.exploredStateCount,
        });
        if (response.status === "exhausted" && !dismissedLayoutsRef.current.has(layoutKey)) {
          setDetected(boardKey);
        }
      };
      runningWorker.onerror = (error) => fail("worker-error", error.message);
      runningWorker.onmessageerror = () => fail("worker-message-error");

      // A separate, longer startup limit prevents a broken worker from
      // remaining alive indefinitely without penalizing slow module loading.
      watchdog = setTimeout(
        () => fail("worker-startup-timeout"),
        WORKER_STARTUP_TIMEOUT_MILLISECONDS,
      );
      debugExhaustion("worker-starting");
    }, DEBOUNCE_MILLISECONDS);

    return () => {
      clearTimeout(debounce);
      if (watchdog !== null) clearTimeout(watchdog);
      worker?.terminate();
      requestIdRef.current += 1;
    };
  }, [board, boardKey, layoutKey, capacity, ready]);

  const dismiss = useCallback(() => {
    // Suppress repeated warnings throughout this same reversible loop.
    dismissedLayoutsRef.current.add(layoutKey);
    setDetected(null);
  }, [layoutKey]);

  return {exhausted: ready && detected === boardKey && !dismissedLayoutsRef.current.has(layoutKey), dismiss};
}
