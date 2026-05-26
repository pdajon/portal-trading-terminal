import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  summarizeNativeSessionEngineDebugOutput,
  type NativeSessionEngineDebugOutput,
} from "./native-session-engine";
import type { NativeSessionV1 } from "./native-session-contract";
import type { EvidenceComparisonDebugOutput } from "./evidence-comparison";

export function writeNativeSessionEngineDebugOutput(input: {
  comparisonSummary?: EvidenceComparisonDebugOutput | null;
  outputPath?: string;
  rejectedDebugEvidenceCount?: number;
  rejectedImportedEvidenceCount?: number;
  sessions: NativeSessionV1[];
}): NativeSessionEngineDebugOutput {
  const outputPath = input.outputPath ?? ".portal/audits/native-session-engine-latest.json";
  const output = summarizeNativeSessionEngineDebugOutput(input);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

  return output;
}
