import {
  Application,
  Assets,
  Container,
  Graphics,
  Mesh,
  MeshGeometry,
  Shader,
  Sprite,
  Texture,
  UniformGroup,
} from "pixi.js";

import {LIQUID_PATTERN_IDS} from "../presentation/liquid-patterns";
import {LIQUID_COLORS} from "../presentation/palette";
import {
  fillToVialY,
  VIAL_INNER_BOTTOM,
  VIAL_INNER_HEIGHT,
  VIAL_INNER_LEFT,
  VIAL_INNER_RIGHT,
  VIAL_INNER_TOP,
  VIAL_INNER_WIDTH,
  VIAL_MOUTH,
  VIAL_VIEWBOX_HEIGHT,
  VIAL_VIEWBOX_WIDTH,
} from "../presentation/vial-geometry";
import {
  DEFAULT_VIAL_SKIN,
  DEFAULT_VIAL_SKIN_ID,
  getVialSkin,
  type VialSkinId,
} from "../presentation/vial-skins";
import {calculateLiquidProjectionGeometry} from "./liquid-projection";
import type {
  BoardRenderState,
  PourStreamRenderState,
  VialRenderState,
} from "./render-state";
import {liquidFragmentShader, liquidVertexShader} from "./liquid-shader";

interface VialVisual {
  liquidContainer: Container;
  artworkContainer: Container;
  movingContainer: Container;
  uniforms: UniformGroup;
  debug: Graphics;
  sparkles: readonly Graphics[];
  artwork: Sprite;
  glassBackground: Sprite;
  stopper: Sprite;
}

interface VialArtTextures {
  front: Texture;
  background: Texture | null;
  stoppers: readonly Texture[];
}

interface Point {
  x: number;
  y: number;
}

interface StreamCurve {
  source: Point;
  control: Point;
  destination: Point;
}

const VIAL_CENTER_X = VIAL_VIEWBOX_WIDTH / 2;
const VIAL_CENTER_Y = VIAL_VIEWBOX_HEIGHT / 2;
const SURFACE_SAMPLE_COUNT = 11;
const SURFACE_WAVE_VISUAL_GAIN = 2.15;
const MAX_NORMALIZED_WAVE_OFFSET = 0.075;
const STREAM_SAMPLE_COUNT = 10;
const STOPPER_VARIANTS = ["cork", "wax", "crystal", "orb", "moon"] as const;

function hexToPackedColor(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

function hexToRgba(hex: string): Float32Array {
  const value = hexToPackedColor(hex);
  return new Float32Array([
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255,
    1,
  ]);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function deterministicUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function traceLiquidPolygon(graphics: Graphics): Graphics {
  const [firstPoint, ...remainingPoints] = DEFAULT_VIAL_SKIN.liquidPolygon;
  if (firstPoint === undefined) {
    throw new Error("Default vial skin must define a liquid polygon.");
  }

  graphics.moveTo(firstPoint.x, firstPoint.y);
  for (const point of remainingPoints) {
    graphics.lineTo(point.x, point.y);
  }
  return graphics.closePath();
}

function createInteriorMask(): Graphics {
  return traceLiquidPolygon(new Graphics()).fill(0xffffff);
}

function createVialArtwork(texture: Texture): Sprite {
  const sprite = new Sprite(texture);
  sprite.width = DEFAULT_VIAL_SKIN.viewBox.width;
  sprite.height = DEFAULT_VIAL_SKIN.viewBox.height;
  return sprite;
}

function createLiquidGeometry(): MeshGeometry {
  return new MeshGeometry({
    positions: new Float32Array([
      VIAL_INNER_LEFT,
      VIAL_INNER_TOP,
      VIAL_INNER_RIGHT,
      VIAL_INNER_TOP,
      VIAL_INNER_RIGHT,
      VIAL_INNER_BOTTOM,
      VIAL_INNER_LEFT,
      VIAL_INNER_BOTTOM,
    ]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
}

function createUniforms(): UniformGroup {
  return new UniformGroup({
    uTime: {value: 0, type: "f32"},
    uFill: {value: 0, type: "f32"},
    uSurfaceNormal: {value: new Float32Array([0, 1]), type: "vec2<f32>"},
    uInteriorAspect: {value: VIAL_INNER_WIDTH / VIAL_INNER_HEIGHT, type: "f32"},
    uFreeSurfaceThreshold: {value: 0, type: "f32"},
    uBandThresholds: {value: new Float32Array([0, 0, 0, 0]), type: "vec4<f32>"},
    uCurvature: {value: 0, type: "f32"},
    uBand0: {value: new Float32Array([0, 0, 0, 0]), type: "vec4<f32>"},
    uBand1: {value: new Float32Array([0, 0, 0, 0]), type: "vec4<f32>"},
    uBand2: {value: new Float32Array([0, 0, 0, 0]), type: "vec4<f32>"},
    uBand3: {value: new Float32Array([0, 0, 0, 0]), type: "vec4<f32>"},
    uBandVolumes: {value: new Float32Array([0, 0, 0, 0]), type: "vec4<f32>"},
    uBandPatterns: {value: new Float32Array([0, 0, 0, 0]), type: "vec4<f32>"},
    uWave0: {value: new Float32Array([0, 0, 0, 0]), type: "vec4<f32>"},
    uWave1: {value: new Float32Array([0, 0, 0, 0]), type: "vec4<f32>"},
    uWave2: {value: new Float32Array([0, 0, 0, 0]), type: "vec4<f32>"},
  });
}

function fillArray(target: Float32Array, values: readonly number[]): void {
  target.fill(0);
  values.forEach((value, index) => {
    if (index < target.length) target[index] = value;
  });
}

function sampleWaveAt(samples: readonly number[], xNormalized: number): number {
  if (samples.length === 0) return 0;
  if (samples.length === 1) return samples[0] ?? 0;

  const scaled = clamp(xNormalized, 0, 1) * (samples.length - 1);
  const firstIndex = Math.floor(scaled);
  const secondIndex = Math.min(samples.length - 1, firstIndex + 1);
  const progress = scaled - firstIndex;
  const first = samples[firstIndex] ?? 0;
  const second = samples[secondIndex] ?? first;
  return lerp(first, second, progress);
}

function quadraticPoint(curve: StreamCurve, progress: number): Point {
  const inverse = 1 - progress;
  return {
    x:
      inverse * inverse * curve.source.x
      + 2 * inverse * progress * curve.control.x
      + progress * progress * curve.destination.x,
    y:
      inverse * inverse * curve.source.y
      + 2 * inverse * progress * curve.control.y
      + progress * progress * curve.destination.y,
  };
}

function quadraticTangent(curve: StreamCurve, progress: number): Point {
  return {
    x:
      2 * (1 - progress) * (curve.control.x - curve.source.x)
      + 2 * progress * (curve.destination.x - curve.control.x),
    y:
      2 * (1 - progress) * (curve.control.y - curve.source.y)
      + 2 * progress * (curve.destination.y - curve.control.y),
  };
}

function streamHalfWidth(
  progress: number,
  sourceHalfWidth: number,
  middleHalfWidth: number,
  destinationHalfWidth: number,
): number {
  return progress <= 0.5
    ? lerp(sourceHalfWidth, middleHalfWidth, progress * 2)
    : lerp(middleHalfWidth, destinationHalfWidth, (progress - 0.5) * 2);
}

export class PixiBoardRenderer {
  private readonly boardElement: HTMLElement;
  private readonly canvasHost: HTMLElement;
  private readonly app = new Application();
  private readonly liquidLayer = new Container();
  private readonly streamLayer = new Container();
  private readonly artworkLayer = new Container();
  private readonly movingVialLayer = new Container();
  private readonly visuals = new Map<number, VialVisual>();
  private readonly streams = new Map<number, Graphics>();
  private pendingState: BoardRenderState | null = null;
  private vialTexture: Texture | null = null;
  private glassBackgroundTexture: Texture | null = null;
  private stopperTextures: readonly Texture[] = [];
  private skinId: VialSkinId = DEFAULT_VIAL_SKIN_ID;
  private initializationState: "idle" | "initializing" | "ready" | "destroyed" = "idle";
  private destroyRequested = false;
  private elapsedSeconds = 0;
  private prefersReducedMotion = false;

  constructor({boardElement, canvasHost}: {boardElement: HTMLElement; canvasHost: HTMLElement}) {
    this.boardElement = boardElement;
    this.canvasHost = canvasHost;
  }

  async initialize(): Promise<void> {
    if (this.initializationState !== "idle") return;
    this.initializationState = "initializing";

    await this.app.init({
      preference: "webgl",
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 3),
      backgroundAlpha: 0,
      resizeTo: this.boardElement,
    });

    const initialSkinId = this.skinId;
    const initialTextures = await this.loadSkinTextures(initialSkinId);
    this.vialTexture = initialTextures.front;
    this.glassBackgroundTexture = initialTextures.background;
    this.stopperTextures = initialTextures.stoppers;
    this.prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (this.destroyRequested) {
      this.destroyApplication();
      return;
    }

    this.initializationState = "ready";
    this.liquidLayer.sortableChildren = true;
    this.artworkLayer.sortableChildren = true;
    this.movingVialLayer.sortableChildren = true;
    this.app.stage.addChild(
      this.liquidLayer,
      this.streamLayer,
      this.artworkLayer,
      this.movingVialLayer,
    );
    this.canvasHost.replaceChildren(this.app.canvas);
    this.app.ticker.add((ticker) => {
      if (!this.prefersReducedMotion) {
        this.elapsedSeconds += Math.min(ticker.deltaMS / 1000, 0.05);
      }
      for (const [vialIndex, visual] of this.visuals.entries()) {
        visual.uniforms.uniforms.uTime = this.elapsedSeconds;
        for (let sparkleIndex = 0; sparkleIndex < visual.sparkles.length; sparkleIndex++) {
          const sparkle = visual.sparkles[sparkleIndex];
          if (sparkle === undefined) continue;
          if (this.prefersReducedMotion) {
            sparkle.alpha = 0.35;
            continue;
          }
          const phase = this.elapsedSeconds * 1.4 + vialIndex * 0.91 + sparkleIndex * 2.3;
          const shimmer = (Math.sin(phase) + 1) / 2;
          sparkle.alpha = 0.14 + shimmer * 0.34;
          sparkle.scale.set(0.8 + shimmer * 0.28);
        }
      }
    });

    const pendingState = this.pendingState;
    if (pendingState !== null) this.render(pendingState);
    if (this.skinId !== initialSkinId) {
      void this.setVialSkin(this.skinId);
    }
  }

  private async loadSkinTextures(skinId: VialSkinId): Promise<VialArtTextures> {
    const skin = getVialSkin(skinId);
    const basePath = process.env["NEXT_PUBLIC_BASE_PATH"] ?? "";
    const stopperSources = skin.stopperSources
      ?? (skinId === DEFAULT_VIAL_SKIN.id
        ? STOPPER_VARIANTS.map((name) => `${basePath}/potions/stoppers/${name}.svg`)
        : []);

    const [front, background, stoppers] = await Promise.all([
      Assets.load<Texture>(skin.svgSource),
      skin.backgroundSource === undefined
        ? Promise.resolve(null)
        : Assets.load<Texture>(skin.backgroundSource),
      Promise.all(stopperSources.map((source) => Assets.load<Texture>(source)))
        .catch((error: unknown): Texture[] => {
          // Optional ornaments must not prevent the game board from loading.
          console.warn("Unable to load potion stoppers.", error);
          return [];
        }),
    ]);

    return {front, background, stoppers};
  }

  async setVialSkin(skinId: VialSkinId): Promise<void> {
    this.skinId = skinId;
    if (this.initializationState !== "ready") return;

    let textures: VialArtTextures;
    try {
      textures = await this.loadSkinTextures(skinId);
    } catch (error: unknown) {
      console.error("Unable to load potion vial artwork.", error);
      return;
    }
    if (this.skinId !== skinId || this.initializationState !== "ready") return;

    this.vialTexture = textures.front;
    this.glassBackgroundTexture = textures.background;
    this.stopperTextures = textures.stoppers;

    for (const [vialIndex, visual] of this.visuals) {
      // Pixi sprites retain their texture-dependent scale: reset logical
      // dimensions after each skin swap (PNG sources are exported at 4x).
      visual.artwork.texture = textures.front;
      visual.artwork.width = VIAL_VIEWBOX_WIDTH;
      visual.artwork.height = VIAL_VIEWBOX_HEIGHT;
      visual.glassBackground.texture = textures.background ?? Texture.EMPTY;
      visual.glassBackground.width = VIAL_VIEWBOX_WIDTH;
      visual.glassBackground.height = VIAL_VIEWBOX_HEIGHT;
      visual.glassBackground.visible = textures.background !== null;
      this.applyStopperTexture(visual, vialIndex);
    }
  }

  private applyStopperTexture(visual: VialVisual, vialIndex: number): void {
    const texture = this.stopperTextures[vialIndex % this.stopperTextures.length];
    visual.stopper.visible = texture !== undefined;
    if (texture === undefined) return;

    const bounds = getVialSkin(this.skinId).stopperBounds
      ?? {x: 0, y: 0, width: VIAL_VIEWBOX_WIDTH, height: 18};
    visual.stopper.texture = texture;
    // All ornament variants must stay inside the existing 100x272 vial box.
    visual.stopper.position.set(bounds.x, bounds.y);
    visual.stopper.width = bounds.width;
    visual.stopper.height = bounds.height;
  }

  destroy(): void {
    if (this.initializationState === "destroyed") return;
    this.destroyRequested = true;

    if (this.initializationState === "ready") {
      this.destroyApplication();
    }
  }

  render(state: BoardRenderState): void {
    this.pendingState = state;
    if (this.initializationState !== "ready") return;

    this.app.stage.alpha = state.boardAlpha;

    const boardRect = this.boardElement.getBoundingClientRect();
    for (const layer of [
      this.liquidLayer,
      this.streamLayer,
      this.artworkLayer,
      this.movingVialLayer,
    ]) {
      layer.pivot.set(boardRect.width / 2, boardRect.height / 2);
      layer.position.set(boardRect.width / 2, boardRect.height / 2);
      layer.scale.set(state.boardScale);
    }

    const visibleIndices = new Set<number>();
    for (const vialState of state.vials) {
      visibleIndices.add(vialState.vialIndex);
      const visual = this.ensureVialVisual(vialState.vialIndex);
      this.renderVial(visual, vialState, state.capacity, state.debugGeometry);
    }

    for (const [vialIndex, visual] of this.visuals) {
      const visible = visibleIndices.has(vialIndex);
      visual.liquidContainer.visible = visible;
      visual.artworkContainer.visible = visible;
    }

    this.renderStreams(state.streams, state);
  }

  private destroyApplication(): void {
    if (this.initializationState === "destroyed") return;

    this.visuals.clear();
    this.streams.clear();
    if (this.app.canvas.parentElement === this.canvasHost) {
      this.app.canvas.remove();
    }
    this.app.destroy(true, {children: true});
    this.initializationState = "destroyed";
  }

  private ensureVialVisual(vialIndex: number): VialVisual {
    const existing = this.visuals.get(vialIndex);
    if (existing !== undefined) return existing;
    if (this.vialTexture === null) {
      throw new Error("Vial artwork texture is not loaded.");
    }

    const liquidContainer = new Container();
    const artworkContainer = new Container();
    const movingContainer = new Container();
    const mask = createInteriorMask();
    const uniforms = createUniforms();
    uniforms.uniforms.uTime = this.elapsedSeconds;
    const shader = Shader.from({
      gl: {vertex: liquidVertexShader, fragment: liquidFragmentShader},
      resources: {liquidUniforms: uniforms},
    });
    const mesh = new Mesh({geometry: createLiquidGeometry(), shader});
    mesh.mask = mask;
    const artwork = createVialArtwork(this.vialTexture);
    const glassBackground = createVialArtwork(this.glassBackgroundTexture ?? Texture.EMPTY);
    glassBackground.visible = this.glassBackgroundTexture !== null;
    const stopper = new Sprite(Texture.EMPTY);
    const debug = new Graphics();
    // Two deliberately quiet gold glints per vial: animated, but not interactive.
    // They live in the artwork container so they follow the original pour geometry.
    const sparkles = [
      new Graphics().circle(23, 78, 1.5).fill({color: 0xffe9ae}),
      new Graphics().circle(79, 190, 1.2).fill({color: 0xffd692}),
    ];
    sparkles.forEach((sparkle) => { sparkle.alpha = 0.35; });

    liquidContainer.addChild(glassBackground, mesh, mask);
    artworkContainer.addChild(artwork, stopper, ...sparkles, debug);
    this.liquidLayer.addChild(liquidContainer);
    this.artworkLayer.addChild(artworkContainer);
    this.movingVialLayer.addChild(movingContainer);

    const visual = {
      liquidContainer,
      artworkContainer,
      movingContainer,
      uniforms,
      debug,
      sparkles,
      artwork,
      glassBackground,
      stopper,
    };
    this.applyStopperTexture(visual, vialIndex);
    this.visuals.set(vialIndex, visual);
    return visual;
  }

  private placeVialVisual(visual: VialVisual, moving: boolean): void {
    if (moving) {
      if (visual.liquidContainer.parent !== visual.movingContainer) {
        visual.movingContainer.addChild(
          visual.liquidContainer,
          visual.artworkContainer,
        );
      }
      return;
    }

    if (visual.liquidContainer.parent !== this.liquidLayer) {
      this.liquidLayer.addChild(visual.liquidContainer);
    }
    if (visual.artworkContainer.parent !== this.artworkLayer) {
      this.artworkLayer.addChild(visual.artworkContainer);
    }
  }

  private applyVialTransform(
    container: Container,
    state: VialRenderState,
    baseScale: number,
    pivotPoint: Point,
  ): void {
    const scale = baseScale * state.scale;
    const pivotRestX = state.anchor.x + (pivotPoint.x - VIAL_CENTER_X) * baseScale;
    const pivotRestY = state.anchor.y + (pivotPoint.y - VIAL_CENTER_Y) * baseScale;

    container.pivot.set(pivotPoint.x, pivotPoint.y);
    container.position.set(
      pivotRestX + state.translationX,
      pivotRestY + state.translationY + state.selectionOffsetY,
    );
    // Deform glass, liquid mesh, mask and ornaments together in local space.
    container.scale.set(scale * (state.scaleX ?? 1), scale * (state.scaleY ?? 1));
    container.rotation = (state.rotationDegrees * Math.PI) / 180;
    container.alpha = state.alpha;
    container.zIndex = state.pivot === "center" ? 0 : 20;
  }

  private renderVial(
    visual: VialVisual,
    state: VialRenderState,
    capacity: number,
    debugGeometry: boolean,
  ): void {
    const baseScale = Math.max(0.001, state.anchor.width / VIAL_VIEWBOX_WIDTH);
    const pivotPoint = state.pivot === "left-mouth"
      ? VIAL_MOUTH.left
      : state.pivot === "right-mouth"
        ? VIAL_MOUTH.right
        : {x: VIAL_CENTER_X, y: VIAL_CENTER_Y};

    this.placeVialVisual(visual, state.pivot !== "center");
    // Open the mouth during pours; no stopper ever extends above y=0.
    visual.stopper.alpha = state.pivot === "center"
      ? 1
      : Math.max(0, 1 - Math.abs(state.rotationDegrees) / 7);
    this.applyVialTransform(visual.liquidContainer, state, baseScale, pivotPoint);
    this.applyVialTransform(visual.artworkContainer, state, baseScale, pivotPoint);

    const bands = state.bands.slice(0, 4);
    const bandVolumes = bands.map((band) => clamp(band.volume, 0, 1));
    const totalUnits = bandVolumes.reduce((sum, volume) => sum + volume, 0);
    const projectionGeometry = calculateLiquidProjectionGeometry({
      surfaceAngleDegrees: state.surface.freeSurfaceAngleDegrees,
      bandVolumes,
      capacity,
    });

    const uniforms = visual.uniforms.uniforms;
    uniforms.uTime = this.elapsedSeconds;
    uniforms.uFill = clamp(totalUnits / capacity, 0, 1);
    uniforms.uInteriorAspect = projectionGeometry.interiorAspect;
    uniforms.uFreeSurfaceThreshold = projectionGeometry.freeSurfaceThreshold;

    const surfaceNormal = uniforms.uSurfaceNormal as Float32Array;
    surfaceNormal[0] = projectionGeometry.normal.x;
    surfaceNormal[1] = projectionGeometry.normal.y;
    fillArray(
      uniforms.uBandThresholds as Float32Array,
      projectionGeometry.bandThresholds,
    );

    uniforms.uCurvature = state.surface.curvatureAmplitude / VIAL_INNER_HEIGHT;

    const colors = [
      uniforms.uBand0,
      uniforms.uBand1,
      uniforms.uBand2,
      uniforms.uBand3,
    ] as Float32Array[];
    const volumes = uniforms.uBandVolumes as Float32Array;
    const patterns = uniforms.uBandPatterns as Float32Array;
    volumes.fill(0);
    patterns.fill(0);

    for (let index = 0; index < 4; index += 1) {
      const band = bands[index];
      if (band === undefined) {
        colors[index]?.set([0, 0, 0, 0]);
        continue;
      }
      colors[index]?.set(hexToRgba(LIQUID_COLORS[band.color]));
      volumes[index] = bandVolumes[index] ?? 0;
      patterns[index] = LIQUID_PATTERN_IDS[band.color];
    }

    const normalizedWave = Array.from({length: SURFACE_SAMPLE_COUNT}, (_, index) =>
      clamp(
        ((state.surface.waveSamples[index] ?? 0) * SURFACE_WAVE_VISUAL_GAIN)
          / VIAL_INNER_HEIGHT,
        -MAX_NORMALIZED_WAVE_OFFSET,
        MAX_NORMALIZED_WAVE_OFFSET,
      ),
    );
    fillArray(uniforms.uWave0 as Float32Array, normalizedWave.slice(0, 4));
    fillArray(uniforms.uWave1 as Float32Array, normalizedWave.slice(4, 8));
    fillArray(uniforms.uWave2 as Float32Array, normalizedWave.slice(8, 11));

    visual.debug.clear();
    if (debugGeometry) {
      traceLiquidPolygon(visual.debug).stroke({color: 0x0ea5e9, alpha: 0.92, width: 1});
      visual.debug
        .circle(VIAL_MOUTH.left.x, VIAL_MOUTH.left.y, 2.4)
        .fill({color: 0xf59e0b, alpha: 0.95});
      visual.debug
        .circle(VIAL_MOUTH.right.x, VIAL_MOUTH.right.y, 2.4)
        .fill({color: 0xf59e0b, alpha: 0.95});
    }
  }

  private renderStreams(
    streamStates: readonly PourStreamRenderState[],
    state: BoardRenderState,
  ): void {
    const activeStreamIndexes = new Set<number>();

    streamStates.forEach((streamState, streamIndex) => {
      activeStreamIndexes.add(streamIndex);
      let graphics = this.streams.get(streamIndex);
      if (graphics === undefined) {
        graphics = new Graphics();
        this.streams.set(streamIndex, graphics);
        this.streamLayer.addChild(graphics);
      }

      const sourceState = state.vials[streamState.sourceVialIndex];
      const destinationState = state.vials[streamState.destinationVialIndex];
      if (sourceState === undefined || destinationState === undefined) {
        graphics.clear();
        return;
      }

      const sourceScale = sourceState.anchor.width / VIAL_VIEWBOX_WIDTH;
      const sourceMouth = streamState.direction === "right" ? VIAL_MOUTH.right : VIAL_MOUTH.left;
      const sourcePivotRestX =
        sourceState.anchor.x + (sourceMouth.x - VIAL_CENTER_X) * sourceScale;
      const sourcePivotRestY =
        sourceState.anchor.y + (sourceMouth.y - VIAL_CENTER_Y) * sourceScale;
      const sourceX = sourcePivotRestX + sourceState.translationX;
      const sourceY = sourcePivotRestY + sourceState.translationY + sourceState.selectionOffsetY;

      const destinationScale =
        (destinationState.anchor.width / VIAL_VIEWBOX_WIDTH) * destinationState.scale;
      const destinationLocalX =
        VIAL_INNER_LEFT + VIAL_INNER_WIDTH * streamState.impactXNormalized;
      const destinationWavePixels =
        sampleWaveAt(
          destinationState.surface.waveSamples,
          streamState.impactXNormalized,
        ) * SURFACE_WAVE_VISUAL_GAIN;
      const destinationLocalY =
        fillToVialY(streamState.destinationFill, state.capacity) + destinationWavePixels;
      const destinationX =
        destinationState.anchor.x
        + (destinationLocalX - VIAL_CENTER_X) * destinationScale
        + destinationState.translationX;
      const destinationY =
        destinationState.anchor.y
        + (destinationLocalY - VIAL_CENTER_Y) * destinationScale
        + destinationState.translationY
        + destinationState.selectionOffsetY;

      this.drawStream(
        graphics,
        {
          x: sourceX,
          y: sourceY,
        },
        {
          x: destinationX,
          y: destinationY,
        },
        streamState,
        hexToPackedColor(LIQUID_COLORS[streamState.color]),
        state.debugGeometry,
      );
    });

    for (const [streamIndex, graphics] of this.streams) {
      if (!activeStreamIndexes.has(streamIndex)) graphics.clear();
    }
  }

  private createStreamCurve(
    source: Point,
    destination: Point,
    direction: "left" | "right",
  ): StreamCurve {
    const deltaX = destination.x - source.x;
    const deltaY = destination.y - source.y;
    const length = Math.max(0.001, Math.hypot(deltaX, deltaY));
    const directionSign = direction === "right" ? 1 : -1;
    const horizontalBow = directionSign * clamp(length * 0.055, 4, 10);
    const gravitySag = clamp(length * 0.13, 9, 18);

    return {
      source,
      control: {
        x: (source.x + destination.x) / 2 + horizontalBow,
        y: (source.y + destination.y) / 2 + gravitySag,
      },
      destination,
    };
  }

  private drawStream(
    graphics: Graphics,
    source: Point,
    destination: Point,
    streamState: PourStreamRenderState,
    color: number,
    debugGeometry: boolean,
  ): void {
    const curve = this.createStreamCurve(source, destination, streamState.direction);
    const widthScale = clamp(streamState.widthScale, 0.35, 1.35);
    const sourceHalfWidth = 3.2 * widthScale;
    const middleHalfWidth = 2.7 * widthScale;
    const destinationHalfWidth = 2.25 * widthScale;
    const leftPoints: Point[] = [];
    const rightPoints: Point[] = [];

    for (let index = 0; index <= STREAM_SAMPLE_COUNT; index += 1) {
      const progress = index / STREAM_SAMPLE_COUNT;
      const point = quadraticPoint(curve, progress);
      const tangent = quadraticTangent(curve, progress);
      const tangentLength = Math.max(0.001, Math.hypot(tangent.x, tangent.y));
      const normalX = -tangent.y / tangentLength;
      const normalY = tangent.x / tangentLength;
      const halfWidth = streamHalfWidth(
        progress,
        sourceHalfWidth,
        middleHalfWidth,
        destinationHalfWidth,
      );

      leftPoints.push({
        x: point.x + normalX * halfWidth,
        y: point.y + normalY * halfWidth,
      });
      rightPoints.push({
        x: point.x - normalX * halfWidth,
        y: point.y - normalY * halfWidth,
      });
    }

    graphics.clear();

    const opacity = clamp(streamState.opacity, 0, 1);
    const firstLeft = leftPoints[0];
    if (opacity > 0.001 && firstLeft !== undefined) {
      graphics.moveTo(firstLeft.x, firstLeft.y);
      for (const point of leftPoints.slice(1)) {
        graphics.lineTo(point.x, point.y);
      }
      for (const point of [...rightPoints].reverse()) {
        graphics.lineTo(point.x, point.y);
      }
      graphics.closePath().fill({color, alpha: opacity * 0.96});

      graphics
        .circle(destination.x, destination.y, destinationHalfWidth * 1.15)
        .fill({color, alpha: opacity * 0.74});
    }

    if (streamState.splashOpacity > 0.001) {
      const splashTime = streamState.splashProgress * 0.24;
      for (let index = 0; index < 3; index += 1) {
        const horizontalRandom = deterministicUnit(streamState.visualSeed + index * 13 + 1);
        const verticalRandom = deterministicUnit(streamState.visualSeed + index * 13 + 2);
        const radiusRandom = deterministicUnit(streamState.visualSeed + index * 13 + 3);
        const horizontalVelocity = (horizontalRandom - 0.5) * 34;
        const verticalVelocity = -(18 + verticalRandom * 24);
        const splashX = destination.x + horizontalVelocity * splashTime;
        const splashY =
          destination.y
          + verticalVelocity * splashTime
          + 0.5 * 150 * splashTime * splashTime;

        graphics
          .circle(splashX, splashY, 0.9 + radiusRandom * 1.25)
          .fill({color, alpha: streamState.splashOpacity * 0.82});
      }
    }

    if (streamState.terminalDropletOpacity > 0.001) {
      const dropletProgress =
        0.68 + 0.32 * streamState.terminalDropletProgress;
      const dropletPoint = quadraticPoint(curve, dropletProgress);
      const dropletRadius = 1.8 - 0.45 * streamState.terminalDropletProgress;
      graphics
        .circle(dropletPoint.x, dropletPoint.y, dropletRadius)
        .fill({color, alpha: streamState.terminalDropletOpacity});
    }

    if (debugGeometry) {
      graphics
        .circle(curve.control.x, curve.control.y, 2.2)
        .fill({color: 0xa855f7, alpha: 0.95});
      graphics
        .circle(destination.x, destination.y, 2.2)
        .fill({color: 0x22c55e, alpha: 0.95});
    }
  }
}
