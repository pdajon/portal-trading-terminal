import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  buildDisciplineBlockedResponse,
  evaluateServerDisciplineRiskGate,
} from "@/features/discipline/lib/discipline-server-gate";
import { recordServerDisciplineTradesPlaced } from "@/features/discipline/lib/discipline-server-state";
import { resolveExecutionSizing } from "@/features/execution/execution-sizing";
import {
  MAX_MARKET_MAX_SLIPPAGE_PERCENT,
  MIN_MARKET_MAX_SLIPPAGE_PERCENT,
} from "@/features/execution/lib/trade-action-safety";
import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";
import { getExecutionGuardError } from "@/lib/markets/portal-market-registry";
import type { HyperliquidSymbol } from "@/types/market";
import type {
  ExecutionSummary,
  TradeDirection,
  TradeMarginMode,
} from "@/types/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const EXECUTION_SCRIPT = join(process.cwd(), "src", "lib", "hyperliquid", "testnet_execute.py");

type ExecuteRequestPayload = {
  allocationPercent?: number;
  baseSize?: number;
  confirmedDisciplineWarnings?: string[];
  conversionPrice?: number;
  executionId: string;
  intendedNotionalUsdc?: number;
  leverage?: number;
  marginMode?: TradeMarginMode;
  maxSlippagePercent?: number;
  notionalUsdc?: number;
  stopLoss?: number;
  stopPrice?: number;
  takeProfit?: number;
  targetPrice?: number;
  side: TradeDirection;
  size?: number;
  symbol: HyperliquidSymbol;
};

function validateExecutionPayload(payload: ExecuteRequestPayload) {
  if (!payload.executionId || typeof payload.executionId !== "string") {
    return "Invalid execution id.";
  }

  if (!payload.symbol || typeof payload.symbol !== "string") {
    return "Invalid execution symbol.";
  }

  if (payload.side !== "long" && payload.side !== "short") {
    return "Invalid execution side.";
  }

  if (
    payload.leverage !== undefined &&
    (!Number.isFinite(payload.leverage) || payload.leverage <= 0 || !Number.isInteger(payload.leverage))
  ) {
    return "Invalid execution leverage.";
  }

  if (
    payload.marginMode !== undefined &&
    payload.marginMode !== "cross" &&
    payload.marginMode !== "isolated"
  ) {
    return "Invalid execution margin mode.";
  }

  if (
    payload.maxSlippagePercent !== undefined &&
    (!Number.isFinite(payload.maxSlippagePercent) ||
      payload.maxSlippagePercent < MIN_MARKET_MAX_SLIPPAGE_PERCENT ||
      payload.maxSlippagePercent > MAX_MARKET_MAX_SLIPPAGE_PERCENT)
  ) {
    return `Invalid max slippage. Use ${MIN_MARKET_MAX_SLIPPAGE_PERCENT.toFixed(
      2,
    )}% to ${MAX_MARKET_MAX_SLIPPAGE_PERCENT.toFixed(2)}%.`;
  }

  return null;
}

export async function POST(request: Request) {
  let payload: ExecuteRequestPayload;

  try {
    payload = (await request.json()) as ExecuteRequestPayload;
  } catch {
    return Response.json({ error: "Invalid execution payload." }, { status: 400 });
  }

  const executionGuardError = getExecutionGuardError(payload.symbol);

  if (executionGuardError) {
    return Response.json({ error: executionGuardError }, { status: 400 });
  }

  const validationError = validateExecutionPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const market = await resolveHyperliquidMarketFromMetadata(payload.symbol);

  if (!market) {
    return Response.json({ error: "Invalid execution symbol." }, { status: 400 });
  }

  const sizing = resolveExecutionSizing({
    baseSize: payload.baseSize,
    conversionPrice: payload.conversionPrice,
    intendedNotionalUsdc: payload.intendedNotionalUsdc,
    market,
    notionalUsdc: payload.notionalUsdc,
    size: payload.size,
    symbol: payload.symbol,
  });

  if (!sizing.ok) {
    return Response.json({ error: sizing.error }, { status: 400 });
  }

  const disciplineDecision = await evaluateServerDisciplineRiskGate({
    actionType: "market_order",
    confirmedDisciplineWarnings: Array.isArray(payload.confirmedDisciplineWarnings)
      ? payload.confirmedDisciplineWarnings.filter((warning) => warning === "market_entry_confirmation_required")
      : [],
    orderType: "market",
    requestedTrades: 1,
    protectionContext: {
      stopLoss: payload.stopLoss,
      stopPrice: payload.stopPrice,
      takeProfit: payload.takeProfit,
      targetPrice: payload.targetPrice,
    },
    side: payload.side,
    size: sizing.baseSize,
    source: "manual",
    symbol: payload.symbol,
  });

  if (disciplineDecision.decision === "blocked" || disciplineDecision.decision === "override_required") {
    return buildDisciplineBlockedResponse(disciplineDecision);
  }

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(EXECUTION_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet execution runtime is not installed." },
      { status: 500 },
    );
  }

  if (!process.env.HYPERLIQUID_TESTNET_SECRET_KEY) {
    return Response.json(
      { error: "Missing Hyperliquid testnet signer config." },
      { status: 500 },
    );
  }

  try {
    const { stdout } = await execFileAsync(PYTHON_EXECUTABLE, [EXECUTION_SCRIPT], {
      env: {
        ...process.env,
        PORTAL_EXECUTION_PAYLOAD: JSON.stringify({
          coin: market.coin,
          direction: payload.side,
          executionId: payload.executionId,
          leverage: payload.leverage,
          marginMode: payload.marginMode ?? "cross",
          maxSlippagePercent: payload.maxSlippagePercent,
          size: sizing.baseSize,
          symbol: payload.symbol,
        }),
      },
      maxBuffer: 1024 * 1024,
    });

    const parsedOutput = JSON.parse(stdout) as {
      error?: string;
      summary?: ExecutionSummary;
      success: boolean;
    };

    if (!parsedOutput.success || !parsedOutput.summary) {
      return Response.json(
        { error: parsedOutput.error ?? "Hyperliquid testnet execution failed." },
        { status: 502 },
      );
    }

    parsedOutput.summary = {
      ...parsedOutput.summary,
      allocationPercent: payload.allocationPercent,
      conversionPrice: payload.conversionPrice,
      estimatedNotionalUsdc: sizing.estimatedNotionalUsdc,
      intendedNotionalUsdc: payload.intendedNotionalUsdc ?? payload.notionalUsdc,
      sizingUnit: sizing.sizingUnit,
    };

    await recordServerDisciplineTradesPlaced(1);

    return Response.json(parsedOutput);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet execution bridge failed", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof (error as { stdout?: unknown }).stdout === "string"
    ) {
      try {
        const parsedError = JSON.parse((error as { stdout: string }).stdout) as {
          error?: string;
          summary?: ExecutionSummary;
        };

        if (parsedError.error) {
          return Response.json(
            { error: parsedError.error, summary: parsedError.summary },
            { status: 502 },
          );
        }
      } catch {
        // Fall through to generic message handling below.
      }
    }

    return Response.json(
      { error: "Hyperliquid testnet execution failed." },
      { status: 502 },
    );
  }
}
