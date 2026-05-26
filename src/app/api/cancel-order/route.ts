import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";
import { getExecutionGuardError } from "@/lib/markets/portal-market-registry";
import type { HyperliquidSymbol } from "@/types/market";
import type { PendingOrderCancelSummary, TradeDirection } from "@/types/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const CANCEL_ORDER_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_cancel_order.py",
);

type CancelOrderRequestPayload = {
  cancelId: string;
  symbol: HyperliquidSymbol;
  side: TradeDirection;
  orderId: number;
};

function validateCancelOrderPayload(payload: CancelOrderRequestPayload) {
  if (!payload.cancelId || typeof payload.cancelId !== "string") {
    return "Invalid cancel id.";
  }

  if (!payload.symbol || typeof payload.symbol !== "string") {
    return "Invalid cancel symbol.";
  }

  if (payload.side !== "long" && payload.side !== "short") {
    return "Invalid cancel side.";
  }

  if (!Number.isInteger(payload.orderId) || payload.orderId <= 0) {
    return "Invalid cancel order id.";
  }

  return null;
}

export async function POST(request: Request) {
  let payload: CancelOrderRequestPayload;

  try {
    payload = (await request.json()) as CancelOrderRequestPayload;
  } catch {
    return Response.json({ error: "Invalid cancel-order payload." }, { status: 400 });
  }

  const executionGuardError = getExecutionGuardError(payload.symbol);

  if (executionGuardError) {
    return Response.json({ error: executionGuardError }, { status: 400 });
  }

  const validationError = validateCancelOrderPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const market = await resolveHyperliquidMarketFromMetadata(payload.symbol);

  if (!market) {
    return Response.json({ error: "Invalid cancel symbol." }, { status: 400 });
  }

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(CANCEL_ORDER_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet cancel runtime is not installed." },
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
    const { stdout } = await execFileAsync(PYTHON_EXECUTABLE, [CANCEL_ORDER_SCRIPT], {
      env: {
        ...process.env,
        PORTAL_CANCEL_ORDER_PAYLOAD: JSON.stringify({
          cancelId: payload.cancelId,
          coin: market.coin,
          direction: payload.side,
          orderId: payload.orderId,
          symbol: payload.symbol,
        }),
      },
      maxBuffer: 1024 * 1024,
    });

    const parsedOutput = JSON.parse(stdout) as {
      error?: string;
      summary?: PendingOrderCancelSummary;
      success: boolean;
    };

    if (!parsedOutput.success || !parsedOutput.summary) {
      return Response.json(
        { error: parsedOutput.error ?? "Hyperliquid testnet order cancel failed." },
        { status: 502 },
      );
    }

    return Response.json(parsedOutput);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet cancel bridge failed", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof (error as { stdout?: unknown }).stdout === "string"
    ) {
      try {
        const parsedError = JSON.parse((error as { stdout: string }).stdout) as {
          error?: string;
          summary?: PendingOrderCancelSummary;
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
      { error: "Hyperliquid testnet order cancel failed." },
      { status: 502 },
    );
  }
}
