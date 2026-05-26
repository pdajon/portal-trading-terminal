import type { Position } from "@/types/trade";

export const mockPositions: Position[] = [
  {
    id: "pos-btc-1",
    symbol: "BTC-USD",
    side: "long",
    size: "0.35 BTC",
    entryPrice: 98620,
    markPrice: 99210,
    pnl: 206.5,
  },
  {
    id: "pos-eth-1",
    symbol: "ETH-USD",
    side: "short",
    size: "4.20 ETH",
    entryPrice: 3442.5,
    markPrice: 3418.2,
    pnl: 102.06,
  },
];
