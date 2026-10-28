import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import React, { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  addComboCelebration,
  ComboCelebrations,
  type ComboCelebration,
} from "./combo-celebrations";

const classes = {
  comboStage: "stage",
  comboIndicator: "indicator",
  comboBurst: "burst",
  comboSpark: "spark",
  comboNumber: "number",
  comboLabel: "label",
};

/** Exercise two synchronous functional state updates in a single React render.
 * This models two ready presentations starting in one scheduler effect.
 */
function TwoSimultaneousStarts() {
  const [celebrations, setCelebrations] = useState<ComboCelebration[]>([]);

  if (celebrations.length === 0) {
    setCelebrations((current) =>
      addComboCelebration(current, {
        id: 12,
        count: 2,
        sequence: 1,
      }),
    );
    setCelebrations((current) =>
      addComboCelebration(current, {
        id: 13,
        count: 3,
        sequence: 2,
      }),
    );
  }

  return <ComboCelebrations celebrations={celebrations} classes={classes} />;
}

test("two ready animation starts in one React update each render a celebration", () => {
  const markup = renderToStaticMarkup(<TwoSimultaneousStarts />);

  assert.match(markup, /data-combo-presentation-id="12"/);
  assert.match(markup, /data-combo-presentation-id="13"/);
  assert.match(markup, />2×</);
  assert.match(markup, />3×</);
  assert.equal((markup.match(/class="indicator"/g) ?? []).length, 2);
});

test("finishing one concurrent pour leaves the other celebration intact", () => {
  const both = addComboCelebration(
    addComboCelebration([], { id: 12, count: 2, sequence: 1 }),
    { id: 13, count: 3, sequence: 2 },
  );
  const remaining = both.filter((entry) => entry.id !== 12);
  const markup = renderToStaticMarkup(
    <ComboCelebrations celebrations={remaining} classes={classes} />,
  );

  assert.doesNotMatch(markup, /data-combo-presentation-id="12"/);
  assert.match(markup, /data-combo-presentation-id="13"/);
});

test("concurrent multipliers render in the same centered grid cell", () => {
  const styles = readFileSync(new URL("./water-sort.module.css", import.meta.url), "utf8");
  const stage = styles.match(/\.comboStage\s*\{([^}]*)\}/)?.[1] ?? "";
  const indicator = styles.match(/\.comboIndicator\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(stage, /display:\s*grid\s*;/);
  assert.match(stage, /justify-items:\s*center\s*;/);
  assert.match(indicator, /grid-area:\s*1\s*\/\s*1\s*;/);
});
