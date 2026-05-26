import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("live position detail ledger omits distance and protection rows", () => {
  const source = readFileSync(
    "src/features/chart/components/live-position-rail.tsx",
    "utf8",
  );

  const detailRowsStart = source.indexOf("function buildPositionDetailRows");
  const detailRowsEnd = source.indexOf(
    "function PositionDetailLedger",
    detailRowsStart,
  );
  const detailRowsSource = source.slice(detailRowsStart, detailRowsEnd);

  assert.doesNotMatch(detailRowsSource, /label: "Distance"/);
  assert.doesNotMatch(detailRowsSource, /label: "Stop Loss"/);
  assert.doesNotMatch(detailRowsSource, /label: "Take Profit"/);
});
