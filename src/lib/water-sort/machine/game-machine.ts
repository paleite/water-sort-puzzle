import { assign, setup } from "xstate";

import { isDeadEnd } from "../domain/dead-end";
import { applyMove } from "../domain/moves";
import { isSolved } from "../domain/solved";
import type {
  AppliedMove,
  AppliedTurn,
  Board,
  InteractionResolution,
  Level,
} from "../domain/types";
import type { SavedGame } from "../persistence/progress";
import { resolveVialPress } from "./interaction";

export interface ActiveMovePresentation {
  id: number;
  move: AppliedMove;
}

export interface GameContext {
  level: Level;
  initialBoard: Board;
  board: Board;
  selectedSourceVialIndex: number | null;
  history: readonly AppliedTurn[];
  activePresentations: readonly ActiveMovePresentation[];
  nextPresentationId: number;
  activeUndo: AppliedTurn | null;
  lastInteraction: InteractionResolution | null;
  isDeadEnd: boolean;
  completionPending: boolean;
}

export type GameEvent =
  | {type: "VIAL.PRESSED"; vialIndex: number}
  | {type: "PRESENTATION.FINISHED"; presentationId: number}
  | {type: "UNDO"}
  | {type: "UNDO.PRESENTATION_FINISHED"}
  | {type: "RESTART"}
  | {type: "RESTART.PRESENTATION_FINISHED"};

export interface GameMachineInput {
  level: Level;
  savedGame?: SavedGame;
}

function sourceIsBusy(context: GameContext, vialIndex: number): boolean {
  return context.activePresentations.some(({move}) =>
    move.move.sourceVialIndex === vialIndex || move.move.destinationVialIndex === vialIndex
  );
}

function destinationIsBusy(context: GameContext, vialIndex: number): boolean {
  return context.activePresentations.some(({move}) => move.move.sourceVialIndex === vialIndex);
}

function resolvePress(context: GameContext, event: GameEvent): InteractionResolution | null {
  if (event.type !== "VIAL.PRESSED" || context.completionPending) return null;

  if (context.selectedSourceVialIndex === null) {
    if (sourceIsBusy(context, event.vialIndex)) return null;
  } else if (
    event.vialIndex !== context.selectedSourceVialIndex
    && destinationIsBusy(context, event.vialIndex)
  ) {
    return null;
  }

  return resolveVialPress(
    context.board,
    context.selectedSourceVialIndex,
    event.vialIndex,
    context.level.capacity,
  );
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
    canUndo: ({context}) =>
      context.history.length > 0 && context.activePresentations.length === 0,
    finishingLastSolvedPresentation: ({context, event}) =>
      event.type === "PRESENTATION.FINISHED"
      && context.completionPending
      && context.activePresentations.length === 1
      && context.activePresentations[0]?.id === event.presentationId,
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
    commitMoveAndStartPresentation: assign(({context, event}) => {
      const resolution = resolvePress(context, event);
      if (resolution?.type !== "move") {
        throw new Error("commitMoveAndStartPresentation received a non-move interaction.");
      }

      const appliedMove = applyMove(context.board, resolution.move, context.level.capacity);
      const presentationId = context.nextPresentationId;
      const nextBoard = appliedMove.nextBoard;

      return {
        board: nextBoard,
        history: [...context.history, appliedMove],
        activePresentations: [
          ...context.activePresentations,
          {id: presentationId, move: appliedMove},
        ],
        nextPresentationId: presentationId + 1,
        selectedSourceVialIndex: null,
        lastInteraction: resolution,
        isDeadEnd: isDeadEnd(nextBoard, context.level.capacity),
        completionPending: isSolved(nextBoard, context.level.capacity),
      };
    }),
    finishPresentation: assign(({context, event}) => {
      if (event.type !== "PRESENTATION.FINISHED") return {};
      return {
        activePresentations: context.activePresentations.filter(
          (presentation) => presentation.id !== event.presentationId,
        ),
      };
    }),
    prepareUndo: assign(({context}) => {
      const activeUndo = context.history.at(-1);
      if (activeUndo === undefined) return {};
      return {
        board: activeUndo.previousBoard,
        history: context.history.slice(0, -1),
        activeUndo,
        selectedSourceVialIndex: null,
        completionPending: false,
        isDeadEnd: isDeadEnd(activeUndo.previousBoard, context.level.capacity),
      };
    }),
    finishUndo: assign(() => ({activeUndo: null})),
    restart: assign(({context}) => ({
      board: context.initialBoard,
      history: [],
      activePresentations: [],
      activeUndo: null,
      selectedSourceVialIndex: null,
      lastInteraction: null,
      isDeadEnd: isDeadEnd(context.initialBoard, context.level.capacity),
      completionPending: false,
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
      activePresentations: [],
      nextPresentationId: 1,
      activeUndo: null,
      lastInteraction: null,
      isDeadEnd: isDeadEnd(board, input.level.capacity),
      completionPending: false,
    };
  },
  initial: "playing",
  states: {
    playing: {
      initial: "idle",
      on: {
        "PRESENTATION.FINISHED": [
          {
            guard: "finishingLastSolvedPresentation",
            target: "#waterSortGame.completed",
            actions: "finishPresentation",
          },
          {actions: "finishPresentation"},
        ],
      },
      states: {
        idle: {
          on: {
            "VIAL.PRESSED": [
              {guard: "pressSelectsSource", target: "sourceSelected", actions: "selectSource"},
              {actions: "recordNonMoveInteraction"},
            ],
            UNDO: {guard: "canUndo", target: "presentingUndo", actions: "prepareUndo"},
            RESTART: {target: "presentingRestart", actions: "restart"},
          },
        },
        sourceSelected: {
          on: {
            "VIAL.PRESSED": [
              {guard: "pressUnselectsSource", target: "idle", actions: "unselectSource"},
              {
                guard: "pressCreatesMove",
                target: "idle",
                actions: "commitMoveAndStartPresentation",
              },
              {actions: "recordNonMoveInteraction"},
            ],
            UNDO: {guard: "canUndo", target: "presentingUndo", actions: "prepareUndo"},
            RESTART: {target: "presentingRestart", actions: "restart"},
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
