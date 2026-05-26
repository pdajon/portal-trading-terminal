import {
  getServerDisciplineRuleStateEntry,
  markServerDisciplineRuleOverridden,
  readServerDisciplineState,
  type DisciplineRuleType,
} from "@/features/discipline/lib/discipline-server-state";
import { appendOverrideBondLedgerEntry } from "@/features/discipline/lib/override-bond-ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OverrideBondRequest = {
  ruleId?: string;
  ruleType?: string;
  walletAddress?: string;
};

export async function POST(request: Request) {
  let body: OverrideBondRequest;

  try {
    body = await request.json() as OverrideBondRequest;
  } catch {
    return Response.json({
      accepted: false,
      message: "Override Bond request is invalid.",
      reasonCode: "invalid_override_bond_request",
    }, { status: 400 });
  }

  const ruleType = sanitizeRuleType(body.ruleType);
  if (!ruleType) {
    return Response.json({
      accepted: false,
      message: "Override Bond request is missing a valid rule type.",
      reasonCode: "invalid_override_bond_rule",
    }, { status: 400 });
  }

  const ruleId = typeof body.ruleId === "string" && body.ruleId.length > 0
    ? body.ruleId
    : getDefaultRuleId(ruleType);
  const state = await readServerDisciplineState();
  const ruleState = getServerDisciplineRuleStateEntry(state, { ruleId, ruleType });

  if (ruleState?.state !== "locked") {
    return Response.json({
      accepted: false,
      message: "Override Bond is only available for locked rules.",
      reasonCode: "override_bond_not_required",
      ruleState: ruleState?.state ?? "inactive",
    }, { status: 409 });
  }

  const bond = await appendOverrideBondLedgerEntry({
    ruleId,
    ruleType,
    state,
    walletAddress: typeof body.walletAddress === "string" ? body.walletAddress : undefined,
  });
  const nextState = await markServerDisciplineRuleOverridden({ ruleId, ruleType });

  return Response.json({
    accepted: true,
    bond: {
      baseAmountUsdc: bond.baseAmountUsdc,
      finalAmountUsdc: bond.finalAmountUsdc,
      multiplier: bond.multiplier,
      portalAmountUsdc: bond.portalAmountUsdc,
      reserveAmountUsdc: bond.reserveAmountUsdc,
      vaultAmountUsdc: bond.vaultAmountUsdc,
    },
    message: "Override Bond posted. Rule overridden.",
    ruleState: "overridden",
    sessionLogEntry: {
      category: "discipline",
      eventType: "discipline-override-bond-posted",
      message: "Override Bond posted. Rule overridden.",
      metadata: {
        baseAmountUsdc: bond.baseAmountUsdc,
        finalAmountUsdc: bond.finalAmountUsdc,
        multiplier: bond.multiplier,
        newRuleState: "overridden",
        overrideCountToday: bond.overrideCountToday,
        portalAmountUsdc: bond.portalAmountUsdc,
        previousRuleState: "locked",
        reasonRequired: false,
        reserveAmountUsdc: bond.reserveAmountUsdc,
        ruleId,
        ruleType,
        source: "simulated",
        vaultAmountUsdc: bond.vaultAmountUsdc,
      },
    },
    state: nextState,
  });
}

function sanitizeRuleType(ruleType: unknown): DisciplineRuleType | null {
  return ruleType === "blocked_time_window" ||
    ruleType === "cooldown_after_loss" ||
    ruleType === "max_daily_loss" ||
    ruleType === "max_trades_per_day" ||
    ruleType === "min_risk_reward" ||
    ruleType === "no_trade_zone"
    ? ruleType
    : null;
}

function getDefaultRuleId(ruleType: DisciplineRuleType) {
  switch (ruleType) {
    case "blocked_time_window":
      return undefined;
    case "cooldown_after_loss":
      return "cooldownAfterLossMinutes";
    case "max_daily_loss":
      return "maxDailyLoss";
    case "max_trades_per_day":
      return "maxTradesPerDay";
    case "min_risk_reward":
      return "minRiskReward";
    case "no_trade_zone":
      return undefined;
  }
}
