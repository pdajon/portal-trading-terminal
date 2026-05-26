import {
  createDisciplineRiskGateLogEntry,
  evaluateDisciplineRiskGate,
  type DisciplineRiskGateInput,
  type DisciplineRiskGateResult,
} from "@/features/discipline/lib/discipline-risk-gate";
import {
  isServerDisciplinePriceInsideNoTradeZone,
  readServerDisciplineState,
  type ServerDisciplineState,
} from "@/features/discipline/lib/discipline-server-state";
import { isBlockedTimeWindowActive } from "@/features/discipline/lib/discipline-time-window";

export type ServerDisciplineGateInput = Omit<
  DisciplineRiskGateInput,
  "noTradeZoneActive" | "rules" | "tracking" | "tradePlan"
> & {
  noTradeZoneActive?: boolean;
  prices?: number[];
};

export async function evaluateServerDisciplineRiskGate(input: ServerDisciplineGateInput) {
  const state = await readServerDisciplineState();
  return evaluateServerDisciplineRiskGateWithState(state, input);
}

export function evaluateServerDisciplineRiskGateWithState(
  state: ServerDisciplineState,
  input: ServerDisciplineGateInput,
): DisciplineRiskGateResult {
  const noTradeZoneActive =
    input.noTradeZoneActive ??
    (input.prices ?? []).some((price) =>
      isServerDisciplinePriceInsideNoTradeZone(state, input.symbol, price),
    );
  const tradePlan = state.activeTradePlan?.symbol === input.symbol ? state.activeTradePlan : null;
  const activeBlockedTimeWindow = state.blockedTimeWindows.find((rule) =>
    state.ruleStates.blockedTimeWindows[rule.id]?.state !== "overridden" &&
    isBlockedTimeWindowActive(rule),
  );

  return evaluateDisciplineRiskGate({
    ...input,
    blockedTimeWindowActive: activeBlockedTimeWindow !== undefined,
    blockedTimeWindowSource: activeBlockedTimeWindow?.source,
    disciplineLocked: input.disciplineLocked ?? state.disciplineLocked,
    marketEntryConfirmation: state.marketEntryConfirmation,
    noTradeZoneActive,
    rules: state.rules,
    requireProtection: state.requireProtection,
    tracking: state.tracking,
    tradePlan,
  });
}

export function buildDisciplineBlockedResponse(result: DisciplineRiskGateResult) {
  const logEntry = result.decision === "blocked" && result.reasonCode
    ? createDisciplineRiskGateLogEntry(result)
    : null;

  return Response.json(
    {
      discipline: {
        actionType: result.input.actionType,
        decision: result.decision,
        message: result.message ?? "Trade blocked. Risk could not be classified.",
        reasonCode: result.reasonCode ?? "unknown_risk_action",
        riskDirection: result.riskDirection,
        source: result.input.source,
        symbol: result.input.symbol ?? null,
      },
      disciplineLogEntry: logEntry,
      error: result.message ?? "Trade blocked. Risk could not be classified.",
      success: false,
    },
    { status: 403 },
  );
}
