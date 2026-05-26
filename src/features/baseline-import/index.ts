import {
  fetchClearinghouseState,
  fetchHistoricalOrders,
  fetchUserPortfolio,
  fetchUserFillsByTime,
  fetchUserFunding,
  fetchUserNonFundingLedgerUpdates,
  runBaselineImportFetch,
  validateHyperliquidAccountAddress,
} from "@/features/baseline-import/hyperliquid-import-client";
import { buildBaselineProfile } from "@/features/baseline-import/build-baseline-profile";
import {
  normalizeHistoricalOrders,
  normalizeLedgerUpdates,
  normalizeUserFills,
  normalizeUserFunding,
} from "@/features/baseline-import/normalize-import";
import { reconstructImportedTrades } from "@/features/baseline-import/reconstruct-trades";
import { buildSessionIntelligence } from "@/features/baseline-import/session-intelligence";
import type {
  BaselineImportRequest,
  BaselineImportScanResult,
  ImportedFill,
  ImportedFundingRecord,
  ImportedLedgerUpdate,
  ImportedOrder,
  HyperliquidClearinghouseStateWire,
} from "@/features/baseline-import/types";

export * from "@/features/baseline-import/build-baseline-profile";
export * from "@/features/baseline-import/debug-output";
export * from "@/features/baseline-import/hyperliquid-import-client";
export * from "@/features/baseline-import/manual-history-import";
export * from "@/features/baseline-import/normalize-import";
export * from "@/features/baseline-import/reconstruct-trades";
export * from "@/features/baseline-import/session-insight-consumption";
export * from "@/features/baseline-import/session-intelligence";
export * from "@/features/baseline-import/storage";
export * from "@/features/baseline-import/types";

export function runHistoricalBaselineScanFromRecords(input: {
  accountSnapshot: HyperliquidClearinghouseStateWire | null;
  funding: ImportedFundingRecord[];
  ledgerUpdates: ImportedLedgerUpdate[];
  orders: ImportedOrder[];
  request: BaselineImportRequest;
  userFills: ImportedFill[];
}): BaselineImportScanResult {
  const reconstructed = reconstructImportedTrades({
    fills: input.userFills,
    funding: input.funding,
    orders: input.orders,
    request: input.request,
  });
  const profile = buildBaselineProfile({
    accountSnapshot: input.accountSnapshot,
    funding: input.funding,
    ledgerUpdates: input.ledgerUpdates,
    orders: input.orders,
    request: input.request,
    sessionWarnings: reconstructed.warnings,
    trades: reconstructed.trades,
    userFills: input.userFills,
  });
  const sourceHealth = {
    aggregatedFillCount: input.userFills.length,
    boundaryFillCount: reconstructed.boundaryFillCount,
    recommendationTradeCount: reconstructed.trades.length,
  };
  const sessionIntelligence = buildSessionIntelligence({
    request: input.request,
    sourceHealth,
    trades: reconstructed.trades,
    warnings: profile.dataQuality,
  });

  return {
    accountSnapshot: input.accountSnapshot,
    fills: input.userFills,
    funding: input.funding,
    ledgerUpdates: input.ledgerUpdates,
    orders: input.orders,
    profile,
    sessions: reconstructed.sessions,
    sessionIntelligence,
    sourceHealth,
    trades: reconstructed.trades,
    warnings: profile.dataQuality,
  };
}

export async function runHistoricalBaselineScan(request: BaselineImportRequest): Promise<BaselineImportScanResult> {
  if (!validateHyperliquidAccountAddress(request.accountAddress)) {
    throw new Error("Invalid Hyperliquid account address.");
  }

  const fetched = await runBaselineImportFetch(request);
  const fills = normalizeUserFills(fetched.userFills, request);
  const orders = normalizeHistoricalOrders(fetched.historicalOrders, request);
  const funding = normalizeUserFunding(fetched.userFunding, request);
  const ledgerUpdates = normalizeLedgerUpdates(fetched.ledgerUpdates, request);

  return runHistoricalBaselineScanFromRecords({
    accountSnapshot: fetched.accountSnapshot,
    funding,
    ledgerUpdates,
    orders,
    request,
    userFills: fills,
  });
}

export {
  buildBaselineProfile,
  fetchClearinghouseState,
  fetchHistoricalOrders,
  fetchUserPortfolio,
  fetchUserFillsByTime,
  fetchUserFunding,
  fetchUserNonFundingLedgerUpdates,
};
