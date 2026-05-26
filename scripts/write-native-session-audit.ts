import { readFileSync } from "node:fs";
import {
  buildNativeSessions,
  type BuildNativeSessionsInput,
} from "../src/features/diagnosis/lib/native-session-engine";
import { writeNativeSessionEngineDebugOutput } from "../src/features/diagnosis/lib/native-session-engine-debug";
import type { NativeSessionV1 } from "../src/features/diagnosis/lib/native-session-contract";
import type { EvidenceComparisonDebugOutput } from "../src/features/diagnosis/lib/evidence-comparison";

type NativeSessionAuditInput = Partial<BuildNativeSessionsInput> & {
  comparisonSummary?: EvidenceComparisonDebugOutput | null;
  rejectedDebugEvidenceCount?: number;
  rejectedImportedEvidenceCount?: number;
  sessions?: NativeSessionV1[];
};

function readAuditInput(path: string | undefined): NativeSessionAuditInput {
  if (!path) {
    return {};
  }

  return JSON.parse(readFileSync(path, "utf8")) as NativeSessionAuditInput;
}

function buildInput(input: NativeSessionAuditInput): BuildNativeSessionsInput {
  return {
    accountAddress: input.accountAddress ?? null,
    aiWarningEvents: input.aiWarningEvents ?? [],
    diagnosisFindings: input.diagnosisFindings ?? [],
    disciplineEvents: input.disciplineEvents ?? [],
    environment: input.environment ?? "mainnet",
    executionEvents: input.executionEvents ?? [],
    journalEntries: input.journalEntries ?? [],
    timezone: input.timezone ?? "UTC",
    walletAddress: input.walletAddress ?? null,
  };
}

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? ".portal/audits/native-session-engine-latest.json";
const auditInput = readAuditInput(inputPath);
const sessions = auditInput.sessions ?? buildNativeSessions(buildInput(auditInput));

writeNativeSessionEngineDebugOutput({
  comparisonSummary: auditInput.comparisonSummary ?? null,
  outputPath,
  rejectedDebugEvidenceCount: auditInput.rejectedDebugEvidenceCount,
  rejectedImportedEvidenceCount: auditInput.rejectedImportedEvidenceCount,
  sessions,
});
