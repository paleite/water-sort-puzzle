import type { PourGeometry } from "../animation/pour-geometry";
import type { PourPresentationSnapshot } from "../animation/timelines";
import { GAME_TIMING } from "../animation/timing";
import type { ColorId } from "../domain/colors";
import type { AppliedMove, Board } from "../domain/types";

export interface VialAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiquidBandRenderState {
  color: ColorId;
  volume: number;
}

export interface LiquidSurfaceRenderState {
  freeSurfaceAngleDegrees: number;
  curvatureAmplitude: number;
  waveSamples: readonly number[];
}

export type VialPivot = "center" | "left-mouth" | "right-mouth";

export interface VialRenderState {
  vialIndex: number;
  anchor: VialAnchor;
  translationX: number;
  translationY: number;
  rotationDegrees: number;
  scale: number;
  alpha: number;
  selectionOffsetY: number;
  pivot: VialPivot;
  bands: readonly LiquidBandRenderState[];
  surface: LiquidSurfaceRenderState;
}

export interface PourStreamRenderState {
  color: ColorId;
  opacity: number;
  sourceVialIndex: number;
  destinationVialIndex: number;
  direction: "left" | "right";
  destinationFill: number;
}

export interface BoardRenderState {
  capacity: number;
  vials: readonly VialRenderState[];
  streams: readonly PourStreamRenderState[];
  boardAlpha: number;
  boardScale: number;
  debugGeometry: boolean;
}

export interface ConcurrentPourPresentation {
  move: AppliedMove;
  geometry: PourGeometry;
  presentation: PourPresentationSnapshot;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function staticBands(vial: readonly ColorId[]): LiquidBandRenderState[] {
  return vial.map((color) => ({color, volume: 1}));
}

function emptySurface(): LiquidSurfaceRenderState {
  return {
    freeSurfaceAngleDegrees: 0,
    curvatureAmplitude: 0,
    waveSamples: [],
  };
}

export function buildStaticBoardRenderState({
  board,
  anchors,
  selectedSourceVialIndex,
  capacity,
  boardAlpha = 1,
  boardScale = 1,
  debugGeometry = false,
}: {
  board: Board;
  anchors: readonly VialAnchor[];
  selectedSourceVialIndex: number | null;
  capacity: number;
  boardAlpha?: number;
  boardScale?: number;
  debugGeometry?: boolean;
}): BoardRenderState {
  return {
    capacity,
    vials: board.map((vial, vialIndex) => ({
      vialIndex,
      anchor: anchors[vialIndex] ?? {x: 0, y: 0, width: 1, height: 1},
      translationX: 0,
      translationY: 0,
      rotationDegrees: 0,
      scale: 1,
      alpha: 1,
      selectionOffsetY: selectedSourceVialIndex === vialIndex ? -10 : 0,
      pivot: "center",
      bands: staticBands(vial),
      surface: emptySurface(),
    })),
    streams: [],
    boardAlpha,
    boardScale,
    debugGeometry,
  };
}

function getTransferProgress(timeSeconds: number): number {
  return clamp(
    (timeSeconds - GAME_TIMING.pour.transferStartSeconds) / GAME_TIMING.pour.transferSeconds,
    0,
    1,
  );
}

function removeVolumeFromTop(
  bands: LiquidBandRenderState[],
  color: ColorId,
  amount: number,
): void {
  let remaining = Math.max(0, amount);

  for (let index = bands.length - 1; index >= 0 && remaining > 0.0001; index -= 1) {
    const band = bands[index];
    if (band === undefined || band.color !== color) break;

    const removed = Math.min(band.volume, remaining);
    const nextVolume = band.volume - removed;
    remaining -= removed;

    if (nextVolume <= 0.0001) bands.splice(index, 1);
    else bands[index] = {...band, volume: nextVolume};
  }
}

function addVolumeToTop(
  bands: LiquidBandRenderState[],
  color: ColorId,
  amount: number,
): void {
  let remaining = Math.max(0, amount);
  while (remaining > 0.0001) {
    const volume = Math.min(1, remaining);
    bands.push({color, volume});
    remaining -= volume;
  }
}

function combinedDestinationWave(
  incoming: readonly ConcurrentPourPresentation[],
): readonly number[] {
  const sampleCount = Math.max(
    0,
    ...incoming.map(({presentation}) => presentation.liquid.destinationDisplacements.length),
  );

  return Array.from({length: sampleCount}, (_, sampleIndex) =>
    clamp(
      incoming.reduce(
        (sum, {presentation}) =>
          sum + (presentation.liquid.destinationDisplacements[sampleIndex] ?? 0),
        0,
      ),
      -8,
      8,
    )
  );
}

export function buildConcurrentPourBoardRenderState({
  board,
  anchors,
  presentations,
  selectedSourceVialIndex,
  capacity,
  debugGeometry = false,
}: {
  board: Board;
  anchors: readonly VialAnchor[];
  presentations: readonly ConcurrentPourPresentation[];
  selectedSourceVialIndex: number | null;
  capacity: number;
  debugGeometry?: boolean;
}): BoardRenderState {
  const visualBands = board.map((vial) => staticBands(vial));
  const presentationBySource = new Map<number, ConcurrentPourPresentation>();
  const incomingByDestination = new Map<number, ConcurrentPourPresentation[]>();

  for (const entry of presentations) {
    const transferProgress = getTransferProgress(entry.presentation.timeSeconds);
    const remainingAmount = entry.move.amount * (1 - transferProgress);
    const sourceIndex = entry.move.move.sourceVialIndex;
    const destinationIndex = entry.move.move.destinationVialIndex;

    const sourceBands = visualBands[sourceIndex];
    const destinationBands = visualBands[destinationIndex];
    if (sourceBands !== undefined) {
      addVolumeToTop(sourceBands, entry.move.color, remainingAmount);
    }
    if (destinationBands !== undefined) {
      removeVolumeFromTop(destinationBands, entry.move.color, remainingAmount);
    }

    presentationBySource.set(sourceIndex, entry);
    const incoming = incomingByDestination.get(destinationIndex) ?? [];
    incoming.push(entry);
    incomingByDestination.set(destinationIndex, incoming);
  }

  const vials = board.map((_, vialIndex): VialRenderState => {
    const sourcePresentation = presentationBySource.get(vialIndex);
    if (sourcePresentation !== undefined) {
      const {geometry, presentation} = sourcePresentation;
      return {
        vialIndex,
        anchor: anchors[vialIndex] ?? {x: 0, y: 0, width: 1, height: 1},
        translationX: presentation.sourceX,
        translationY: presentation.sourceY,
        rotationDegrees: presentation.sourceRotationDegrees,
        scale: 1,
        alpha: 1,
        selectionOffsetY: 0,
        pivot: geometry.direction === "right" ? "right-mouth" : "left-mouth",
        bands: visualBands[vialIndex] ?? [],
        surface: {
          freeSurfaceAngleDegrees: presentation.liquid.sourceLocalAngleDegrees,
          curvatureAmplitude: presentation.liquid.sourceCurvatureAmplitude,
          waveSamples: [],
        },
      };
    }

    const incoming = incomingByDestination.get(vialIndex);
    if (incoming !== undefined) {
      return {
        vialIndex,
        anchor: anchors[vialIndex] ?? {x: 0, y: 0, width: 1, height: 1},
        translationX: 0,
        translationY: 0,
        rotationDegrees: 0,
        scale: Math.max(1, ...incoming.map(({presentation}) => presentation.destinationScale)),
        alpha: 1,
        selectionOffsetY: selectedSourceVialIndex === vialIndex ? -10 : 0,
        pivot: "center",
        bands: visualBands[vialIndex] ?? [],
        surface: {
          freeSurfaceAngleDegrees: 0,
          curvatureAmplitude: 0,
          waveSamples: combinedDestinationWave(incoming),
        },
      };
    }

    return {
      vialIndex,
      anchor: anchors[vialIndex] ?? {x: 0, y: 0, width: 1, height: 1},
      translationX: 0,
      translationY: 0,
      rotationDegrees: 0,
      scale: 1,
      alpha: 1,
      selectionOffsetY: selectedSourceVialIndex === vialIndex ? -10 : 0,
      pivot: "center",
      bands: visualBands[vialIndex] ?? [],
      surface: emptySurface(),
    };
  });

  const destinationFillByIndex = new Map<number, number>();
  for (const [destinationIndex, bands] of visualBands.entries()) {
    destinationFillByIndex.set(
      destinationIndex,
      bands.reduce((sum, band) => sum + band.volume, 0),
    );
  }

  const streams = presentations.flatMap(({move, geometry, presentation}) =>
    presentation.streamOpacity <= 0.001
      ? []
      : [{
          color: move.color,
          opacity: presentation.streamOpacity,
          sourceVialIndex: move.move.sourceVialIndex,
          destinationVialIndex: move.move.destinationVialIndex,
          direction: geometry.direction,
          destinationFill:
            destinationFillByIndex.get(move.move.destinationVialIndex)
            ?? (board[move.move.destinationVialIndex]?.length ?? 0),
        } satisfies PourStreamRenderState]
  );

  return {
    capacity,
    vials,
    streams,
    boardAlpha: 1,
    boardScale: 1,
    debugGeometry,
  };
}

export function buildPourBoardRenderState({
  move,
  anchors,
  selectedSourceVialIndex,
  geometry,
  presentation,
  capacity,
  debugGeometry = false,
}: {
  move: AppliedMove;
  anchors: readonly VialAnchor[];
  selectedSourceVialIndex: number | null;
  geometry: PourGeometry;
  presentation: PourPresentationSnapshot;
  capacity: number;
  debugGeometry?: boolean;
}): BoardRenderState {
  return buildConcurrentPourBoardRenderState({
    board: move.nextBoard,
    anchors,
    presentations: [{move, geometry, presentation}],
    selectedSourceVialIndex,
    capacity,
    debugGeometry,
  });
}
