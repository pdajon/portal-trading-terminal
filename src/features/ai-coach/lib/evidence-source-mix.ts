import type { StoredBaselineImportCollection } from "@/features/baseline-import";
import { createImportedBaselineEvidence } from "@/features/diagnosis/lib/diagnosis-evidence";
import type { OperatorDiagnosisJournalEntry } from "@/features/diagnosis/lib/operator-diagnosis";

export type AiEvidenceSourceId = "portal-recorded" | "external-context";

export type AiEvidenceSourceMix = {
  externalContext: boolean;
  portalRecorded: boolean;
};

export const AI_EVIDENCE_SOURCE_MIX_STORAGE_KEY = "portal.ai-evidence-source-mix";

export const DEFAULT_AI_EVIDENCE_SOURCE_MIX: AiEvidenceSourceMix = {
  externalContext: true,
  portalRecorded: true,
};

export function sanitizeAiEvidenceSourceMix(value: unknown): AiEvidenceSourceMix {
  if (!value || typeof value !== "object") {
    return DEFAULT_AI_EVIDENCE_SOURCE_MIX;
  }

  const candidate = value as Partial<AiEvidenceSourceMix>;
  const nextMix = {
    externalContext:
      typeof candidate.externalContext === "boolean"
        ? candidate.externalContext
        : DEFAULT_AI_EVIDENCE_SOURCE_MIX.externalContext,
    portalRecorded:
      typeof candidate.portalRecorded === "boolean"
        ? candidate.portalRecorded
        : DEFAULT_AI_EVIDENCE_SOURCE_MIX.portalRecorded,
  };

  if (!nextMix.externalContext && !nextMix.portalRecorded) {
    return DEFAULT_AI_EVIDENCE_SOURCE_MIX;
  }

  return nextMix;
}

export function parseAiEvidenceSourceMix(raw: string | null) {
  if (!raw) {
    return DEFAULT_AI_EVIDENCE_SOURCE_MIX;
  }

  try {
    return sanitizeAiEvidenceSourceMix(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_AI_EVIDENCE_SOURCE_MIX;
  }
}

export function toggleAiEvidenceSource(
  currentMix: AiEvidenceSourceMix,
  sourceId: AiEvidenceSourceId,
): AiEvidenceSourceMix {
  const nextMix =
    sourceId === "portal-recorded"
      ? { ...currentMix, portalRecorded: !currentMix.portalRecorded }
      : { ...currentMix, externalContext: !currentMix.externalContext };

  if (!nextMix.externalContext && !nextMix.portalRecorded) {
    return currentMix;
  }

  return nextMix;
}

export function getAiEvidenceSourceSummary(mix: AiEvidenceSourceMix) {
  if (mix.portalRecorded && mix.externalContext) {
    return "Portal + External";
  }

  return mix.portalRecorded ? "Portal only" : "External only";
}

function formatImportedTradeSymbol(coin: string) {
  const normalizedCoin = coin.trim().toUpperCase();

  if (!normalizedCoin) {
    return "UNKNOWN-USD";
  }

  return normalizedCoin.includes("-") ? normalizedCoin : `${normalizedCoin}-USD`;
}

function formatImportedEntrySource(executionMode: string) {
  if (executionMode === "market") {
    return "Market";
  }

  if (executionMode === "limit") {
    return "Limit";
  }

  if (executionMode === "mixed") {
    return "Mixed";
  }

  return "Historical Import";
}

export function mapBaselineImportTradesForDiagnosis(
  bundles: StoredBaselineImportCollection,
): OperatorDiagnosisJournalEntry[] {
  return bundles.flatMap((bundle) =>
    bundle.result.trades.map((trade): OperatorDiagnosisJournalEntry => {
      const entryTimestamp = new Date(trade.entryTime).toISOString();
      const closeTimestamp =
        typeof trade.endTime === "number"
          ? new Date(trade.endTime).toISOString()
          : null;
      const diagnosisEvidence = createImportedBaselineEvidence({
        accountAddress: bundle.request.accountAddress,
        confidence: trade.reconstructionConfidence,
        confidenceReasons: [
          "Imported Historical Baseline trade; external directional context only.",
          "Not native Journal evidence.",
        ],
        environment: bundle.request.environment,
        id: `baseline-evidence:${bundle.id}:${trade.id}`,
        relatedTradeIds: [trade.id],
        sourceWarnings: bundle.result.warnings,
        timeRange: {
          endTime: trade.endTime ?? trade.entryTime,
          startTime: trade.entryTime,
        },
        timezone: bundle.request.timezone,
      });

      return {
        closedAt: closeTimestamp,
        // Phase 3A guard: imported baseline trades remain external context.
        // Session intelligence is not mapped into native Operator Diagnosis evidence.
        dataSource: "imported",
        diagnosisEvidence,
        entrySource: formatImportedEntrySource(trade.executionMode),
        exitPrice: trade.exitPrice,
        id: `baseline:${bundle.id}:${trade.id}`,
        openedAt: entryTimestamp,
        planFollowed: "unclear",
        realizedPnl: trade.netPnl,
        relatedSessionLogIds: [],
        replayMetadata: { frames: [] },
        setupQualityRating: null,
        sourceType: "imported",
        status: trade.status === "open" ? "open" : "closed",
        symbol: formatImportedTradeSymbol(trade.coin),
        timestamp: entryTimestamp,
        userFacingLabel: diagnosisEvidence.userFacingLabel,
      };
    }),
  );
}
