import type { PourGeometry } from "../animation/pour-geometry";
import type { PourPresentationSnapshot } from "../animation/timelines";
import { GAME_TIMING } from "../animation/timing";
import type { ColorId } from "../domain/colors";
import type {
  AppliedMove,
  AppliedPourBatch,
  AppliedPourTransfer,
  Board,
} from "../domain/types";

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

export interface PourBatchPresentation {
  transfer: AppliedPourTransfer;
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

function selectedSet(
  selectedSourceVialIndex: number | null | undefined,
  selectedSourceVialIndices: readonly number[] | undefined,
): ReadonlySet<number> {
  if (selectedSourceVialIndices !== undefined) return new Set(selectedSourceVialIndices);
  return selectedSourceVialIndex === null || selectedSourceVialIndex === undefined
    ? new Set()
    : new Set([selectedSourceVialIndex]);
}

export function buildStaticBoardRenderState({
  board,
  anchors,
  selectedSourceVialIndex,
  selectedSourceVialIndices,
  capacity,
  boardAlpha = 1,
  boardScale = 1,
  debugGeometry = false,
}: {
  board: Board;
  anchors: readonly VialAnchor[];
  selectedSourceVialIndex?: number | null;
  selectedSourceVialIndices?: readonly number[];
  capacity: number;
  boardAlpha?: number;
  boardScale?: number;
  debugGeometry?: boolean;
}): BoardRenderState {
  const selected = selectedSet(selectedSourceVialIndex, selectedSourceVialIndices);
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
      selectionOffsetY: selected.has(vialIndex) ? -10 : 0,
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

function sourceBands(
  board: Board,
  transfer: Pick<AppliedPourTransfer, "move" | "amount">,
  transferProgress: number,
): LiquidBandRenderState[] {
  const sourceVial = board[transfer.move.sourceVialIndex] ?? [];
  const firstTransferredIndex = Math.max(0, sourceVial.length - transfer.amount);
  return sourceVial.map((color, index) => ({
    color,
    volume: index < firstTransferredIndex ? 1 : 1 - transferProgress,
  }));
}

function destinationBands(
  board: Board,
  destinationVialIndex: number,
  incoming: readonly PourBatchPresentation[],
): LiquidBandRenderState[] {
  const destinationVial = board[destinationVialIndex] ?? [];
  return [
    ...destinationVial.map((color) => ({color, volume: 1})),
    ...incoming.flatMap(({transfer, presentation}) => {
      const progress = getTransferProgress(presentation.timeSeconds);
      return Array.from({length: transfer.amount}, () => ({
        color: transfer.color,
        volume: progress,
      }));
    }),
  ];
}

function combinedDestinationWave(
  incoming: readonly PourBatchPresentation[],
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

export function buildPourBatchBoardRenderState({
  batch,
  anchors,
  presentations,
  capacity,
  debugGeometry = false,
}: {
  batch: AppliedPourBatch;
  anchors: readonly VialAnchor[];
  presentations: readonly PourBatchPresentation[];
  capacity: number;
  debugGeometry?: boolean;
}): BoardRenderState {
  const presentationBySource = new Map(
    presentations.map((entry) => [entry.transfer.move.sourceVialIndex, entry] as const),
  );
  const incomingByDestination = new Map<number, PourBatchPresentation[]>();
  for (const entry of presentations) {
    const destinationVialIndex = entry.transfer.move.destinationVialIndex;
    const incoming = incomingByDestination.get(destinationVialIndex) ?? [];
    incoming.push(entry);
    incomingByDestination.set(destinationVialIndex, incoming);
  }

  const vials = batch.previousBoard.map((vial, vialIndex): VialRenderState => {
    const sourcePresentation = presentationBySource.get(vialIndex);
    if (sourcePresentation !== undefined) {
      const {transfer, geometry, presentation} = sourcePresentation;
      const progress = getTransferProgress(presentation.timeSeconds);
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
        bands: sourceBands(batch.previousBoard, transfer, progress),
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
        selectionOffsetY: 0,
        pivot: "center",
        bands: destinationBands(batch.previousBoard, vialIndex, incoming),
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
      selectionOffsetY: 0,
      pivot: "center",
      bands: staticBands(vial),
      surface: emptySurface(),
    };
  });

  const streams = presentations.flatMap(({transfer, geometry, presentation}) => {
    if (presentation.streamOpacity <= 0.001) return [];
    const destinationVialIndex = transfer.move.destinationVialIndex;
    const previousDestinationFill = batch.previousBoard[destinationVialIndex]?.length ?? 0;
    const destinationIncoming = incomingByDestination.get(destinationVialIndex) ?? [];
    const destinationFill = previousDestinationFill + destinationIncoming.reduce(
      (sum, entry) =>
        sum + entry.transfer.amount * getTransferProgress(entry.presentation.timeSeconds),
      0,
    );
    return [{
      color: transfer.color,
      opacity: presentation.streamOpacity,
      sourceVialIndex: transfer.move.sourceVialIndex,
      destinationVialIndex,
      direction: geometry.direction,
      destinationFill,
    } satisfies PourStreamRenderState];
  });

  return {
    capacity,
    vials,
    streams,
    boardAlpha: 1,
    boardScale: 1,
    debugGeometry,
  };
}

function buildSourceBands(move: AppliedMove, transferProgress: number): LiquidBandRenderState[] {
  return sourceBands(move.previousBoard, move, transferProgress);
}

function buildDestinationBands(
  move: AppliedMove,
  transferProgress: number,
): LiquidBandRenderState[] {
  const destinationVial = move.previousBoard[move.move.destinationVialIndex] ?? [];
  return [
    ...destinationVial.map((color) => ({color, volume: 1})),
    ...Array.from({length: move.amount}, () => ({
      color: move.color,
      volume: transferProgress,
    })),
  ];
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
  const transferProgress = getTransferProgress(presentation.timeSeconds);
  const sourceIndex = move.move.sourceVialIndex;
  const destinationIndex = move.move.destinationVialIndex;
  const previousDestinationFill = move.previousBoard[destinationIndex]?.length ?? 0;

  const vials = move.previousBoard.map((vial, vialIndex): VialRenderState => {
    const isSource = vialIndex === sourceIndex;
    const isDestination = vialIndex === destinationIndex;

    if (isSource) {
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
        bands: buildSourceBands(move, transferProgress),
        surface: {
          freeSurfaceAngleDegrees: presentation.liquid.sourceLocalAngleDegrees,
          curvatureAmplitude: presentation.liquid.sourceCurvatureAmplitude,
          waveSamples: [],
        },
      };
    }

    if (isDestination) {
      return {
        vialIndex,
        anchor: anchors[vialIndex] ?? {x: 0, y: 0, width: 1, height: 1},
        translationX: 0,
        translationY: 0,
        rotationDegrees: 0,
        scale: presentation.destinationScale,
        alpha: 1,
        selectionOffsetY: 0,
        pivot: "center",
        bands: buildDestinationBands(move, transferProgress),
        surface: {
          freeSurfaceAngleDegrees: 0,
          curvatureAmplitude: 0,
          waveSamples: presentation.liquid.destinationDisplacements,
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
      bands: staticBands(vial),
      surface: emptySurface(),
    };
  });

  return {
    capacity,
    vials,
    streams: presentation.streamOpacity <= 0.001
      ? []
      : [{
          color: move.color,
          opacity: presentation.streamOpacity,
          sourceVialIndex: sourceIndex,
          destinationVialIndex: destinationIndex,
          direction: geometry.direction,
          destinationFill: previousDestinationFill + move.amount * transferProgress,
        }],
    boardAlpha: 1,
    boardScale: 1,
    debugGeometry,
  };
}
