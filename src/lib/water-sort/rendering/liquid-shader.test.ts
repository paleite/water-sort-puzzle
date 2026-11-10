import assert from "node:assert/strict";
import test from "node:test";

import {liquidFragmentShader} from "./liquid-shader";

test("glitter stays inside the volume-clipped liquid with pigment-linked identity", () => {
  const cutout = liquidFragmentShader.indexOf("if (surfaceDepth < 0.0) discard;");
  const pigment = liquidFragmentShader.indexOf("float patternId = choosePattern(liquidProjection);");
  const glitter = liquidFragmentShader.indexOf("float backGlitter = glitterFleck(");
  const output = liquidFragmentShader.indexOf("gl_FragColor =");

  assert.ok(cutout >= 0, "Liquid must discard pixels outside the free surface");
  assert.ok(pigment > cutout, "Glitter may only use the visible pigment");
  assert.ok(glitter > pigment, "Glitter must be shaded after the volume cutout");
  assert.ok(output > glitter, "The final pixel includes the glitter layers");
  assert.match(liquidFragmentShader, /glitterFleck\(flowUv, patternId, 0\.0\)/);
  assert.match(liquidFragmentShader, /flowUv \+ surfaceNormal \* \(uTime \* 0\.003\), patternId, 1\.0/);
});

test("slime wobble is activity-gated without changing the CPU-owned band thresholds", () => {
  assert.match(liquidFragmentShader, /uniform float uJellyActivity;/);
  assert.match(liquidFragmentShader, /clamp\(uJellyActivity, 0\.0, 1\.0\)/);
  assert.match(liquidFragmentShader, /float meniscus = 1\.0 - smoothstep/);
  assert.match(liquidFragmentShader, /float liquidProjection = dot\(liquidPoint, surfaceNormal\);/);
  assert.match(liquidFragmentShader, /vec4 band = chooseBand\(liquidProjection\);/);
});

test("pigment-linked droplets follow gravity and activity without changing band thresholds", () => {
  const clip = liquidFragmentShader.indexOf("if (surfaceDepth < 0.0) discard;");
  const bandSelection = liquidFragmentShader.indexOf("vec4 band = chooseBand(liquidProjection);");
  const flow = liquidFragmentShader.indexOf("vec2 flowUv = liquidPoint");
  assert.ok(flow > bandSelection && bandSelection > clip);
  assert.match(liquidFragmentShader, /surfaceNormal \* \(uTime \* 0\.0055\)/);
  assert.match(liquidFragmentShader, /surfaceTangent \* circulation;/);
  assert.match(liquidFragmentShader, /0\.012 \* flowActivity;/);
  assert.match(liquidFragmentShader, /sin\(uTime \* \(1\.25 \+ layer \* 0\.65\) \+ phase\)/);
  assert.doesNotMatch(liquidFragmentShader, /uniform float uGlitterClock;/);
});
