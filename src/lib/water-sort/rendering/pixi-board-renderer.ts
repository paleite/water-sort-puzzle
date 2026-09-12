import {
  Application,
  Assets,
  Container,
  Graphics,
  Mesh,
  MeshGeometry,
  Shader,
  Sprite,
  type Texture,
  UniformGroup,
} from "pixi.js";

import { LIQUID_PATTERN_IDS } from "../presentation/liquid-patterns";
import { LIQUID_COLORS } from "../presentation/palette";
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
import { DEFAULT_VIAL_SKIN } from "../presentation/vial-skins";
import type {
  BoardRenderState,
  PourStreamRenderState,
  VialRenderState,
} from "./render-state";
import { liquidFragmentShader, liquidVertexShader } from "./liquid-shader";

interface VialVisual {
  container: Container;
  uniforms: UniformGroup;
  debug: Graphics;
}

const VIAL_CENTER_X = VIAL_VIEWBOX_WIDTH / 2;
const VIAL_CENTER_Y = VIAL_VIEWBOX_HEIGHT / 2;
const SURFACE_SAMPLE_COUNT = 11;
const SURFACE_WAVE_VISUAL_GAIN = 2.15;
const MAX_NORMALIZED_WAVE_OFFSET = 0.075;

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
      VIAL_INNER_LEFT, VIAL_INNER_TOP,
      VIAL_INNER_RIGHT, VIAL_INNER_TOP,
      VIAL_INNER_RIGHT, VIAL_INNER_BOTTOM,
      VIAL_INNER_LEFT, VIAL_INNER_BOTTOM,
    ]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
}

function createUniforms(): UniformGroup {
  return new UniformGroup({
    uTime: {value: 0, type: "f32"},
    uCapacity: {value: 4, type: "f32"},
    uFill: {value: 0, type: "f32"},
    uSurfaceSlope: {value: 0, type: "f32"},
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

export class PixiBoardRenderer {
  private readonly boardElement: HTMLElement;
  private readonly canvasHost: HTMLElement;
  private readonly app = new Application();
  private readonly vialLayer = new Container();
  private readonly streamLayer = new Container();
  private readonly visuals = new Map<number, VialVisual>();
  private readonly streams = new Map<number, Graphics>();
  private pendingState: BoardRenderState | null = null;
  private vialTexture: Texture | null = null;
  private initializationState: "idle" | "initializing" | "ready" | "destroyed" = "idle";
  private destroyRequested = false;
  private elapsedSeconds = 0;

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

    this.vialTexture = await Assets.load<Texture>(DEFAULT_VIAL_SKIN.svgSource);

    if (this.destroyRequested) {
      this.destroyApplication();
      return;
    }

    this.initializationState = "ready";
    this.vialLayer.sortableChildren = true;
    this.app.stage.addChild(this.vialLayer, this.streamLayer);
    this.canvasHost.replaceChildren(this.app.canvas);
    this.app.ticker.add((ticker) => {
      this.elapsedSeconds += Math.min(ticker.deltaMS / 1000, 0.05);
      for (const visual of this.visuals.values()) {
        visual.uniforms.uniforms.uTime = this.elapsedSeconds;
      }
    });

    const pendingState = this.pendingState;
    if (pendingState !== null) this.render(pendingState);
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
    this.vialLayer.pivot.set(boardRect.width / 2, boardRect.height / 2);
    this.vialLayer.position.set(boardRect.width / 2, boardRect.height / 2);
    this.vialLayer.scale.set(state.boardScale);

    const visibleIndices = new Set<number>();
    for (const vialState of state.vials) {
      visibleIndices.add(vialState.vialIndex);
      const visual = this.ensureVialVisual(vialState.vialIndex);
      this.renderVial(visual, vialState, state.capacity, state.debugGeometry);
    }

    for (const [vialIndex, visual] of this.visuals) {
      visual.container.visible = visibleIndices.has(vialIndex);
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

    const container = new Container();
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
    const debug = new Graphics();

    container.addChild(mesh, mask, artwork, debug);
    this.vialLayer.addChild(container);

    const visual = {container, uniforms, debug};
    this.visuals.set(vialIndex, visual);
    return visual;
  }

  private renderVial(
    visual: VialVisual,
    state: VialRenderState,
    capacity: number,
    debugGeometry: boolean,
  ): void {
    const baseScale = Math.max(0.001, state.anchor.width / VIAL_VIEWBOX_WIDTH);
    const scale = baseScale * state.scale;
    const pivotPoint = state.pivot === "left-mouth"
      ? VIAL_MOUTH.left
      : state.pivot === "right-mouth"
        ? VIAL_MOUTH.right
        : {x: VIAL_CENTER_X, y: VIAL_CENTER_Y};

    const pivotRestX = state.anchor.x + (pivotPoint.x - VIAL_CENTER_X) * baseScale;
    const pivotRestY = state.anchor.y + (pivotPoint.y - VIAL_CENTER_Y) * baseScale;

    visual.container.pivot.set(pivotPoint.x, pivotPoint.y);
    visual.container.position.set(
      pivotRestX + state.translationX,
      pivotRestY + state.translationY + state.selectionOffsetY,
    );
    visual.container.scale.set(scale);
    visual.container.rotation = (state.rotationDegrees * Math.PI) / 180;
    visual.container.alpha = state.alpha;
    visual.container.zIndex = state.pivot === "center" ? 0 : 20;

    const bands = state.bands.slice(0, 4);
    const totalUnits = bands.reduce((sum, band) => sum + clamp(band.volume, 0, 1), 0);
    const uniforms = visual.uniforms.uniforms;
    uniforms.uTime = this.elapsedSeconds;
    uniforms.uCapacity = capacity;
    uniforms.uFill = clamp(totalUnits / capacity, 0, 1);
    uniforms.uSurfaceSlope =
      Math.tan((state.surface.freeSurfaceAngleDegrees * Math.PI) / 180)
      * (VIAL_INNER_WIDTH / VIAL_INNER_HEIGHT);
    uniforms.uCurvature = state.surface.curvatureAmplitude / VIAL_INNER_HEIGHT;

    const colors = [uniforms.uBand0, uniforms.uBand1, uniforms.uBand2, uniforms.uBand3] as Float32Array[];
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
      volumes[index] = clamp(band.volume, 0, 1);
      patterns[index] = LIQUID_PATTERN_IDS[band.color];
    }

    const normalizedWave = Array.from({length: SURFACE_SAMPLE_COUNT}, (_, index) =>
      clamp(
        ((state.surface.waveSamples[index] ?? 0) * SURFACE_WAVE_VISUAL_GAIN)
          / VIAL_INNER_HEIGHT,
        -MAX_NORMALIZED_WAVE_OFFSET,
        MAX_NORMALIZED_WAVE_OFFSET,
      )
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

  private renderStreams(streamStates: readonly PourStreamRenderState[], state: BoardRenderState): void {
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
      const sourceY = sourcePivotRestY + sourceState.translationY;

      const destinationScale = destinationState.anchor.width / VIAL_VIEWBOX_WIDTH;
      const destinationLocalX = VIAL_INNER_LEFT
        + VIAL_INNER_WIDTH * (streamState.direction === "right" ? 0.28 : 0.72);
      const destinationLocalY = fillToVialY(streamState.destinationFill, state.capacity);
      const destinationX =
        destinationState.anchor.x + (destinationLocalX - VIAL_CENTER_X) * destinationScale;
      const destinationY =
        destinationState.anchor.y + (destinationLocalY - VIAL_CENTER_Y) * destinationScale;

      this.drawTaperedStream(
        graphics,
        sourceX,
        sourceY,
        destinationX,
        destinationY,
        hexToPackedColor(LIQUID_COLORS[streamState.color]),
        streamState.opacity,
      );
    });

    for (const [streamIndex, graphics] of this.streams) {
      if (!activeStreamIndexes.has(streamIndex)) graphics.clear();
    }
  }

  private drawTaperedStream(
    graphics: Graphics,
    sourceX: number,
    sourceY: number,
    destinationX: number,
    destinationY: number,
    color: number,
    opacity: number,
  ): void {
    const deltaX = destinationX - sourceX;
    const deltaY = destinationY - sourceY;
    const length = Math.max(0.001, Math.hypot(deltaX, deltaY));
    const normalX = -deltaY / length;
    const normalY = deltaX / length;
    const sourceHalfWidth = 2.4;
    const destinationHalfWidth = 0.8;
    const middleHalfWidth = 1.5;
    const middleX = (sourceX + destinationX) / 2;
    const middleY = (sourceY + destinationY) / 2 + Math.min(3, length * 0.045);

    graphics.clear();
    graphics
      .moveTo(
        sourceX + normalX * sourceHalfWidth,
        sourceY + normalY * sourceHalfWidth,
      )
      .quadraticCurveTo(
        middleX + normalX * middleHalfWidth,
        middleY + normalY * middleHalfWidth,
        destinationX + normalX * destinationHalfWidth,
        destinationY + normalY * destinationHalfWidth,
      )
      .lineTo(
        destinationX - normalX * destinationHalfWidth,
        destinationY - normalY * destinationHalfWidth,
      )
      .quadraticCurveTo(
        middleX - normalX * middleHalfWidth,
        middleY - normalY * middleHalfWidth,
        sourceX - normalX * sourceHalfWidth,
        sourceY - normalY * sourceHalfWidth,
      )
      .closePath()
      .fill({color, alpha: clamp(opacity, 0, 1)});
  }
}
