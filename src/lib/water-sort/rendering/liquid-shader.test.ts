import assert from "node:assert/strict";
import test from "node:test";

import {liquidFragmentShader} from "./liquid-shader";

test("dense metallic glitter is clipped by the existing liquid surface and pigment bands", () => {
  const cutout = liquidFragmentShader.indexOf("if (surfaceDepth < 0.0) discard;");
  const pigment = liquidFragmentShader.indexOf("float patternId = choosePattern(liquidProjection);");
  const glitter = liquidFragmentShader.indexOf("float deepMetal = metallicGlitter(");
  const output = liquidFragmentShader.indexOf("gl_FragColor =");

  assert.ok(cutout >= 0);
  assert.ok(pigment > cutout);
  assert.ok(glitter > pigment);
  assert.ok(output > glitter);
  assert.match(liquidFragmentShader, /metallicGlitter\(gelUv, patternId, 0\.0\)/);
  assert.match(liquidFragmentShader, /metallicGlitter\(gelUv, patternId, 1\.0\)/);
  assert.match(liquidFragmentShader, /gridSize = mix\(39\.0, 16\.0, depthLayer\)/);
});

test("color identity and CPU-owned fluid volumes remain independent of cosmetic glitter", () => {
  assert.match(liquidFragmentShader, /vec4 band = chooseBand\(liquidProjection\);/);
  assert.match(liquidFragmentShader, /float patternId = choosePattern\(liquidProjection\);/);
  assert.match(liquidFragmentShader, /color = mix\(color, patternColor, pattern \* 0\.13\);/);
  assert.match(liquidFragmentShader, /uniform vec4 uBandThresholds;/);
  assert.match(liquidFragmentShader, /uniform vec4 uBandVolumes;/);
  assert.match(liquidFragmentShader, /float liquidProjection = dot\(liquidPoint, surfaceNormal\);/);
  assert.match(liquidFragmentShader, /float meniscus = 1\.0 - smoothstep/);
});

test("gel displacement drives glitter without a flashing activity-dependent phase", () => {
  assert.match(liquidFragmentShader, /uniform float uJellyActivity;/);
  assert.match(liquidFragmentShader, /uGelElapsedSeconds - depth \* 0\.70/);
  assert.doesNotMatch(liquidFragmentShader, /activity \* 4\.2/);
  assert.doesNotMatch(liquidFragmentShader, /uTime \* \(0\.012/);
  assert.doesNotMatch(liquidFragmentShader, /uniform float uGlitterClock;/);
});

test("visible mobile-scale material has curved specular highlights and faceted glints", () => {
  assert.match(liquidFragmentShader, /float sideShadow = pow\(abs\(vUV\.x \* 2\.0 - 1\.0\), 2\.2\);/);
  assert.match(liquidFragmentShader, /float leftCenter = 0\.22 \+ 0\.075 \* sin/);
  assert.match(liquidFragmentShader, /float rightCenter = 0\.79 - 0\.038 \* sin/);
  assert.match(liquidFragmentShader, /0\.41 \* leftGloss \+ 0\.23 \* rightGloss/);
  assert.match(liquidFragmentShader, /float flare = 0\.0;/);
  assert.match(liquidFragmentShader, /float reachY = 1\.0 - smoothstep/);
  assert.match(liquidFragmentShader, /pattern \* 0\.13/);
});

test("scanline gel shear is sampled continuously before pigment-linked glitter", () => {
  assert.match(liquidFragmentShader, /uniform float uGelElapsedSeconds;/);
  assert.match(liquidFragmentShader, /uniform float uGelStrength;/);
  assert.match(liquidFragmentShader, /uniform float uGelBottomProjection;/);
  assert.match(liquidFragmentShader, /float gelScanlineShift\(float depth\)/);
  assert.match(liquidFragmentShader, /uGelElapsedSeconds - depth \* 0\.70/);
  assert.match(liquidFragmentShader, /pow\(1\.0 - depth, 1\.6\)/);
  assert.match(liquidFragmentShader, /float gelDepth = clamp/);
  assert.match(liquidFragmentShader, /surfaceDepth \/ max\(0\.0001, uGelBottomProjection - uFreeSurfaceThreshold\)/);
  assert.match(liquidFragmentShader, /vec2 gelUv = liquidPoint \+ vec2\(/);
  assert.match(liquidFragmentShader, /gelShift \+ bubbleShift\.x \* uInteriorAspect/);
  assert.match(liquidFragmentShader, /0\.38 \* gelShift \+ bubbleShift\.y/);
  assert.match(liquidFragmentShader, /metallicGlitter\(gelUv, patternId, 0\.0\)/);
  assert.match(liquidFragmentShader, /metallicGlitter\(gelUv, patternId, 1\.0\)/);
  assert.doesNotMatch(liquidFragmentShader, /gelScanlineShift\(float depth, float bandId\)/);
});

test("metallic flakes darken and brighten via pigment-relative soft-light rather than white overlays", () => {
  assert.match(liquidFragmentShader, /vec3 softLightPigment\(vec3 baseColor, vec3 blendColor\)/);
  assert.match(liquidFragmentShader, /float facetPolarity = hash\(seed \+ vec2\(4\.73, 6\.11\)\) < 0\.48 \? -1\.0 : 1\.0;/);
  assert.match(liquidFragmentShader, /float signedMetal = clamp\(deepMetal \* 0\.35 \+ nearMetal \* 0\.65, -1\.0, 1\.0\);/);
  assert.match(liquidFragmentShader, /color = mix\(color, softLightPigment\(color, metallicBlend\), 0\.65\);/);
  assert.doesNotMatch(liquidFragmentShader, /color = mix\(color, vec3\(1\.0, 0\.96, 0\.79\), nearMetal/);
  assert.doesNotMatch(liquidFragmentShader, /reactiveFlash/);
});

test("individual glitter intensities cannot be re-phased by a changing pour-activity uniform", () => {
  const functionStart = liquidFragmentShader.indexOf("float metallicGlitter(");
  const functionEnd = liquidFragmentShader.indexOf("vec3 softLightPigment(", functionStart);
  const functionBody = liquidFragmentShader.slice(functionStart, functionEnd);
  assert.ok(functionStart >= 0 && functionEnd > functionStart);
  assert.doesNotMatch(functionBody, /uTime/);
  assert.doesNotMatch(functionBody, /activity/);
  assert.doesNotMatch(functionBody, /uJellyActivity/);
  assert.match(functionBody, /float intensity = 0\.40 \+ 0\.60 \* hash/);
});

test("rising bubbles displace only nearby glitter using the same bubble geometry", () => {
  const displacement = liquidFragmentShader.indexOf("vec2 bubbleShift = vec2(0.0);");
  const metallicSamples = liquidFragmentShader.indexOf("float deepMetal = metallicGlitter(");
  const bubbles = liquidFragmentShader.indexOf("vec3 bubbleColor =");

  assert.ok(displacement >= 0 && displacement < metallicSamples);
  assert.ok(metallicSamples < bubbles);
  assert.match(liquidFragmentShader, /float bubbleDistance = length\(bubbleDelta\);/);
  assert.match(liquidFragmentShader, /float influence = exp\(-2\.8 \* normalizedDistance \* normalizedDistance\);/);
  assert.match(liquidFragmentShader, /float lateral = bubbleDelta\.x \/ max\(radius, abs\(bubbleDelta\.x\)\);/);
  assert.match(liquidFragmentShader, /bubbleShift \+= vec2\(/);
  assert.match(liquidFragmentShader, /bubbleMask = max\(bubbleMask, bubble\);/);
  assert.equal(
    (liquidFragmentShader.match(/float bubbleX = fract\(/g) ?? []).length,
    1,
    "bubble coordinates must be shared between visible bubbles and glitter displacement",
  );
});

test("the bubble influence is local, symmetric, and tends to zero after passage", () => {
  const influenceAtRadius = (distanceInRadii: number) =>
    Math.exp(-2.8 * distanceInRadii * distanceInRadii);

  assert.equal(influenceAtRadius(0), 1);
  assert.equal(influenceAtRadius(-1), influenceAtRadius(1));
  assert.ok(influenceAtRadius(1) < 0.07);
  assert.ok(influenceAtRadius(2) < 0.00002);
  assert.ok(influenceAtRadius(3) < 1e-10);
});

test("soft light can darken and brighten midtone pigments without white replacement", () => {
  const softLight = (base: number, blend: number) =>
    blend <= 0.5
      ? base - (1 - 2 * blend) * base * (1 - base)
      : base + (2 * blend - 1) * (Math.sqrt(base) - base);

  for (const base of [0.15, 0.35, 0.6, 0.85]) {
    assert.ok(softLight(base, 0.17) < base);
    assert.equal(softLight(base, 0.5), base);
    assert.ok(softLight(base, 0.83) > base);
    assert.ok(softLight(base, 0.83) < 1);
  }
});
