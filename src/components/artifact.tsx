import React, { useCallback, useEffect, useRef, useState } from "react";

// import Image from "next/image";
import { ArrowRight, Award, RefreshCw, Undo } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { isDev } from "@/lib/env";
import { useGameStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// import Game from "./background/game.jpg";

// Game constants
const VIAL_COUNT = 14;
const COLORS_PER_VIAL = 4;
const EMPTY_VIALS = 2;
const FILLED_VIALS = VIAL_COUNT - EMPTY_VIALS;
const MAX_GENERATION_ATTEMPTS = 10;
const GENERATION_TIMEOUT_MS = 10000;

// Define types
type Vial = string[]; // A vial is an array of colors (strings)
type VialState = Vial[]; // The game state is an array of vials

// Game state enum
const GAME_STATE = {
  INITIALIZING: "initializing",
  READY: "ready",
  PLAYING: "playing",
  WIN: "win",
  ERROR: "error",
} as const;

type GameStateType = (typeof GAME_STATE)[keyof typeof GAME_STATE];

// Define colors for our liquid layers (12 distinct colors with improved contrast)
const COLORS = [
  "#FF3030", // bright red
  "#3AE12E", // lime green
  "#347BFF", // bright blue
  "#FFD700", // gold
  "#E02DF3", // magenta
  "#FF7F00", // orange
  "#964B00", // brown
  "#00FFFF", // cyan
  "#FF1493", // deep pink
  "#48D1CC", // turquoise
  "#ADFF2F", // yellow-green
  "#9966FF", // purple
] as const;

const EMOJIS = {
  "#FF3030": "😀", // grinning face
  "#3AE12E": "🚀", // rocket
  "#347BFF": "🐶", // dog
  "#FFD700": "🏀", // basketball
  "#E02DF3": "🎸", // guitar
  "#FF7F00": "📚", // books
  "#964B00": "⚡", // high voltage
  "#00FFFF": "🛸", // flying saucer
  "#FF1493": "🎨", // palette
  "#48D1CC": "🌍", // globe
  "#ADFF2F": "🍕", // pizza
  "#9966FF": "⏰", // alarm clock
  // 11: "⏰", // alarm clock
  // 12: "🎲", // game die
  // 13: "💡", // light bulb
} as const;

// Simple seeded random number generator for deterministic level generation
class SeededRandom {
  seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Random number between 0 and 1 (exclusive)
  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  // Random integer between min (inclusive) and max (exclusive)
  nextInt(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min));
  }

  // Randomly shuffle an array using Fisher-Yates algorithm
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      // Ensure we're within bounds to satisfy TypeScript
      if (i < result.length && j < result.length) {
        // Use a different approach to avoid type errors with possible undefined
        const itemI = result[i];
        const itemJ = result[j];

        if (itemI !== undefined && itemJ !== undefined) {
          result[i] = itemJ;
          result[j] = itemI;
        }
      }
    }
    return result;
  }
}

// =================== PURE FUNCTIONS ===================

/**
 * Check if the puzzle is solved
 */
function isSolvedState(vialState: VialState): boolean {
  // Count how many vials are properly sorted (single color or empty)
  let sortedVials = 0;

  for (const vial of vialState) {
    if (vial.length === 0) {
      // Empty vials count as sorted
      sortedVials++;
    } else if (vial.length === COLORS_PER_VIAL) {
      // Check if all colors in this vial are the same
      const [firstColor] = vial;
      const allSameColor = vial.every((color) => color === firstColor);

      if (allSameColor) {
        sortedVials++;
      }
    }
  }

  // A puzzle is solved when all vials are sorted
  return sortedVials === VIAL_COUNT;
}

/**
 * Validate that a vial state has correct color counts and is solvable
 */
function validateVials(vialState: VialState): boolean {
  // Count colors
  const colorCounts: Record<string, number> = {};
  let totalSegments = 0;

  vialState.forEach((vial) => {
    vial.forEach((color) => {
      colorCounts[color] = (colorCounts[color] ?? 0) + 1;
      totalSegments++;
    });
  });

  // Check total segments
  if (totalSegments !== FILLED_VIALS * COLORS_PER_VIAL) {
    return false;
  }

  // Check each color has exactly 4 segments
  for (const color in colorCounts) {
    if (colorCounts[color] !== COLORS_PER_VIAL) {
      return false;
    }
  }

  // Check that it's not already sorted
  // Count how many vials are already single-color or empty
  let sortedVialCount = 0;
  vialState.forEach((vial) => {
    if (vial.length === 0) {
      sortedVialCount++;
    } else if (vial.length === COLORS_PER_VIAL) {
      // Check if all elements in this vial are the same
      if (vial.every((color) => color === vial[0])) {
        sortedVialCount++;
      }
    }
  });

  // If all vials are sorted, the puzzle is already solved - we don't want that
  // But allow some sorted vials (up to 4) to make the puzzle easier to understand
  if (sortedVialCount === VIAL_COUNT) {
    return false;
  }

  return true;
}

/**
 * Check if a move is valid
 */
function isValidMove(
  fromIndex: number,
  toIndex: number,
  vialState: VialState,
): boolean {
  // Check valid indices
  if (
    fromIndex < 0 ||
    fromIndex >= vialState.length ||
    toIndex < 0 ||
    toIndex >= vialState.length
  ) {
    return false;
  }

  const fromVial = vialState[fromIndex];
  const toVial = vialState[toIndex];

  if (!fromVial || !toVial) {
    return false;
  }

  // Can't move from an empty vial
  if (fromVial.length === 0) {
    return false;
  }

  // Can't move to a full vial
  if (toVial.length >= COLORS_PER_VIAL) {
    return false;
  }

  // Can move to an empty vial
  if (toVial.length === 0) {
    return true;
  }

  // Check if the top colors match
  const fromColor = fromVial[fromVial.length - 1];
  const toColor = toVial[toVial.length - 1];

  if (fromColor === undefined || toColor === undefined) {
    return false;
  }

  return fromColor === toColor;
}

/**
 * Execute a move between vials (pour liquid)
 * Returns a new vial state or null if the move is invalid
 */
function executeMove(
  fromIndex: number,
  toIndex: number,
  vialState: VialState,
): VialState | null {
  if (!isValidMove(fromIndex, toIndex, vialState)) {
    return null;
  }

  // Create a deep copy of vials
  const newVialState = JSON.parse(JSON.stringify(vialState)) as VialState;

  // Check indices are valid
  if (
    fromIndex < 0 ||
    fromIndex >= newVialState.length ||
    toIndex < 0 ||
    toIndex >= newVialState.length
  ) {
    return null;
  }

  const fromVial = newVialState[fromIndex];
  const toVial = newVialState[toIndex];

  if (!fromVial || !toVial || fromVial.length === 0) {
    return null;
  }

  // Get the color to move
  const colorToMove = fromVial[fromVial.length - 1];
  if (colorToMove === undefined) {
    return null;
  }

  // Count consecutive same colors from top
  let colorCount = 0;
  for (let i = fromVial.length - 1; i >= 0; i--) {
    if (fromVial[i] === colorToMove) {
      colorCount++;
    } else {
      break;
    }
  }

  // Calculate how many can be moved (limited by space in destination)
  const maxAccept = COLORS_PER_VIAL - toVial.length;
  const countToMove = Math.min(colorCount, maxAccept);

  // Execute the move
  const colorsToMove = fromVial.splice(fromVial.length - countToMove);
  toVial.push(...colorsToMove);

  return newVialState;
}

/**
 * Generate a scrambled puzzle state using a deterministic approach with level as seed
 */
function generatePuzzle(level: number, attempts: number = 0): VialState | null {
  // Check for too many attempts
  if (attempts >= MAX_GENERATION_ATTEMPTS) {
    return null;
  }

  // Create a seeded random generator for deterministic generation
  const random = new SeededRandom(level);

  // Create a pool of all color segments we need
  const colorPool: string[] = [];
  for (let i = 0; i < FILLED_VIALS; i++) {
    // Different levels can have slightly different color sets
    // This creates a sense of progression
    const colorOffset = Math.floor(level / 5) % COLORS.length; // Change colors every 5 levels
    const colorIndex = (i + colorOffset) % COLORS.length;

    // Add 4 of each color to the pool
    for (let j = 0; j < COLORS_PER_VIAL; j++) {
      // Make sure we have a valid index
      if (colorIndex >= 0 && colorIndex < COLORS.length) {
        const color = COLORS[colorIndex];
        if (color !== undefined) {
          colorPool.push(color);
        }
      }
    }
  }

  // Shuffle the color pool using our seeded random generator
  const shuffledColors = random.shuffle(colorPool);

  // Create a puzzle with distributed colors
  const scrambledState: VialState = [];

  // Fill the first 12 vials with random colors from our pool
  for (let i = 0; i < FILLED_VIALS; i++) {
    const vial: Vial = [];
    for (let j = 0; j < COLORS_PER_VIAL; j++) {
      // Get a color from our shuffled pool
      if (shuffledColors.length > 0) {
        const color = shuffledColors.pop();
        if (color !== undefined) {
          vial.push(color);
        }
      }
    }
    scrambledState.push(vial);
  }

  // Add the empty vials
  for (let i = 0; i < EMPTY_VIALS; i++) {
    scrambledState.push([]);
  }

  // For higher levels, add an additional challenge: perform more shuffling operations
  // The higher the level, the more complex the puzzle
  if (level > 1) {
    const additionalShuffles = Math.min(Math.floor(level / 2), 10); // Cap at 10 extra shuffles

    for (let i = 0; i < additionalShuffles; i++) {
      // Find vials with some space and some content
      const validSourceVials = scrambledState
        .map((vial, index) => ({ vial, index }))
        .filter(({ vial }) => vial.length > 0);

      const validTargetVials = scrambledState
        .map((vial, index) => ({ vial, index }))
        .filter(({ vial }) => vial.length < COLORS_PER_VIAL);

      if (validSourceVials.length > 0 && validTargetVials.length > 0) {
        // Select random source and target
        const sourceIndex = random.nextInt(0, validSourceVials.length);
        const targetIndex = random.nextInt(0, validTargetVials.length);

        // Check if indices are valid
        if (
          sourceIndex >= 0 &&
          sourceIndex < validSourceVials.length &&
          targetIndex >= 0 &&
          targetIndex < validTargetVials.length
        ) {
          const source = validSourceVials[sourceIndex];
          const target = validTargetVials[targetIndex];

          if (source && target && source.index !== target.index) {
            // Check if the source vial exists in scrambledState
            if (
              source.index >= 0 &&
              source.index < scrambledState.length &&
              target.index >= 0 &&
              target.index < scrambledState.length
            ) {
              // Take one color from source and add to target
              const sourceVial = scrambledState[source.index];
              const targetVial = scrambledState[target.index];

              if (sourceVial && sourceVial.length > 0) {
                const color = sourceVial.pop();
                if (color && targetVial) {
                  targetVial.push(color);
                }
              }
            }
          }
        }
      }
    }
  }

  // Verify the scrambled state isn't already solved
  if (isSolvedState(scrambledState)) {
    // Very unlikely with seeded generation, but try again if it is
    return generatePuzzle(level, attempts + 1);
  }

  // Ensure the puzzle is actually solvable by verifying color counts
  if (!validateVials(scrambledState)) {
    return generatePuzzle(level, attempts + 1);
  }

  return scrambledState;
}

// =================== UI COMPONENTS ===================

function UndoButton({
  isDisabled,
  onClick,
}: {
  isDisabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex size-14 items-center rounded-full bg-amber-500 p-2 text-white transition-all duration-300 hover:bg-amber-600",
        isDisabled && (isDev ? "opacity-50" : "opacity-0"),
      )}
      disabled={isDisabled}
      type="button"
      onClick={onClick}
    >
      <Undo className="h-full w-auto" />
    </button>
  );
}

function ResetButton({
  isDisabled,
  onClick,
}: {
  isDisabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex size-12 items-center rounded-full bg-amber-500 p-2 text-white transition-all duration-300 hover:bg-amber-600",
        isDisabled && (isDev ? "opacity-50" : "opacity-0"),
      )}
      disabled={isDisabled}
      type="button"
      onClick={onClick}
    >
      <RefreshCw className="h-full w-auto" />
    </button>
  );
}

/**
 * Render a vial with its contents
 */
function renderVial(
  vial: Vial,
  index: number,
  selectedVialIndex: number | null,
  gameState: GameStateType,
  vials: VialState,
  handleVialClick: (index: number) => void,
): React.ReactNode {
  const isSelected = selectedVialIndex === index;
  const isAnySelected = selectedVialIndex !== null;
  const isInteractive =
    gameState === GAME_STATE.READY || gameState === GAME_STATE.PLAYING;
  const isValidTarget =
    selectedVialIndex !== null &&
    selectedVialIndex !== index &&
    isValidMove(selectedVialIndex, index, vials);

  const vialType = isSelected
    ? "source"
    : isValidTarget
      ? "target"
      : isAnySelected
        ? "invalid"
        : "default";

  return (
    <div
      key={index}
      className={cn(
        "relative flex h-48 w-11 flex-col-reverse overflow-hidden rounded-b-full border-4 bg-purple-900 pt-6",
        isInteractive ? "cursor-pointer" : "cursor-default",
        vialType === "source" && "border-blue-500",
        vialType === "target" && "border-green-500",
        vialType === "invalid" && "border-gray-400 opacity-50",
        vialType === "default" && "border-gray-400",
      )}
      onClick={() => {
        if (isInteractive) {
          handleVialClick(index);
        }
      }}
    >
      {/* Liquid layers */}
      {vial.map((color, layerIndex) => {
        const colorKey = color as keyof typeof EMOJIS;
        // Add a pattern or texture to each color to help distinguish them
        const addPattern = (
          <div
            key={layerIndex}
            className="relative h-10 w-full"
            style={{ backgroundColor: colorKey }}
          >
            {/* Subtle diagonal stripes or pattern based on color index */}
            <div
              className="absolute inset-0 opacity-20"
              // style={{
              //   background:
              //     COLORS.indexOf(colorKey) % 4 === 0
              //       ? "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.5) 5px, rgba(255,255,255,0.5) 10px)"
              //       : COLORS.indexOf(colorKey) % 4 === 1
              //         ? "repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(255,255,255,0.5) 5px, rgba(255,255,255,0.5) 10px)"
              //         : COLORS.indexOf(colorKey) % 4 === 2
              //           ? "radial-gradient(circle, transparent 30%, rgba(255,255,255,0.3) 70%)"
              //           : "repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(255,255,255,0.3) 5px, rgba(255,255,255,0.3) 10px)",
              // }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-100 mix-blend-luminosity">
              {EMOJIS[colorKey]}
            </div>

            {/* Add highlight/shadow to create depth */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 100%)",
              }}
            />

            {/* Border between layers */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-black opacity-10" />
          </div>
        );

        return addPattern;
      })}

      {/* Glass reflection effect */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 right-0 top-0 h-10 bg-gradient-to-b from-white to-transparent opacity-20" />
      </div>

      {/* Empty space */}
      <div className="flex-grow" />
    </div>
  );
}

// =================== MAIN GAME COMPONENT ===================

function WaterSortGame() {
  // Game state
  const [vials, setVials] = useState<VialState>([]);
  const [selectedVialIndex, setSelectedVialIndex] = useState<number | null>(
    null,
  );
  const [moveHistory, setMoveHistory] = useState<VialState[]>([]);
  const [moves, setMoves] = useState<number>(0);
  const [gameState, setGameState] = useState<GameStateType>(
    GAME_STATE.INITIALIZING,
  );
  const [showNewGameDialog, setShowNewGameDialog] = useState(false);

  // Level system - using zustand store with persistence
  const { currentLevel, highestLevel, setCurrentLevel, incrementHighestLevel } =
    useGameStore();

  // Refs for timeout handling
  const generationTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Start a specific level
  const startLevel = useCallback(
    (level: number): void => {
      setGameState(GAME_STATE.INITIALIZING);
      setSelectedVialIndex(null);
      setMoveHistory([]);
      setMoves(0);
      toast.error(null);
      setCurrentLevel(level);

      // Use setTimeout to ensure the UI updates before the generation starts
      setTimeout(() => {
        try {
          // Clear timeout to prevent infinite loops
          if (generationTimeout.current) {
            clearTimeout(generationTimeout.current);
          }

          generationTimeout.current = setTimeout(() => {
            toast.error("Puzzle generation timed out. Please try again.");
            setGameState(GAME_STATE.ERROR);
          }, GENERATION_TIMEOUT_MS);

          const scrambledPuzzle = generatePuzzle(level);

          // Clear the timeout as we've finished
          clearTimeout(generationTimeout.current);

          if (scrambledPuzzle) {
            setVials(scrambledPuzzle);
            setGameState(GAME_STATE.READY);
          } else {
            toast.error("Failed to generate a valid puzzle configuration.");
            setGameState(GAME_STATE.ERROR);
          }
        } catch (err) {
          console.error("Error generating puzzle:", err);
          toast.error("An unexpected error occurred. Please try again.");
          setGameState(GAME_STATE.ERROR);
        }
      }, 100);
    },
    [setCurrentLevel],
  );

  // Start a new game (alias for restarting current level)
  const startNewGame = useCallback((): void => {
    setShowNewGameDialog(false);
    startLevel(currentLevel);
  }, [currentLevel, startLevel]);

  // Go to next level
  const nextLevel = useCallback((): void => {
    const nextLevelNum = currentLevel + 1;
    // Update highest level if needed through zustand store
    if (nextLevelNum > highestLevel) {
      incrementHighestLevel();
    }
    startLevel(nextLevelNum);
  }, [currentLevel, highestLevel, incrementHighestLevel, startLevel]);

  // Handle vial selection and moves
  const handleVialClick = useCallback(
    (index: number): void => {
      // Only allow interaction in READY or PLAYING states
      if (gameState !== GAME_STATE.READY && gameState !== GAME_STATE.PLAYING) {
        return;
      }

      // Check if index is valid
      if (index < 0 || index >= vials.length) {
        return;
      }

      const targetVial = vials[index];
      if (!targetVial) {
        return;
      }

      if (selectedVialIndex === null) {
        // Select a vial if it's not empty
        if (targetVial.length > 0) {
          setSelectedVialIndex(index);
        }
      } else if (index === selectedVialIndex) {
        // Deselect if clicking the same vial
        setSelectedVialIndex(null);
      } else {
        // Try to move from selected vial to the clicked vial
        if (isValidMove(selectedVialIndex, index, vials)) {
          // If still in READY state, transition to PLAYING
          if (gameState === GAME_STATE.READY) {
            setGameState(GAME_STATE.PLAYING);
          }

          // Save current state for undo
          setMoveHistory([...moveHistory, JSON.parse(JSON.stringify(vials))]);

          const fromIndex = selectedVialIndex;
          const toIndex = index;

          // Execute the move immediately
          const newVials = executeMove(fromIndex, toIndex, vials);
          if (newVials) {
            // Update the state immediately
            setVials(newVials);
            setMoves(moves + 1);
            setSelectedVialIndex(null);
          }
        } else if (targetVial.length > 0) {
          // If move is invalid, select the new vial if not empty
          setSelectedVialIndex(index);
        } else {
          // If target is empty and move is invalid, deselect
          setSelectedVialIndex(null);
        }
      }
    },
    [selectedVialIndex, vials, moveHistory, moves, gameState],
  );

  // Undo the last move
  const undoMove = useCallback((): void => {
    if (
      moveHistory.length > 0 &&
      (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.READY)
    ) {
      if (moveHistory.length > 0) {
        const lastState = moveHistory[moveHistory.length - 1];
        if (lastState) {
          setVials(lastState);
          setMoveHistory(moveHistory.slice(0, -1));
          setSelectedVialIndex(null);
          setMoves(Math.max(0, moves - 1));
        }
      }
    }
  }, [moveHistory, moves, gameState]);

  // Initialize the game on first load
  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      clearTimeout(generationTimeout.current);
    };
  }, []);

  // Check if the current state is a win
  useEffect(() => {
    if (gameState === GAME_STATE.PLAYING && vials.length > 0) {
      if (isSolvedState(vials)) {
        // Level completed!
        setGameState(GAME_STATE.WIN);

        // Update highest level if needed through zustand store
        incrementHighestLevel();
      }
    }
  }, [vials, gameState, currentLevel, highestLevel, incrementHighestLevel]);

  return (
    <div className="grid h-dvh w-full max-w-md grid-rows-[auto_1fr] bg-[#221337]">
      {/* HUD/Controls - Top section */}
      <div className="flex flex-col items-center bg-[#060d1f]">
        {/* Game status and controls in single row */}
        <div className="flex h-20 w-full items-center justify-between overflow-hidden p-4">
          {/* Left: Level info and prev/next controls */}
          <div className="text-3xl font-medium text-[#654373]">
            Level {currentLevel}
          </div>

          <Dialog open={showNewGameDialog} onOpenChange={setShowNewGameDialog}>
            <DialogTrigger asChild>
              <ResetButton
                isDisabled={
                  gameState === GAME_STATE.INITIALIZING ||
                  moveHistory.length === 0
                }
                onClick={() => {
                  setShowNewGameDialog(true);
                }}
              />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Restart Level {currentLevel}</DialogTitle>
                <DialogDescription>
                  Are you sure you want to restart the current level? This will
                  reset all your moves.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewGameDialog(false);
                  }}
                >
                  No, keep playing
                </Button>
                <Button onClick={startNewGame}>Yes, restart</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Win message overlay */}
        {gameState === GAME_STATE.WIN && (
          <Dialog open={true}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center">
                  <Award className="mr-2 text-yellow-500" size={20} />
                  Level {currentLevel} Solved!
                </DialogTitle>
                <DialogDescription>
                  Congratulations! You completed level {currentLevel} in {moves}{" "}
                  moves.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button className="flex items-center" onClick={nextLevel}>
                  Next Level
                  <ArrowRight className="ml-2" size={18} />
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Game board - Fills remaining space */}
      <div className="relative flex h-full w-full items-center justify-between overflow-hidden p-2.5">
        {/* Responsive grid for vials */}
        <div className="relative grid max-h-full w-full grid-cols-7 place-items-center gap-x-2.5 gap-y-10">
          {vials.map((vial, index) =>
            renderVial(
              vial,
              index,
              selectedVialIndex,
              gameState,
              vials,
              handleVialClick,
            ),
          )}
        </div>
      </div>

      {/* HUD/Controls - Bottom section */}
      <div className="flex w-full items-center justify-end bg-[#060d1f] p-4 pb-6">
        <UndoButton
          isDisabled={
            moveHistory.length === 0 ||
            gameState === GAME_STATE.INITIALIZING ||
            gameState === GAME_STATE.WIN
          }
          onClick={undoMove}
        />
      </div>
      {/* <div className="pointer-events-none absolute inset-0 touch-none opacity-10">
        <Image alt="Game" className="h-full w-full" src={Game} />
      </div> */}

      {isDev && (
        <div className="pointer-events-none absolute inset-0 touch-none border-x-[16px] border-y-[24px] border-red-500/50 opacity-50" />
      )}
    </div>
  );
}

export { WaterSortGame };
