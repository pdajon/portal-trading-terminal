import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  buildDisciplineBlockedResponse,
  evaluateServerDisciplineRiskGateWithState,
} from "@/features/discipline/lib/discipline-server-gate";
import {
  findServerDisciplinePendingOrder,
  readServerDisciplineState,
} from "@/features/discipline/lib/discipline-server-state";
import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";
import { getExecutionGuardError } from "@/lib/markets/portal-market-registry";
import type { HyperliquidSymbol } from "@/types/market";
import type { PendingOrderReplaceSummary, TradeDirection } from "@/types/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const REPLACE_ORDER_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_replace_order.py",
);

type ReplaceOrderRequestPayload = {
  replaceId: string;
  symbol: HyperliquidSymbol;
  side: TradeDirection;
  orderId: number;
  price: number;
  size: number;
  stopLoss?: number;
  stopPrice?: number;
  takeProfit?: number;
  targetPrice?: number;
};

function validateReplaceOrderPayload(payload: ReplaceOrderRequestPayload) {
  if (!payload.replaceId || typeof payload.replaceId !== "string") {
    return "Invalid replace id.";
  }

  if (!payload.symbol || typeof payload.symbol !== "string") {
    return "Invalid replace symbol.";
  }

  if (payload.side !== "long" && payload.side !== "short") {
    return "Invalid replace side.";
  }

  if (!Number.isInteger(payload.orderId) || payload.orderId <= 0) {
    return "Invalid replace order id.";
  }

  if (!Number.isFinite(payload.size) || payload.size <= 0) {
    return "Invalid replace size.";
  }

  if (!Number.isFinite(payload.price) || payload.price <= 0) {
    return "Invalid replace price.";
  }

  return null;
}

export async function POST(request: Request) {
  let payload: ReplaceOrderRequestPayload;

  try {
    payload = (await request.json()) as ReplaceOrderRequestPayload;
  } catch {
    return Response.json({ error: "Invalid replace-order payload." }, { status: 400 });
  }

  const executionGuardError = getExecutionGuardError(payload.symbol);

  if (executionGuardError) {
    return Response.json({ error: executionGuardError }, { status: 400 });
  }

  const validationError = validateReplaceOrderPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const market = await resolveHyperliquidMarketFromMetadata(payload.symbol);

  if (!market) {
    return Response.json({ error: "Invalid replace symbol." }, { status: 400 });
  }

  const disciplineState = await readServerDisciplineState();
  const existingOrder = findServerDisciplinePendingOrder(disciplineState, {
    orderId: payload.orderId,
  });
  const disciplineDecision = evaluateServerDisciplineRiskGateWithState(disciplineState, {
    actionType: existingOrder ? "order_update" : "unknown",
    existingOrders: existingOrder ? [existingOrder] : [],
    nextOrders: existingOrder
      ? [{
          id: existingOrder.id,
          orderId: payload.orderId,
          reduceOnly: existingOrder.reduceOnly,
          side: payload.side,
          size: payload.size,
        }]
      : [],
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

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(REPLACE_ORDER_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet replace runtime is not installed." },
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
    const { stdout } = await execFileAsync(PYTHON_EXECUTABLE, [REPLACE_ORDER_SCRIPT], {
      env: {
        ...process.env,
        PORTAL_REPLACE_ORDER_PAYLOAD: JSON.stringify({
          coin: market.coin,
          direction: payload.side,
          orderId: payload.orderId,
          price: payload.price,
          replaceId: payload.replaceId,
          size: payload.size,
          symbol: payload.symbol,
        }),
      },
      maxBuffer: 1024 * 1024,
    });

    const parsedOutput = JSON.parse(stdout) as {
      error?: string;
      summary?: PendingOrderReplaceSummary;
      success: boolean;
    };

    if (!parsedOutput.success || !parsedOutput.summary) {
      return Response.json(
        { error: parsedOutput.error ?? "Hyperliquid testnet order replace failed." },
        { status: 502 },
      );
    }

    return Response.json(parsedOutput);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet replace bridge failed", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof (error as { stdout?: unknown }).stdout === "string"
    ) {
      try {
        const parsedError = JSON.parse((error as { stdout: string }).stdout) as {
          error?: string;
          summary?: PendingOrderReplaceSummary;
        };

        if (parsedError.error) {
          return Response.json(
            { error: parsedError.error, summary: parsedError.summary },
            { status: 502 },
          );
        }
      } catch {
        // Fall through.
      }
    }

    return Response.json(
      { error: "Hyperliquid testnet order replace failed." },
      { status: 502 },
    );
  }
}
