import assert from "node:assert/strict";
import test from "node:test";

import { buildAccountScriptArgs } from "./account-route-args";

test("buildAccountScriptArgs passes aggregate trade history through to the bridge", () => {
  assert.deepEqual(
    buildAccountScriptArgs({
      aggregateTrades: true,
      scriptPath: "/portal/testnet_account.py",
      symbol: "BTC-USD",
    }),
    ["/portal/testnet_account.py", "BTC-USD", "--aggregate-trades"],
  );

  assert.deepEqual(
    buildAccountScriptArgs({
      aggregateTrades: false,
      scriptPath: "/portal/testnet_account.py",
      symbol: null,
    }),
    ["/portal/testnet_account.py"],
  );
});
