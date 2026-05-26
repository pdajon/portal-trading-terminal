import { isIndexTriggerMarketSymbol } from "@/lib/markets/portal-market-registry";
import type { MagicTradeSupportedTimeframe, TagAlongRule, TagAlongSymbol } from "./tag-along-rules";
import {
  isMagicTradeSupportedTimeframe,
  MAGIC_TRADE_SUPPORTED_TIMEFRAMES,
  sourceConditionRequiresTimeframe,
} from "./tag-along-rules";

export { isMagicTradeSupportedTimeframe, MAGIC_TRADE_SUPPORTED_TIMEFRAMES };
export type { MagicTradeSupportedTimeframe };

export type MagicTradeCandleStream = {
  sourceSymbol: TagAlongSymbol;
  timeframe: MagicTradeSupportedTimeframe;
};

export type MagicTradeDataSubscriptions = {
  candleStreams: MagicTradeCandleStream[];
  indexCandleStreams: MagicTradeCandleStream[];
  indexPriceSymbols: TagAlongSymbol[];
  priceSymbols: TagAlongSymbol[];
  unsupportedRuleIds: string[];
};

export function getMagicTradeDataSubscriptions(rules: TagAlongRule[]): MagicTradeDataSubscriptions {
  const priceSymbols = new Set<TagAlongSymbol>();
  const indexPriceSymbols = new Set<TagAlongSymbol>();
  const candleStreamKeys = new Set<string>();
  const indexCandleStreamKeys = new Set<string>();
  const candleStreams: MagicTradeCandleStream[] = [];
  const indexCandleStreams: MagicTradeCandleStream[] = [];
  const unsupportedRuleIds: string[] = [];

  rules.forEach((rule) => {
    if (rule.status !== "armed") {
      return;
    }

    if (sourceConditionRequiresTimeframe(rule.source.type)) {
      const timeframe = rule.source.timeframe ?? "1m";

      if (!isMagicTradeSupportedTimeframe(timeframe)) {
        unsupportedRuleIds.push(rule.id);
        return;
      }

      const streamKey = `${rule.source.sourceSymbol}:${timeframe}`;
      const isIndexSource = isIndexTriggerMarketSymbol(rule.source.sourceSymbol);

      if (isIndexSource) {
        if (!indexCandleStreamKeys.has(streamKey)) {
          indexCandleStreamKeys.add(streamKey);
          indexCandleStreams.push({
            sourceSymbol: rule.source.sourceSymbol,
            timeframe,
          });
        }

        return;
      }

      if (!candleStreamKeys.has(streamKey)) {
        candleStreamKeys.add(streamKey);
        candleStreams.push({
          sourceSymbol: rule.source.sourceSymbol,
          timeframe,
        });
      }

      return;
    }

    if (isIndexTriggerMarketSymbol(rule.source.sourceSymbol)) {
      indexPriceSymbols.add(rule.source.sourceSymbol);
      return;
    }

    priceSymbols.add(rule.source.sourceSymbol);
  });

  return {
    candleStreams,
    indexCandleStreams,
    indexPriceSymbols: [...indexPriceSymbols],
    priceSymbols: [...priceSymbols],
    unsupportedRuleIds,
  };
}

export function getHyperliquidCoinFromMagicTradeSymbol(symbol: TagAlongSymbol) {
  return symbol.replace(/-USD$/i, "");
}

export function getMagicTradeSymbolFromHyperliquidCoin(coin: string): TagAlongSymbol {
  return `${coin.toUpperCase()}-USD` as TagAlongSymbol;
}
