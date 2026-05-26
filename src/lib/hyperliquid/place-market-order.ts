import type { HyperliquidSymbol } from "@/types/market";
import type {
  ExecutionSummary,
  TradeDirection,
  TradeMarginMode,
} from "@/types/trade";

export type PlaceHyperliquidMarketOrderInput = {
  allocationPercent?: number | null;
  baseSize: number;
  confirmedDisciplineWarnings?: string[];
  conversionPrice?: number | null;
  executionId: string;
  intendedNotionalUsdc?: number | null;
  leverage?: number;
  marginMode?: TradeMarginMode;
  maxSlippagePercent?: number;
  metadata?: Record<string, unknown>;
  side: TradeDirection;
  symbol: HyperliquidSymbol;
};

export type PlaceHyperliquidMarketOrderResult =
  | {
      ok: true;
      summary: ExecutionSummary;
    }
  | {
      discipline?: unknown;
      disciplineLogEntry?: unknown;
      error: string;
      ok: false;
      status?: number;
      summary?: ExecutionSummary;
    };

export async function placeHyperliquidMarketOrder(
  input: PlaceHyperliquidMarketOrderInput,
): Promise<PlaceHyperliquidMarketOrderResult> {
  try {
    const response = await fetch("/api/execute", {
      body: JSON.stringify({
        executionId: input.executionId,
        ...(input.confirmedDisciplineWarnings === undefined
          ? {}
          : { confirmedDisciplineWarnings: input.confirmedDisciplineWarnings }),
        allocationPercent: input.allocationPercent ?? undefined,
        baseSize: input.baseSize,
        conversionPrice: input.conversionPrice ?? undefined,
        intendedNotionalUsdc: input.intendedNotionalUsdc ?? undefined,
        leverage: input.leverage,
        ...(input.marginMode === undefined
          ? {}
          : { marginMode: input.marginMode }),
        ...(input.maxSlippagePercent === undefined
          ? {}
          : { maxSlippagePercent: input.maxSlippagePercent }),
        side: input.side,
        symbol: input.symbol,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const payload = (await response.json()) as {
      discipline?: unknown;
      disciplineLogEntry?: unknown;
      error?: string;
      summary?: ExecutionSummary;
    };

    if (!response.ok || !payload.summary) {
      return {
        ...(payload.discipline === undefined ? {} : { discipline: payload.discipline }),
        ...(payload.disciplineLogEntry === undefined
          ? {}
          : { disciplineLogEntry: payload.disciplineLogEntry }),
        error: payload.error ?? "unable to place testnet market order",
        ok: false,
        status: response.status,
        summary: payload.summary,
      };
    }

    return {
      ok: true,
      summary: payload.summary,
    };
  } catch {
    return {
      error: "Execution failed — unable to reach Hyperliquid testnet bridge",
      ok: false,
    };
  }
}
