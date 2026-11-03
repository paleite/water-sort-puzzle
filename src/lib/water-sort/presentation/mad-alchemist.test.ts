import { existsSync } from "node:fs";
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
  DEFAULT_VIAL_SKIN,
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
