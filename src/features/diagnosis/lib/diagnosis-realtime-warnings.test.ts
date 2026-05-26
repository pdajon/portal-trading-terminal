import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveDiagnosisRealtimeWarningsV1,
  type DiagnosisRealtimeWarningInput,
} from "./diagnosis-realtime-warnings";
import type { DiagnosisFinding, OperatorDiagnosis } from "./operator-diagnosis";
import type { JournalMemoryEvent } from "@/features/journal/lib/journal-memory-events";

function finding(overrides: Partial<DiagnosisFinding> = {}): DiagnosisFinding {
  return {
    category: "post_loss_behavior",
    evidenceEventIds: [],
    id: "finding:post-loss-behavior",
    impact: { netPnl: -120, tradeCount: 2 },
    journalEntryIds: ["trade-1", "trade-2"],
    recommendation: "Add a cooldown after realized losses.",
    severity: "warning",
    summary: "Your trades after losses are underperforming.",
    title: "Post-loss trading is hurting you.",
    ...overrides,
  };
}

function diagnosis(overrides: Partial<OperatorDiagnosis> = {}): OperatorDiagnosis {
  return {
    confidence: "medium",
    generatedAt: "2026-05-04T14:00:00.000Z",
    profitableBehaviors: [],
    profitLeaks: [finding()],
    recommendedPlan: {
      expectedBenefit: "Reduce avoidable loss.",
      id: "diagnosis-plan-1",
      rules: [],
      status: "review_ready",
      summary: "Draft plan.",
      title: "Recommended Discipline Plan",
    },
    sampleSize: 8,
    ...overrides,
    nativeSessionReviewCandidates: overrides.nativeSessionReviewCandidates ?? [],
  };
}

function input(overrides: Partial<DiagnosisRealtimeWarningInput> = {}): DiagnosisRealtimeWarningInput {
  return {
    activeDisciplineState: {
      cooldownAfterLossMinutes: null,
      maxTradesPerDay: null,
      minRiskReward: null,
      tradesPlacedToday: 0,
    },
    currentAction: {
      actionType: "open_risk",
      hasPlanContext: false,
      orderType: "market",
      riskIncreasing: true,
      side: "long",
      source: "manual",
      symbol: "BTC-USD",
    },
    diagnosis: diagnosis(),
    existingAiWarningCount: 0,
    journalEntries: [
      {
        id: "loss-1",
        realizedPnl: -40,
        status: "closed",
        timestamp: "2026-05-04T13:30:00.000Z",
      },
    ],
    journalMemoryEvents: [],
    now: "2026-05-04T14:00:00.000Z",
    ...overrides,
  };
}

function memory(overrides: Partial<JournalMemoryEvent> = {}): JournalMemoryEvent {
  return {
    id: "memory-1",
    source: "journal",
    timestamp: "2026-05-04T13:55:00.000Z",
    type: "plan_changed",
    ...overrides,
  };
}

test("post-loss diagnosis creates real-time warning on new risk", () => {
  const warnings = deriveDiagnosisRealtimeWarningsV1(input());

  assert.equal(warnings[0]?.trigger, "diagnosed_post_loss_pattern");
  assert.equal(warnings[0]?.title, "Post-loss risk.");
});

test("weak time-window diagnosis creates warning during matching hour", () => {
  const warnings = deriveDiagnosisRealtimeWarningsV1(
    input({
      diagnosis: diagnosis({
        profitLeaks: [
          finding({
            category: "time_window",
            id: "finding:time-window:14",
            recommendation: "Block or warn during 14:00-15:00.",
            recommendedRule: {
              id: "rule:blocked-time-window:14",
              proposedValue: { hour: 14, label: "14:00-15:00" },
              reason: "This hour underperforms.",
              ruleType: "blocked_time_window",
              sourceFindingId: "finding:time-window:14",
              title: "Block 14:00-15:00",
            },
            title: "This time window underperforms.",
          }),
        ],
      }),
      journalEntries: [],
      now: "2026-05-04T19:00:00.000Z",
    }),
  );

  const warning = warnings.find((candidate) => candidate.trigger === "diagnosed_time_window_weakness");
  assert.equal(warning?.title, "Weak time window.");
  assert.match(warning?.message ?? "", /warning only/i);
});

test("manual entry weakness creates warning on manual market order intent", () => {
  const warnings = deriveDiagnosisRealtimeWarningsV1(
    input({
      diagnosis: diagnosis({
        profitLeaks: [finding({ category: "manual_entry", id: "finding:manual-entry", title: "Manual entries underperform." })],
      }),
    }),
  );

  assert.ok(warnings.some((warning) => warning.trigger === "diagnosed_manual_entry_weakness"));
});

test("override pattern creates warning before another override", () => {
  const warnings = deriveDiagnosisRealtimeWarningsV1(
    input({
      currentAction: {
        actionType: "override_bond",
        riskIncreasing: true,
        source: "manual",
      },
      diagnosis: diagnosis({
        profitLeaks: [finding({ category: "override_bond", id: "finding:override-bond", severity: "critical" })],
      }),
    }),
  );

  assert.equal(warnings[0]?.severity, "critical");
  assert.equal(warnings[0]?.trigger, "diagnosed_override_pattern");
});

test("plan broken pattern creates warning without plan context", () => {
  const warnings = deriveDiagnosisRealtimeWarningsV1(
    input({
      diagnosis: diagnosis({
        profitLeaks: [finding({ category: "plan_broken", id: "finding:plan-broken" })],
      }),
    }),
  );

  assert.ok(warnings.some((warning) => warning.trigger === "diagnosed_plan_broken_pattern"));
});

test("AI warning ignored pattern creates follow-up warning", () => {
  const warnings = deriveDiagnosisRealtimeWarningsV1(
    input({
      diagnosis: diagnosis({
        profitLeaks: [finding({ category: "ai_warning_ignored", id: "finding:ai-warning-ignored" })],
      }),
      existingAiWarningCount: 1,
    }),
  );

  assert.ok(warnings.some((warning) => warning.trigger === "diagnosed_ai_warning_ignored"));
});

test("activated plan rule relevance creates info warning", () => {
  const warnings = deriveDiagnosisRealtimeWarningsV1(
    input({
      journalMemoryEvents: [
        memory({
          metadata: {
            activatedRules: [
              {
                recommendedRuleId: "rule:cooldown-after-loss",
                ruleType: "cooldown_after_loss",
              },
            ],
            diagnosisPlanId: "diagnosis-plan-1",
            source: "operator_diagnosis",
          },
        }),
      ],
    }),
  );

  assert.ok(warnings.some((warning) => warning.trigger === "activated_plan_rule_relevant"));
});

test("unsupported recommendation warns but does not enforce", () => {
  const warnings = deriveDiagnosisRealtimeWarningsV1(
    input({
      diagnosis: diagnosis({
        profitLeaks: [
          finding({
            category: "time_window",
            id: "finding:time-window:14",
            recommendedRule: {
              id: "rule:blocked-time-window:14",
              proposedValue: { hour: 14, label: "14:00-15:00" },
              reason: "Weak time window.",
              ruleType: "blocked_time_window",
              sourceFindingId: "finding:time-window:14",
              title: "Block weak hour",
            },
          }),
        ],
      }),
      journalEntries: [],
      now: "2026-05-04T19:00:00.000Z",
    }),
  );

  assert.ok(warnings.some((warning) => warning.trigger === "unsupported_recommendation_warning"));
  assert.ok(warnings.every((warning) => warning.message.includes("blocked") === false));
});

test("duplicate diagnosis warnings dedupe", () => {
  const warnings = deriveDiagnosisRealtimeWarningsV1(
    input({
      diagnosis: diagnosis({
        profitLeaks: [
          finding({ category: "manual_entry", id: "finding:manual-entry-a" }),
          finding({ category: "manual_entry", id: "finding:manual-entry-b" }),
        ],
      }),
    }),
  );

  assert.equal(warnings.filter((warning) => warning.trigger === "diagnosed_manual_entry_weakness").length, 1);
});

test("no warning appears when no matching diagnosis exists", () => {
  const warnings = deriveDiagnosisRealtimeWarningsV1(
    input({
      diagnosis: diagnosis({ profitLeaks: [] }),
      journalEntries: [],
    }),
  );

  assert.equal(warnings.length, 0);
});
