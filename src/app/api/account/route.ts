import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  buildBridgeRouteTimingHeaders,
  isBridgeTimeoutError,
  parseBridgeStdoutJson,
} from "@/lib/api/bridge-route-timing";
import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";
import type { HyperliquidSymbol } from "@/types/market";
import { buildAccountScriptArgs } from "./account-route-args";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PYTHON_EXECUTABLE = join(process.cwd(), ".venv-hl", "bin", "python");
const ACCOUNT_CACHE_TTL_MS = 3_000;
const ACCOUNT_STALE_CACHE_TTL_MS = 60_000;
const ACCOUNT_BRIDGE_TIMEOUT_MS = 8_000;
const ACCOUNT_SCRIPT = join(
  process.cwd(),
  "src",
  "lib",
  "hyperliquid",
  "testnet_account.py",
);

type AccountPayload = Record<string, unknown> & { success?: true };

let accountCache:
  | Map<
      string,
      {
        expiresAt: number;
        payload: AccountPayload;
        staleExpiresAt: number;
      }
    >
  | null = null;
let accountInFlight: Map<string, Promise<AccountPayload>> | null = null;

function getAccountCache() {
  accountCache ??= new Map();
  return accountCache;
}

function getAccountInFlight() {
  accountInFlight ??= new Map();
  return accountInFlight;
}

export async function GET(request: Request) {
  const routeStartedAt = Date.now();
  const searchParams = new URL(request.url).searchParams;
  const symbol = searchParams.get("symbol");
  const bypassCache = searchParams.get("fresh") === "1";
  const aggregateTrades =
    searchParams.get("aggregateTrades") === "1" ||
    searchParams.get("aggregateByTime") === "1";
  let activeBridgeStartedAt: number | null = null;
  const requestedMarket = symbol
    ? await resolveHyperliquidMarketFromMetadata(symbol)
    : null;

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

  if (symbol && !requestedMarket) {
    return Response.json(
      { error: "Invalid account symbol." },
      { headers: timingHeaders(), status: 400 },
    );
  }

  if (!existsSync(PYTHON_EXECUTABLE) || !existsSync(ACCOUNT_SCRIPT)) {
    return Response.json(
      { error: "Hyperliquid testnet account runtime is not installed." },
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

  const cacheKey = [
    requestedMarket?.symbol ?? "account",
    aggregateTrades ? "aggregate-trades" : "raw-trades",
  ].join(":");

  try {
    const now = Date.now();
    const cache = getAccountCache();
    const cached = cache.get(cacheKey);

    if (!bypassCache && cached && cached.expiresAt > now) {
      return Response.json(cached.payload, {
        headers: timingHeaders({
          "X-Portal-Account-Cache": "hit",
        }),
      });
    }

    const scriptArgs = buildAccountScriptArgs({
      aggregateTrades,
      scriptPath: ACCOUNT_SCRIPT,
      symbol: requestedMarket?.symbol ?? null,
    });
    const bridgeStartedAt = Date.now();
    activeBridgeStartedAt = bridgeStartedAt;
    const inFlight = getAccountInFlight();

    if (bypassCache || !inFlight.has(cacheKey)) {
      inFlight.set(
        cacheKey,
        execFileAsync(PYTHON_EXECUTABLE, scriptArgs, {
          env: process.env,
          maxBuffer: 1024 * 1024,
          timeout: ACCOUNT_BRIDGE_TIMEOUT_MS,
        }).then(({ stdout }) => JSON.parse(stdout) as AccountPayload),
      );
    }

    const payload = await inFlight.get(cacheKey);
    inFlight.delete(cacheKey);

    if (!payload) {
      throw new Error("Hyperliquid account bridge returned no payload.");
    }

    cache.set(cacheKey, {
      expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS,
      payload,
      staleExpiresAt: Date.now() + ACCOUNT_STALE_CACHE_TTL_MS,
    });

    return Response.json(payload, {
      headers: timingHeaders({
        "X-Portal-Account-Cache": bypassCache ? "bypass" : "miss",
      }, bridgeStartedAt),
    });
  } catch (error) {
    getAccountInFlight().delete(cacheKey);
    const timedOut = isBridgeTimeoutError(error);
    const stdoutPayload = parseBridgeStdoutJson<AccountPayload & { error?: string }>(error);

    if (stdoutPayload) {
      if (stdoutPayload.error) {
        return Response.json(
          { error: stdoutPayload.error },
          { headers: timingHeaders({}, activeBridgeStartedAt, timedOut), status: 502 },
        );
      }

      getAccountCache().set(cacheKey, {
        expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS,
        payload: stdoutPayload,
        staleExpiresAt: Date.now() + ACCOUNT_STALE_CACHE_TTL_MS,
      });

      return Response.json(stdoutPayload, {
        headers: timingHeaders({
          "X-Portal-Account-Cache": bypassCache ? "bypass" : "miss",
        }, activeBridgeStartedAt, timedOut),
      });
    }

    const cached = getAccountCache().get(cacheKey);
    if (!bypassCache && cached && cached.staleExpiresAt > Date.now()) {
      return Response.json(cached.payload, {
        headers: timingHeaders({
          "X-Portal-Account-Cache": "stale",
        }, activeBridgeStartedAt, timedOut),
      });
    }

    console.error("[portal] Hyperliquid testnet account bridge failed", error);

    return Response.json(
      { error: "Unable to fetch Hyperliquid testnet account state." },
      { headers: timingHeaders({}, activeBridgeStartedAt, timedOut), status: 502 },
    );
  }
}
