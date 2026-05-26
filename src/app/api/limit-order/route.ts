import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  buildDisciplineBlockedResponse,
  evaluateServerDisciplineRiskGate,
} from "@/features/discipline/lib/discipline-server-gate";
import { recordServerDisciplineTradesPlaced } from "@/features/discipline/lib/discipline-server-state";
import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";
import { getExecutionGuardError } from "@/lib/markets/portal-market-registry";
import type { HyperliquidSymbol } from "@/types/market";
import type { LimitOrderPlacementSummary, TradeDirection } from "@/types/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const LIMIT_ORDER_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_limit_order.py",
);

type LimitOrderRequestPayload = {
  placementId: string;
  reduceOnly?: boolean;
  stopLoss?: number;
  stopPrice?: number;
  takeProfit?: number;
  targetPrice?: number;
  side: TradeDirection;
  size: number;
  price: number;
  symbol: HyperliquidSymbol;
};

function validateLimitOrderPayload(payload: LimitOrderRequestPayload) {
  if (!payload.placementId || typeof payload.placementId !== "string") {
    return "Invalid limit order id.";
  }

  if (!payload.symbol || typeof payload.symbol !== "string") {
    return "Invalid execution symbol.";
  }

  if (payload.side !== "long" && payload.side !== "short") {
    return "Invalid execution side.";
  }

  if (!Number.isFinite(payload.size) || payload.size <= 0) {
    return "Invalid execution size.";
  }

  if (!Number.isFinite(payload.price) || payload.price <= 0) {
    return "Invalid execution price.";
  }

  return null;
}

export async function POST(request: Request) {
  let payload: LimitOrderRequestPayload;

  try {
    payload = (await request.json()) as LimitOrderRequestPayload;
  } catch {
    return Response.json({ error: "Invalid limit-order payload." }, { status: 400 });
  }

  const executionGuardError = getExecutionGuardError(payload.symbol);

  if (executionGuardError) {
    return Response.json({ error: executionGuardError }, { status: 400 });
  }

  const validationError = validateLimitOrderPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const market = await resolveHyperliquidMarketFromMetadata(payload.symbol);

  if (!market) {
    return Response.json({ error: "Invalid execution symbol." }, { status: 400 });
  }

  const disciplineDecision = await evaluateServerDisciplineRiskGate({
    actionType: "limit_order",
    nextOrder: {
      reduceOnly: payload.reduceOnly === true,
      side: payload.side,
      size: payload.size,
    },
    orderType: "limit",
    prices: [payload.price],
    protectionContext: {
      stopLoss: payload.stopLoss,
      stopPrice: payload.stopPrice,
      takeProfit: payload.takeProfit,
      targetPrice: payload.targetPrice,
    },
    requestedTrades: 1,
    side: payload.side,
    size: payload.size,
    source: "manual",
    symbol: payload.symbol,
  });

  if (disciplineDecision.decision === "blocked") {
    return buildDisciplineBlockedResponse(disciplineDecision);
  }

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(LIMIT_ORDER_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet limit-order runtime is not installed." },
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
    const { stdout } = await execFileAsync(PYTHON_EXECUTABLE, [LIMIT_ORDER_SCRIPT], {
      env: {
        ...process.env,
        PORTAL_LIMIT_ORDER_PAYLOAD: JSON.stringify({
          coin: market.coin,
          direction: payload.side,
          placementId: payload.placementId,
          price: payload.price,
          reduceOnly: payload.reduceOnly === true,
          size: payload.size,
          symbol: payload.symbol,
        }),
      },
      maxBuffer: 1024 * 1024,
    });

    const parsedOutput = JSON.parse(stdout) as {
      error?: string;
      summary?: LimitOrderPlacementSummary;
      success: boolean;
    };

    if (!parsedOutput.success || !parsedOutput.summary) {
      return Response.json(
        { error: parsedOutput.error ?? "Hyperliquid testnet limit-order placement failed." },
        { status: 502 },
      );
    }

    if (parsedOutput.summary.finalResult === "live" || parsedOutput.summary.finalResult === "filled") {
      await recordServerDisciplineTradesPlaced(1);
    }

    return Response.json(parsedOutput);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet limit-order bridge failed", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof (error as { stdout?: unknown }).stdout === "string"
    ) {
      try {
        const parsedError = JSON.parse((error as { stdout: string }).stdout) as {
          error?: string;
          summary?: LimitOrderPlacementSummary;
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
      { error: "Hyperliquid testnet limit-order placement failed." },
      { status: 502 },
    );
  }
}
