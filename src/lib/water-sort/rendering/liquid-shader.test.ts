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
  assert.match(liquidFragmentShader, /metallicGlitter\(gelUv, patternId, 0\.0, activity\)/);
  assert.match(liquidFragmentShader, /metallicGlitter\(gelUv, patternId, 1\.0, activity\)/);
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

test("glitter reacts to movement and reduced-motion freezes ambient shader time", () => {
  assert.match(liquidFragmentShader, /uniform float uJellyActivity;/);
  assert.match(liquidFragmentShader, /uGelElapsedSeconds - depth \* 0\.70/);
  assert.match(liquidFragmentShader, /activity \* 4\.2/);
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
  assert.match(liquidFragmentShader, /vec2 gelUv = liquidPoint \+ vec2\(gelShift, 0\.38 \* gelShift\)/);
  assert.match(liquidFragmentShader, /metallicGlitter\(gelUv, patternId, 0\.0, activity\)/);
  assert.match(liquidFragmentShader, /metallicGlitter\(gelUv, patternId, 1\.0, activity\)/);
  assert.doesNotMatch(liquidFragmentShader, /gelScanlineShift\(float depth, float bandId\)/);
});
