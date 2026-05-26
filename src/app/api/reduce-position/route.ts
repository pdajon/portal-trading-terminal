import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { parseBridgeStdoutJson } from "@/lib/api/bridge-route-timing";
import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";
import { getExecutionGuardError } from "@/lib/markets/portal-market-registry";
import type { HyperliquidSymbol } from "@/types/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const REDUCE_POSITION_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_reduce_position.py",
);

type ReducePositionRequestPayload = {
  percent: number;
  symbol: HyperliquidSymbol;
};

export async function POST(request: Request) {
  let payload: ReducePositionRequestPayload;

  try {
    payload = (await request.json()) as ReducePositionRequestPayload;
  } catch {
    return Response.json({ error: "Invalid reduce-position payload." }, { status: 400 });
  }

  const executionGuardError = getExecutionGuardError(payload.symbol);

  if (executionGuardError) {
    return Response.json({ error: executionGuardError }, { status: 400 });
  }

  const market = await resolveHyperliquidMarketFromMetadata(payload.symbol);

  if (!market) {
    return Response.json({ error: "Invalid reduce-position symbol." }, { status: 400 });
  }

  if (!Number.isFinite(payload.percent) || payload.percent <= 0 || payload.percent > 100) {
    return Response.json({ error: "Invalid reduce-position percent." }, { status: 400 });
  }

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(REDUCE_POSITION_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet reduce-position runtime is not installed." },
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
    const { stdout } = await execFileAsync(PYTHON_EXECUTABLE, [REDUCE_POSITION_SCRIPT], {
      env: {
        ...process.env,
        PORTAL_REDUCE_POSITION_PAYLOAD: JSON.stringify({
          coin: market.coin,
          percent: payload.percent,
          symbol: payload.symbol,
        }),
      },
      maxBuffer: 1024 * 1024,
    });

    return Response.json(JSON.parse(stdout) as unknown);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet reduce-position bridge failed", error);

    const parsedStdout = parseBridgeStdoutJson<{
      error?: string;
      remainingSize?: number;
      success?: boolean;
    }>(error);

    if (parsedStdout?.success === true) {
      return Response.json(parsedStdout);
    }

    if (parsedStdout?.error) {
      return Response.json({ error: parsedStdout.error }, { status: 502 });
    }

    return Response.json(
      { error: "Unable to reduce Hyperliquid testnet position." },
      { status: 502 },
    );
  }
}
