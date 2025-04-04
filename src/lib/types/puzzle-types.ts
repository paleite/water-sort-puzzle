/**
 * Core types for the Water Sort Puzzle game
 */

// Define color type
export type Color = string;

/**
 * Represents a move in the puzzle
 */
export type Move = {
  sourceVialIndex: number;
  targetVialIndex: number;
  colorsToPour: number;
};
