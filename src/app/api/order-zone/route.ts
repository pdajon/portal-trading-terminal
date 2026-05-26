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
import type { OrderZonePlacementSummary, OrderZoneDistribution, TradeDirection } from "@/types/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const ORDER_ZONE_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_order_zone.py",
);

type OrderZoneRequestPayload = {
  direction: TradeDirection;
  distribution: OrderZoneDistribution;
  orders: Array<{
    placementId: string;
    price: number;
    size: number;
  }>;
  stopLoss?: number;
  stopPrice?: number;
  takeProfit?: number;
  targetPrice?: number;
  symbol: HyperliquidSymbol;
};

function validatePayload(payload: OrderZoneRequestPayload) {
  if (!payload.symbol || typeof payload.symbol !== "string") {
    return "Invalid execution symbol.";
  }

  if (payload.direction !== "long" && payload.direction !== "short") {
    return "Invalid execution side.";
  }

  if (
    payload.distribution !== "even" &&
    payload.distribution !== "top-heavy" &&
    payload.distribution !== "bottom-heavy"
  ) {
    return "Invalid order-zone distribution.";
  }

  if (!Array.isArray(payload.orders) || payload.orders.length < 2 || payload.orders.length > 10) {
    return "Invalid order-zone order count.";
  }

  for (const order of payload.orders) {
    if (!order.placementId || typeof order.placementId !== "string") {
      return "Invalid order-zone placement id.";
    }

    if (!Number.isFinite(order.price) || order.price <= 0) {
      return "Invalid order-zone price.";
    }

    if (!Number.isFinite(order.size) || order.size <= 0) {
      return "Invalid order-zone size.";
    }
  }

  return null;
}

export async function POST(request: Request) {
  let payload: OrderZoneRequestPayload;

  try {
    payload = (await request.json()) as OrderZoneRequestPayload;
  } catch {
    return Response.json({ error: "Invalid order-zone payload." }, { status: 400 });
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
    return Response.json({ error: "Invalid execution symbol." }, { status: 400 });
  }

  const disciplineDecision = await evaluateServerDisciplineRiskGate({
    actionType: "order_zone_create",
    nextOrders: payload.orders.map((order) => ({
      id: order.placementId,
      side: payload.direction,
      size: order.size,
    })),
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

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(ORDER_ZONE_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet order-zone runtime is not installed." },
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
    const { stdout } = await execFileAsync(PYTHON_EXECUTABLE, [ORDER_ZONE_SCRIPT], {
      env: {
        ...process.env,
        PORTAL_ORDER_ZONE_PAYLOAD: JSON.stringify({
          coin: market.coin,
          direction: payload.direction,
          distribution: payload.distribution,
          orders: payload.orders,
          symbol: payload.symbol,
        }),
      },
      maxBuffer: 1024 * 1024,
    });

    const parsedOutput = JSON.parse(stdout) as {
      error?: string;
      summary?: OrderZonePlacementSummary;
      success: boolean;
    };

    if (!parsedOutput.success || !parsedOutput.summary) {
      return Response.json(
        { error: parsedOutput.error ?? "Hyperliquid testnet order-zone placement failed." },
        { status: 502 },
      );
    }

    await recordServerDisciplineTradesPlaced(
      parsedOutput.summary.liveOrders.length + parsedOutput.summary.filledOrders.length,
    );

    return Response.json(parsedOutput);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet order-zone bridge failed", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof (error as { stdout?: unknown }).stdout === "string"
    ) {
      try {
        const parsedError = JSON.parse((error as { stdout: string }).stdout) as {
          error?: string;
          summary?: OrderZonePlacementSummary;
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
      { error: "Hyperliquid testnet order-zone placement failed." },
      { status: 502 },
    );
  }
}
