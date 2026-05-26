import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  buildBridgeRouteTimingHeaders,
  isBridgeTimeoutError,
  parseBridgeStdoutJson,
} from "@/lib/api/bridge-route-timing";
import type { LivePendingOrder } from "@/types/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const PENDING_ORDERS_CACHE_TTL_MS = 3_000;
const PENDING_ORDERS_BRIDGE_TIMEOUT_MS = 8_000;
const PENDING_ORDERS_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_pending_orders.py",
);

type PendingOrdersPayload = { pendingOrders: LivePendingOrder[]; success: true };

let pendingOrdersCache:
  | {
      expiresAt: number;
      payload: PendingOrdersPayload;
    }
  | null = null;
let pendingOrdersInFlight: Promise<PendingOrdersPayload> | null = null;

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

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(PENDING_ORDERS_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet pending-order runtime is not installed." },
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

    if (!bypassCache && pendingOrdersCache && pendingOrdersCache.expiresAt > now) {
      return Response.json(pendingOrdersCache.payload, {
        headers: timingHeaders({
          "X-Portal-Pending-Orders-Cache": "hit",
        }),
      });
    }

    const bridgeStartedAt = Date.now();
    activeBridgeStartedAt = bridgeStartedAt;

    if (bypassCache || !pendingOrdersInFlight) {
      pendingOrdersInFlight = execFileAsync(PYTHON_EXECUTABLE, [PENDING_ORDERS_SCRIPT], {
        env: process.env,
        maxBuffer: 1024 * 1024,
        timeout: PENDING_ORDERS_BRIDGE_TIMEOUT_MS,
      }).then(({ stdout }) => JSON.parse(stdout) as PendingOrdersPayload);
    }

    const payload = await pendingOrdersInFlight;
    pendingOrdersCache = {
      expiresAt: now + PENDING_ORDERS_CACHE_TTL_MS,
      payload,
    };
    pendingOrdersInFlight = null;

    return Response.json(payload, {
      headers: timingHeaders({
        "X-Portal-Pending-Orders-Cache": bypassCache ? "bypass" : "miss",
      }, bridgeStartedAt),
    });
  } catch (error) {
    pendingOrdersInFlight = null;
    const timedOut = isBridgeTimeoutError(error);
    const stdoutPayload = parseBridgeStdoutJson<PendingOrdersPayload & { error?: string }>(error);

    if (stdoutPayload) {
      if (stdoutPayload.error) {
        return Response.json(
          { error: stdoutPayload.error },
          { headers: timingHeaders({}, activeBridgeStartedAt, timedOut), status: 502 },
        );
      }

      pendingOrdersCache = {
        expiresAt: Date.now() + PENDING_ORDERS_CACHE_TTL_MS,
        payload: stdoutPayload,
      };

      return Response.json(stdoutPayload, {
        headers: timingHeaders({
          "X-Portal-Pending-Orders-Cache": bypassCache ? "bypass" : "miss",
        }, activeBridgeStartedAt, timedOut),
      });
    }

    console.error("[portal] Hyperliquid testnet pending-order bridge failed", error);

    return Response.json(
      { error: "Unable to fetch Hyperliquid testnet pending orders." },
      { headers: timingHeaders({}, activeBridgeStartedAt, timedOut), status: 502 },
    );
  }
}
