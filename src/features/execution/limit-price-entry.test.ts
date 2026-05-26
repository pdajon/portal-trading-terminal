import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LIMIT_PRICE_ENTRY_MODE,
  formatLimitMidPriceInput,
  getLimitPriceEntryResetState,
  parseLimitPriceInput,
  resolveLimitPriceEntry,
} from "./limit-price-entry";

test("defaults manual limit price entry to typed input", () => {
  assert.equal(DEFAULT_LIMIT_PRICE_ENTRY_MODE, "typed");
  assert.deepEqual(getLimitPriceEntryResetState(), {
    mode: "typed",
    typedPriceInput: "",
  });
});

test("chart mode resolves without requiring a typed price", () => {
  assert.deepEqual(
    resolveLimitPriceEntry({
      mode: "chart",
      typedPriceInput: "",
    }),
    { mode: "chart", ok: true },
  );
});

test("typed mode resolves positive finite price input", () => {
  assert.deepEqual(
    resolveLimitPriceEntry({
      mode: "typed",
      typedPriceInput: "77,292.50",
    }),
    { mode: "typed", ok: true, price: 77292.5 },
  );
});

test("typed mode rejects empty, zero, negative, and non-number prices", () => {
  for (const typedPriceInput of ["", "0", "-1", "abc"]) {
    assert.deepEqual(
      resolveLimitPriceEntry({
        mode: "typed",
        typedPriceInput,
      }),
      {
        mode: "typed",
        ok: false,
        reason: "Enter a valid limit price before placing the order.",
      },
    );
  }
});

test("mid helper formats only positive finite market prices", () => {
  assert.equal(formatLimitMidPriceInput(77292.44), "77292");
  assert.equal(formatLimitMidPriceInput(0), "");
  assert.equal(formatLimitMidPriceInput(Number.NaN), "");
  assert.equal(formatLimitMidPriceInput(null), "");
});

test("price parser accepts comma-formatted prices and ignores labels", () => {
  assert.equal(parseLimitPriceInput("Price 77,292.50 USDC"), 77292.5);
  assert.equal(parseLimitPriceInput(""), null);
});
