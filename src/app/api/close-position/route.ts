import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";
import { getExecutionGuardError } from "@/lib/markets/portal-market-registry";
import type { HyperliquidSymbol } from "@/types/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const CLOSE_POSITION_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_close_position.py",
);

type ClosePositionRequestPayload = {
  symbol: HyperliquidSymbol;
};

export async function POST(request: Request) {
  let payload: ClosePositionRequestPayload;

  try {
    payload = (await request.json()) as ClosePositionRequestPayload;
  } catch {
    return Response.json({ error: "Invalid close-position payload." }, { status: 400 });
  }

  const executionGuardError = getExecutionGuardError(payload.symbol);

  if (executionGuardError) {
    return Response.json({ error: executionGuardError }, { status: 400 });
  }

  const market = await resolveHyperliquidMarketFromMetadata(payload.symbol);

  if (!market) {
    return Response.json({ error: "Invalid close-position symbol." }, { status: 400 });
  }

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(CLOSE_POSITION_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet close-position runtime is not installed." },
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
    const { stdout } = await execFileAsync(PYTHON_EXECUTABLE, [CLOSE_POSITION_SCRIPT], {
      env: {
        ...process.env,
        PORTAL_CLOSE_POSITION_PAYLOAD: JSON.stringify({
          coin: market.coin,
          symbol: payload.symbol,
        }),
      },
      maxBuffer: 1024 * 1024,
    });

    return Response.json(JSON.parse(stdout) as unknown);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet close-position bridge failed", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof (error as { stdout?: unknown }).stdout === "string"
    ) {
      try {
        const parsedError = JSON.parse((error as { stdout: string }).stdout) as {
          error?: string;
        };

        if (parsedError.error) {
          return Response.json({ error: parsedError.error }, { status: 502 });
        }
      } catch {
        // Fall through.
      }
    }

    return Response.json(
      { error: "Unable to close Hyperliquid testnet position." },
      { status: 502 },
    );
  }
}
