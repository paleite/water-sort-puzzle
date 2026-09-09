import { assign, setup } from "xstate";

import { isDeadEnd } from "../domain/dead-end";
import { applyMove } from "../domain/moves";
import {
  applyPourBatch,
  canApplyPourBatch,
} from "../domain/pour-batch";
import { isSolved } from "../domain/solved";
import type {
  AppliedMove,
  AppliedPourBatch,
  AppliedTurn,
  Board,
  InteractionResolution,
  Level,
  Move,
} from "../domain/types";
import type { SavedGame } from "../persistence/progress";
import { resolveVialPress } from "./interaction";

export interface GameContext {
  level: Level;
  initialBoard: Board;
  board: Board;
  selectedSourceVialIndex: number | null;
  history: readonly AppliedTurn[];
  activeMove: AppliedMove | null;
  activeBatch: AppliedPourBatch | null;
  activeUndo: AppliedTurn | null;
  lastInteraction: InteractionResolution | null;
  isDeadEnd: boolean;
}

export type GameEvent =
  | {type: "VIAL.PRESSED"; vialIndex: number}
  | {
      type: "POUR_BATCH.REQUESTED";
      sourceVialIndices: readonly number[];
      destinationVialIndex: number;
    }
  | {type: "MOVE.PRESENTATION_FINISHED"}
  | {type: "UNDO"}
  | {type: "UNDO.PRESENTATION_FINISHED"}
  | {type: "RESTART"}
  | {type: "RESTART.PRESENTATION_FINISHED"};

export interface GameMachineInput {
  level: Level;
  savedGame?: SavedGame;
}

function resolvePress(context: GameContext, event: GameEvent): InteractionResolution | null {
  if (event.type !== "VIAL.PRESSED") return null;
  return resolveVialPress(
    context.board,
    context.selectedSourceVialIndex,
    event.vialIndex,
    context.level.capacity,
  );
}

function requestedBatchMoves(event: GameEvent): readonly Move[] | null {
  if (event.type !== "POUR_BATCH.REQUESTED") return null;
  return event.sourceVialIndices.map((sourceVialIndex) => ({
    sourceVialIndex,
    destinationVialIndex: event.destinationVialIndex,
  }));
}

function activePresentationBoard(context: GameContext): Board | null {
  return context.activeBatch?.nextBoard ?? context.activeMove?.nextBoard ?? null;
}

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    input: {} as GameMachineInput,
  },
  guards: {
    pressSelectsSource: ({context, event}) =>
      resolvePress(context, event)?.type === "source-selected",
    pressUnselectsSource: ({context, event}) =>
      resolvePress(context, event)?.type === "source-unselected",
    pressCreatesMove: ({context, event}) =>
      resolvePress(context, event)?.type === "move",
    requestedBatchIsLegal: ({context, event}) => {
      const moves = requestedBatchMoves(event);
      return moves !== null && canApplyPourBatch(context.board, moves, context.level.capacity);
    },
    canUndo: ({context}) => context.history.length > 0,
    activePresentationSolvesBoard: ({context}) => {
      const nextBoard = activePresentationBoard(context);
      return nextBoard !== null && isSolved(nextBoard, context.level.capacity);
    },
  },
  actions: {
    selectSource: assign(({context, event}) => {
      const resolution = resolvePress(context, event);
      if (resolution?.type !== "source-selected") return {};
      return {
        selectedSourceVialIndex: resolution.vialIndex,
        lastInteraction: resolution,
      };
    }),
    unselectSource: assign(() => ({
      selectedSourceVialIndex: null,
      lastInteraction: {type: "source-unselected"} as const,
    })),
    recordNonMoveInteraction: assign(({context, event}) => ({
      lastInteraction: resolvePress(context, event) ?? context.lastInteraction,
    })),
    prepareMove: assign(({context, event}) => {
      const resolution = resolvePress(context, event);
      if (resolution?.type !== "move") {
        throw new Error("prepareMove received a non-move interaction.");
      }
      return {
        activeMove: applyMove(context.board, resolution.move, context.level.capacity),
        activeBatch: null,
        lastInteraction: resolution,
      };
    }),
    prepareBatch: assign(({context, event}) => {
      const moves = requestedBatchMoves(event);
      if (moves === null) {
        throw new Error("prepareBatch received a non-batch event.");
      }
      return {
        activeBatch: applyPourBatch(context.board, moves, context.level.capacity),
        activeMove: null,
        selectedSourceVialIndex: null,
      };
    }),
    commitPresentation: assign(({context}) => {
      const activeTurn: AppliedTurn | null = context.activeBatch ?? context.activeMove;
      if (activeTurn === null) {
        throw new Error("MOVE.PRESENTATION_FINISHED without an active presentation.");
      }
      return {
        board: activeTurn.nextBoard,
        history: [...context.history, activeTurn],
        activeMove: null,
        activeBatch: null,
        selectedSourceVialIndex: null,
        isDeadEnd: isDeadEnd(activeTurn.nextBoard, context.level.capacity),
      };
    }),
    prepareUndo: assign(({context}) => {
      const activeUndo = context.history.at(-1);
      if (activeUndo === undefined) return {};
      return {
        board: activeUndo.previousBoard,
        history: context.history.slice(0, -1),
        activeUndo,
        activeMove: null,
        activeBatch: null,
        selectedSourceVialIndex: null,
        isDeadEnd: isDeadEnd(activeUndo.previousBoard, context.level.capacity),
      };
    }),
    finishUndo: assign(() => ({activeUndo: null})),
    restart: assign(({context}) => ({
      board: context.initialBoard,
      history: [],
      activeMove: null,
      activeBatch: null,
      activeUndo: null,
      selectedSourceVialIndex: null,
      lastInteraction: null,
      isDeadEnd: isDeadEnd(context.initialBoard, context.level.capacity),
    })),
  },
}).createMachine({
  id: "waterSortGame",
  context: ({input}) => {
    const restore = input.savedGame?.levelId === input.level.id ? input.savedGame : undefined;
    const board = restore?.board ?? input.level.board;
    const history = restore?.history ?? [];
    return {
      level: input.level,
      initialBoard: input.level.board,
      board,
      selectedSourceVialIndex: null,
      history,
      activeMove: null,
      activeBatch: null,
      activeUndo: null,
      lastInteraction: null,
      isDeadEnd: isDeadEnd(board, input.level.capacity),
    };
  },
  initial: "playing",
  states: {
    playing: {
      initial: "idle",
      states: {
        idle: {
          on: {
            "VIAL.PRESSED": [
              {guard: "pressSelectsSource", target: "sourceSelected", actions: "selectSource"},
              {actions: "recordNonMoveInteraction"},
            ],
            "POUR_BATCH.REQUESTED": {
              guard: "requestedBatchIsLegal",
              target: "presentingMove",
              actions: "prepareBatch",
            },
            UNDO: {guard: "canUndo", target: "presentingUndo", actions: "prepareUndo"},
            RESTART: {target: "presentingRestart", actions: "restart"},
          },
        },
        sourceSelected: {
          on: {
            "VIAL.PRESSED": [
              {guard: "pressUnselectsSource", target: "idle", actions: "unselectSource"},
              {guard: "pressCreatesMove", target: "presentingMove", actions: "prepareMove"},
              {actions: "recordNonMoveInteraction"},
            ],
            UNDO: {guard: "canUndo", target: "presentingUndo", actions: "prepareUndo"},
            RESTART: {target: "presentingRestart", actions: "restart"},
          },
        },
        presentingMove: {
          on: {
            "MOVE.PRESENTATION_FINISHED": [
              {
                guard: "activePresentationSolvesBoard",
                target: "#waterSortGame.completed",
                actions: "commitPresentation",
              },
              {target: "idle", actions: "commitPresentation"},
            ],
          },
        },
        presentingUndo: {
          on: {
            "UNDO.PRESENTATION_FINISHED": {target: "idle", actions: "finishUndo"},
          },
        },
        presentingRestart: {
          on: {
            "RESTART.PRESENTATION_FINISHED": {target: "idle"},
          },
        },
      },
    },
    completed: {
      on: {
        RESTART: {
          target: "#waterSortGame.playing.presentingRestart",
          actions: "restart",
        },
      },
    },
  },
});
