import assert from "node:assert/strict";
import test from "node:test";

import { applyMove } from "../domain/moves";
import type { Board } from "../domain/types";
import { ComboTracker, comboFontSizePixels, isComboEligible } from "./combo";

const board: Board = [
  ["coral", "sky"], ["sky"], ["cocoa", "coral"], [],
  ["coral", "coral", "coral", "coral"], [],
];
const move = applyMove(board, {sourceVialIndex: 0, destinationVialIndex: 1}, 4);
const secondMove = applyMove(board, {sourceVialIndex: 2, destinationVialIndex: 3}, 4);
const completeMove = applyMove(board, {sourceVialIndex: 4, destinationVialIndex: 5}, 4);

test("queued pours cannot reveal future combo before they start", () => {
  const tracker = new ComboTracker();
  tracker.accept(1, move, 4, 1000);
  tracker.accept(2, secondMove, 4, 1030);
  assert.equal(tracker.start(1), 1);
  // The second award is held behind its own presentation ID until start.
  assert.equal(tracker.start(2), 2);
  assert.equal(tracker.start(999), null);
});

test("hybrid overlap and 500ms grace, expiring after 500ms", () => {
  const tracker = new ComboTracker();
  tracker.accept(1, move, 4, 1000);
  tracker.finish(1, 1800);
  tracker.accept(2, secondMove, 4, 2300);
  assert.equal(tracker.start(2), 2);
  tracker.finish(2, 2400);
  tracker.accept(3, move, 4, 2901);
  assert.equal(tracker.start(3), 1);
});

test("already complete single-color source does not increase or refresh chain", () => {
  const tracker = new ComboTracker();
  assert.equal(isComboEligible(completeMove, 4), false);
  assert.equal(isComboEligible(move, 4), true);
  tracker.accept(1, move, 4, 100);
  tracker.finish(1, 300);
  tracker.accept(2, completeMove, 4, 700);
  assert.equal(tracker.start(2), null);
  tracker.finish(2, 720);
  tracker.accept(3, secondMove, 4, 801);
  assert.equal(tracker.start(3), 1);
});

test("excluded complete vial does not increment an overlapping combo", () => {
  const tracker = new ComboTracker();
  tracker.accept(1, move, 4, 100);
  tracker.accept(2, completeMove, 4, 105);
  tracker.accept(3, secondMove, 4, 110);
  assert.equal(tracker.start(2), null);
  assert.equal(tracker.start(3), 2);
});

test("newly completed destination and full mixed source remain eligible", () => {
  const mixed: Board = [["sky", "coral", "sky", "coral"], ["coral"]];
  const poured = applyMove(mixed, {sourceVialIndex: 0, destinationVialIndex: 1}, 4);
  assert.equal(isComboEligible(poured, 4), true);
});

test("font size grows linearly through 15, then stays fixed", () => {
  assert.equal(comboFontSizePixels(2), 32);
  assert.equal(comboFontSizePixels(15), 64);
  assert.equal(comboFontSizePixels(16), 64);
  assert.equal(comboFontSizePixels(100), 64);
  assert.ok(comboFontSizePixels(7) > comboFontSizePixels(6));
});
