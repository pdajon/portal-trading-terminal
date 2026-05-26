import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildNativeSessions,
  type BuildNativeSessionsInput,
  type NativeJournalEntryLike,
} from "./native-session-engine";
import { writeNativeSessionEngineDebugOutput } from "./native-session-engine-debug";
import {
  canBecomeDiagnosisGradeNativeSession,
} from "./native-session-contract";
import {
  createDebugOnlyEvidence,
  createImportedBaselineEvidence,
  createNativeJournalEvidence,
} from "./diagnosis-evidence";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const WALLET = "0x2222222222222222222222222222222222222222";

function trade(overrides: Partial<NativeJournalEntryLike> = {}): NativeJournalEntryLike {
  return {
    asset: "BTC",
    closedAt: "2026-05-23T15:00:00.000Z",
    direction: "long",
    entrySource: "manual",
    fees: 1,
    funding: 0,
    grossPnlBeforeFees: 11,
    id: "trade-1",
    openedAt: "2026-05-23T14:00:00.000Z",
    protected: true,
    realizedPnl: 10,
    status: "closed",
    timestamp: "2026-05-23T14:00:00.000Z",
    ...overrides,
  };
}

function input(overrides: Partial<BuildNativeSessionsInput> = {}): BuildNativeSessionsInput {
  return {
    accountAddress: ACCOUNT,
    environment: "mainnet",
    journalEntries: [],
    timezone: "America/Chicago",
    walletAddress: WALLET,
    ...overrides,
  };
}

test("no native evidence returns an empty session list", () => {
  assert.deepEqual(buildNativeSessions(input()), []);
});

test("native journal closed trades create a native session", () => {
  const sessions = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "trade-1", realizedPnl: -10 }),
        trade({
          id: "trade-2",
          openedAt: "2026-05-23T14:30:00.000Z",
          closedAt: "2026-05-23T14:50:00.000Z",
          realizedPnl: 30,
        }),
      ],
    }),
  );

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.source, "portal_native");
  assert.equal(sessions[0]?.closedTrades, 2);
  assert.equal(sessions[0]?.netPnlAfterFeesAndFunding, 20);
  assert.deepEqual(sessions[0]?.relatedTradeIds, ["trade-1", "trade-2"]);
  assert.equal(sessions[0]?.evidence.some((evidence) => evidence.sourceType === "native_journal"), true);
});

test("two trades within 90 minutes group into one session", () => {
  const sessions = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "trade-1", openedAt: "2026-05-23T14:00:00.000Z", closedAt: "2026-05-23T14:05:00.000Z" }),
        trade({ id: "trade-2", openedAt: "2026-05-23T15:20:00.000Z", closedAt: "2026-05-23T15:40:00.000Z" }),
      ],
    }),
  );

  assert.equal(sessions.length, 1);
  assert.deepEqual(sessions[0]?.relatedTradeIds, ["trade-1", "trade-2"]);
});

test("trades over 90 minutes split into separate sessions", () => {
  const sessions = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "trade-1", openedAt: "2026-05-23T14:00:00.000Z", closedAt: "2026-05-23T14:05:00.000Z" }),
        trade({ id: "trade-2", openedAt: "2026-05-23T16:00:00.000Z", closedAt: "2026-05-23T16:20:00.000Z" }),
      ],
    }),
  );

  assert.equal(sessions.length, 2);
});

test("imported entries are rejected and cannot create native sessions", () => {
  const sessions = buildNativeSessions(
    input({
      journalEntries: [
        trade({
          dataSource: "imported",
          diagnosisEvidence: createImportedBaselineEvidence({ id: "imported-evidence" }),
          sourceType: "imported",
        }),
      ],
    }),
  );

  assert.deepEqual(sessions, []);
});

test("debug-only evidence is rejected from user-facing session evidence", () => {
  const sessions = buildNativeSessions(
    input({
      journalEntries: [
        trade({ diagnosisEvidence: createDebugOnlyEvidence({ id: "debug-evidence" }), id: "debug-trade" }),
      ],
    }),
  );

  assert.equal(sessions.length, 0);
});

test("discipline and AI warning events attach inside the session window", () => {
  const [session] = buildNativeSessions(
    input({
      aiWarningEvents: [
        { id: "warning-shown", timestamp: "2026-05-23T14:05:00.000Z", type: "shown" },
        { id: "warning-dismissed", timestamp: "2026-05-23T14:06:00.000Z", type: "dismissed" },
        { id: "warning-outside", timestamp: "2026-05-23T18:00:00.000Z", type: "shown" },
      ],
      disciplineEvents: [
        { id: "discipline-block", timestamp: "2026-05-23T14:07:00.000Z", type: "block" },
        { id: "discipline-outside", timestamp: "2026-05-23T18:00:00.000Z", type: "block" },
      ],
      journalEntries: [
        trade({ id: "trade-1", realizedPnl: -10 }),
        trade({ id: "trade-2", openedAt: "2026-05-23T14:20:00.000Z", closedAt: "2026-05-23T14:35:00.000Z", realizedPnl: 5 }),
      ],
    }),
  );

  assert.deepEqual(session?.relatedDisciplineEventIds, ["discipline-block"]);
  assert.deepEqual(session?.relatedAiWarningIds, ["warning-shown", "warning-dismissed"]);
  assert.equal(session?.disciplineViolationCount, 1);
  assert.equal(session?.aiWarningShownCount, 1);
  assert.equal(session?.aiWarningDismissedCount, 1);
  assert.ok(session?.tags.includes("discipline_violation"));
  assert.ok(session?.tags.includes("ai_warning"));
});

test("post-loss and rapid re-entry tags are applied", () => {
  const [session] = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "loss", openedAt: "2026-05-23T14:00:00.000Z", closedAt: "2026-05-23T14:05:00.000Z", realizedPnl: -20 }),
        trade({ id: "reentry", openedAt: "2026-05-23T14:10:00.000Z", closedAt: "2026-05-23T14:20:00.000Z", realizedPnl: 10 }),
      ],
    }),
  );

  assert.equal(session?.postLossReentryCount, 1);
  assert.equal(session?.shortGapTradeCount, 1);
  assert.ok(session?.tags.includes("post_loss"));
  assert.ok(session?.tags.includes("rapid_reentry"));
});

test("high-density tag is applied", () => {
  const entries = Array.from({ length: 6 }, (_, index) =>
    trade({
      id: `trade-${index + 1}`,
      openedAt: `2026-05-23T14:${String(index * 5).padStart(2, "0")}:00.000Z`,
      closedAt: `2026-05-23T14:${String(index * 5 + 2).padStart(2, "0")}:00.000Z`,
      realizedPnl: index % 2 === 0 ? -5 : 10,
    }),
  );

  const [session] = buildNativeSessions(input({ journalEntries: entries }));

  assert.equal(session?.totalTrades, 6);
  assert.ok(session?.tags.includes("high_density"));
  assert.equal(session?.sessionType, "high_density");
});

test("manual and planned execution counts are calculated", () => {
  const [session] = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "manual", entrySource: "manual" }),
        trade({
          id: "planned",
          entrySource: "magic_trade",
          openedAt: "2026-05-23T14:15:00.000Z",
          closedAt: "2026-05-23T14:25:00.000Z",
          planFollowed: "followed",
        }),
      ],
    }),
  );

  assert.equal(session?.manualExecutionCount, 1);
  assert.equal(session?.plannedExecutionCount, 1);
  assert.ok(session?.tags.includes("manual_impulse"));
  assert.ok(session?.tags.includes("planned_execution"));
});

test("protected and unprotected counts are calculated", () => {
  const [session] = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "protected", protected: true }),
        trade({ id: "unprotected", openedAt: "2026-05-23T14:15:00.000Z", closedAt: "2026-05-23T14:25:00.000Z", protected: false }),
      ],
    }),
  );

  assert.equal(session?.protectedTradeCount, 1);
  assert.equal(session?.unprotectedTradeCount, 1);
  assert.ok(session?.tags.includes("protected"));
  assert.ok(session?.tags.includes("unprotected"));
});

test("overnight and weekend tags use trader timezone when safe", () => {
  const [session] = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "late-1", openedAt: "2026-05-24T02:00:00.000Z", closedAt: "2026-05-24T02:15:00.000Z" }),
        trade({ id: "late-2", openedAt: "2026-05-24T02:20:00.000Z", closedAt: "2026-05-24T02:35:00.000Z" }),
      ],
      timezone: "America/Chicago",
    }),
  );

  assert.ok(session?.tags.includes("overnight"));
  assert.ok(session?.tags.includes("weekend"));
  assert.equal(session?.sessionType, "overnight");
});

test("valid session can pass diagnosis-grade gate", () => {
  const [session] = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "trade-1", diagnosisEvidence: createNativeJournalEvidence({ id: "native-evidence-1", relatedTradeIds: ["trade-1"] }) }),
        trade({ id: "trade-2", openedAt: "2026-05-23T14:15:00.000Z", closedAt: "2026-05-23T14:25:00.000Z" }),
      ],
    }),
  );

  assert.equal(session?.diagnosisReadiness, "diagnosis_grade");
  assert.equal(session ? canBecomeDiagnosisGradeNativeSession(session) : false, true);
});

test("missing timezone blocks diagnosis-grade readiness", () => {
  const [session] = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "trade-1" }),
        trade({ id: "trade-2", openedAt: "2026-05-23T14:15:00.000Z", closedAt: "2026-05-23T14:25:00.000Z" }),
      ],
      timezone: "",
    }),
  );

  assert.equal(session?.diagnosisReadiness, "unsafe_not_enough_evidence");
  assert.equal(session ? canBecomeDiagnosisGradeNativeSession(session) : false, false);
  assert.match(session?.confidenceReasons.join(" ") ?? "", /timezone/i);
});

test("fewer than two closed trades blocks diagnosis-grade readiness", () => {
  const [session] = buildNativeSessions(input({ journalEntries: [trade({ id: "single" })] }));

  assert.equal(session?.closedTrades, 1);
  assert.equal(session?.diagnosisReadiness, "directional_only");
  assert.equal(session ? canBecomeDiagnosisGradeNativeSession(session) : false, false);
});

test("imported evidence cannot raise confidence", () => {
  const [session] = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "native-1" }),
        trade({
          dataSource: "imported",
          diagnosisEvidence: createImportedBaselineEvidence({ confidence: "high", id: "imported-high" }),
          id: "imported-1",
          openedAt: "2026-05-23T14:15:00.000Z",
          sourceType: "imported",
        }),
      ],
    }),
  );

  assert.equal(session?.totalTrades, 1);
  assert.equal(session?.confidence, "low");
  assert.equal(session?.diagnosisReadiness, "directional_only");
});

test("native session ID is stable for same membership", () => {
  const sessionA = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "trade-1" }),
        trade({ id: "trade-2", openedAt: "2026-05-23T14:20:00.000Z", closedAt: "2026-05-23T14:30:00.000Z" }),
      ],
    }),
  )[0];
  const sessionB = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "trade-2", openedAt: "2026-05-23T14:20:00.000Z", closedAt: "2026-05-23T14:30:00.000Z" }),
        trade({ id: "trade-1" }),
      ],
    }),
  )[0];

  assert.equal(sessionA?.id, sessionB?.id);
});

test("debug writer produces safe native-session audit output", () => {
  const auditPath = join(process.cwd(), ".portal/audits/native-session-engine-latest.json");
  rmSync(auditPath, { force: true });
  const sessions = buildNativeSessions(
    input({
      journalEntries: [
        trade({ id: "trade-1" }),
        trade({ id: "trade-2", openedAt: "2026-05-23T14:20:00.000Z", closedAt: "2026-05-23T14:30:00.000Z" }),
      ],
    }),
  );

  writeNativeSessionEngineDebugOutput({ outputPath: auditPath, sessions });

  assert.equal(existsSync(auditPath), true);
  const parsed = JSON.parse(readFileSync(auditPath, "utf8")) as {
    diagnosisReadinessDistribution: Record<string, number>;
    nativeSessionCount: number;
    evidenceSourceCounts: Record<string, number>;
    sampleSessions: Array<{ safeId: string }>;
    sourceHealth: { displayLines: string[]; primaryDiagnosisFindingCount: number };
  };
  assert.equal(parsed.nativeSessionCount, 1);
  assert.equal(parsed.evidenceSourceCounts.native_journal, 1);
  assert.equal(parsed.diagnosisReadinessDistribution.diagnosis_grade, 1);
  assert.equal(parsed.sourceHealth.primaryDiagnosisFindingCount, 0);
  assert.equal(parsed.sourceHealth.displayLines.includes("Not yet promoted into Operator Diagnosis"), true);
  assert.match(parsed.sampleSessions[0]?.safeId ?? "", /^native-session:[a-z0-9]+$/);
  assert.doesNotMatch(parsed.sampleSessions[0]?.safeId ?? "", /0x/);
});
