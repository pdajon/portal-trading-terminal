# Native Session Summary Phase 4D

## Scope

Phase 4D adds a narrow native session summary layer for future Operator Diagnosis context.

This phase does not redesign UI, does not promote imported evidence into primary Operator Diagnosis, does not allow imported evidence to trigger Discipline enforcement, does not create imported-only realtime blocking warnings, and does not rewrite imported trade or session reconstruction.

## Files Changed

- `src/features/diagnosis/lib/native-session-summary.ts`
- `src/features/diagnosis/lib/native-session-summary.test.ts`
- `src/features/diagnosis/lib/evidence-comparison.test.ts`
- `src/components/layout/app-shell.tsx`
- `docs/implementation/NATIVE_SESSION_SUMMARY_PHASE_4D.md`

## Native Sources Used

The V1 summary layer reads Portal-native sources only:

- native Journal entries
- native Journal memory events
- native session-log events for Discipline activity
- existing Operator Diagnosis findings when their evidence can be treated as native

Imported Historical Baseline evidence, external directional context, and debug-only evidence are filtered out before a native summary can be created.

## Supported Native Topics

V1 supports summaries for:

- `post_loss_behavior`
- `manual_planned_execution`
- `ai_warning_behavior`
- `discipline_violations`
- `time_window_findings`
- `high_density_sessions`

If a topic has no native evidence, the summary returns:

- `hasNativeEvidence: false`
- `trustLevel: insufficient_evidence`
- `confidence: insufficient_evidence`
- empty evidence/source arrays
- limitations explaining that native evidence is missing

## Summary Shape

`NativeSessionSummary` now includes guard-aligned metadata:

```ts
type NativeSessionSummary = {
  topic: NativeSessionSummaryTopic;
  hasNativeEvidence: boolean;
  trustLevel: EvidenceTrustLevel;
  confidence: DiagnosisEvidenceConfidence;
  sampleSize: number;
  netPnl: number | null;
  winRate: number | null;
  summary: string;
  evidenceIds: string[];
  limitations: string[];
  sourceTypes: EvidenceSourceType[];
  relatedTradeIds: string[];
  relatedSessionIds: string[];
  sourceWarnings: DiagnosisEvidenceSourceWarning[];
  allowedUses: DiagnosisEvidenceAllowedUse[];
  prohibitedUses: DiagnosisEvidenceProhibitedUse[];
};
```

Native summaries are allowed as supporting diagnosis context, AI Coach context, and investigation prompts. They explicitly prohibit Discipline enforcement and automatic trade blocking in this phase.

## What Counts As Native Evidence

A Journal entry is treated as native only when:

- it is not marked `dataSource: imported`
- it is not marked `sourceType: imported`
- any attached `diagnosisEvidence` is native, not imported, not debug-only, and eligible as primary native diagnosis evidence

Memory/session events are used only from native Portal sources such as execution, Journal, AI Coach, Discipline, Override Bond, trigger, and Magic Trade. Debug/system evidence does not create a native summary.

## Imported Evidence Cannot Upgrade Native Confidence

Imported evidence is blocked at two points:

- imported Journal-shaped entries are excluded before raw native summaries are built
- Operator Diagnosis findings are rejected when their referenced Journal entries or evidence events resolve only to imported/debug evidence

Sample size from imported history is never merged into native sample size and cannot raise native confidence.

## Comparison Integration

`app-shell.tsx` now passes native Journal entries, Journal memory events, and native session-log events into `buildNativeSessionSummariesFromOperatorDiagnosis()` before mapping summaries to evidence comparison inputs.

Comparison behavior remains unchanged:

- native summary plus imported agreement: `aligned`
- native summary plus imported disagreement: `conflict`
- imported only: `imported_only`
- native only: `native_only`

Native and imported samples remain separate IDs in comparison results.

## Intentionally Deferred

- No full native session intelligence engine.
- No primary Operator Diagnosis promotion from imported evidence.
- No Discipline Plan activation from native summaries.
- No realtime blocking warning from summaries.
- No imported trade/session reconstruction changes.
- No new comparison page or UI redesign.

## Next Recommended Phase

Phase 4E should define a diagnosis-grade native session engine contract: durable native session IDs, session boundary rules for Portal-native trades, confidence thresholds, and the exact gate for when a native session summary can become a primary Operator Diagnosis input.
