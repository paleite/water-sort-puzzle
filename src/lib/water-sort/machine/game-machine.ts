import { assign, setup } from "xstate";

import { isDeadEnd } from "../domain/dead-end";
import { applyMove } from "../domain/moves";
import { isSolved } from "../domain/solved";
import type {
  AppliedMove,
  Board,
  InteractionResolution,
  Level,
} from "../domain/types";
import type { SavedGame } from "../persistence/progress";
import { resolveVialPress } from "./interaction";

export interface GameContext {
  level: Level;
  initialBoard: Board;
  board: Board;
  selectedSourceVialIndex: number | null;
  history: readonly AppliedMove[];
  activeMove: AppliedMove | null;
  activeUndo: AppliedMove | null;
  lastInteraction: InteractionResolution | null;
  isDeadEnd: boolean;
}

export type GameEvent =
  | {type: "VIAL.PRESSED"; vialIndex: number}
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
    canUndo: ({context}) => context.history.length > 0,
    activeMoveSolvesBoard: ({context}) =>
      context.activeMove !== null &&
      isSolved(context.activeMove.nextBoard, context.level.capacity),
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
        lastInteraction: resolution,
      };
    }),
    commitMove: assign(({context}) => {
      const activeMove = context.activeMove;
      if (activeMove === null) {
        throw new Error("MOVE.PRESENTATION_FINISHED without activeMove.");
      }
      return {
        board: activeMove.nextBoard,
        history: [...context.history, activeMove],
        activeMove: null,
        selectedSourceVialIndex: null,
        isDeadEnd: isDeadEnd(activeMove.nextBoard, context.level.capacity),
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
        selectedSourceVialIndex: null,
        isDeadEnd: isDeadEnd(activeUndo.previousBoard, context.level.capacity),
      };
    }),
    finishUndo: assign(() => ({activeUndo: null})),
    restart: assign(({context}) => ({
      board: context.initialBoard,
      history: [],
      activeMove: null,
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
                guard: "activeMoveSolvesBoard",
                target: "#waterSortGame.completed",
                actions: "commitMove",
              },
              {target: "idle", actions: "commitMove"},
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
