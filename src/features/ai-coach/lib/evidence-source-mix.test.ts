import assert from "node:assert/strict";
import test from "node:test";
import type { StoredBaselineImportBundle } from "@/features/baseline-import";
import {
  DEFAULT_AI_EVIDENCE_SOURCE_MIX,
  getAiEvidenceSourceSummary,
  mapBaselineImportTradesForDiagnosis,
  sanitizeAiEvidenceSourceMix,
  toggleAiEvidenceSource,
} from "./evidence-source-mix";

function storedBundle(
  overrides: Partial<StoredBaselineImportBundle["result"]["trades"][number]> = {},
): StoredBaselineImportBundle {
  return {
    id: "bundle-1",
    request: {
      accountAddress: "0xabc",
      endTime: 1000,
      environment: "testnet",
      startTime: 0,
      timezone: "UTC",
    },
    result: {
      accountSnapshot: null,
      fills: [],
      funding: [],
      ledgerUpdates: [],
      orders: [],
      profile: {} as StoredBaselineImportBundle["result"]["profile"],
      sessions: [],
      sourceHealth: {
        aggregatedFillCount: 0,
        boundaryFillCount: 0,
        recommendationTradeCount: 1,
      },
      trades: [
        {
          accountAddress: "0xabc",
          addFills: [],
          closeFills: [],
          coin: "BTC",
          direction: "long",
          durationMinutes: 12,
          endTime: 1000,
          entryPrice: 100,
          entryStyleProxy: "likely-hunted",
          entryTime: 0,
          environment: "testnet",
          executionClosedPnl: -45,
          executionMode: "market",
          exitPrice: 95,
          fundingPnl: 0,
          grossFees: 1,
          id: "trade-1",
          maxSize: 1,
          netPnl: -46,
          openFills: [],
          orderIds: [],
          rawOrderMatches: [],
          reconstructionConfidence: "high",
          reduceFills: [],
          sessionId: "session-1",
          sourceLabel: "Historical Import",
          status: "closed",
          ...overrides,
        },
      ],
      warnings: [],
    },
    savedAt: "2026-05-01T00:00:00.000Z",
    source: "hyperliquid",
    sourceLabel: "Historical Import",
    version: "v1",
  };
}

test("source mix defaults to both Portal and external evidence", () => {
  assert.deepEqual(sanitizeAiEvidenceSourceMix(null), DEFAULT_AI_EVIDENCE_SOURCE_MIX);
  assert.equal(getAiEvidenceSourceSummary(DEFAULT_AI_EVIDENCE_SOURCE_MIX), "Portal + External");
});

test("source mix never allows both evidence sources to be off", () => {
  const externalOnly = toggleAiEvidenceSource(
    DEFAULT_AI_EVIDENCE_SOURCE_MIX,
    "portal-recorded",
  );

  assert.deepEqual(externalOnly, {
    externalContext: true,
    portalRecorded: false,
  });
  assert.deepEqual(toggleAiEvidenceSource(externalOnly, "external-context"), externalOnly);
  assert.deepEqual(
    sanitizeAiEvidenceSourceMix({ externalContext: false, portalRecorded: false }),
    DEFAULT_AI_EVIDENCE_SOURCE_MIX,
  );
});

test("stored baseline trades map into imported diagnosis evidence", () => {
  const entries = mapBaselineImportTradesForDiagnosis([storedBundle()]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.id, "baseline:bundle-1:trade-1");
  assert.equal(entries[0]?.dataSource, "imported");
  assert.equal(entries[0]?.sourceType, "imported");
  assert.match(entries[0]?.userFacingLabel ?? "", /Imported Historical Baseline/);
  assert.match(entries[0]?.userFacingLabel ?? "", /Directional context/);
  assert.equal(entries[0]?.diagnosisEvidence?.sourceType, "imported_historical_baseline");
  assert.equal(entries[0]?.diagnosisEvidence?.trustLevel, "directional_context");
  assert.ok(entries[0]?.diagnosisEvidence?.prohibitedUses.includes("native_journal_claim"));
  assert.equal(entries[0]?.entrySource, "Market");
  assert.equal(entries[0]?.realizedPnl, -46);
  assert.equal(entries[0]?.status, "closed");
  assert.equal(entries[0]?.symbol, "BTC-USD");
});
