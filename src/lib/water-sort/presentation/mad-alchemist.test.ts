import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { COLOR_IDS } from "../domain/colors";
import {
  DEFAULT_GAME_BACKGROUND_ID,
  getGameBackground,
} from "./backgrounds";
import { LIQUID_PATTERN_IDS } from "./liquid-patterns";
import {
  CLASSIC_VIAL_SKIN,
  COMPACT_VIAL_SKIN,
  DEFAULT_VIAL_SKIN,
  DEFAULT_VIAL_SKIN_ID,
  getNextVialSkinId,
  getVialSkin,
} from "./vial-skins";
import {
  DEFAULT_LIQUID_PALETTE_ID,
  getLiquidPalette,
} from "./palette";

test("all twelve potion colors retain unique patterns", () => {
  const assignedPatterns = COLOR_IDS.map((colorId) => LIQUID_PATTERN_IDS[colorId]);

  assert.deepEqual(
    [...assignedPatterns].sort((first, second) => first - second),
    Array.from({length: COLOR_IDS.length}, (_, index) => index),
  );
});

test("mad-alchemist palette gives every playable color a distinct pigment", () => {
  const palette = getLiquidPalette("mad_alchemist");

  assert.equal(DEFAULT_LIQUID_PALETTE_ID, "mad_alchemist");
  assert.equal(palette.values.length, COLOR_IDS.length);
  assert.equal(new Set(palette.values).size, COLOR_IDS.length);
  for (const color of palette.values) {
    assert.match(color, /^#[0-9a-fA-F]{6}$/);
  }
});

test("the fantasy theme defaults to a plain, not textured, background", () => {
  const background = getGameBackground(DEFAULT_GAME_BACKGROUND_ID);

  assert.equal(background.id, "arcane");
  assert.equal(background.css, "#210d38");
});

test("both vial skins preserve fill and mouth geometry", () => {
  assert.deepEqual(CLASSIC_VIAL_SKIN.liquidPolygon, DEFAULT_VIAL_SKIN.liquidPolygon);
  assert.deepEqual(CLASSIC_VIAL_SKIN.mouth, DEFAULT_VIAL_SKIN.mouth);
  assert.deepEqual(CLASSIC_VIAL_SKIN.viewBox, DEFAULT_VIAL_SKIN.viewBox);
  assert.equal(getNextVialSkinId(DEFAULT_VIAL_SKIN.id), CLASSIC_VIAL_SKIN.id);
  assert.equal(getVialSkin(CLASSIC_VIAL_SKIN.id).name, "Classic");
});

test("the production sprite pack includes all twelve pigments and five stoppers", () => {
  for (const colorId of COLOR_IDS) {
    assert.ok(existsSync(join(process.cwd(), "public", "potions", "liquids", `${colorId}.svg`)));
  }
  for (const stopper of ["cork", "wax", "crystal", "orb", "moon"]) {
    assert.ok(existsSync(join(process.cwd(), "public", "potions", "stoppers", `${stopper}.svg`)));
  }
});


test("compact skin preserves liquid geometry without extending ornaments above the rim", () => {
  assert.equal(DEFAULT_VIAL_SKIN_ID, COMPACT_VIAL_SKIN.id);
  assert.deepEqual(COMPACT_VIAL_SKIN.liquidPolygon, DEFAULT_VIAL_SKIN.liquidPolygon);
  assert.deepEqual(COMPACT_VIAL_SKIN.mouth, DEFAULT_VIAL_SKIN.mouth);
  assert.deepEqual(COMPACT_VIAL_SKIN.viewBox, {width: 100, height: 272});
  assert.equal(getNextVialSkinId(CLASSIC_VIAL_SKIN.id), COMPACT_VIAL_SKIN.id);

  const stopperBounds = COMPACT_VIAL_SKIN.stopperBounds;
  assert.ok(stopperBounds.y >= 0);
  assert.ok(stopperBounds.y + stopperBounds.height <= COMPACT_VIAL_SKIN.mouth.left.y);
  assert.ok(stopperBounds.x >= 0);
  assert.ok(stopperBounds.x + stopperBounds.width <= COMPACT_VIAL_SKIN.viewBox.width);
});

test("published compact PNG pack has exact 4x geometry and RGBA alpha channels", () => {
  const root = join(process.cwd(), "public", "potions", "compact");
  const assets: Array<{path: string; width: number; height: number}> = [
    ...["glass_back", "glass_front", "glass_front_glossy_variant"]
      .map((name) => ({path: `vial/${name}.png`, width: 400, height: 1088})),
    ...["cork", "wax", "crystal", "orb", "moon"]
      .map((name) => ({path: `toppers/${name}.png`, width: 400, height: 72})),
    ...COLOR_IDS.map((color) => ({path: `liquid/tiles/${color}.png`, width: 256, height: 256})),
    ...COLOR_IDS.map((color) => ({path: `liquid/bands/${color}.png`, width: 284, height: 237})),
    ...["bubble_cluster", "bubble_small", "foam_cluster", "sparkle_burst", "sparkle_single", "splash_drops"]
      .map((name) => ({path: `effects/${name}.png`, width: 128, height: 128})),
  ];

  assert.equal(assets.length, 38);
  for (const asset of assets) {
    const image = readFileSync(join(root, asset.path));
    assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", asset.path);
    assert.equal(image.readUInt32BE(16), asset.width, asset.path);
    assert.equal(image.readUInt32BE(20), asset.height, asset.path);
    assert.equal(image[25], 6, `${asset.path}: expected RGBA PNG`);
  }
});
