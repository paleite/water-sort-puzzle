import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Undo, Award, AlertCircle } from 'lucide-react';

// Game constants
const VIAL_COUNT = 14;
const COLORS_PER_VIAL = 4;
const EMPTY_VIALS = 2;
const FILLED_VIALS = VIAL_COUNT - EMPTY_VIALS;
const MIN_SHUFFLE_MOVES = 40;
const MAX_GENERATION_ATTEMPTS = 10;
const GENERATION_TIMEOUT_MS = 10000;

// Simple seeded random number generator for deterministic level generation
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  // Random number between 0 and 1 (exclusive)
  next() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  // Random integer between min (inclusive) and max (exclusive)
  nextInt(min, max) {
    return Math.floor(min + this.next() * (max - min));
  }

  // Randomly shuffle an array using Fisher-Yates algorithm
  shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// Animation states
const ANIMATION_STATE = {
  IDLE: 'idle',
  POURING: 'pouring'
};

// Game states
const GAME_STATE = {
  INITIALIZING: 'initializing',
  READY: 'ready',
  PLAYING: 'playing',
  ANIMATING: 'animating',
  WIN: 'win',
  ERROR: 'error'
};

// Define colors for our liquid layers (12 distinct colors with improved contrast)
const COLORS = [
  '#FF3030', // bright red
  '#3AE12E', // lime green
  '#347BFF', // bright blue
  '#FFD700', // gold
  '#E02DF3', // magenta
  '#FF7F00', // orange
  '#964B00', // brown
  '#00FFFF', // cyan
  '#FF1493', // deep pink
  '#48D1CC', // turquoise
  '#ADFF2F', // yellow-green
  '#9966FF', // purple
];

const WaterSortGame = () => {
  // Game state
  const [vials, setVials] = useState([]);
  const [selectedVialIndex, setSelectedVialIndex] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [moves, setMoves] = useState(0);
  const [gameState, setGameState] = useState(GAME_STATE.INITIALIZING);
  const [error, setError] = useState(null);

  // Level system
  const [currentLevel, setCurrentLevel] = useState(1);
  const [highestLevel, setHighestLevel] = useState(1);

  // Animation state
  const [animationState, setAnimationState] = useState(ANIMATION_STATE.IDLE);
  const [animatingFrom, setAnimatingFrom] = useState(null);
  const [animatingTo, setAnimatingTo] = useState(null);
  const [animatingColor, setAnimatingColor] = useState(null);
  const [animatingCount, setAnimatingCount] = useState(0);

  // Refs
  const generationAttempts = useRef(0);
  const generationTimeout = useRef(null);
  const solvedState = useRef(null);
  const animationTimeoutRef = useRef(null);

  // Check if a state is solved
  const isSolvedState = useCallback((vialState) => {
    // Count how many vials are properly sorted (single color or empty)
    let sortedVials = 0;

    for (const vial of vialState) {
      if (vial.length === 0) {
        // Empty vials count as sorted
        sortedVials++;
      } else if (vial.length === COLORS_PER_VIAL) {
        // Check if all colors in this vial are the same
        const firstColor = vial[0];
        const allSameColor = vial.every(color => color === firstColor);

        if (allSameColor) {
          sortedVials++;
        }
      }
    }

    // A puzzle is solved when all vials are sorted
    return sortedVials === VIAL_COUNT;
  }, []);

  // Create initial solved state
  const createSolvedState = useCallback(() => {
    const solved = [];

    // Create vials with single colors (solved state)
    for (let i = 0; i < FILLED_VIALS; i++) {
      const colorIndex = i % COLORS.length;
      solved.push(Array(COLORS_PER_VIAL).fill(COLORS[colorIndex]));
    }

    // Add empty vials
    for (let i = 0; i < EMPTY_VIALS; i++) {
      solved.push([]);
    }

    return solved;
  }, []);

  // Validate vials state to ensure it has correct color counts and is solvable
  const validateVials = useCallback((vialState) => {
    // Count colors
    const colorCounts = {};
    let totalSegments = 0;

    vialState.forEach(vial => {
      vial.forEach(color => {
        colorCounts[color] = (colorCounts[color] || 0) + 1;
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
    vialState.forEach(vial => {
      if (vial.length === 0) {
        sortedVialCount++;
      } else if (vial.length === COLORS_PER_VIAL) {
        // Check if all elements in this vial are the same
        if (vial.every(color => color === vial[0])) {
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
  const isValidMove = useCallback((fromIndex, toIndex, vialState) => {
    // Can't move from an empty vial
    if (vialState[fromIndex].length === 0) return false;

    // Can't move to a full vial
    if (vialState[toIndex].length >= COLORS_PER_VIAL) return false;

    // Can move to an empty vial
    if (vialState[toIndex].length === 0) return true;

    // Check if the top colors match
    const fromColor = vialState[fromIndex][vialState[fromIndex].length - 1];
    const toColor = vialState[toIndex][vialState[toIndex].length - 1];

    return fromColor === toColor;
  }, []);

  // Find all valid moves for a given vial state
  const findAllValidMoves = useCallback((vialState) => {
    const validMoves = [];

    for (let fromIndex = 0; fromIndex < vialState.length; fromIndex++) {
      if (vialState[fromIndex].length === 0) continue;

      for (let toIndex = 0; toIndex < vialState.length; toIndex++) {
        if (fromIndex === toIndex) continue;

        if (isValidMove(fromIndex, toIndex, vialState)) {
          validMoves.push([fromIndex, toIndex]);
        }
      }
    }

    return validMoves;
  }, [isValidMove]);

  // Execute a move between vials (pour liquid)
  const executeMove = useCallback((fromIndex, toIndex, vialState) => {
    if (!isValidMove(fromIndex, toIndex, vialState)) {
      return null;
    }

    // Create a deep copy of vials
    const newVialState = JSON.parse(JSON.stringify(vialState));
    const fromVial = newVialState[fromIndex];
    const toVial = newVialState[toIndex];

    // Get the color to move
    const colorToMove = fromVial[fromVial.length - 1];

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
  }, [isValidMove]);

  // Generate a scrambled puzzle state using a deterministic approach with level as seed
  const generatePuzzle = useCallback((level) => {
    // Create a seeded random generator for deterministic generation
    const random = new SeededRandom(level);

    // Clear timeout to prevent infinite loops
    clearTimeout(generationTimeout.current);
    generationTimeout.current = setTimeout(() => {
      setError("Puzzle generation timed out. Please try again.");
      setGameState(GAME_STATE.ERROR);
    }, GENERATION_TIMEOUT_MS);

    // Create a pool of all color segments we need
    const colorPool = [];
    for (let i = 0; i < FILLED_VIALS; i++) {
      // Different levels can have slightly different color sets
      // This creates a sense of progression
      const colorOffset = Math.floor(level / 5) % COLORS.length; // Change colors every 5 levels
      const colorIndex = (i + colorOffset) % COLORS.length;

      // Add 4 of each color to the pool
      for (let j = 0; j < COLORS_PER_VIAL; j++) {
        colorPool.push(COLORS[colorIndex]);
      }
    }

    // Shuffle the color pool using our seeded random generator
    const shuffledColors = random.shuffle(colorPool);

    // Create a puzzle with distributed colors
    const scrambledState = [];

    // Fill the first 12 vials with random colors from our pool
    for (let i = 0; i < FILLED_VIALS; i++) {
      const vial = [];
      for (let j = 0; j < COLORS_PER_VIAL; j++) {
        // Get a color from our shuffled pool
        if (shuffledColors.length > 0) {
          vial.push(shuffledColors.pop());
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

          const source = validSourceVials[sourceIndex];
          const target = validTargetVials[targetIndex];

          // Only move if they are different vials
          if (source.index !== target.index) {
            // Take one color from source and add to target
            const color = scrambledState[source.index].pop();
            scrambledState[target.index].push(color);
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
  }, [validateVials, isSolvedState]);

  // Start a specific level
  const startLevel = useCallback((level) => {
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
  }, [generatePuzzle]);

  // Start a new game (alias for restarting current level)
  const startNewGame = useCallback(() => {
    startLevel(currentLevel);
  }, [currentLevel, startLevel]);

  // Go to next level
  const nextLevel = useCallback(() => {
    const nextLevelNum = currentLevel + 1;
    // Update highest level if needed
    if (nextLevelNum > highestLevel) {
      setHighestLevel(nextLevelNum);
    }
    startLevel(nextLevelNum);
  }, [currentLevel, highestLevel, startLevel]);

  // Go to previous level (if available)
  const prevLevel = useCallback(() => {
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

        // Update highest level if needed
        if (currentLevel + 1 > highestLevel) {
          setHighestLevel(currentLevel + 1);
        }
      }
    }
  }, [vials, gameState, isSolvedState, currentLevel, highestLevel]);

  // Start pouring animation
  const startPouringAnimation = useCallback((fromIndex, toIndex) => {
    // Set animation state - but don't block game play
    // Just track that an animation is happening visually
    setAnimationState(ANIMATION_STATE.POURING);
    setAnimatingFrom(fromIndex);
    setAnimatingTo(toIndex);

    // Get the color that will be poured
    const fromVial = vials[fromIndex];
    const colorToPour = fromVial[fromVial.length - 1];
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
    const toVial = vials[toIndex];
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
  }, [vials]);

  // We no longer need this function since we update state immediately
  const finishPouringAnimation = useCallback(() => {
    // This function is now empty as the game state is updated immediately
    // keeping it as a placeholder in case we need it later
  }, []);

  // Handle vial selection and moves
  const handleVialClick = useCallback((index) => {
    // Only allow interaction in READY or PLAYING states (and now during animations)
    if (gameState !== GAME_STATE.READY &&
        gameState !== GAME_STATE.PLAYING &&
        gameState !== GAME_STATE.ANIMATING) {
      return;
    }

    if (selectedVialIndex === null) {
      // Select a vial if it's not empty
      if (vials[index].length > 0) {
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
      } else if (vials[index].length > 0) {
        // If move is invalid, select the new vial if not empty
        setSelectedVialIndex(index);
      } else {
        // If target is empty and move is invalid, deselect
        setSelectedVialIndex(null);
      }
    }
  }, [selectedVialIndex, vials, moveHistory, moves, gameState, isValidMove, executeMove, startPouringAnimation]);

  // Undo the last move
  const undoMove = useCallback(() => {
    if (moveHistory.length > 0 &&
        (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.READY)) {
      const lastState = moveHistory[moveHistory.length - 1];
      setVials(lastState);
      setMoveHistory(moveHistory.slice(0, -1));
      setSelectedVialIndex(null);
      setMoves(moves - 1);
    }
  }, [moveHistory, moves, gameState]);

  useEffect(() => {
    // Add ripple animation for water effect
    const style = document.createElement('style');
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
  const renderLiquidAnimation = useCallback(() => {
    if (animationState !== ANIMATION_STATE.POURING ||
        animatingFrom === null ||
        animatingTo === null) {
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

    // Get container dimensions
    const containerWidth = vialsPerRow * (vialWidth + vialGap);
    const containerHeight = Math.max(fromRow, toRow) * (160 + vialGap) + 160; // 160px height for each vial

    // Calculate center points of the vials
    const fromX = (fromCol * (vialWidth + vialGap)) + (vialWidth / 2);
    const fromY = (fromRow * (160 + vialGap)) + 20;
    const toX = (toCol * (vialWidth + vialGap)) + (vialWidth / 2);
    const toY = (toRow * (160 + vialGap)) + 20 + (vials[animatingTo].length * 40);

    // First determine the path control points
    const midY = Math.min(fromY, toY) - 40; // Arc height
    const path = `M${fromX},${fromY} Q${(fromX + toX) / 2},${midY} ${toX},${toY}`;

    // We'll create multiple droplets along the path for a more fluid effect
    const droplets = [];
    const dropletCount = 5; // Number of droplets in the animation
    const dropletRadius = 6; // Smaller droplets for mobile

    for (let i = 0; i < dropletCount; i++) {
      // Calculate the animation delay for each droplet
      const animationDelay = i * 0.12; // Stagger the droplets

      droplets.push(
        <g key={`droplet-${i}`}>
          <circle
            r={dropletRadius}
            fill={animatingColor}
            opacity={0.9}
          >
            <animateMotion
              path={path}
              begin={`${animationDelay}s`}
              dur="0.7s"
              fill="freeze"
              calcMode="linear"
            />
            <animate
              attributeName="r"
              values={`${dropletRadius * 0.8};${dropletRadius};${dropletRadius * 0.8}`}
              dur="0.5s"
              repeatCount="1"
              begin={`${animationDelay}s`}
            />
          </circle>
        </g>
      );
    }

    // Create a splash effect at the destination
    const splash = (
      <g key="splash">
        <circle
          cx={toX}
          cy={toY}
          r={0}
          fill={animatingColor}
          opacity={0.7}
        >
          <animate
            attributeName="r"
            values="0;12"
            dur="0.4s"
            begin="0.5s"
            fill="freeze"
          />
          <animate
            attributeName="opacity"
            values="0.7;0"
            dur="0.4s"
            begin="0.5s"
            fill="freeze"
          />
        </circle>
      </g>
    );

    return (
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
        {/* Droplets */}
        {droplets}

        {/* Splash effect */}
        {splash}
      </svg>
    );
  }, [animationState, animatingFrom, animatingTo, animatingColor, vials]);

  // Render a vial with its contents
  const renderVial = useCallback((vial, index) => {
    const isSelected = selectedVialIndex === index;
    const isInteractive = gameState === GAME_STATE.READY ||
                         gameState === GAME_STATE.PLAYING ||
                         gameState === GAME_STATE.ANIMATING;
    const isValidTarget = selectedVialIndex !== null &&
                          selectedVialIndex !== index &&
                          isValidMove(selectedVialIndex, index, vials);

    // Animation states
    const isPouring = animationState === ANIMATION_STATE.POURING;
    const isPouringSource = isPouring && animatingFrom === index;
    const isPouringTarget = isPouring && animatingTo === index;

    return (
      <div
        key={index}
        className={`relative w-10 sm:w-12 h-40 sm:h-48 flex flex-col-reverse rounded-b-xl overflow-hidden
                   ${isInteractive ? 'cursor-pointer' : 'cursor-default'}
                   bg-gray-200 border-2
                   ${isSelected ? 'border-blue-500 shadow-lg' :
                    isValidTarget ? 'border-green-500 shadow-md' : 'border-gray-400'}`}
        onClick={() => isInteractive && handleVialClick(index)}
      >
        {/* Liquid layers */}
        {vial.map((color, layerIndex) => {
          // Skip rendering the top layers that are being poured out
          if (isPouringSource &&
              layerIndex >= vial.length - animatingCount &&
              color === animatingColor) {
            return null;
          }

          // Add a pattern or texture to each color to help distinguish them
          const addPattern = (
            <div
              key={layerIndex}
              className="w-full h-10 sm:h-12 relative"
              style={{ backgroundColor: color }}
            >
              {/* Subtle diagonal stripes or pattern based on color index */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background: COLORS.indexOf(color) % 4 === 0
                    ? 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.5) 5px, rgba(255,255,255,0.5) 10px)'
                    : COLORS.indexOf(color) % 4 === 1
                    ? 'repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(255,255,255,0.5) 5px, rgba(255,255,255,0.5) 10px)'
                    : COLORS.indexOf(color) % 4 === 2
                    ? 'radial-gradient(circle, transparent 30%, rgba(255,255,255,0.3) 70%)'
                    : 'repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(255,255,255,0.3) 5px, rgba(255,255,255,0.3) 10px)'
                }}
              />

              {/* Add highlight/shadow to create depth */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 100%)'
                }}
              />

              {/* Border between layers */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-black opacity-10" />
            </div>
          );

          return addPattern;
        })}

        {/* Glass reflection effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-white to-transparent opacity-20" />
        </div>

        {/* Animation effects for the target vial */}
        {isPouringTarget && (
          <div className="absolute left-0 right-0 bottom-0 pointer-events-none">
            {/* Show ripple effect when liquid lands */}
            <div
              className="absolute left-1/2 top-0 w-6 h-1 -translate-x-1/2 opacity-70 rounded-full"
              style={{
                backgroundColor: animatingColor,
                animation: 'ripple 0.8s ease-out',
                animationDelay: '0.3s'
              }}
            />
          </div>
        )}

        {/* Empty space */}
        <div className="flex-grow" />
      </div>
    );
  }, [selectedVialIndex, gameState, vials, isValidMove, handleVialClick,
      animationState, animatingFrom, animatingTo, animatingColor, animatingCount]);

  return (
    <div className="grid grid-rows-[auto_1fr] h-screen w-full bg-gray-100">
      {/* HUD/Controls - Top section */}
      <div className="p-3 flex flex-col items-center bg-white shadow-md">
        {/* Game status and controls in single row */}
        <div className="w-full flex items-center justify-between">
          {/* Left: Level info and prev/next controls */}
          <div className="flex items-center">
            <button
              className={`p-2 rounded-full flex items-center mr-2
                        ${currentLevel <= 1 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
              onClick={prevLevel}
              disabled={currentLevel <= 1 || gameState === GAME_STATE.INITIALIZING}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>

            <div className="text-gray-800 font-medium">
              Level <span className="font-bold">{currentLevel}</span>
            </div>

            <button
              className={`p-2 rounded-full flex items-center ml-2
                        ${gameState === GAME_STATE.INITIALIZING ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
              onClick={nextLevel}
              disabled={gameState === GAME_STATE.INITIALIZING || (currentLevel >= highestLevel && gameState !== GAME_STATE.WIN)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          {/* Status */}
          <div className="flex items-center">
            {gameState === GAME_STATE.INITIALIZING && (
              <div className="text-blue-600 font-medium flex items-center">
                <RefreshCw size={16} className="animate-spin mr-2" />
                Generating...
              </div>
            )}

            {gameState === GAME_STATE.READY && (
              <div className="text-green-600 font-medium">
                Ready! Make a move
              </div>
            )}

            {(gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.ANIMATING) && (
              <div className="text-gray-700">
                Moves: <span className="font-bold">{moves}</span>
              </div>
            )}

            {gameState === GAME_STATE.ERROR && (
              <div className="text-red-600 font-medium flex items-center">
                <AlertCircle size={16} className="mr-1" />
                {error || "Error"}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            <button
              className={`p-2 rounded-full flex items-center
                        ${moveHistory.length === 0 || gameState === GAME_STATE.INITIALIZING || gameState === GAME_STATE.WIN
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'}`}
              onClick={undoMove}
              disabled={moveHistory.length === 0 || gameState === GAME_STATE.INITIALIZING || gameState === GAME_STATE.WIN}
            >
              <Undo size={18} />
            </button>

            <button
              className={`p-2 rounded-full flex items-center
                        ${gameState === GAME_STATE.INITIALIZING
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-500 text-white hover:bg-green-600'}`}
              onClick={startNewGame}
              disabled={gameState === GAME_STATE.INITIALIZING}
            >
              <RefreshCw size={18} className={gameState === GAME_STATE.INITIALIZING ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Win message overlay */}
        {gameState === GAME_STATE.WIN && (
          <div className="mt-2 p-2 bg-yellow-100 border-2 border-yellow-400 rounded-lg flex items-center justify-between w-full">
            <div className="flex items-center">
              <Award size={20} className="text-yellow-500 mr-2" />
              <div className="font-bold">Level {currentLevel} solved in {moves} moves!</div>
            </div>

            <button
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
              onClick={nextLevel}
            >
              Next Level
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Game board - Fills remaining space */}
      <div className="w-full h-full relative flex items-center justify-center overflow-hidden p-1">
        {/* Responsive grid for vials */}
        <div className="grid grid-cols-7 md:grid-cols-7 sm:grid-cols-5 gap-1 max-h-full place-items-center relative">
          {vials.map((vial, index) => renderVial(vial, index))}
          {renderLiquidAnimation()}
        </div>
      </div>
    </div>
  );
};

export default WaterSortGame;
