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
  float cursor = clamp(unitsFromBottom, 0.0, max(uBandVolumes.x + uBandVolumes.y + uBandVolumes.z + uBandVolumes.w - 0.0001, 0.0));

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

float frothCells(float surfaceY, float intensity) {
  float cells = 0.0;

  for (int index = 0; index < 10; index++) {
    float fi = float(index);
    float cellX = fract(0.08 + fi * 0.173 + sin(fi * 3.17) * 0.09);
    float cellY = surfaceY
      + 0.006
      + mod(fi, 3.0) * 0.007
      + sin(uTime * (3.2 + mod(fi, 4.0) * 0.35) + fi * 1.9) * 0.0025;
    float radiusX = 0.024 + mod(fi, 4.0) * 0.005;
    float radiusY = 0.007 + mod(fi, 3.0) * 0.003;
    vec2 delta = vec2(
      (vUV.x - cellX) / radiusX,
      (vUV.y - cellY) / radiusY
    );
    float cell = 1.0 - smoothstep(0.62, 1.0, length(delta));
    cells = max(cells, cell);
  }

  return cells * intensity;
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

  float sideLight = smoothstep(0.0, 0.24, vUV.x) * smoothstep(1.0, 0.76, vUV.x);
  vec3 color = band.rgb * (0.88 + sideLight * 0.12);

  float bubbleMask = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
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
  float frothBand = 1.0 - smoothstep(0.0, 0.032, distanceBelowSurface);
  float frothNoise = 0.55
    + hash(floor(vec2(vUV.x * 72.0, uTime * 7.0))) * 0.45;
  float froth = max(
    frothBand * frothNoise * 0.72,
    frothCells(surfaceY, agitation)
  ) * agitation;
  color = mix(color, vec3(0.99), froth * 0.86);

  gl_FragColor = vec4(color, 0.96);
}
`;
