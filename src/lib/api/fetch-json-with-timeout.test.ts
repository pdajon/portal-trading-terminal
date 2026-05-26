import test from "node:test";
import assert from "node:assert/strict";
import { fetchJsonWithTimeout, isFetchJsonTimeoutError } from "./fetch-json-with-timeout";

test("returns parsed JSON when fetch completes before timeout", async () => {
  const payload = await fetchJsonWithTimeout<{ ok: boolean }>(
    () =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    { timeoutMs: 50 },
  );

  assert.equal(payload.response.ok, true);
  assert.deepEqual(payload.json, { ok: true });
});

test("rejects with a timeout error when fetch does not settle", async () => {
  await assert.rejects(
    fetchJsonWithTimeout(
      () => new Promise<Response>(() => {}),
      { timeoutMs: 1 },
    ),
    (error: unknown) => {
      assert.equal(isFetchJsonTimeoutError(error), true);
      return true;
    },
  );
});
