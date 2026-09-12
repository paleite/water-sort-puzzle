import type { AppliedMove } from "../domain/types";

export interface QueuedMovePresentation {
  id: number;
  move: AppliedMove;
}

export interface PresentationRuntimeState {
  started: boolean;
  contentCommitted: boolean;
}

export type PresentationDependency =
  | "none"
  | "content-committed"
  | "presentation-finished";

export function getPresentationDependency(
  candidate: QueuedMovePresentation,
  blocker: QueuedMovePresentation,
): PresentationDependency {
  if (blocker.id >= candidate.id) return "none";

  const candidateSource = candidate.move.move.sourceVialIndex;
  const candidateDestination = candidate.move.move.destinationVialIndex;
  const blockerSource = blocker.move.move.sourceVialIndex;
  const blockerDestination = blocker.move.move.destinationVialIndex;

  if (
    candidateSource === blockerSource
    || candidateDestination === blockerSource
  ) {
    return "presentation-finished";
  }

  if (candidateSource === blockerDestination) {
    return "content-committed";
  }

  return "none";
}

export function presentationIsReady(
  candidate: QueuedMovePresentation,
  activePresentations: readonly QueuedMovePresentation[],
  runtimes: ReadonlyMap<number, PresentationRuntimeState>,
): boolean {
  for (const blocker of activePresentations) {
    const dependency = getPresentationDependency(candidate, blocker);
    if (dependency === "none") continue;

    if (dependency === "presentation-finished") {
      return false;
    }

    const blockerRuntime = runtimes.get(blocker.id);
    if (blockerRuntime?.contentCommitted !== true) {
      return false;
    }
  }

  return true;
}

export function presentationHasQueuedFinishDependent(
  blocker: QueuedMovePresentation,
  activePresentations: readonly QueuedMovePresentation[],
  runtimes: ReadonlyMap<number, PresentationRuntimeState>,
): boolean {
  return activePresentations.some((candidate) => {
    const runtime = runtimes.get(candidate.id);
    return runtime !== undefined
      && !runtime.started
      && getPresentationDependency(candidate, blocker) === "presentation-finished";
  });
}
