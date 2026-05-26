import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  buildBridgeRouteTimingHeaders,
  isBridgeTimeoutError,
  parseBridgeStdoutJson,
} from "@/lib/api/bridge-route-timing";
import type { LiveExchangePosition } from "@/types/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const LIVE_POSITIONS_CACHE_TTL_MS = 3_000;
const LIVE_POSITIONS_BRIDGE_TIMEOUT_MS = 8_000;
const LIVE_POSITIONS_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_live_positions.py",
);

type LivePositionsPayload = { positions: LiveExchangePosition[]; success: true };

let livePositionsCache:
  | {
      expiresAt: number;
      payload: LivePositionsPayload;
    }
  | null = null;
let livePositionsInFlight: Promise<LivePositionsPayload> | null = null;

export async function GET(request: Request) {
  const routeStartedAt = Date.now();
  const bypassCache = new URL(request.url).searchParams.get("fresh") === "1";
  let activeBridgeStartedAt: number | null = null;

  function timingHeaders(
    extraHeaders: Record<string, string> = {},
    bridgeStartedAt: number | null = null,
    timedOut = false,
  ) {
    const now = Date.now();

    return buildBridgeRouteTimingHeaders({
      bridgeDurationMs: bridgeStartedAt === null ? 0 : now - bridgeStartedAt,
      extraHeaders,
      routeDurationMs: now - routeStartedAt,
      timedOut,
    });
  }

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(LIVE_POSITIONS_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet live-position runtime is not installed." },
      { headers: timingHeaders(), status: 500 },
    );
  }

  if (
    !process.env.HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS &&
    !process.env.HYPERLIQUID_TESTNET_SECRET_KEY
  ) {
    return Response.json(
      { error: "Missing Hyperliquid testnet account config." },
      { headers: timingHeaders(), status: 500 },
    );
  }

  try {
    const now = Date.now();

    if (!bypassCache && livePositionsCache && livePositionsCache.expiresAt > now) {
      return Response.json(livePositionsCache.payload, {
        headers: timingHeaders({
          "X-Portal-Live-Positions-Cache": "hit",
        }),
      });
    }

    const bridgeStartedAt = Date.now();
    activeBridgeStartedAt = bridgeStartedAt;

    if (bypassCache || !livePositionsInFlight) {
      livePositionsInFlight = execFileAsync(PYTHON_EXECUTABLE, [LIVE_POSITIONS_SCRIPT], {
        env: process.env,
        maxBuffer: 1024 * 1024,
        timeout: LIVE_POSITIONS_BRIDGE_TIMEOUT_MS,
      }).then(({ stdout }) => JSON.parse(stdout) as LivePositionsPayload);
    }

    const payload = await livePositionsInFlight;
    livePositionsCache = {
      expiresAt: now + LIVE_POSITIONS_CACHE_TTL_MS,
      payload,
    };
    livePositionsInFlight = null;

    return Response.json(payload, {
      headers: timingHeaders({
        "X-Portal-Live-Positions-Cache": bypassCache ? "bypass" : "miss",
      }, bridgeStartedAt),
    });
  } catch (error) {
    livePositionsInFlight = null;
    const timedOut = isBridgeTimeoutError(error);
    const stdoutPayload = parseBridgeStdoutJson<LivePositionsPayload & { error?: string }>(error);

    if (stdoutPayload) {
      if (stdoutPayload.error) {
        return Response.json(
          { error: stdoutPayload.error },
          { headers: timingHeaders({}, activeBridgeStartedAt, timedOut), status: 502 },
        );
      }

      livePositionsCache = {
        expiresAt: Date.now() + LIVE_POSITIONS_CACHE_TTL_MS,
        payload: stdoutPayload,
      };

      return Response.json(stdoutPayload, {
        headers: timingHeaders({
          "X-Portal-Live-Positions-Cache": bypassCache ? "bypass" : "miss",
        }, activeBridgeStartedAt, timedOut),
      });
    }

    console.error("[portal] Hyperliquid testnet live-position bridge failed", error);

    return Response.json(
      { error: "Unable to fetch Hyperliquid testnet live positions." },
      { headers: timingHeaders({}, activeBridgeStartedAt, timedOut), status: 502 },
    );
  }
}
