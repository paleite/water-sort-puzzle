"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createCanonicalBoardKey } from "@/lib/water-sort/domain/board";
import type { Board, Move } from "@/lib/water-sort/domain/types";
import {
  mergeHintPath,
  resolveHintMove,
  type HintPolicy,
} from "@/lib/water-sort/hints/hint-policy";
import type {
  HintWorkerRequest,
  HintWorkerResponse,
} from "@/lib/water-sort/hints/hint-worker";

export type HintState =
  | {status: "idle"}
  | {status: "searching"; slow: boolean}
  | {status: "showing"; move: Move}
  | {status: "unsolvable"}
  | {status: "limit-reached"}
  | {status: "error"};

export function useWaterSortHints(
  board: Board,
  capacity: number,
  initialHintPath: readonly string[] = [],
) {
  const [state, setState] = useState<HintState>({status: "idle"});
  const policyRef = useRef<HintPolicy>(new Map(
    initialHintPath.slice(0, -1).map((key, index) => [key, initialHintPath[index + 1]!] as const),
  ));
  const unsolvableKeysRef = useRef(new Set<string>());
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardKey = createCanonicalBoardKey(board);

  const clearSlowTimer = useCallback(() => {
    if (slowTimerRef.current !== null) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    clearSlowTimer();
    workerRef.current?.terminate();
    workerRef.current = null;
    setState({status: "idle"});
  }, [clearSlowTimer]);

  useEffect(() => {
    cancel();
    return () => cancel();
  }, [boardKey, cancel]);

  const requestHint = useCallback(() => {
    const currentKey = createCanonicalBoardKey(board);
    if (unsolvableKeysRef.current.has(currentKey)) {
      setState({status: "unsolvable"});
      return;
    }

    const nextKey = policyRef.current.get(currentKey);
    if (nextKey !== undefined) {
      const move = resolveHintMove(board, capacity, nextKey);
      if (move !== null) {
        setState({status: "showing", move});
        return;
      }
      policyRef.current.delete(currentKey);
    }

    cancel();
    const requestId = ++requestIdRef.current;
    const worker = new Worker(
      new URL("../lib/water-sort/hints/hint-worker.ts", import.meta.url),
      {type: "module"},
    );
    workerRef.current = worker;
    setState({status: "searching", slow: false});
    slowTimerRef.current = setTimeout(() => {
      if (requestIdRef.current === requestId) {
        setState((current) =>
          current.status === "searching"
            ? {status: "searching", slow: true}
            : current,
        );
      }
    }, 2_000);

    worker.onmessage = (event: MessageEvent<HintWorkerResponse>) => {
      if (event.data.requestId !== requestId || requestIdRef.current !== requestId) return;
      clearSlowTimer();
      worker.terminate();
      workerRef.current = null;

      if (event.data.status === "unsolvable") {
        unsolvableKeysRef.current.add(currentKey);
        setState({status: "unsolvable"});
        return;
      }
      if (event.data.status === "limit-reached") {
        setState({status: "limit-reached"});
        return;
      }

      mergeHintPath(policyRef.current, event.data.boards);
      const resolvedNextKey = policyRef.current.get(currentKey);
      const move = resolvedNextKey === undefined
        ? null
        : resolveHintMove(board, capacity, resolvedNextKey);
      setState(move === null ? {status: "error"} : {status: "showing", move});
    };

    worker.onerror = () => {
      if (requestIdRef.current !== requestId) return;
      clearSlowTimer();
      worker.terminate();
      workerRef.current = null;
      setState({status: "error"});
    };

    const request: HintWorkerRequest = {
      requestId,
      board,
      capacity,
      knownPolicyKeys: [...policyRef.current.keys()],
    };
    worker.postMessage(request);
  }, [board, cancel, capacity, clearSlowTimer]);

  const dismiss = useCallback(() => setState({status: "idle"}), []);

  return {state, requestHint, cancel, dismiss};
}
