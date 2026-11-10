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
  assert.match(liquidFragmentShader, /metallicGlitter\(liquidPoint, patternId, 0\.0, activity\)/);
  assert.match(liquidFragmentShader, /metallicGlitter\(liquidPoint, patternId, 1\.0, activity\)/);
  assert.match(liquidFragmentShader, /gridSize = mix\(50\.0, 68\.0, depthLayer\)/);
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
  assert.match(liquidFragmentShader, /activity \* 0\.09/);
  assert.match(liquidFragmentShader, /activity \* 4\.2/);
  assert.match(liquidFragmentShader, /uTime \* \(0\.012/);
  assert.doesNotMatch(liquidFragmentShader, /uniform float uGlitterClock;/);
});
