import type { HyperliquidClientConfig } from "@/lib/hyperliquid/types";

export function createHyperliquidClient(config: HyperliquidClientConfig) {
  return {
    environment: config.environment,
    isPlaceholder: true as const,
  };
}
