# Portal Operator Diagnosis Evidence Boundary

Date: 2026-05-23

Status: Phase 3B specification only. This document does not authorize UI redesign, execution changes, trade reconstruction changes, session reconstruction changes, or imported session integration into Operator Diagnosis.

## 1. Executive Summary

Operator Diagnosis is only trustworthy when Portal can explain where each claim came from, how complete that source is, and whether the evidence is native to Portal or imported from a historical scan.

Historical Baseline data is valuable. It can reveal directional performance, rough time/session patterns, source-quality gaps, and early investigation candidates. But imported data is reconstructed from exchange history with known limitations: order and fill caps, boundary exclusions, proxy-only entry style, incomplete protection context, unresolved fee semantics, and no native Journal intent. If imported baseline findings silently become native diagnosis evidence, Portal risks overclaiming behavior and losing user trust.

The boundary is therefore:

- Native Portal evidence can become diagnosis-grade when the relevant events are complete and labeled.
- Imported Historical Baseline evidence starts as directional context.
- Imported session intelligence can support investigation topics, but must not be the sole source of high-confidence Operator Diagnosis.
- Debug-only evidence can validate systems, but must not become user-facing diagnosis.
- Every future diagnosis finding must preserve source labels, trust level, confidence, and source warnings.

## 2. Evidence Source Types

### Native Journal Evidence

Portal-created Journal entries and recap data captured through Portal's native lifecycle. This includes closed trade records, setup tags, entry style, plan-followed fields, replay frames, and user-reviewed context.

Default trust: highest available behavioral evidence when closed, internally consistent, and tied to native lifecycle events.

### Native Execution Evidence

Portal-generated execution events such as opened positions, reductions, reversals, close-all actions, protection attachment, break-even actions, trigger execution, and order lifecycle records.

Default trust: high for what Portal executed or requested; medium for exchange outcome details until reconciled with live account state.

### Native Discipline Evidence

Portal discipline rules, blocks, confirmations, cooldowns, override bonds, market-entry confirmations, and plan activation records.

Default trust: high for rule events emitted by Portal; diagnosis-grade when linked to the relevant trade/session timeframe.

### Native AI Warning Evidence

AI Coach and diagnosis warning events generated from deterministic local helpers, including shown/dismissed warnings and contextual warning matches.

Default trust: medium to high for "warning was shown" or "warning was dismissed"; not automatically proof that the user intended a behavior.

### Imported Historical Baseline Evidence

Historical fills, orders, funding, ledger rows, reconstructed trades, baseline profile metrics, and session intelligence produced by the Historical Baseline scan.

Default trust: directional_context. It can become supporting context only after source quality and labels are preserved. It is not native Journal evidence.

### External Directional Context

Any imported or external source that helps frame a pattern but lacks native Portal intent, plan, warning, or discipline context. Historical Baseline is the current V1 example.

Default trust: directional_context or weak_signal depending on completeness.

### Debug-Only Evidence

Audit JSON, reconstruction counters, scan internals, raw source counters, local debug files, and developer-only completeness diagnostics.

Default trust: debug_only. It can explain why a claim is limited, but must not create user-facing diagnosis by itself.

## 3. Evidence Trust Levels

| Trust Level | Meaning | User-Facing Strength |
| --- | --- | --- |
| `diagnosis_grade` | Evidence is native, complete enough for the claim, and carries source labels and confidence reasons. | Can support Operator Diagnosis findings and recommended discipline review. |
| `directional_context` | Evidence is useful for pattern discovery but is imported, external, or missing native intent. | Can appear as contextual support or investigation prompt. |
| `weak_signal` | Evidence is thin, low-confidence, or source-quality-limited. | Should use cautious copy and avoid hard claims. |
| `debug_only` | Evidence exists for audit, validation, or developer troubleshooting. | Hidden from normal user-facing diagnosis. |
| `insufficient_evidence` | Evidence is missing, invalid, contradictory, or unsafe for the claim. | Suppress strong insight; show what is missing if helpful. |

## 4. What Imported Baseline Can Be Used For

Imported Historical Baseline can be used for:

- Directional historical performance, such as rough net PnL, win rate, asset mix, and directional split.
- Rough asset, time, and session patterns when source quality is visible.
- Imported session summaries, including overnight, weekend, high-density, post-loss, revenge-risk, and multi-asset counts.
- Early warning candidates for future native confirmation.
- Suggested areas to investigate in AI Coach.
- Comparison against future native Portal behavior.
- Source-quality diagnostics and scan completeness explanations.
- User education about where stronger native evidence is needed.

Allowed wording examples:

- "Directional baseline signal: imported overnight sessions were negative in this scan, but source quality limits diagnosis confidence."
- "Early session pattern: imported context shows post-loss clusters. Needs native confirmation."
- "Imported Historical Baseline suggests this is worth watching."

## 5. What Imported Baseline Must NOT Be Used For Yet

Imported Historical Baseline must not be used for:

- Hard behavioral diagnosis.
- Native Journal conclusions.
- Discipline rule enforcement.
- Automatic trade blocking.
- Hard revenge, chasing, fatigue, or impulse claims.
- High-confidence Operator Diagnosis without labels.
- User-facing "you always" or "you are" claims.
- Plan-followed conclusions.
- Protection behavior conclusions unless native protection context exists.
- Native AI warning ignored or followed conclusions.
- Any claim that implies Portal observed the user's intent when the evidence came only from imported exchange history.

Disallowed wording examples:

- "Your overnight trading is unprofitable."
- "You revenge trade after losses."
- "You are a chaser."
- "Activate this rule because your imported baseline proves the behavior."

## 6. Diagnosis Eligibility Matrix

| Evidence Type | Required Confidence | Required Source Quality | Allowed In Operator Diagnosis? | Required Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Native Journal closed trades | `medium` or higher for a narrow claim; `high` for strong repeated pattern | Closed trade, valid timestamp, native source, relevant fields present | Yes | `Native Journal evidence` | Strongest behavioral evidence when enough sample exists. |
| Native planned execution events | `medium` or higher | Portal execution event linked to plan/trigger and trade lifecycle | Yes | `Native execution evidence` | Can support planned vs manual findings. |
| Native Discipline violations | `medium` or higher | Portal-emitted rule block, override, confirmation, or cooldown event | Yes | `Native Discipline evidence` | Can support diagnosis when linked to trade/session timing. |
| Native AI warnings | `medium` or higher | Deterministic warning event with source, trigger, timestamp, and dismissal state | Yes, as supporting evidence | `Native AI warning evidence` | Warning shown/dismissed is evidence of warning exposure, not intent by itself. |
| Imported reconstructed trades | `medium` maximum unless source quality is independently strong | Complete fills/orders, no boundary/cap warnings, valid timezone, closed trades | Supporting context only in Phase 3B | `Imported Historical Baseline` and `Directional context` | Must not be converted into native Journal entries. |
| Imported session intelligence | `directional_only` unless future gate upgrades it | Persisted timezone, valid timestamps, source warnings visible, no unsafe completeness flags | Not yet; future supporting context only | `Imported session intelligence`, `Not diagnosis-grade yet` | Phase 3B does not wire sessions into Operator Diagnosis. |
| Imported overnight sessions | `low` to `medium`; never high without native confirmation | Valid timezone, complete session windows, no invalid timestamps | Future investigation/support only | `Imported overnight context` | Any hard overnight diagnosis needs native confirmation or stronger gate. |
| Imported post-loss clusters | `low` to `medium`; never high without native confirmation | Reliable close times, next entries, closed PnL, source warnings visible | Future investigation/support only | `Imported post-loss context` | Can suggest cooldown candidates, not enforce them. |
| Imported market/limit proxy | `weak_signal` to `directional_context` | Matched historical orders; explicit proxy label | Supporting context only | `Market/limit proxy` | Market does not equal chased; limit does not equal hunted. |
| Imported fee/net PnL | `weak_signal` to `directional_context` | Fee semantics reconciled or caveated; funding visible | Supporting context only | `Imported PnL context` | Unresolved fee semantics prevent hard profitability claims. |
| Debug scan data | `debug_only` | Local audit provenance and no secrets | No | `Debug-only evidence` | May explain source quality, not create findings. |

## 7. External Context Labeling Rules

Every imported or external-context item must carry visible or machine-preserved labels. The exact labels are:

- `Imported Historical Baseline`
- `Directional context`
- `Not native Journal evidence`
- `Not diagnosis-grade yet`
- `Source quality limits confidence`
- `Needs native confirmation`

Copy rules:

- Use "Directional baseline signal" for imported evidence that is useful but not diagnosis-grade.
- Use "Early session pattern" for session tags that need confirmation.
- Use "Imported context only" when the source is saved baseline data.
- Use "Weak signal" when confidence is low.
- Use "Insufficient evidence" when strong copy must be suppressed.
- Avoid "you always", "you are", "proves", "diagnosed", or "confirmed" for imported-only evidence.
- If source warnings exist, include "Source quality limits confidence" or "Order/fill completeness limits this read."
- If imported evidence conflicts with native evidence, say the sources conflict instead of merging them into one claim.

## 8. Safe Operator Diagnosis Integration Rules

Future imported evidence may influence Operator Diagnosis only under these rules:

- Imported data can suggest investigation topics.
- Imported data can appear as supporting context only.
- Imported data cannot be the sole basis for high-confidence diagnosis.
- Imported data must carry source label, trust level, confidence, confidence reasons, source warnings, timezone, and time range.
- Native evidence should always outrank imported evidence.
- If imported and native evidence conflict, show the conflict instead of merging silently.
- Imported evidence must be suppressible or toggleable.
- Imported evidence must not activate Discipline rules by itself.
- Imported evidence must not create automatic trade blocks.
- Imported evidence cannot upgrade confidence by sample size alone.
- A finding that uses imported evidence must state whether native confirmation exists.

Recommended future language:

- "Native Journal confirms this pattern; imported baseline shows similar context."
- "Imported baseline suggests this area is worth investigating, but native evidence is not strong enough yet."
- "Native and imported evidence disagree; Portal is holding this as a comparison, not a diagnosis."

## 9. Evidence Object Schema

Future shared evidence objects should preserve provenance before any diagnosis helper consumes them.

```ts
type EvidenceTrustLevel =
  | "diagnosis_grade"
  | "directional_context"
  | "weak_signal"
  | "debug_only"
  | "insufficient_evidence";

type EvidenceSourceType =
  | "native_journal"
  | "native_execution"
  | "native_discipline"
  | "native_ai_warning"
  | "imported_historical_baseline"
  | "external_directional_context"
  | "debug_only";

type DiagnosisEvidence = {
  id: string;
  sourceType: EvidenceSourceType;
  trustLevel: EvidenceTrustLevel;
  origin: "portal_native" | "historical_import" | "external" | "debug";
  label: string;
  accountAddress: string | null;
  environment: "mainnet" | "testnet" | null;
  timeRange: {
    startTime: number;
    endTime: number;
  } | null;
  timezone: string | null;
  relatedTradeIds: string[];
  relatedSessionIds: string[];
  confidence: "high" | "medium" | "low" | "insufficient_evidence";
  confidenceReasons: string[];
  sourceWarnings: Array<{
    code: string;
    detail: string;
    severity: "warning" | "info";
  }>;
  allowedUses: Array<
    | "operator_diagnosis_primary"
    | "operator_diagnosis_supporting"
    | "ai_coach_context"
    | "investigation_prompt"
    | "debug_audit"
  >;
  prohibitedUses: Array<
    | "native_journal_claim"
    | "discipline_enforcement"
    | "automatic_trade_blocking"
    | "high_confidence_diagnosis"
    | "hard_behavior_claim"
  >;
  userFacingLabel: string;
};
```

Minimum V1 validation rules:

- `sourceType` and `trustLevel` are required.
- Imported evidence must include `origin: "historical_import"` or `origin: "external"`.
- Imported evidence must include `userFacingLabel`.
- Debug-only evidence cannot include `operator_diagnosis_primary` in `allowedUses`.
- `diagnosis_grade` requires no `insufficient_evidence` confidence.
- `high_confidence_diagnosis` must be in `prohibitedUses` for imported evidence unless a future explicit gate removes it.

## 10. Required Code Guards Later

Future implementation should add guards for:

- Imported sessions cannot be passed as native Journal entries.
- Imported sessions require an explicit `externalContext` flag.
- Imported trades require source labels if included as diagnosis context.
- Findings must include evidence source labels.
- Confidence cannot be upgraded by sample size alone.
- Operator Diagnosis must separate native findings from imported context.
- Imported findings must be suppressible or toggleable.
- Debug-only evidence must never render as a user-facing diagnosis finding.
- Any finding with imported-only support must use cautious copy.
- Discipline activation must reject rules based only on imported evidence.
- Realtime warnings must not fire from imported-only diagnosis findings unless a later explicit rule allows contextual, non-blocking warnings.

## 11. Recommended Future UX Treatment

Future UX should treat evidence strength visually and verbally:

- Native findings: stronger diagnosis styling, clearer action affordances, and eligible review-plan behavior.
- Imported context: softer contextual cards, labels visible in the finding, no enforcement styling.
- Weak signals: investigation prompts, not conclusions.
- Conflicting evidence: comparison panel that shows native and imported evidence side by side.
- Debug-only evidence: hidden unless audit or developer mode is active.

The visual redesign belongs to a later phase. Phase 3B only defines the boundary.

## 12. Tests Needed Later

Future tests should verify:

- Imported baseline does not create a native diagnosis finding.
- Imported session requires an external context label.
- Native evidence outranks imported evidence.
- Conflicting native/imported evidence is not silently merged.
- Low-confidence imported evidence cannot produce a hard claim.
- Debug-only evidence never appears in user-facing diagnosis.
- Source labels render in every imported-context finding.
- Sample size alone cannot upgrade imported evidence to high confidence.
- Discipline activation rejects imported-only findings.
- Realtime warnings do not fire from imported-only findings unless explicitly allowed.
- External context can be toggled without mutating native Journal evidence.

## 13. Implementation Plan

### Phase 3C

- Implement shared evidence source schema/types.
- Add guards around imported evidence.
- Update diagnosis mapping to preserve labels.
- Add tests for trust levels, labels, prohibited uses, and source conflicts.
- Keep imported sessions out of native Operator Diagnosis findings.

### Phase 4

- Cautiously allow selected imported session signals into AI Coach and Operator Diagnosis as supporting context only.
- Require source labels and confidence reasons in every imported-context finding.
- Keep native evidence above imported evidence in ranking and copy strength.

### Phase 5

- Redesign Operator Intelligence visually around evidence provenance.
- Separate native diagnosis, imported context, weak signals, conflicts, and debug evidence into distinct visual treatments.
- Preserve chart-first Portal layout and avoid turning evidence into a cluttered dashboard.

## Major Open Questions

- Should External Context be off by default for Operator Diagnosis while remaining available in AI Coach?
- What exact source-quality threshold, if any, can promote imported evidence from weak signal to supporting context?
- Should imported baseline and native Portal sessions share a unified evidence schema immediately, or use adapters until native session capture is richer?
- How should conflicts be scored when native evidence is thin but imported history is large?
- Should Discipline Plan review ever show imported-only suggested rules, or should imported signals stay AI Coach-only until native confirmation exists?
