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
  int secondIndex = min(firstIndex + 1, 10);
  float t = fract(scaled);
  return mix(waveSample(firstIndex), waveSample(secondIndex), t);
}

vec4 chooseBand(float unitsFromBottom) {
  float cursor = unitsFromBottom;

  if (uBandVolumes.x > 0.0001) {
    if (cursor <= uBandVolumes.x) return uBand0;
    cursor -= uBandVolumes.x;
  }
  if (uBandVolumes.y > 0.0001) {
    if (cursor <= uBandVolumes.y) return uBand1;
    cursor -= uBandVolumes.y;
  }
  if (uBandVolumes.z > 0.0001) {
    if (cursor <= uBandVolumes.z) return uBand2;
    cursor -= uBandVolumes.z;
  }
  return uBand3;
}

void main() {
  float totalUnits = uBandVolumes.x + uBandVolumes.y + uBandVolumes.z + uBandVolumes.w;
  if (totalUnits <= 0.0001 || uFill <= 0.0001) discard;

  float centeredX = vUV.x - 0.5;
  float curvatureShape = sin(clamp(vUV.x, 0.0, 1.0) * 3.14159265359);
  float surfaceY = 1.0 - uFill;
  surfaceY += centeredX * uSurfaceSlope;
  surfaceY += curvatureShape * uCurvature;
  surfaceY += sampleWave(vUV.x);

  if (vUV.y < surfaceY) discard;

  float internalSlope = uSurfaceSlope * 0.18;
  float internalY = vUV.y - centeredX * internalSlope;
  float unitsFromBottom = clamp((1.0 - internalY) * uCapacity, 0.0, totalUnits);
  vec4 band = chooseBand(unitsFromBottom);

  float sideLight = smoothstep(0.0, 0.24, vUV.x) * smoothstep(1.0, 0.76, vUV.x);
  vec3 color = band.rgb * (0.90 + sideLight * 0.10);

  gl_FragColor = vec4(color, 1.0);
}
`;
