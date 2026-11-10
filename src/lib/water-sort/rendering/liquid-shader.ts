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
uniform float uFill;
uniform float uJellyActivity;
uniform vec2 uSurfaceNormal;
uniform float uInteriorAspect;
uniform float uFreeSurfaceThreshold;
uniform vec4 uBandThresholds;
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

vec4 chooseBand(float projection) {
  if (uBandVolumes.x > 0.0001 && projection >= uBandThresholds.x) return uBand0;
  if (uBandVolumes.y > 0.0001 && projection >= uBandThresholds.y) return uBand1;
  if (uBandVolumes.z > 0.0001 && projection >= uBandThresholds.z) return uBand2;
  if (uBandVolumes.w > 0.0001 && projection >= uBandThresholds.w) return uBand3;

  if (uBandVolumes.w > 0.0001) return uBand3;
  if (uBandVolumes.z > 0.0001) return uBand2;
  if (uBandVolumes.y > 0.0001) return uBand1;
  return uBand0;
}

float choosePattern(float projection) {
  if (uBandVolumes.x > 0.0001 && projection >= uBandThresholds.x) return uBandPatterns.x;
  if (uBandVolumes.y > 0.0001 && projection >= uBandThresholds.y) return uBandPatterns.y;
  if (uBandVolumes.z > 0.0001 && projection >= uBandThresholds.z) return uBandPatterns.z;
  if (uBandVolumes.w > 0.0001 && projection >= uBandThresholds.w) return uBandPatterns.w;

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


float alchemistDisc(vec2 offset, float radius) {
  return 1.0 - smoothstep(radius * 0.82, radius, length(offset));
}

float alchemistLine(vec2 point, vec2 start, vec2 end, float width) {
  vec2 line = end - start;
  float progress = clamp(dot(point - start, line) / max(dot(line, line), 0.0001), 0.0, 1.0);
  return 1.0 - smoothstep(width * 0.7, width, length(point - start - progress * line));
}

float alchemistFlower(vec2 point) {
  float petals = 0.0;
  for (int index = 0; index < 5; index++) {
    float angle = float(index) * 1.25663706 - 1.57079633;
    vec2 center = 0.19 * vec2(cos(angle), sin(angle));
    petals = max(petals, alchemistDisc(point - center, 0.14));
  }
  return max(petals * 0.88, alchemistDisc(point, 0.08));
}

float alchemistStar(vec2 point) {
  float angle = atan(point.y, point.x);
  float peaks = pow(0.5 + 0.5 * cos(angle * 5.0 + 1.57079633), 4.0);
  float radius = mix(0.17, 0.37, peaks);
  return 1.0 - smoothstep(radius - 0.035, radius + 0.02, length(point));
}

float alchemistHeart(vec2 point) {
  // The standard implicit heart curve: negative values are inside.
  vec2 heart = vec2(point.x * 3.0, (point.y + 0.02) * 3.0);
  float squaredRadius = dot(heart, heart);
  float base = squaredRadius - 1.0;
  float shape = base * base * base - heart.x * heart.x * heart.y * heart.y * heart.y;
  return 1.0 - smoothstep(-0.05, 0.07, shape);
}

float alchemistLeaf(vec2 point, vec2 center, float rotation) {
  float cosine = cos(rotation);
  float sine = sin(rotation);
  vec2 offset = point - center;
  vec2 rotated = vec2(cosine * offset.x - sine * offset.y, sine * offset.x + cosine * offset.y);
  float elliptical = length(rotated * vec2(4.5, 2.7));
  return 1.0 - smoothstep(0.73, 0.98, elliptical);
}

float alchemistCrescent(vec2 point) {
  float outer = alchemistDisc(point + vec2(0.05, 0.0), 0.36);
  float inner = alchemistDisc(point + vec2(0.17, -0.09), 0.31);
  return outer * (1.0 - inner);
}

float alchemistPattern(float patternId) {
  // Match the twelve generated potion motifs. Patterns are locked to color IDs,
  // not vial positions, so their visual identity survives every transfer.
  vec2 uv = vec2(vUV.x * 2.7, vUV.y * 10.0);
  vec2 point = fract(uv) - 0.5;

  if (patternId < 0.5) return alchemistFlower(point); // coral: blossoms
  if (patternId < 1.5) { // amber: engraved diamonds
    float distanceToEdge = abs(point.x) + abs(point.y);
    return 1.0 - smoothstep(0.30, 0.38, distanceToEdge);
  }
  if (patternId < 2.5) { // lemon: enchanted waves
    float wave = point.y - 0.18 * sin(uv.x * 6.2831853);
    return 1.0 - smoothstep(0.075, 0.14, abs(wave));
  }
  if (patternId < 3.5) { // lime: zigzag
    float saw = abs(fract(uv.x) * 2.0 - 1.0);
    float centerLine = (saw - 0.5) * 0.53;
    return 1.0 - smoothstep(0.055, 0.115, abs(point.y - centerLine));
  }
  if (patternId < 4.5) { // emerald: floating leaves
    return max(
      alchemistLeaf(point, vec2(-0.19, 0.17), 0.7),
      alchemistLeaf(point, vec2(0.16, -0.16), -0.75)
    );
  }
  if (patternId < 5.5) { // teal: spiraling magic
    float radius = length(point);
    float angle = atan(point.y, point.x) / 6.2831853;
    float spiral = abs(fract(angle - 1.7 * radius) - 0.5);
    return (1.0 - smoothstep(0.03, 0.085, spiral)) * (1.0 - smoothstep(0.34, 0.45, radius));
  }
  if (patternId < 6.5) { // sky: floating bubbles
    float ring = abs(length(point) - 0.27);
    return 1.0 - smoothstep(0.035, 0.065, ring);
  }
  if (patternId < 7.5) { // cobalt: diagonal stripes
    float stripe = abs(fract(uv.x + uv.y * 0.67) - 0.5);
    return 1.0 - smoothstep(0.18, 0.27, stripe);
  }
  if (patternId < 8.5) return alchemistStar(point); // violet: five-point stars
  if (patternId < 9.5) return alchemistCrescent(point); // magenta: crescent moons
  if (patternId < 10.5) return alchemistHeart(point); // rose: hearts

  // cocoa: connected constellations, visually distinct from dots and stars
  float connections = max(
    alchemistLine(point, vec2(-0.32, 0.24), vec2(0.15, -0.23), 0.035),
    alchemistLine(point, vec2(0.15, -0.23), vec2(0.32, 0.25), 0.035)
  );
  float stars = max(
    alchemistDisc(point - vec2(-0.32, 0.24), 0.085),
    max(alchemistDisc(point - vec2(0.15, -0.23), 0.085), alchemistDisc(point - vec2(0.32, 0.25), 0.085))
  );
  return max(connections * 0.65, stars);
}

// Sparse translucent droplets, retained as two pigment-seeded depth layers.
// Flow is applied to the sampling coordinate, never to the color volume.
float glitterFleck(vec2 liquidUv, float pigmentId, float layer) {
  float depthScale = mix(1.0, 1.65, layer);
  vec2 coordinate = liquidUv * (19.0 * depthScale);
  vec2 cell = floor(coordinate);
  vec2 cellUv = fract(coordinate);
  vec2 seed = cell + vec2(pigmentId * 7.11, pigmentId * 13.73)
    + layer * vec2(31.7, 17.3);

  // Only a minority of cells contain a particle; skip expensive detail
  // calculations in empty cells on the usual mobile-sized board.
  if (hash(seed) < mix(0.75, 0.82, layer)) return 0.0;
  vec2 center = vec2(
    0.22 + 0.56 * hash(seed + vec2(8.1, 2.3)),
    0.22 + 0.56 * hash(seed + vec2(3.7, 9.4))
  );
  vec2 offset = cellUv - center;
  float size = mix(0.090, 0.145, hash(seed + vec2(4.2, 6.7)));
  vec2 dropletOffset = vec2(offset.x, offset.y * mix(1.20, 0.92, layer));
  float droplet = 1.0 - smoothstep(size * 0.58, size, length(dropletOffset));
  float highlight = 1.0 - smoothstep(
    size * 0.17, size * 0.44,
    length(dropletOffset + vec2(size * 0.25, size * 0.22))
  );
  float phase = hash(seed + vec2(9.6, 1.2)) * 6.2831853;
  float shimmer = 0.50 + 0.50 * sin(uTime * (1.25 + layer * 0.65) + phase);
  return droplet * (0.32 + 0.46 * shimmer) + highlight * 0.14;
}

float wrappedDistance(float first, float second) {
  float direct = abs(first - second);
  return min(direct, 1.0 - direct);
}

float foamCells(float surfaceCoordinate, float surfaceDepth, float agitation) {
  float cells = 0.0;
  float surfaceU = fract(surfaceCoordinate / max(uInteriorAspect, 0.001) + 0.5);

  for (int index = 0; index < 12; index++) {
    float fi = float(index);
    float drift = sin(uTime * (0.55 + mod(fi, 4.0) * 0.08) + fi * 1.7) * 0.012;
    float cellX = fract(0.07 + fi * 0.151 + sin(fi * 2.91) * 0.08 + drift);
    float bob = sin(uTime * (1.1 + mod(fi, 3.0) * 0.14) + fi * 2.2) * 0.0018;
    float cellDepth = 0.006 + mod(fi, 3.0) * 0.0065 + bob;
    float agitationScale = 1.0 + agitation * 0.28;
    float radiusX = (0.020 + mod(fi, 4.0) * 0.004) * agitationScale;
    float radiusY = (0.006 + mod(fi, 3.0) * 0.0024) * agitationScale;
    vec2 delta = vec2(
      wrappedDistance(surfaceU, cellX) / radiusX,
      (surfaceDepth - cellDepth) / radiusY
    );
    float cell = 1.0 - smoothstep(0.58, 1.0, length(delta));
    cells = max(cells, cell);
  }

  return cells;
}

void main() {
  float totalUnits = uBandVolumes.x + uBandVolumes.y + uBandVolumes.z + uBandVolumes.w;
  if (totalUnits <= 0.0001 || uFill <= 0.0001) discard;

  vec2 surfaceNormal = normalize(uSurfaceNormal);
  vec2 surfaceTangent = vec2(surfaceNormal.y, -surfaceNormal.x);
  vec2 liquidPoint = vec2(vUV.x * uInteriorAspect, vUV.y);
  float liquidProjection = dot(liquidPoint, surfaceNormal);
  float curvatureShape = sin(clamp(vUV.x, 0.0, 1.0) * 3.14159265359);
  float agitation = smoothstep(0.002, 0.026, waveEnergy());
  float surfaceOffset = curvatureShape * uCurvature;
  surfaceOffset += sampleWave(vUV.x);
  surfaceOffset += sin(vUV.x * 12.5663706144 - uTime * 9.5) * 0.0075 * agitation;
  surfaceOffset += sin(vUV.x * 25.1327412287 + uTime * 6.5) * 0.0035 * agitation;
  // Restrained viscous wobble only while the vial or receiving liquid moves.
  // The CPU continues to own the actual color-volume projection.
  surfaceOffset += sin(vUV.x * 9.42477796 - uTime * 3.6)
    * 0.0018 * clamp(uJellyActivity, 0.0, 1.0);
  float surfaceDepth = liquidProjection - uFreeSurfaceThreshold - surfaceOffset;

  // The free surface and each internal color boundary are independent
  // half-plane cuts through the real vial polygon. Their thresholds are
  // solved on the CPU from polygon area, so every band keeps its requested
  // volume while the vial crosses vertical or any other orientation.
  if (surfaceDepth < 0.0) discard;

  vec4 band = chooseBand(liquidProjection);
  float patternId = choosePattern(liquidProjection);

  float sideLight = smoothstep(0.0, 0.24, vUV.x) * smoothstep(1.0, 0.76, vUV.x);
  float edgeShade = smoothstep(0.0, 0.22, vUV.x)
    * (1.0 - smoothstep(0.76, 1.0, vUV.x));
  float depthTint = 0.89 + 0.09 * clamp(surfaceDepth, 0.0, 1.0);
  vec3 color = band.rgb * depthTint * (0.81 + sideLight * 0.18 + edgeShade * 0.06);

  float pattern = alchemistPattern(patternId);
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec3 lightPatternColor = mix(color, vec3(1.0), 0.38);
  vec3 darkPatternColor = color * 0.62;
  vec3 patternColor = mix(lightPatternColor, darkPatternColor, step(0.58, luminance));
  color = mix(color, patternColor, pattern * 0.40);

  // Drift against the free-surface normal and briefly swirl while pouring.
  // Color-band selection above stays in unmodified liquid coordinates.
  float flowActivity = clamp(uJellyActivity, 0.0, 1.0);
  float circulation = sin(
    dot(liquidPoint, surfaceTangent) * 17.0
    + dot(liquidPoint, surfaceNormal) * 7.0
    - uTime * 2.1 + patternId
  ) * 0.012 * flowActivity;
  vec2 flowUv = liquidPoint
    + surfaceNormal * (uTime * 0.0055)
    + surfaceTangent * circulation;
  float backGlitter = glitterFleck(flowUv, patternId, 0.0);
  float frontGlitter = glitterFleck(
    flowUv + surfaceNormal * (uTime * 0.003), patternId, 1.0
  );
  color = mix(color, mix(band.rgb, vec3(1.0, 0.91, 0.78), 0.67), backGlitter * 0.38);
  color = mix(color, vec3(1.0, 0.98, 0.88), frontGlitter * 0.76);

  // A broad wet gloss plus one thin specular streak, beneath the glass layer.
  float broadGloss = 1.0 - smoothstep(0.045, 0.23, abs(vUV.x - 0.29));
  float thinGloss = 1.0 - smoothstep(0.008, 0.047, abs(vUV.x - 0.67));
  float verticalGloss = smoothstep(0.02, 0.20, vUV.y)
    * (1.0 - smoothstep(0.80, 0.98, vUV.y));
  float gloss = (broadGloss * 0.17 + thinGloss * 0.19) * verticalGloss;
  color = mix(color, vec3(1.0, 0.97, 0.94), gloss);

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

  float distanceBelowSurface = max(0.0, surfaceDepth);
  float surfaceCoordinate = dot(liquidPoint, surfaceTangent);
  float foamBand = 1.0 - smoothstep(0.0, 0.021 + agitation * 0.009, distanceBelowSurface);
  float foamCoordinate = surfaceCoordinate / max(uInteriorAspect, 0.001) + 0.5;
  float foamTexture = 0.72
    + 0.18 * sin(foamCoordinate * 58.0 + uTime * 1.25)
    + 0.10 * sin(foamCoordinate * 103.0 - uTime * 0.72);
  float foam = max(
    foamBand * clamp(foamTexture, 0.45, 1.0) * (0.38 + agitation * 0.22),
    foamCells(surfaceCoordinate, distanceBelowSurface, agitation) * (0.58 + agitation * 0.22)
  );

  vec3 topColor = topBandColor().rgb;
  vec3 foamColor = mix(topColor, vec3(1.0), 0.28);
  color = mix(color, foamColor, clamp(foam, 0.0, 0.82));

  // Bright curved meniscus sells gel viscosity without changing fill volume.
  float meniscus = 1.0 - smoothstep(0.001, 0.017, surfaceDepth);
  color = mix(color, mix(topColor, vec3(1.0), 0.52), meniscus * 0.48);
  gl_FragColor = vec4(color, 0.93);
}
`;
