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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const REVERSE_POSITION_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_reverse_position.py",
);

type ReversePositionRequestPayload = {
  stopLoss?: number;
  stopPrice?: number;
  takeProfit?: number;
  targetPrice?: number;
  symbol: HyperliquidSymbol;
};

export async function POST(request: Request) {
  let payload: ReversePositionRequestPayload;

  try {
    payload = (await request.json()) as ReversePositionRequestPayload;
  } catch {
    return Response.json({ error: "Invalid reverse-position payload." }, { status: 400 });
  }

  const executionGuardError = getExecutionGuardError(payload.symbol);

  if (executionGuardError) {
    return Response.json({ error: executionGuardError }, { status: 400 });
  }

  const market = await resolveHyperliquidMarketFromMetadata(payload.symbol);

  if (!market) {
    return Response.json({ error: "Invalid reverse-position symbol." }, { status: 400 });
  }

  const disciplineDecision = await evaluateServerDisciplineRiskGate({
    actionType: "reverse_position",
    protectionContext: {
      stopLoss: payload.stopLoss,
      stopPrice: payload.stopPrice,
      takeProfit: payload.takeProfit,
      targetPrice: payload.targetPrice,
    },
    requestedTrades: 1,
    source: "manual",
    symbol: payload.symbol,
  });

  if (disciplineDecision.decision === "blocked") {
    return buildDisciplineBlockedResponse(disciplineDecision);
  }

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(REVERSE_POSITION_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet reverse-position runtime is not installed." },
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
    const { stdout } = await execFileAsync(PYTHON_EXECUTABLE, [REVERSE_POSITION_SCRIPT], {
      env: {
        ...process.env,
        PORTAL_REVERSE_POSITION_PAYLOAD: JSON.stringify({
          coin: market.coin,
          symbol: payload.symbol,
        }),
      },
      maxBuffer: 1024 * 1024,
    });

    const parsedOutput = JSON.parse(stdout) as { error?: string };

    if (!parsedOutput.error) {
      await recordServerDisciplineTradesPlaced(1);
    }

    return Response.json(parsedOutput);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet reverse-position bridge failed", error);

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
      { error: "Unable to reverse Hyperliquid testnet position." },
      { status: 502 },
    );
  }
}
