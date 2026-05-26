import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";
import { getExecutionGuardError } from "@/lib/markets/portal-market-registry";
import type { HyperliquidSymbol } from "@/types/market";
import type {
  ActivePosition,
  ProtectionRemovalSummary,
  ProtectionSummary,
  TradeDirection,
} from "@/types/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const PROTECTION_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_protection.py",
);
const CANCEL_PROTECTION_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_cancel_protection.py",
);

type ProtectionRequestPayload = {
  protectionId: string;
  activePosition: ActivePosition;
  stop: number;
  target: number;
};

type ProtectionRemovalRequestPayload = {
  cancelId: string;
  activePosition: ActivePosition;
};

function validateProtectionPayload(payload: ProtectionRequestPayload) {
  if (!payload.protectionId || typeof payload.protectionId !== "string") {
    return "Invalid protection id.";
  }

  if (!payload.activePosition || typeof payload.activePosition !== "object") {
    return "Missing active position.";
  }

  if (!payload.activePosition.symbol) {
    return "Invalid protection symbol.";
  }

  if (
    payload.activePosition.direction !== "long" &&
    payload.activePosition.direction !== "short"
  ) {
    return "Invalid protection direction.";
  }

  if (!Number.isFinite(payload.stop) || !Number.isFinite(payload.target)) {
    return "Invalid protection levels.";
  }

  return null;
}

function validateProtectionRemovalPayload(
  payload: ProtectionRemovalRequestPayload,
) {
  if (!payload.cancelId || typeof payload.cancelId !== "string") {
    return "Invalid protection cancel id.";
  }

  if (!payload.activePosition || typeof payload.activePosition !== "object") {
    return "Missing active position.";
  }

  if (!payload.activePosition.symbol) {
    return "Invalid protection symbol.";
  }

  if (
    payload.activePosition.direction !== "long" &&
    payload.activePosition.direction !== "short"
  ) {
    return "Invalid protection direction.";
  }

  return null;
}

export async function POST(request: Request) {
  let payload: ProtectionRequestPayload;

  try {
    payload = (await request.json()) as ProtectionRequestPayload;
  } catch {
    return Response.json({ error: "Invalid protection payload." }, { status: 400 });
  }

  const executionGuardError = getExecutionGuardError(
    payload.activePosition?.symbol,
  );

  if (executionGuardError) {
    return Response.json({ error: executionGuardError }, { status: 400 });
  }

  const validationError = validateProtectionPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const market = await resolveHyperliquidMarketFromMetadata(
    payload.activePosition.symbol,
  );

  if (!market) {
    return Response.json({ error: "Invalid protection symbol." }, { status: 400 });
  }

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(PROTECTION_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet protection runtime is not installed." },
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
    const { stdout } = await execFileAsync(PYTHON_EXECUTABLE, [PROTECTION_SCRIPT], {
      env: {
        ...process.env,
        PORTAL_PROTECTION_PAYLOAD: JSON.stringify({
          coin: market.coin,
          direction: payload.activePosition.direction,
          expectedEntry: payload.activePosition.entry,
          expectedSize: payload.activePosition.size,
          positionExecutionId: payload.activePosition.executionId,
          protectionId: payload.protectionId,
          stop: payload.stop,
          symbol: payload.activePosition.symbol,
          target: payload.target,
        }),
      },
      maxBuffer: 1024 * 1024,
    });

    const parsedOutput = JSON.parse(stdout) as {
      error?: string;
      summary?: ProtectionSummary;
      success: boolean;
    };

    if (!parsedOutput.success || !parsedOutput.summary) {
      return Response.json(
        { error: parsedOutput.error ?? "Hyperliquid testnet protection sync failed." },
        { status: 502 },
      );
    }

    return Response.json(parsedOutput);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet protection bridge failed", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof (error as { stdout?: unknown }).stdout === "string"
    ) {
      try {
        const parsedError = JSON.parse((error as { stdout: string }).stdout) as {
          error?: string;
          summary?: ProtectionSummary;
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
      { error: "Hyperliquid testnet protection sync failed." },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  let payload: ProtectionRemovalRequestPayload;

  try {
    payload = (await request.json()) as ProtectionRemovalRequestPayload;
  } catch {
    return Response.json(
      { error: "Invalid protection cancel payload." },
      { status: 400 },
    );
  }

  const executionGuardError = getExecutionGuardError(
    payload.activePosition?.symbol,
  );

  if (executionGuardError) {
    return Response.json({ error: executionGuardError }, { status: 400 });
  }

  const validationError = validateProtectionRemovalPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const market = await resolveHyperliquidMarketFromMetadata(
    payload.activePosition.symbol,
  );

  if (!market) {
    return Response.json({ error: "Invalid protection symbol." }, { status: 400 });
  }

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(CANCEL_PROTECTION_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet protection cancel runtime is not installed." },
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
    const { stdout } = await execFileAsync(
      PYTHON_EXECUTABLE,
      [CANCEL_PROTECTION_SCRIPT],
      {
        env: {
          ...process.env,
          PORTAL_CANCEL_PROTECTION_PAYLOAD: JSON.stringify({
            cancelId: payload.cancelId,
            coin: market.coin,
            symbol: payload.activePosition.symbol,
          }),
        },
        maxBuffer: 1024 * 1024,
      },
    );

    const parsedOutput = JSON.parse(stdout) as {
      error?: string;
      summary?: ProtectionRemovalSummary;
      success: boolean;
    };

    if (!parsedOutput.success || !parsedOutput.summary) {
      return Response.json(
        {
          error:
            parsedOutput.error ??
            "Hyperliquid testnet protection cancel failed.",
        },
        { status: 502 },
      );
    }

    return Response.json(parsedOutput);
  } catch (error) {
    console.error("[portal] Hyperliquid testnet protection cancel bridge failed", error);

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
        // Fall through to generic message handling below.
      }
    }

    return Response.json(
      { error: "Hyperliquid testnet protection cancel failed." },
      { status: 502 },
    );
  }
}
