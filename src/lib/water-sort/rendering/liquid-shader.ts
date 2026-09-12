export const liquidVertexShader = `
precision mediump float;

attribute vec2 aPosition;
attribute vec2 aUV;

varying vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}
`;

export const liquidFragmentShader = `
precision highp float;

varying vec2 vUV;

uniform float uTime;
uniform float uCapacity;
uniform float uFill;
uniform float uSurfaceSlope;
uniform float uCurvature;
uniform vec4 uBand0;
uniform vec4 uBand1;
uniform vec4 uBand2;
uniform vec4 uBand3;
uniform vec4 uBandVolumes;
uniform vec4 uBandPatterns;
uniform vec4 uWave0;
uniform vec4 uWave1;
uniform vec4 uWave2;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float waveSample(int index) {
  if (index == 0) return uWave0.x;
  if (index == 1) return uWave0.y;
  if (index == 2) return uWave0.z;
  if (index == 3) return uWave0.w;
  if (index == 4) return uWave1.x;
  if (index == 5) return uWave1.y;
  if (index == 6) return uWave1.z;
  if (index == 7) return uWave1.w;
  if (index == 8) return uWave2.x;
  if (index == 9) return uWave2.y;
  return uWave2.z;
}

float sampleWave(float x) {
  float scaled = clamp(x, 0.0, 1.0) * 10.0;
  int firstIndex = int(floor(scaled));
  int secondIndex = firstIndex < 10 ? firstIndex + 1 : 10;
  float t = fract(scaled);
  return mix(waveSample(firstIndex), waveSample(secondIndex), t);
}

float waveEnergy() {
  float energy = 0.0;
  for (int index = 0; index < 11; index++) {
    energy = max(energy, abs(waveSample(index)));
  }
  return energy;
}

vec4 chooseBand(float unitsFromBottom) {
  float cursor = clamp(
    unitsFromBottom,
    0.0,
    max(uBandVolumes.x + uBandVolumes.y + uBandVolumes.z + uBandVolumes.w - 0.0001, 0.0)
  );

  if (uBandVolumes.x > 0.0001) {
    if (cursor < uBandVolumes.x) return uBand0;
    cursor -= uBandVolumes.x;
  }
  if (uBandVolumes.y > 0.0001) {
    if (cursor < uBandVolumes.y) return uBand1;
    cursor -= uBandVolumes.y;
  }
  if (uBandVolumes.z > 0.0001) {
    if (cursor < uBandVolumes.z) return uBand2;
    cursor -= uBandVolumes.z;
  }
  if (uBandVolumes.w > 0.0001) return uBand3;
  if (uBandVolumes.z > 0.0001) return uBand2;
  if (uBandVolumes.y > 0.0001) return uBand1;
  return uBand0;
}

float choosePattern(float unitsFromBottom) {
  float cursor = clamp(
    unitsFromBottom,
    0.0,
    max(uBandVolumes.x + uBandVolumes.y + uBandVolumes.z + uBandVolumes.w - 0.0001, 0.0)
  );

  if (uBandVolumes.x > 0.0001) {
    if (cursor < uBandVolumes.x) return uBandPatterns.x;
    cursor -= uBandVolumes.x;
  }
  if (uBandVolumes.y > 0.0001) {
    if (cursor < uBandVolumes.y) return uBandPatterns.y;
    cursor -= uBandVolumes.y;
  }
  if (uBandVolumes.z > 0.0001) {
    if (cursor < uBandVolumes.z) return uBandPatterns.z;
    cursor -= uBandVolumes.z;
  }
  if (uBandVolumes.w > 0.0001) return uBandPatterns.w;
  if (uBandVolumes.z > 0.0001) return uBandPatterns.z;
  if (uBandVolumes.y > 0.0001) return uBandPatterns.y;
  return uBandPatterns.x;
}

vec4 topBandColor() {
  if (uBandVolumes.w > 0.0001) return uBand3;
  if (uBandVolumes.z > 0.0001) return uBand2;
  if (uBandVolumes.y > 0.0001) return uBand1;
  return uBand0;
}

float centeredLine(float coordinate, float width) {
  float distanceToCenter = abs(fract(coordinate) - 0.5);
  return 1.0 - smoothstep(width, width + 0.075, distanceToCenter);
}

float dotGrid(vec2 point, float radius) {
  vec2 cell = fract(point) - 0.5;
  return 1.0 - smoothstep(radius, radius + 0.09, length(cell));
}

float ringGrid(vec2 point) {
  float radius = length(fract(point) - 0.5);
  return 1.0 - smoothstep(0.07, 0.13, abs(radius - 0.28));
}

float diamondGrid(vec2 point) {
  vec2 cell = abs(fract(point) - 0.5);
  float distanceToEdge = abs(cell.x + cell.y - 0.38);
  return 1.0 - smoothstep(0.05, 0.11, distanceToEdge);
}

float zigzagPattern(vec2 point) {
  float triangle = abs(fract(point.x * 0.5) * 2.0 - 1.0);
  float row = fract(point.y * 0.5);
  return 1.0 - smoothstep(0.055, 0.12, abs(row - triangle));
}

float liquidPattern(float patternId) {
  vec2 coarse = vec2(vUV.x * 6.2, vUV.y * 14.0);

  if (patternId < 0.5) return centeredLine(coarse.x + coarse.y * 0.55, 0.12);
  if (patternId < 1.5) return dotGrid(coarse, 0.17);
  if (patternId < 2.5) return centeredLine(coarse.y, 0.12);
  if (patternId < 3.5) return centeredLine(coarse.x, 0.12);
  if (patternId < 4.5) {
    return mod(floor(coarse.x) + floor(coarse.y), 2.0);
  }
  if (patternId < 5.5) {
    return max(
      centeredLine(coarse.x + coarse.y, 0.09),
      centeredLine(coarse.x - coarse.y, 0.09)
    );
  }
  if (patternId < 6.5) return diamondGrid(coarse);
  if (patternId < 7.5) return ringGrid(coarse);
  if (patternId < 8.5) return zigzagPattern(coarse);
  if (patternId < 9.5) {
    vec2 staggered = coarse;
    staggered.x += mod(floor(staggered.y), 2.0) * 0.5;
    return dotGrid(staggered, 0.145);
  }
  if (patternId < 10.5) {
    return max(centeredLine(coarse.x, 0.08), centeredLine(coarse.y, 0.08));
  }

  float speckle = hash(floor(coarse * 2.0));
  return smoothstep(0.72, 0.88, speckle);
}

float foamCells(float surfaceY, float agitation) {
  float cells = 0.0;

  for (int index = 0; index < 12; index++) {
    float fi = float(index);
    float drift = sin(uTime * (0.55 + mod(fi, 4.0) * 0.08) + fi * 1.7) * 0.012;
    float cellX = fract(0.07 + fi * 0.151 + sin(fi * 2.91) * 0.08 + drift);
    float bob = sin(uTime * (1.1 + mod(fi, 3.0) * 0.14) + fi * 2.2) * 0.0018;
    float cellY = surfaceY + 0.006 + mod(fi, 3.0) * 0.0065 + bob;
    float agitationScale = 1.0 + agitation * 0.28;
    float radiusX = (0.020 + mod(fi, 4.0) * 0.004) * agitationScale;
    float radiusY = (0.006 + mod(fi, 3.0) * 0.0024) * agitationScale;
    vec2 delta = vec2(
      (vUV.x - cellX) / radiusX,
      (vUV.y - cellY) / radiusY
    );
    float cell = 1.0 - smoothstep(0.58, 1.0, length(delta));
    cells = max(cells, cell);
  }

  return cells;
}

void main() {
  float totalUnits = uBandVolumes.x + uBandVolumes.y + uBandVolumes.z + uBandVolumes.w;
  if (totalUnits <= 0.0001 || uFill <= 0.0001) discard;

  float centeredX = vUV.x - 0.5;
  float curvatureShape = sin(clamp(vUV.x, 0.0, 1.0) * 3.14159265359);
  float agitation = smoothstep(0.002, 0.026, waveEnergy());
  float surfaceY = 1.0 - uFill;
  surfaceY += centeredX * uSurfaceSlope;
  surfaceY += curvatureShape * uCurvature;
  surfaceY += sampleWave(vUV.x);
  surfaceY += sin(vUV.x * 12.5663706144 - uTime * 9.5) * 0.0075 * agitation;
  surfaceY += sin(vUV.x * 25.1327412287 + uTime * 6.5) * 0.0035 * agitation;

  if (vUV.y < surfaceY) discard;

  float internalSlope = uSurfaceSlope * 0.18;
  float internalY = vUV.y - centeredX * internalSlope;
  float unitsFromBottom = (1.0 - internalY) * uCapacity;
  vec4 band = chooseBand(unitsFromBottom);
  float patternId = choosePattern(unitsFromBottom);

  float sideLight = smoothstep(0.0, 0.24, vUV.x) * smoothstep(1.0, 0.76, vUV.x);
  vec3 color = band.rgb * (0.88 + sideLight * 0.12);

  float pattern = liquidPattern(patternId);
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec3 lightPatternColor = mix(color, vec3(1.0), 0.38);
  vec3 darkPatternColor = color * 0.62;
  vec3 patternColor = mix(lightPatternColor, darkPatternColor, step(0.58, luminance));
  color = mix(color, patternColor, pattern * 0.28);

  float bubbleMask = 0.0;
  for (int index = 0; index < 7; index++) {
    float fi = float(index);
    float bubbleX = fract(0.15 + fi * 0.137 + sin(fi * 2.7) * 0.13);
    float speed = 0.10 + mod(fi, 3.0) * 0.025;
    float bubbleY = 1.08 - fract(uTime * speed + fi * 0.173) * (uFill + 0.14);
    float radius = 0.018 + mod(fi, 2.0) * 0.008;
    vec2 bubbleDelta = vec2((vUV.x - bubbleX) * 0.72, vUV.y - bubbleY);
    float bubble = 1.0 - smoothstep(radius * 0.70, radius, length(bubbleDelta));
    bubbleMask = max(bubbleMask, bubble);
  }

  vec3 bubbleColor = mix(color * 1.13, vec3(1.0), 0.18);
  color = mix(color, bubbleColor, bubbleMask * 0.58);

  float distanceBelowSurface = max(0.0, vUV.y - surfaceY);
  float foamBand = 1.0 - smoothstep(0.0, 0.021 + agitation * 0.009, distanceBelowSurface);
  float foamTexture = 0.72
    + 0.18 * sin(vUV.x * 58.0 + uTime * 1.25)
    + 0.10 * sin(vUV.x * 103.0 - uTime * 0.72);
  float foam = max(
    foamBand * clamp(foamTexture, 0.45, 1.0) * (0.38 + agitation * 0.22),
    foamCells(surfaceY, agitation) * (0.58 + agitation * 0.22)
  );

  vec3 topColor = topBandColor().rgb;
  vec3 foamColor = mix(topColor, vec3(1.0), 0.28);
  color = mix(color, foamColor, clamp(foam, 0.0, 0.82));

  gl_FragColor = vec4(color, 0.96);
}
`;
