import React, { useCallback, useEffect, useRef, useState } from "react";

import { AlertCircle, Award, RefreshCw, Undo } from "lucide-react";

import { useGameStore } from "@/lib/store";

// Game constants
const VIAL_COUNT = 14;
const COLORS_PER_VIAL = 4;
const EMPTY_VIALS = 2;
const FILLED_VIALS = VIAL_COUNT - EMPTY_VIALS;
const MAX_GENERATION_ATTEMPTS = 10;
const GENERATION_TIMEOUT_MS = 10000;

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

// Animation states
const ANIMATION_STATE = {
  IDLE: "idle",
  POURING: "pouring",
} as const;

// Game states
const GAME_STATE = {
  INITIALIZING: "initializing",
  READY: "ready",
  PLAYING: "playing",
  ANIMATING: "animating",
  WIN: "win",
  ERROR: "error",
} as const;

// Define types
type AnimationStateType =
  (typeof ANIMATION_STATE)[keyof typeof ANIMATION_STATE];
type GameStateType = (typeof GAME_STATE)[keyof typeof GAME_STATE];

// Define a vial as an array of colors (strings)
type Vial = string[];
type VialState = Vial[];

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
];

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
  const [error, setError] = useState<string | null>(null);

  // Level system - using zustand store with persistence
  const { currentLevel, highestLevel, setCurrentLevel, incrementHighestLevel } =
    useGameStore();

  // Animation state
  const [animationState, setAnimationState] = useState<AnimationStateType>(
    ANIMATION_STATE.IDLE,
  );
  const [animatingFrom, setAnimatingFrom] = useState<number | null>(null);
  const [animatingTo, setAnimatingTo] = useState<number | null>(null);
  const [animatingColor, setAnimatingColor] = useState<string | null>(null);
  const [animatingCount, setAnimatingCount] = useState<number>(0);

  // Refs
  const generationAttempts = useRef<number>(0);
  const generationTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Check if a state is solved
  const isSolvedState = useCallback((vialState: VialState): boolean => {
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
  }, []);

  // Validate vials state to ensure it has correct color counts and is solvable
  const validateVials = useCallback((vialState: VialState): boolean => {
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
  }, []);

  // Check if a move is valid
  const isValidMove = useCallback(
    (fromIndex: number, toIndex: number, vialState: VialState): boolean => {
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
    },
    [],
  );

  // Execute a move between vials (pour liquid)
  const executeMove = useCallback(
    (
      fromIndex: number,
      toIndex: number,
      vialState: VialState,
    ): VialState | null => {
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
    },
    [isValidMove],
  );

  // Generate a scrambled puzzle state using a deterministic approach with level as seed
  const generatePuzzle = useCallback(
    (level: number): VialState | null => {
      // Create a seeded random generator for deterministic generation
      const random = new SeededRandom(level);

      // Clear timeout to prevent infinite loops
      if (generationTimeout.current) {
        clearTimeout(generationTimeout.current);
      }
      generationTimeout.current = setTimeout(() => {
        setError("Puzzle generation timed out. Please try again.");
        setGameState(GAME_STATE.ERROR);
      }, GENERATION_TIMEOUT_MS);

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

      // Clear the timeout as we've finished
      clearTimeout(generationTimeout.current);

      // Verify the scrambled state isn't already solved
      if (isSolvedState(scrambledState)) {
        // Very unlikely with seeded generation, but try again if it is
        generationAttempts.current++;
        if (generationAttempts.current >= MAX_GENERATION_ATTEMPTS) {
          setError("Failed to generate an unsolved puzzle for this level.");
          setGameState(GAME_STATE.ERROR);
          return null;
        }
        return generatePuzzle(level);
      }

      // Ensure the puzzle is actually solvable by verifying color counts
      if (!validateVials(scrambledState)) {
        generationAttempts.current++;
        if (generationAttempts.current >= MAX_GENERATION_ATTEMPTS) {
          setError("Failed to generate a valid puzzle configuration.");
          setGameState(GAME_STATE.ERROR);
          return null;
        }
        return generatePuzzle(level);
      }

      // Reset attempts counter and return the valid scrambled state
      generationAttempts.current = 0;
      return scrambledState;
    },
    [validateVials, isSolvedState],
  );

  // Start a specific level
  const startLevel = useCallback(
    (level: number): void => {
      setGameState(GAME_STATE.INITIALIZING);
      setSelectedVialIndex(null);
      setMoveHistory([]);
      setMoves(0);
      setError(null);
      setCurrentLevel(level);

      // Reset animation state
      setAnimationState(ANIMATION_STATE.IDLE);
      setAnimatingFrom(null);
      setAnimatingTo(null);
      setAnimatingColor(null);
      setAnimatingCount(0);

      // Use setTimeout to ensure the UI updates before the generation starts
      setTimeout(() => {
        try {
          const scrambledPuzzle = generatePuzzle(level);
          if (scrambledPuzzle) {
            setVials(scrambledPuzzle);
            setGameState(GAME_STATE.READY);
          }
        } catch (err) {
          console.error("Error generating puzzle:", err);
          setError("An unexpected error occurred. Please try again.");
          setGameState(GAME_STATE.ERROR);
        }
      }, 100);
    },
    [generatePuzzle],
  );

  // Start a new game (alias for restarting current level)
  const startNewGame = useCallback((): void => {
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

  // Go to previous level (if available)
  const prevLevel = useCallback((): void => {
    if (currentLevel > 1) {
      startLevel(currentLevel - 1);
    }
  }, [currentLevel, startLevel]);

  // Initialize the game on first load
  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      clearTimeout(generationTimeout.current);
      clearTimeout(animationTimeoutRef.current);
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
  }, [vials, gameState, isSolvedState, currentLevel, highestLevel]);

  // Start pouring animation
  const startPouringAnimation = useCallback(
    (fromIndex: number, toIndex: number): void => {
      // Check indices are valid
      if (
        fromIndex < 0 ||
        fromIndex >= vials.length ||
        toIndex < 0 ||
        toIndex >= vials.length
      ) {
        return;
      }

      // Get the vials
      const fromVial = vials[fromIndex];
      const toVial = vials[toIndex];

      if (!fromVial || !toVial || fromVial.length === 0) {
        return;
      }

      // Set animation state - but don't block game play
      // Just track that an animation is happening visually
      setAnimationState(ANIMATION_STATE.POURING);
      setAnimatingFrom(fromIndex);
      setAnimatingTo(toIndex);

      // Get the color that will be poured
      const colorToPour = fromVial[fromVial.length - 1];
      if (colorToPour === undefined) {
        return;
      }

      setAnimatingColor(colorToPour);

      // Count how many of the same color will be poured
      let colorCount = 0;
      for (let i = fromVial.length - 1; i >= 0; i--) {
        if (fromVial[i] === colorToPour) {
          colorCount++;
        } else {
          break;
        }
      }

      // Calculate how many can be moved based on destination space
      const maxAccept = COLORS_PER_VIAL - toVial.length;
      const countToPour = Math.min(colorCount, maxAccept);
      setAnimatingCount(countToPour);

      // Set a timeout to finish the animation visually
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = setTimeout(() => {
        // Reset animation state when animation completes
        setAnimationState(ANIMATION_STATE.IDLE);
        setAnimatingFrom(null);
        setAnimatingTo(null);
        setAnimatingColor(null);
        setAnimatingCount(0);
      }, 800); // Animation duration
    },
    [vials],
  );

  // Handle vial selection and moves
  const handleVialClick = useCallback(
    (index: number): void => {
      // Only allow interaction in READY or PLAYING states (and now during animations)
      if (
        gameState !== GAME_STATE.READY &&
        gameState !== GAME_STATE.PLAYING &&
        gameState !== GAME_STATE.ANIMATING
      ) {
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

          // Start animation but immediately update the game state
          // This makes the animation purely visual without blocking gameplay
          const fromIndex = selectedVialIndex;
          const toIndex = index;

          // Execute the move immediately
          const newVials = executeMove(fromIndex, toIndex, vials);
          if (newVials) {
            // Start animation visually
            startPouringAnimation(fromIndex, toIndex);

            // But update the state immediately
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
    [
      selectedVialIndex,
      vials,
      moveHistory,
      moves,
      gameState,
      isValidMove,
      executeMove,
      startPouringAnimation,
    ],
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

  useEffect(() => {
    // Add ripple animation for water effect
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes ripple {
        0% { transform: scale(0); opacity: 0.7; }
        100% { transform: scale(3); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Render the liquid animation as an SVG path
  const renderLiquidAnimation = useCallback((): React.ReactNode => {
    if (
      animationState !== ANIMATION_STATE.POURING ||
      animatingFrom === null ||
      animatingTo === null ||
      animatingColor === null
    ) {
      return null;
    }

    // Calculate vial positions in the grid
    // Adjust sizes for responsive layout
    const vialWidth = 40; // Smaller for mobile (w-10)
    const vialGap = 4; // gap-1 in grid
    const vialsPerRow = window.innerWidth < 640 ? 5 : 7; // Based on sm:grid-cols-5 / grid-cols-7

    // Calculate from and to positions
    const fromRow = Math.floor(animatingFrom / vialsPerRow);
    const fromCol = animatingFrom % vialsPerRow;
    const toRow = Math.floor(animatingTo / vialsPerRow);
    const toCol = animatingTo % vialsPerRow;

    // Calculate center points of the vials
    const fromX = fromCol * (vialWidth + vialGap) + vialWidth / 2;
    const fromY = fromRow * (160 + vialGap) + 20;
    const toX = toCol * (vialWidth + vialGap) + vialWidth / 2;

    // Safely access the target vial length
    let toVialLength = 0;
    if (animatingTo >= 0 && animatingTo < vials.length) {
      const toVial = vials[animatingTo];
      if (toVial) {
        toVialLength = toVial.length;
      }
    }

    const toY = toRow * (160 + vialGap) + 20 + toVialLength * 40;

    // First determine the path control points
    const midY = Math.min(fromY, toY) - 40; // Arc height
    const path = `M${String(fromX)},${String(fromY)} Q${String((fromX + toX) / 2)},${String(midY)} ${String(toX)},${String(toY)}`;

    // We'll create multiple droplets along the path for a more fluid effect
    const droplets: React.ReactNode[] = [];
    const dropletCount = 5; // Number of droplets in the animation
    const dropletRadius = 6; // Smaller droplets for mobile

    for (let i = 0; i < dropletCount; i++) {
      // Calculate the animation delay for each droplet
      const animationDelay = i * 0.12; // Stagger the droplets

      droplets.push(
        <g key={`droplet-${String(i)}`}>
          <circle fill={animatingColor} opacity={0.9} r={dropletRadius}>
            <animateMotion
              begin={`${String(animationDelay)}s`}
              calcMode="linear"
              dur="0.7s"
              fill="freeze"
              path={path}
            />
            <animate
              attributeName="r"
              begin={`${String(animationDelay)}s`}
              dur="0.5s"
              repeatCount="1"
              values={`${String(dropletRadius * 0.8)};${String(dropletRadius)};${String(dropletRadius * 0.8)}`}
            />
          </circle>
        </g>,
      );
    }

    // Create a splash effect at the destination
    const splash = (
      <g key="splash">
        <circle
          cx={String(toX)}
          cy={String(toY)}
          fill={animatingColor}
          opacity={0.7}
          r={0}
        >
          <animate
            attributeName="r"
            begin="0.5s"
            dur="0.4s"
            fill="freeze"
            values="0;12"
          />
          <animate
            attributeName="opacity"
            begin="0.5s"
            dur="0.4s"
            fill="freeze"
            values="0.7;0"
          />
        </circle>
      </g>
    );

    return (
      <svg className="pointer-events-none absolute left-0 top-0 z-20 h-full w-full">
        {/* Droplets */}
        {droplets}

        {/* Splash effect */}
        {splash}
      </svg>
    );
  }, [animationState, animatingFrom, animatingTo, animatingColor, vials]);

  // Render a vial with its contents
  const renderVial = useCallback(
    (vial: Vial, index: number): React.ReactNode => {
      const isSelected = selectedVialIndex === index;
      const isInteractive =
        gameState === GAME_STATE.READY ||
        gameState === GAME_STATE.PLAYING ||
        gameState === GAME_STATE.ANIMATING;
      const isValidTarget =
        selectedVialIndex !== null &&
        selectedVialIndex !== index &&
        isValidMove(selectedVialIndex, index, vials);

      // Animation states
      const isPouring = animationState === ANIMATION_STATE.POURING;
      const isPouringSource = isPouring && animatingFrom === index;
      const isPouringTarget = isPouring && animatingTo === index;

      return (
        <div
          key={index}
          className={`relative flex h-40 w-10 flex-col-reverse overflow-hidden rounded-b-xl sm:h-48 sm:w-12 ${isInteractive ? "cursor-pointer" : "cursor-default"} border-2 bg-gray-200 ${
            isSelected
              ? "border-blue-500 shadow-lg"
              : isValidTarget
                ? "border-green-500 shadow-md"
                : "border-gray-400"
          }`}
          onClick={() => {
            if (isInteractive) {
              handleVialClick(index);
            }
          }}
        >
          {/* Liquid layers */}
          {vial.map((color, layerIndex) => {
            // Skip rendering the top layers that are being poured out
            if (
              isPouringSource &&
              layerIndex >= vial.length - animatingCount &&
              animatingColor !== null &&
              color === animatingColor
            ) {
              return null;
            }

            // Add a pattern or texture to each color to help distinguish them
            const addPattern = (
              <div
                key={layerIndex}
                className="relative h-10 w-full sm:h-12"
                style={{ backgroundColor: color }}
              >
                {/* Subtle diagonal stripes or pattern based on color index */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background:
                      COLORS.indexOf(color) % 4 === 0
                        ? "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.5) 5px, rgba(255,255,255,0.5) 10px)"
                        : COLORS.indexOf(color) % 4 === 1
                          ? "repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(255,255,255,0.5) 5px, rgba(255,255,255,0.5) 10px)"
                          : COLORS.indexOf(color) % 4 === 2
                            ? "radial-gradient(circle, transparent 30%, rgba(255,255,255,0.3) 70%)"
                            : "repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(255,255,255,0.3) 5px, rgba(255,255,255,0.3) 10px)",
                  }}
                />

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

          {/* Animation effects for the target vial */}
          {isPouringTarget && animatingColor !== null && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0">
              {/* Show ripple effect when liquid lands */}
              <div
                className="absolute left-1/2 top-0 h-1 w-6 -translate-x-1/2 rounded-full opacity-70"
                style={{
                  backgroundColor: animatingColor,
                  animation: "ripple 0.8s ease-out",
                  animationDelay: "0.3s",
                }}
              />
            </div>
          )}

          {/* Empty space */}
          <div className="flex-grow" />
        </div>
      );
    },
    [
      selectedVialIndex,
      gameState,
      vials,
      isValidMove,
      handleVialClick,
      animationState,
      animatingFrom,
      animatingTo,
      animatingColor,
      animatingCount,
    ],
  );

  return (
    <div className="grid h-screen w-full grid-rows-[auto_1fr] bg-gray-100">
      {/* HUD/Controls - Top section */}
      <div className="flex flex-col items-center bg-white p-3 shadow-md">
        {/* Game status and controls in single row */}
        <div className="flex w-full items-center justify-between">
          {/* Left: Level info and prev/next controls */}
          <div className="flex items-center">
            <button
              className={`mr-2 flex items-center rounded-full p-2 ${currentLevel <= 1 ? "cursor-not-allowed bg-gray-300 text-gray-500" : "bg-blue-500 text-white hover:bg-blue-600"}`}
              disabled={
                currentLevel <= 1 || gameState === GAME_STATE.INITIALIZING
              }
              type="button"
              onClick={prevLevel}
            >
              <svg
                fill="none"
                height="18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="font-medium text-gray-800">
              Level <span className="font-bold">{currentLevel}</span>
            </div>

            <button
              className={`ml-2 flex items-center rounded-full p-2 ${gameState === GAME_STATE.INITIALIZING ? "cursor-not-allowed bg-gray-300 text-gray-500" : "bg-blue-500 text-white hover:bg-blue-600"}`}
              disabled={
                gameState === GAME_STATE.INITIALIZING ||
                (currentLevel >= highestLevel && gameState !== GAME_STATE.WIN)
              }
              type="button"
              onClick={nextLevel}
            >
              <svg
                fill="none"
                height="18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Status */}
          <div className="flex items-center">
            {gameState === GAME_STATE.INITIALIZING && (
              <div className="flex items-center font-medium text-blue-600">
                <RefreshCw className="mr-2 animate-spin" size={16} />
                Generating...
              </div>
            )}

            {gameState === GAME_STATE.READY && (
              <div className="font-medium text-green-600">
                Ready! Make a move
              </div>
            )}

            {(gameState === GAME_STATE.PLAYING ||
              gameState === GAME_STATE.ANIMATING) && (
              <div className="text-gray-700">
                Moves: <span className="font-bold">{moves}</span>
              </div>
            )}

            {gameState === GAME_STATE.ERROR && (
              <div className="flex items-center font-medium text-red-600">
                <AlertCircle className="mr-1" size={16} />
                {error ?? "Error"}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            <button
              className={`flex items-center rounded-full p-2 ${
                moveHistory.length === 0 ||
                gameState === GAME_STATE.INITIALIZING ||
                gameState === GAME_STATE.WIN
                  ? "cursor-not-allowed bg-gray-300 text-gray-500"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
              disabled={
                moveHistory.length === 0 ||
                gameState === GAME_STATE.INITIALIZING ||
                gameState === GAME_STATE.WIN
              }
              type="button"
              onClick={undoMove}
            >
              <Undo size={18} />
            </button>

            <button
              className={`flex items-center rounded-full p-2 ${
                gameState === GAME_STATE.INITIALIZING
                  ? "cursor-not-allowed bg-gray-300 text-gray-500"
                  : "bg-green-500 text-white hover:bg-green-600"
              }`}
              disabled={gameState === GAME_STATE.INITIALIZING}
              type="button"
              onClick={startNewGame}
            >
              <RefreshCw
                className={
                  gameState === GAME_STATE.INITIALIZING ? "animate-spin" : ""
                }
                size={18}
              />
            </button>
          </div>
        </div>

        {/* Win message overlay */}
        {gameState === GAME_STATE.WIN && (
          <div className="mt-2 flex w-full items-center justify-between rounded-lg border-2 border-yellow-400 bg-yellow-100 p-2">
            <div className="flex items-center">
              <Award className="mr-2 text-yellow-500" size={20} />
              <div className="font-bold">
                Level {currentLevel} solved in {moves} moves!
              </div>
            </div>

            <button
              className="flex items-center rounded-lg bg-blue-500 p-2 text-white hover:bg-blue-600"
              type="button"
              onClick={nextLevel}
            >
              Next Level
              <svg
                className="ml-1"
                fill="none"
                height="18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Game board - Fills remaining space */}
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-1">
        {/* Responsive grid for vials */}
        <div className="relative grid max-h-full grid-cols-7 place-items-center gap-1 sm:grid-cols-5 md:grid-cols-7">
          {vials.map((vial, index) => renderVial(vial, index))}
          {renderLiquidAnimation()}
        </div>
      </div>
    </div>
  );
}

export { WaterSortGame };
