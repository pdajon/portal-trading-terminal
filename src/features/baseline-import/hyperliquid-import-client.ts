import type {
  BaselineImportFetchResult,
  BaselineImportRequest,
  HyperliquidClearinghouseStateWire,
  HyperliquidHistoricalOrderWire,
  HyperliquidLedgerUpdateWire,
  HyperliquidPortfolioWire,
  HyperliquidUserFillWire,
  HyperliquidUserFundingWire,
} from "@/features/baseline-import/types";

const HYPERLIQUID_INFO_URL = {
  mainnet: "https://api.hyperliquid.xyz/info",
  testnet: "https://api.hyperliquid-testnet.xyz/info",
} as const;

function assertValidRequest(request: BaselineImportRequest) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(request.accountAddress)) {
    throw new Error("Invalid Hyperliquid account address.");
  }

  if (!Number.isFinite(request.startTime) || !Number.isFinite(request.endTime) || request.endTime <= request.startTime) {
    throw new Error("Invalid baseline import time range.");
  }
}

async function postInfo<T>(request: BaselineImportRequest, payload: Record<string, unknown>): Promise<T> {
  assertValidRequest(request);

  const response = await fetch(HYPERLIQUID_INFO_URL[request.environment], {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid info request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export function validateHyperliquidAccountAddress(accountAddress: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(accountAddress);
}

export async function fetchUserFillsByTime(request: BaselineImportRequest) {
  return await postInfo<HyperliquidUserFillWire[]>(request, {
    aggregateByTime: true,
    endTime: request.endTime,
    startTime: request.startTime,
    type: "userFillsByTime",
    user: request.accountAddress,
  });
}

export async function fetchHistoricalOrders(request: BaselineImportRequest) {
  return await postInfo<HyperliquidHistoricalOrderWire[]>(request, {
    type: "historicalOrders",
    user: request.accountAddress,
  });
}

export async function fetchUserFunding(request: BaselineImportRequest) {
  return await postInfo<HyperliquidUserFundingWire[]>(request, {
    endTime: request.endTime,
    startTime: request.startTime,
    type: "userFunding",
    user: request.accountAddress,
  });
}

export async function fetchUserNonFundingLedgerUpdates(request: BaselineImportRequest) {
  return await postInfo<HyperliquidLedgerUpdateWire[]>(request, {
    endTime: request.endTime,
    startTime: request.startTime,
    type: "userNonFundingLedgerUpdates",
    user: request.accountAddress,
  });
}

export async function fetchClearinghouseState(request: BaselineImportRequest) {
  return await postInfo<HyperliquidClearinghouseStateWire>(request, {
    type: "clearinghouseState",
    user: request.accountAddress,
  });
}

export async function fetchUserPortfolio(request: BaselineImportRequest) {
  return await postInfo<HyperliquidPortfolioWire>(request, {
    type: "portfolio",
    user: request.accountAddress,
  });
}

export async function runBaselineImportFetch(request: BaselineImportRequest): Promise<BaselineImportFetchResult> {
  const [userFills, historicalOrders, userFunding, ledgerUpdates, accountSnapshot] = await Promise.all([
    fetchUserFillsByTime(request),
    fetchHistoricalOrders(request).catch(() => []),
    fetchUserFunding(request).catch(() => []),
    fetchUserNonFundingLedgerUpdates(request).catch(() => []),
    fetchClearinghouseState(request).catch(() => null),
  ]);

  return {
    accountSnapshot,
    historicalOrders,
    ledgerUpdates,
    userFills,
    userFunding,
  };
}
