import type { OrderHistoryItem } from "@/types/trade";

export const mockOrders: OrderHistoryItem[] = [
  {
    id: "ord-1001",
    symbol: "BTC-USD",
    side: "long",
    type: "limit",
    status: "filled",
    price: 98480,
    size: "0.20 BTC",
    placedAt: "2026-04-16 09:14 CT",
  },
  {
    id: "ord-1002",
    symbol: "SOL-USD",
    side: "short",
    type: "market",
    status: "canceled",
    price: 188.42,
    size: "125 SOL",
    placedAt: "2026-04-16 10:02 CT",
  },
];
