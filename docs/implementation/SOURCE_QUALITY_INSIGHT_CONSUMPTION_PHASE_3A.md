# Source Quality Insight Consumption Phase 3A

Date: 2026-05-23

## Files Changed

- `src/features/baseline-import/session-insight-consumption.ts`
- `src/features/baseline-import/session-intelligence.ts`
- `src/features/baseline-import/debug-output.ts`
- `src/features/baseline-import/index.ts`
- `src/features/ai-coach/lib/observational-coach.ts`
- `src/features/ai-coach/lib/ai-warning-aggregation.ts`
- `src/features/ai-coach/lib/evidence-source-mix.ts`
- `src/components/layout/app-shell.tsx`
- `src/features/ai-coach/lib/observational-coach.test.ts`
- `src/features/baseline-import/session-intelligence.test.ts`
- `src/features/baseline-import/baseline-import.test.ts`
- `src/components/layout/app-shell-review-workspace.test.ts`
- `scripts/write-session-intelligence-audit.ts`
- `.portal/audits/session-intelligence-latest.json`

## Where Session Intelligence Is Surfaced

Phase 3A keeps the existing UI shape and only adds compact consumption points:

- AI Coach Historical Performance and Behavior Signals cards now accept `sessionIntelligence` context.
- The AI Coach Context Sources card now shows session count and `Directional context` for saved Historical Baseline sources.
- The saved Historical Baseline modal now has a compact `Session Intelligence` section with timezone, total sessions, overnight sessions, weekend sessions, high-density sessions, post-loss clusters, revenge-risk sessions, confidence mix, readiness mix, worst session net PnL, and best session net PnL.
- Existing source-health/debug output now includes readiness and source-warning context for session intelligence.

## Confidence Language

Session-derived copy is intentionally cautious unless the session result is strong enough:

- `directional_only` sessions are labeled as `Directional baseline signal`, `Early session pattern`, `Imported context only`, and `Not diagnosis-grade yet`.
- Low-confidence sessions add `Weak signal`.
- Source warnings add `Order/fill completeness limits this read`.
- `insufficient_evidence` or `unsafe_not_enough_evidence` suppress strong insight language and show that complete session evidence is missing.

Phase 3A does not turn imported baseline sessions into hard behavioral diagnosis.

## Source Warning Propagation

The shared consumption helper summarizes source warnings from the saved scan and applies them to UI/debug language. Current warning-driven caution includes:

- order cap hit
- fill cap hit
- boundary fills excluded
- open or incomplete session evidence through the Phase 2 confidence model
- unresolved fee semantics through the Phase 2 confidence cap
- low or insufficient session confidence

Warnings do not mutate reconstructed trades or PnL. They only change labels, confidence copy, and debug metadata.

## Directional Only Boundary

Imported session intelligence remains Historical Baseline context:

- The UI labels it as `Historical Baseline`, `Imported context only`, `Directional context`, and `Not native Journal evidence`.
- AI Coach can read it as contextual baseline signal.
- Operator Diagnosis does not receive imported session records in Phase 3A.
- The existing imported-trade evidence path remains marked `dataSource: "imported"` and `sourceType: "imported"`; a Phase 3A guard comment documents that session intelligence is not mapped into native diagnosis evidence.

## Debug Output Upgrade

`.portal/audits/session-intelligence-latest.json` and the session debug builder now include:

- `sourceQualityWarnings`
- `anyReadyForDiagnosis`
- `directionalOnlySessionCount`
- `unsafeNotEnoughEvidenceSessionCount`
- `strongestDirectionalSessionSignals`
- `weakestSessionSignals`

These fields are local audit metadata only and do not include secrets or private keys.

## Intentionally Not Changed

- No UI redesign.
- No new full page.
- No Operator Diagnosis integration for imported sessions.
- No execution behavior changes.
- No trade reconstruction rewrite.
- No native Journal evidence conversion.
- No PnL attribution across overlapping tags.

## Remaining Risks

- Imported baseline trades can still be included in the existing Operator Diagnosis evidence mix when External Context is enabled; they remain labeled imported, but a later phase should review whether that toggle should be diagnosis-off by default.
- Hyperliquid fee semantics are still unresolved, so PnL claims remain capped by the Phase 2 confidence model.
- Source completeness depends on current scan warnings and order-match enrichment; capped or missing history can still weaken session reads.
- `ready_for_diagnosis` remains reserved for a later integration phase.

## Next Recommended Phase

Phase 3B should define the Operator Diagnosis boundary explicitly: whether imported baseline sessions stay AI Coach-only, become a separate external-context appendix, or are allowed into diagnosis under a stricter readiness gate. Native Journal/session evidence should remain the higher-confidence path.
