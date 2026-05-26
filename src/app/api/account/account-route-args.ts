import type { HyperliquidSymbol } from "@/types/market";

export function buildAccountScriptArgs({
  aggregateTrades,
  scriptPath,
  symbol,
}: {
  aggregateTrades: boolean;
  scriptPath: string;
  symbol: HyperliquidSymbol | string | null;
}) {
  const args = symbol ? [scriptPath, symbol] : [scriptPath];

  if (aggregateTrades) {
    args.push("--aggregate-trades");
  }

  return args;
}
