import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";
import { getExecutionGuardError } from "@/lib/markets/portal-market-registry";
import type { HyperliquidSymbol } from "@/types/market";
import type {
  TradeDirection,
  ZoneDerivedOrderCancelSummary,
} from "@/types/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const CANCEL_ZONE_ORDERS_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_cancel_zone_orders.py",
);

type CancelZoneOrdersRequestPayload = {
  direction: TradeDirection;
  symbol: HyperliquidSymbol;
  orders: Array<{
    currentPrice: number;
    localOrderId: string;
    orderId: number;
    size: number;
  }>;
};

function validatePayload(payload: CancelZoneOrdersRequestPayload) {
  if (!payload.symbol || typeof payload.symbol !== "string") {
    return "Invalid cancel symbol.";
  }

  if (payload.direction !== "long" && payload.direction !== "short") {
    return "Invalid cancel side.";
  }

  if (!Array.isArray(payload.orders) || payload.orders.length === 0) {
    return "Invalid cancel orders.";
  }

  for (const order of payload.orders) {
    if (!order.localOrderId || typeof order.localOrderId !== "string") {
      return "Invalid local order id.";
    }

    if (!Number.isFinite(order.currentPrice) || order.currentPrice <= 0) {
      return "Invalid current order price.";
    }

    if (!Number.isInteger(order.orderId) || order.orderId <= 0) {
      return "Invalid cancel order id.";
    }

    if (!Number.isFinite(order.size) || order.size <= 0) {
      return "Invalid cancel size.";
    }
  }

  return null;
}

export async function POST(request: Request) {
  let payload: CancelZoneOrdersRequestPayload;

  try {
    payload = (await request.json()) as CancelZoneOrdersRequestPayload;
  } catch {
    return Response.json({ error: "Invalid zone-cancel payload." }, { status: 400 });
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
    return Response.json({ error: "Invalid cancel symbol." }, { status: 400 });
  }

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(CANCEL_ZONE_ORDERS_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet zone-cancel runtime is not installed." },
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
    const { stdout } = await execFileAsync(PYTHON_EXECUTABLE, [CANCEL_ZONE_ORDERS_SCRIPT], {
      env: {
        ...process.env,
        PORTAL_CANCEL_ZONE_ORDERS_PAYLOAD: JSON.stringify({
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
      summary?: ZoneDerivedOrderCancelSummary;
      success: boolean;
    };

    if (!parsedOutput.success || !parsedOutput.summary) {
      return Response.json(
        { error: parsedOutput.error ?? "Hyperliquid testnet zone cancel failed." },
        { status: 502 },
      );
    }

    return Response.json(parsedOutput);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet zone cancel bridge failed", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof (error as { stdout?: unknown }).stdout === "string"
    ) {
      try {
        const parsedError = JSON.parse((error as { stdout: string }).stdout) as {
          error?: string;
          summary?: ZoneDerivedOrderCancelSummary;
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
      { error: "Hyperliquid testnet zone cancel failed." },
      { status: 502 },
    );
  }
}
