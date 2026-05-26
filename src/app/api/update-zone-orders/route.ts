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
import type {
  TradeDirection,
  ZoneDerivedOrderUpdateSummary,
} from "@/types/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const UPDATE_ZONE_ORDERS_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_update_zone_orders.py",
);

type UpdateZoneOrdersRequestPayload = {
  direction: TradeDirection;
  symbol: HyperliquidSymbol;
  orders: Array<{
    currentPrice: number;
    localOrderId: string;
    orderId: number;
    price: number;
    size: number;
  }>;
  stopLoss?: number;
  stopPrice?: number;
  takeProfit?: number;
  targetPrice?: number;
};

function validatePayload(payload: UpdateZoneOrdersRequestPayload) {
  if (!payload.symbol || typeof payload.symbol !== "string") {
    return "Invalid update symbol.";
  }

  if (payload.direction !== "long" && payload.direction !== "short") {
    return "Invalid update side.";
  }

  if (!Array.isArray(payload.orders) || payload.orders.length === 0) {
    return "Invalid update orders.";
  }

  for (const order of payload.orders) {
    if (!order.localOrderId || typeof order.localOrderId !== "string") {
      return "Invalid local order id.";
    }

    if (!Number.isFinite(order.currentPrice) || order.currentPrice <= 0) {
      return "Invalid current order price.";
    }

    if (!Number.isInteger(order.orderId) || order.orderId <= 0) {
      return "Invalid update order id.";
    }

    if (!Number.isFinite(order.price) || order.price <= 0) {
      return "Invalid update price.";
    }

    if (!Number.isFinite(order.size) || order.size <= 0) {
      return "Invalid update size.";
    }
  }

  return null;
}

export async function POST(request: Request) {
  let payload: UpdateZoneOrdersRequestPayload;

  try {
    payload = (await request.json()) as UpdateZoneOrdersRequestPayload;
  } catch {
    return Response.json({ error: "Invalid zone-update payload." }, { status: 400 });
  }

  const executionGuardError = getExecutionGuardError(payload.symbol);

  if (executionGuardError) {
    return Response.json({ error: executionGuardError }, { status: 400 });
  }

  const validationError = validatePayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const market = await resolveHyperliquidMarketFromMetadata(payload.symbol);

  if (!market) {
    return Response.json({ error: "Invalid update symbol." }, { status: 400 });
  }

  const disciplineState = await readServerDisciplineState();
  const existingOrders = payload.orders.flatMap((order) => {
    const existingOrder = findServerDisciplinePendingOrder(disciplineState, {
      id: order.localOrderId,
      orderId: order.orderId,
    });

    return existingOrder ? [existingOrder] : [];
  });
  const canClassifyUpdate = existingOrders.length === payload.orders.length;
  const disciplineDecision = evaluateServerDisciplineRiskGateWithState(disciplineState, {
    actionType: canClassifyUpdate ? "zone_order_update" : "unknown",
    existingOrders,
    nextOrders: canClassifyUpdate
      ? payload.orders.map((order) => ({
          id: order.localOrderId,
          orderId: order.orderId,
          side: payload.direction,
          size: order.size,
        }))
      : [],
    orderType: "limit",
    prices: payload.orders.map((order) => order.price),
    protectionContext: {
      stopLoss: payload.stopLoss,
      stopPrice: payload.stopPrice,
      takeProfit: payload.takeProfit,
      targetPrice: payload.targetPrice,
    },
    requestedTrades: payload.orders.length,
    side: payload.direction,
    size: payload.orders.reduce((totalSize, order) => totalSize + order.size, 0),
    source: "order_zone",
    symbol: payload.symbol,
  });

  if (disciplineDecision.decision === "blocked") {
    return buildDisciplineBlockedResponse(disciplineDecision);
  }

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(UPDATE_ZONE_ORDERS_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet zone-update runtime is not installed." },
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
    const { stdout } = await execFileAsync(PYTHON_EXECUTABLE, [UPDATE_ZONE_ORDERS_SCRIPT], {
      env: {
        ...process.env,
        PORTAL_UPDATE_ZONE_ORDERS_PAYLOAD: JSON.stringify({
          coin: market.coin,
          direction: payload.direction,
          orders: payload.orders,
          symbol: payload.symbol,
        }),
      },
      maxBuffer: 1024 * 1024,
    });

    const parsedOutput = JSON.parse(stdout) as {
      error?: string;
      summary?: ZoneDerivedOrderUpdateSummary;
      success: boolean;
    };

    if (!parsedOutput.success || !parsedOutput.summary) {
      return Response.json(
        { error: parsedOutput.error ?? "Hyperliquid testnet zone update failed." },
        { status: 502 },
      );
    }

    return Response.json(parsedOutput);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet zone update bridge failed", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof (error as { stdout?: unknown }).stdout === "string"
    ) {
      try {
        const parsedError = JSON.parse((error as { stdout: string }).stdout) as {
          error?: string;
          summary?: ZoneDerivedOrderUpdateSummary;
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
      { error: "Hyperliquid testnet zone update failed." },
      { status: 502 },
    );
  }
}
