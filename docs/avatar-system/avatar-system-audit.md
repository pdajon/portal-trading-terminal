# Avatar / Soul / Inventory System Audit

Status: audit only. No Avatar UI, layout, state, API, or trading behavior was implemented.

## Current Architecture Summary

Portal's current footer intelligence system is implemented as a mode-based command deck. The main integration point is `src/components/layout/app-shell.tsx`, which owns the footer tabs, footer height, Portal Command input, Magic Trade / Armed Magic entry points, Discipline UI, Journal UI, AI Coach UI, Diagnosis UI, Session Logs UI, and Settings footer content.

The current footer modes are typed in `src/features/terminal/lib/footer-mode.ts`:

- `trade`
- `discipline`
- `journal`
- `ai-coach`
- `diagnosis`
- `session-logs`
- `settings`

Important implementation detail: `settings` is part of the `FooterTab` type but is not included in `FOOTER_TABS`; it is opened through the header gear button. The visible footer tab row currently includes Trade, Discipline, Journal, AI Coach, Diagnosis, and Session Logs.

The current Portal Command input lives inside the Trade footer content area, not the footer header. The same Trade-side command panel also contains the current Armed Magic trigger and drawer. This matches the target direction for the audit: the old Portal Command content area is the cleanest candidate for a future Avatar surface, while the command input itself needs a later controlled move into the footer header near the mode tabs.

Most of the domain logic already has useful helper seams:

- Discipline enforcement is split between client gating, server gating, server state, and sync adapters.
- AI Coach insight generation is mostly derived through pure helper modules.
- Operator Diagnosis is deterministic and local.
- Journal lifecycle and memory-event capture are in feature helpers.
- Session Logs have a dedicated event model and local persistence helper.
- Magic Trade / Armed Magic has a dedicated Tag-Along rule model and execution helpers.

The main architecture risk is that `app-shell.tsx` still mixes UI rendering, state hydration, localStorage persistence, server sync, footer mode switching, execution callbacks, and derived intelligence state in one very large component. The Avatar system should therefore start as a read-only presentation layer over existing state, not as a second source of truth.

## File Map

### Brand And Project Direction

- `AGENTS.md`
- `docs/brand/PORTAL_BRAND_BIBLE.md`
- `docs/brand/PORTAL_PROMPT_PACK.md`

Note: `docs/brand/visual/Portal_Visual_Brand_Bible.pdf` was not used for this audit because this pass did not implement UI, UX, layout, or styling. It should be reviewed before any Avatar visual work begins.

### Footer And Shell

- `src/components/layout/app-shell.tsx`
- `src/features/terminal/lib/footer-mode.ts`
- `src/features/terminal/lib/footer-mode.test.ts`

### Discipline And Override Bond

- `src/features/discipline/lib/discipline-sync-adapter.ts`
- `src/features/discipline/lib/discipline-risk-gate.ts`
- `src/features/discipline/lib/discipline-server-gate.ts`
- `src/features/discipline/lib/discipline-server-state.ts`
- `src/features/discipline/lib/override-bond-ledger.ts`
- `src/features/discipline/lib/discipline-protection.ts`
- `src/features/discipline/lib/discipline-time-window.ts`
- `src/features/discipline/lib/blocked-time-window-override.ts`
- `src/app/api/discipline/state/route.ts`
- `src/app/api/discipline/override-bond/route.ts`

### AI Coach And Diagnosis

- `src/features/ai-coach/lib/observational-coach.ts`
- `src/features/ai-coach/lib/ai-warning-aggregation.ts`
- `src/features/diagnosis/lib/operator-diagnosis.ts`
- `src/features/diagnosis/lib/diagnosis-realtime-warnings.ts`
- `src/features/diagnosis/lib/discipline-plan-activation.ts`

### Journal And Memory

- `src/features/journal/lib/journal-capture-adapter.ts`
- `src/features/journal/lib/journal-lifecycle.ts`
- `src/features/journal/lib/journal-memory-events.ts`
- `src/features/journal/lib/journal-memory-insights.ts`
- `src/features/journal/lib/journal-insights.ts`
- `src/features/journal/lib/trade-review.ts`
- `src/features/journal/components/journal-setup-preview.tsx`
- `src/features/journal/components/trade-recap-replay-viewer.tsx`

### Session Logs

- `src/features/session-log/lib/session-log.ts`

### Armed Magic / Magic Trade / Tag-Along

- `src/features/tag-along/lib/tag-along-rules.ts`
- `src/features/tag-along/lib/magic-trade-open-position-execution.ts`
- `src/features/tag-along/lib/magic-trade-live-open-position.ts`
- `src/features/tag-along/lib/magic-trade-market-options.ts`
- `src/features/tag-along/lib/magic-trade-data-engine.ts`
- `src/features/tag-along/lib/magic-trade-target-price.ts`
- `src/features/tag-along/lib/magic-trade-sentence.ts`
- `src/features/tag-along/lib/magic-trade-chart-overlays.ts`

### Execution And Exchange-Facing Routes

- `src/app/api/execute/route.ts`
- `src/app/api/limit-order/route.ts`
- `src/app/api/order-zone/route.ts`
- `src/app/api/update-zone-orders/route.ts`
- `src/app/api/cancel-zone-orders/route.ts`
- `src/app/api/protection/route.ts`
- `src/app/api/close-position/route.ts`
- `src/app/api/reduce-position/route.ts`
- `src/app/api/reverse-position/route.ts`
- `src/app/api/close-all/route.ts`
- `src/app/api/cancel-all-orders/route.ts`
- `src/app/api/cancel-order/route.ts`
- `src/app/api/replace-order/route.ts`
- `src/app/api/live-positions/route.ts`
- `src/app/api/pending-orders/route.ts`
- `src/app/api/account/route.ts`

### Market, Chart, Baseline, And Mock Sources

- `src/app/api/chart/route.ts`
- `src/app/api/market-stats/route.ts`
- `src/app/api/market-metadata/route.ts`
- `src/app/api/order-book/route.ts`
- `src/app/api/recent-trades/route.ts`
- `src/features/baseline-import/storage.ts`
- `src/features/baseline-import/types.ts`
- `src/features/baseline-import/build-baseline-profile.ts`
- `src/features/baseline-import/normalize-import.ts`
- `src/features/baseline-import/reconstruct-trades.ts`
- `src/lib/mock/trade-plan.ts`
- `src/lib/mock/orders.ts`
- `src/lib/mock/positions.ts`

## Footer Mode Inventory

| Mode | Main files | State / data hooks | API routes used | Mock / derived data | Persistence | Current UI responsibilities | Should stay as-is | Avatar / Soul / Inventory candidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Trade | `app-shell.tsx`, `footer-mode.ts`, execution routes, chart components, Tag-Along helpers | `selectedFooterTab`, `commandValue`, `tradeFooterSidePanel`, order form state, active position state, live exchange state, pending order state, Magic Trade state | `/api/execute`, `/api/limit-order`, `/api/order-zone`, `/api/protection`, `/api/close-position`, `/api/reduce-position`, `/api/reverse-position`, `/api/cancel-all-orders`, `/api/close-all`, `/api/live-positions`, `/api/pending-orders`, `/api/account`, market/chart/order-book routes | `src/lib/mock/trade-plan.ts`, `src/lib/mock/orders.ts`, `src/lib/mock/positions.ts`, testnet/live exchange responses | localStorage for chart, active position, order zones, Magic Trade market use, Tag-Along rules; sessionStorage for footer tab | Trading, command entry, order placement, safety actions, order-book side panel, Armed Magic access | Actual trading, source-of-truth exchange actions, chart ownership, risk-reducing safety actions | Move command input to footer header. Convert old command panel into Avatar surface. Make Armed Magic a small text trigger into Magic rules / Inventory. |
| Discipline | `app-shell.tsx`, `discipline-sync-adapter.ts`, `discipline-risk-gate.ts`, `discipline-server-state.ts`, `discipline-server-gate.ts`, `override-bond-ledger.ts` | `disciplineRules`, `disciplineTracking`, `serverDisciplineRuleStates`, `overrideBondConfig`, `pendingOverrideBondPrompt`, active rule counts, block reasons | `/api/discipline/state`, `/api/discipline/override-bond`; execution routes call server discipline gate | Derived rule states from local tracking and server state | `portal.discipline-rules`, `portal.discipline-tracking`, `.portal/discipline-state.json`, `.portal/override-bond-ledger.json` | Configure rules, show session discipline status, handle Override Bond flow | Enforcement logic, server state, override sync, risk gate behavior | Armory / armor slots. Rules become armor pieces visually, but existing discipline engine remains the enforcement source. |
| Journal | `app-shell.tsx`, Journal lifecycle/memory/insight helpers, recap viewer, setup preview | `journalEntries`, `journalMemoryEvents`, setup gate state, selected recap, no-trade memory, review expansion | No primary Journal API route in this surface; Journal is local and derived from execution/session events | Derived recap, memory insights, trade review helpers | `portal.journal`, `portal.journal.memoryEvents`, `portal.journal-setup-tags`, `portal.journal-settings`, IndexedDB journal snapshots | Native Journal entries, setup gate, no-trade memory, recap/replay | Journal native-only boundary and lifecycle capture | EXP memory archive. Inventory can expose summarized memory and unlock progress, not replace native Journal. |
| AI Coach | `app-shell.tsx`, `observational-coach.ts`, `ai-warning-aggregation.ts`, baseline import helpers | `aiCoachInsights`, dismissed warning IDs, baseline context, current intent, live position, discipline state, diagnosis state, Journal memory events | Baseline import is local/client-side in the current surface; AI Coach consumes existing app state rather than owning a dedicated route | Derived warnings, insight cards, source orbs, native and baseline metrics | Baseline import local storage, Journal memory events, in-component dismissed warning state | Warnings, real-time guidance, context sources, baseline scan entry point | Deterministic, evidence-based warning derivation and cautious copy | Soul real-time guidance. The Soul can present coach warnings, conscience prompts, and source-aware insight snippets. |
| Diagnosis | `app-shell.tsx`, `operator-diagnosis.ts`, `diagnosis-realtime-warnings.ts`, `discipline-plan-activation.ts` | `operatorDiagnosis`, selected recommendation IDs, activation status, review drawer state | `/api/discipline/state` when activating supported discipline plan rules | Deterministic report from native Journal, memory events, and session logs | Uses Journal, memory events, Session Logs, and Discipline state rather than its own store | Profit leaks, working behaviors, confidence, Review Plan, supported rule activation | Deterministic/local diagnosis and review-first plan model | Soul report / trader mirror. Activation remains routed through Discipline / Armory. |
| Session Logs | `app-shell.tsx`, `session-log.ts` | `sessionLogEntries`, selected filter, indexed/filter derived state | No dedicated API route; entries are appended from UI/execution handlers and some API responses | Derived filtered/indexed rows | `portal.session-log`, capped at 250 entries | Event timeline for confirmed trading, position, protection, discipline, and logic events | Best-effort logging, full-footer ownership, confirmed-event bias | Inventory activity log / EXP event stream candidate. Keep separate footer tab until Inventory is mature. |
| Settings | `app-shell.tsx`, header settings button | `selectedFooterTab = "settings"`, header market/timeframe/locale controls, terminal preferences copy | None specific to Settings | None | Mostly in component/browser state | Lightweight terminal preferences footer | Keep as terminal settings, reached from header gear | Skins may eventually live in Inventory, but terminal settings should remain separate for now. |

## Named System Audit

### Footer Mode Tabs / Header Layout

Current implementation:

- `FOOTER_TABS` defines Trade, Discipline, Journal, AI Coach, Diagnosis, and Session Logs.
- The tab row is rendered in `app-shell.tsx` inside the footer form header.
- `settings` is opened from the top terminal header gear button, not from `FOOTER_TABS`.
- Footer height is resolved by `resolveFooterHeight`.
- Journal, AI Coach, Diagnosis, and Session Logs support expansion. Trade and Discipline do not.
- Magic Trade chart-pick mode can collapse the footer height to zero.

Avatar implication:

- The target command input relocation touches the footer header and current Trade form structure.
- The Avatar surface should not add a new global shell or redesign the terminal.
- A future Inventory panel should respect existing footer mode ownership and expansion rules.

### Portal Command Input

Current implementation:

- `commandValue` lives in `app-shell.tsx`.
- The input is inside the Trade footer content area.
- Submit uses the existing form flow and command parsing/execution path.
- The input placeholder currently suggests conditional command syntax.

Avatar implication:

- Moving the input to the footer header is feasible but risky because it changes form layout and keyboard focus behavior.
- The safest path is to move markup only while preserving `commandValue`, submit handlers, parser behavior, and existing execution state.

### Armed Magic

Current implementation:

- Armed Magic is rendered inside the Trade footer command panel as a contained trigger.
- The drawer lists `tagAlongRules`, statuses, source/target symbols, and rule actions.
- Magic Trade creation/editing uses separate modal and rule builder state.
- Rule definitions live in `tag-along-rules.ts`.

Avatar implication:

- Armed Magic can become a small text-only trigger without changing Magic Trade behavior.
- Inventory can later expose Magic rules as a list of active spells/automation rules, but Magic Trade should not be confused with Discipline armor.

### Discipline Rules

Current implementation:

- Client rule shape lives in `discipline-sync-adapter.ts`.
- Client preflight lives in `discipline-risk-gate.ts`.
- Server source state lives in `.portal/discipline-state.json` through `discipline-server-state.ts`.
- Server enforcement lives in `discipline-server-gate.ts`.
- Current rule UI is rendered directly in `app-shell.tsx`.
- Supported rule concepts include max daily loss, max trades per day, cooldown after loss, minimum R:R, require protection, market entry confirmation, blocked time windows, no-trade zones, and locked/overridden rule states.

Avatar implication:

- Discipline rules are the strongest fit for Armory / armor slots.
- The Armory should render existing rule states and edit existing rule values.
- Enforcement must remain in the current discipline gate and server sync path.
- Armor visuals must not become a second implementation of rule logic.

### Override Bond

Current implementation:

- Override Bond config and prompt state are coordinated in `app-shell.tsx`.
- Posting an Override Bond calls `/api/discipline/override-bond`.
- Ledger persistence lives in `.portal/override-bond-ledger.json`.
- Server state marks the rule as overridden after a posted bond.
- Session Logs and Journal memory events record override activity.

Avatar implication:

- Override Bond maps well to an intentional rule-break flow, armor fracture, cursed item, or visible damage state.
- This is high-risk to move early because it touches locked-rule sync, ledger persistence, server state, and warning/memory systems.
- The visual metaphor must stay premium Portal, not cartoon RPG.

### AI Coach Warnings / Insights

Current implementation:

- `deriveObservationalCoachV1` derives insight cards and realtime warnings.
- `deriveAiWarningAggregation` adapts app-shell state into the AI Coach helper.
- Warning sources include discipline, operator diagnosis, risk gate, Override Bond, trade behavior, and position context.
- Baseline import is treated as AI Coach context, not native Journal content.

Avatar implication:

- AI Coach is the natural source for the Soul's realtime guidance.
- Keep existing evidence-based derivation and cautious confidence language.
- Soul should read coach output first; it should not create new opaque AI claims.

### Diagnosis / Performance Analysis

Current implementation:

- `deriveOperatorDiagnosisV1` is deterministic and local.
- It filters to closed native Journal trades and excludes imported baseline-like records.
- It uses Journal entries, Journal memory events, and Session Logs.
- It emits confidence, profit leaks, working behaviors, and a review-ready recommended Discipline Plan.
- Plan activation maps selected recommendations into supported Discipline rules.

Avatar implication:

- Diagnosis maps cleanly to a Soul report, trader mirror, or reflective inventory panel.
- Keep the review-first model.
- Activation remains a Discipline / Armory action and should not become a one-click Avatar effect.

### Journal / Trade Memory

Current implementation:

- Native Journal entries are created and updated through lifecycle helpers.
- Journal memory events capture trade opens/closes, Magic executions, Discipline blocks, Override Bonds, AI warnings, no-trade sessions, plans, and protection changes.
- Journal storage is local-first, with IndexedDB snapshots for larger data.
- Journal UI currently provides native entries, no-trade memory, setup flow, and recap/replay.

Avatar implication:

- Journal entries and memory events are the best source for EXP.
- Inventory should expose summaries, milestones, unlocks, and memory archive access.
- Do not mix imported baseline into native Journal.

### Session Logs

Current implementation:

- Session Logs are best-effort, localStorage-backed, capped at 250 entries.
- Categories are orders, positions, protection, discipline, and logic.
- Filters and indexing are helper-derived.
- Logging is intentionally non-blocking.

Avatar implication:

- Session Logs can become an Inventory activity timeline or EXP ledger.
- Keep the standalone Session Logs mode until Inventory is proven, because it is the clearest observability surface today.

## Proposed Feature Mapping

This table is an audit recommendation, not an implementation decision.

| Current feature | New Avatar system location | Notes | Risk / complexity |
| --- | --- | --- | --- |
| Portal Command input | Footer header near mode tabs | Move markup only; preserve `commandValue`, submit handling, parser, and execution behavior. | High |
| Current Portal Command panel area | Main Avatar surface | Best candidate for dormant Avatar body, Soul status, HP/Stamina, and quick inventory access. | Medium |
| Armed Magic trigger | Small text-only trigger/link | Should open current Magic rules drawer or future Inventory section without a large contained pill/card. | Medium |
| Magic Trade composer | Existing modal, reachable from small trigger or Inventory | Do not rebuild the Magic rule engine during Avatar shell work. | Medium-high |
| Tag-Along rule list | Inventory automation/rules list | Can be framed as armed automation, separate from armor. | Medium |
| Discipline rule toggles | Armory / armor slots | Visual shell over current rule values and server rule states. | Medium |
| Max daily loss | Armor piece plus HP breaker | Existing rule should remain enforcement source; can also inform HP. | Medium |
| Max trades per day | Armor piece plus stamina limiter | Existing tracking already supports daily count. | Medium |
| Cooldown after loss | Stamina rule / energy limiter | Existing cooldown tracking can drive stamina display. | Medium |
| Minimum protected R:R | Shield / chest armor | Tied to active trade plan, order setup, and discipline gate. | Medium-high |
| Require Protection | Shield / guard layer | Strong armor metaphor; risky because it touches protection state and server/client gates. | High |
| Market Entry Confirmation | Soul conscience prompt / helmet | Existing behavior is warning/confirmation, not a hard armor stat. | Medium |
| Blocked Time Windows | Time ward / fatigue limiter | Needs careful timezone handling and server state alignment. | Medium-high |
| No-trade zones | Chart ward / boundary field | Should remain chart-owned; Inventory can summarize but not replace chart controls. | High |
| Override Bond | Armor fracture / deliberate override flow | Ledger, locked rule states, session logs, and Journal memory all participate. | High |
| AI Coach warnings | Soul realtime guidance | Strong fit; derive from existing `aiCoachInsights`. | Low-medium |
| AI Coach baseline context | Soul context source / EXP source | Keep imported baseline outside native Journal. | Medium |
| Operator Diagnosis | Soul report / trader mirror | Keep deterministic helper and confidence boundaries. | Medium |
| Diagnosis Review Plan | Armory recommendation review | Activation still maps into Discipline rules. | Medium-high |
| Journal entries | EXP memory archive | Use summaries and milestones; keep Journal as native evidence layer. | Medium |
| Journal memory events | EXP event stream | Strong low-risk source for unlock progress and behavior history. | Low-medium |
| No-trade memory | Soul restraint memory / EXP event | Should reward discipline without overclaiming. | Low-medium |
| Session Logs | Inventory activity timeline or retained Logs tab | Keep separate initially to avoid hiding observability. | Low |
| HP | Derived session/daily health | New domain model. Must not duplicate enforcement or imply false precision. | High |
| Stamina | Derived cooldown/pacing/readiness | Can read existing cooldown and trade-frequency state first. | Medium-high |
| Avatar Body dormant/unborn | Avatar surface visual state | Needs product thresholds for "enough experience." | Medium |
| Skins | Inventory visual theme only | Must not affect trading logic, unlock power, or rule enforcement. | Low |

## State And Data Map

| Domain | Current state / storage | Current owner | Avatar use | Guardrail |
| --- | --- | --- | --- | --- |
| Footer mode | `selectedFooterTab`, `portal.footer-tab`, `isFooterDeckCollapsed`, `isReviewWorkspaceExpanded`, `resolveFooterHeight` | `app-shell.tsx`, `footer-mode.ts` | Decide where Avatar surface appears and how Inventory expands. | Preserve mode ownership; no trade controls in non-trade modes. |
| Portal Command | `commandValue`, current footer form submit flow | `app-shell.tsx` | Move input to footer header later. | Do not change parser or execution behavior during layout move. |
| Trade execution | order form state, active position, pending orders, account state, live exchange refresh state | `app-shell.tsx`, execution helpers, API routes | Avatar can summarize live state but must not become execution source. | Exchange/API remains source of truth. |
| Armed Magic | `tagAlongRules`, `tagAlongExecutionRecords`, rule builder draft, Magic Trade modal state | `app-shell.tsx`, Tag-Along helpers | Inventory automation list and small access trigger. | Keep Magic automation separate from Discipline armor. |
| Discipline local state | `disciplineRules`, `disciplineTracking` | `app-shell.tsx`, `discipline-sync-adapter.ts` | Armory values and armor status. | Existing gates remain authoritative. |
| Discipline server state | `.portal/discipline-state.json`, server rule states, locked/overridden statuses | `discipline-server-state.ts`, `/api/discipline/state` | Armor active/locked/fractured state. | Do not fork server rule state into Avatar storage. |
| Override Bond | override config, pending prompt, `.portal/override-bond-ledger.json` | `app-shell.tsx`, `/api/discipline/override-bond`, `override-bond-ledger.ts` | Armor fracture / override history. | High-risk; preserve exact ledger and server sync semantics. |
| AI Coach | `aiCoachInsights`, dismissed warning IDs, baseline context, live-position context | `observational-coach.ts`, `ai-warning-aggregation.ts`, `app-shell.tsx` | Soul guidance and warnings. | Do not invent unsupported AI certainty. |
| Diagnosis | `operatorDiagnosis`, review drawer state, selected recommendation IDs, activation status | `operator-diagnosis.ts`, `diagnosis-realtime-warnings.ts`, `discipline-plan-activation.ts`, `app-shell.tsx` | Soul mirror/report and Armory recommendations. | Keep deterministic/local helper. |
| Journal | `journalEntries`, setup gate state, recap/replay state | Journal helpers, `app-shell.tsx` | EXP memory archive and unlock source. | Journal stays native-only. |
| Journal memory events | `portal.journal.memoryEvents` | `journal-memory-events.ts`, `app-shell.tsx` | EXP event stream, behavior history, no-trade memory. | Imported baseline remains separate. |
| Session Logs | `portal.session-log`, filters, indexed logs | `session-log.ts`, `app-shell.tsx` | Activity timeline, Inventory log, EXP ledger candidate. | Logging remains best-effort and non-blocking. |
| Historical baseline import | baseline local storage and profile helpers | `baseline-import/*`, AI Coach surface | Optional EXP/source context for connected/imported history. | Keep as AI Coach context, not native Journal. |
| Skins | No current Avatar skin state found | Future Avatar/Inventory feature | Cosmetic-only inventory category. | No trading advantage or rule power. |

## Technical Constraints

- `app-shell.tsx` is the main coupling point. It owns too much state and too much UI to safely redesign in one pass.
- Portal Command relocation is not just visual. The input is currently inside the Trade footer form and tied to command submission.
- Discipline has multiple sources of truth by design: local state, server file state, server gate, client gate, and API responses. Avatar must read these states, not reimplement them.
- HP and Stamina do not exist as canonical primitives today. They should start as derived display concepts, not enforcement logic.
- Override Bond is the riskiest Avatar metaphor because it touches locked-rule sync, server state, ledger persistence, Session Logs, Journal memory, and UI prompts.
- The Override Bond support matrix is not perfectly uniform across files. In particular, `require_protection` is part of discipline gating but is not accepted by the current Override Bond API sanitizer. `override-bond-ledger.ts` also has a narrower rule-type sanitizer than other discipline modules. Any Inventory history view should handle missing or unsupported rule types carefully.
- Session Logs are localStorage-only and best-effort. They are excellent for activity display, but they should not become the authoritative record for execution.
- Diagnosis and AI Coach already have product boundaries: AI Coach is realtime warning, Diagnosis is decision packaging, Journal is evidence. Soul should combine their presentation without collapsing these roles internally.
- Journal and historical baseline import must remain separate. Imported wallet or transaction history can contribute to EXP/source context, but it should not become native Journal evidence.
- Magic Trade / Tag-Along rules are automation logic, not discipline rules. They can live near Inventory, but they should not become armor.
- Existing execution routes already enforce discipline in the important risk-increasing paths. Avatar actions must not bypass those routes.
- The existing expansion model is shared by Journal, AI Coach, Diagnosis, and Session Logs. Inventory needs its own explicit expansion/modal behavior to avoid fighting current footer height state.

## What Is Easy To Refactor

- Add a read-only Avatar/Soul/Inventory view model that consumes existing app-shell state and helper outputs.
- Map AI Coach warnings into Soul guidance.
- Map Operator Diagnosis summary into a Soul report.
- Map Journal memory events into EXP event counts.
- Summarize Session Logs in an Inventory timeline.
- Render Discipline rules as read-only armor slots before editing is introduced.
- Turn Armed Magic's visual trigger into smaller text once a layout pass begins.

## Risks

- Moving the Portal Command input into the footer header while preserving form submission, keyboard behavior, and command execution.
- Replacing the Discipline UI with Armory editing before rule sync and server state are cleanly abstracted.
- Introducing HP as if it were authoritative risk state.
- Introducing Stamina as if it blocks trades before the discipline gate supports that rule.
- Moving Override Bond into Inventory before its rule-type support and ledger edge cases are audited.
- Collapsing AI Coach, Diagnosis, and Journal into one Soul surface without preserving their current product boundaries.
- Hiding Session Logs too early and losing the current observability surface.

## What Should Remain Separate For Now

- Trade execution controls and emergency controls.
- Chart-owned controls and overlays, especially no-trade zones and Magic Trade chart pick overlays.
- Native Journal as an evidence surface.
- Historical baseline import as AI Coach context, not Journal content.
- Session Logs as a standalone footer mode until Inventory has equivalent observability.
- Settings as terminal preferences, separate from cosmetic Avatar skins.
- Discipline gates and server state as the actual enforcement layer.

## Recommended Build Phases

### Phase 1: Layout Shell Only

Goal: create the Avatar surface placement without changing domain behavior.

Scope:

- Keep the existing footer mode system.
- Move the Portal Command input into the footer header only after preserving its current submit flow.
- Replace the old command panel area with a non-functional Avatar/Soul placeholder.
- Convert Armed Magic to a small text-only trigger/link.
- No HP/Stamina math, no armor editing, no Inventory modal logic.

Guardrail: this phase is layout-only and should not change trading, Discipline, Journal, AI Coach, Diagnosis, Session Logs, or Magic Trade behavior.

### Phase 2: Static Avatar / Soul Mock State

Goal: prove the premium Portal RPG operating-system tone without binding it to trading logic.

Scope:

- Dormant/unborn Avatar body state.
- Static Soul status.
- Static HP/Stamina labels.
- Static armor slots.
- Static Inventory access affordance.

Guardrail: no claims of real diagnosis, progress, health, readiness, unlocks, or rule enforcement.

### Phase 3: Map Existing Discipline Into Armory

Goal: render current Discipline rules as armor pieces while preserving existing rule editing and enforcement.

Scope:

- Read existing `disciplineRules`, `disciplineTracking`, and server rule states.
- Show armor status for max daily loss, max trades, cooldown, minimum R:R, require protection, market entry confirmation, blocked windows, and no-trade zones.
- Keep current Discipline mode available until Armory editing is proven.

Guardrail: no duplicate enforcement and no new rule state storage.

### Phase 4: Map AI Coach + Diagnosis Into Soul

Goal: make Soul the combined presentation layer for realtime guidance and reflective diagnosis.

Scope:

- Feed existing AI Coach warnings into Soul realtime guidance.
- Feed Operator Diagnosis into Soul report/trader mirror.
- Preserve the internal boundary between realtime warning and decision packaging.

Guardrail: no external AI, no fake certainty, no unsupported activation claims.

### Phase 5: Map Journal Into EXP

Goal: make trading memory visible as Avatar experience.

Scope:

- Count native Journal trades, Journal memory events, no-trade events, and recap milestones.
- Use baseline/imported history as separate source context only.
- Keep Journal as native evidence mode.

Guardrail: do not mix imported baseline into native Journal EXP without explicit source labeling.

### Phase 6: HP / Stamina Logic

Goal: introduce derived health and readiness metrics.

Scope:

- HP reads from losses, daily loss progress, violations, Override Bonds, broken plans, and rule blocks.
- Stamina reads from cooldown, trade frequency, session pacing, and recent overtrading signals.
- Start as display-only and explain uncertainty through restrained copy.

Guardrail: HP/Stamina must not become hidden trading gates unless a later product decision explicitly defines that behavior.

### Phase 7: Inventory Modal

Goal: provide the expanded management surface for Avatar, armor, Soul insights, EXP, HP, stamina, unlocks, skins, and activity.

Scope:

- Inventory sections for Avatar, Armory, Soul, EXP, Activity, and Skins.
- Reuse current modals/drawers where possible.
- Keep Session Logs accessible until Inventory activity fully replaces it.

Guardrail: Inventory should be progressive disclosure, not a new dashboard that competes with the chart.

### Phase 8: Animation / Polish

Goal: add premium motion and visual fidelity after the model is stable.

Scope:

- Review `docs/brand/visual/Portal_Visual_Brand_Bible.pdf` first.
- Add subtle earned glow, armor state transitions, Soul presence, and dormant/body reveal moments.
- Keep skins visual-only.

Guardrail: Portal should feel like a luxury trading cockpit with cyber wormhole energy, not cartoon game UI.

## Open Questions

- Does Avatar become the default Trade footer surface, or does it become its own footer mode later?
- Should AI Coach and Diagnosis tabs remain after Soul exists, or should they become deep views inside Soul/Inventory?
- What counts as "enough experience" for the Avatar Body to move from dormant/unborn to visible?
- How should EXP weight native trades, Journal entries, no-trade sessions, connected wallet history, and imported transaction history?
- Should HP be purely visual, or can it eventually participate in warnings or blocks?
- Should Stamina be derived only from existing cooldown/trade frequency state, or should Portal add new pacing rules later?
- Which Discipline rules are editable from Armory in V1, and which remain read-only links to the current Discipline mode?
- Should Override Bond use the "cursed item" metaphor, or should it stay closer to Portal language such as fracture, breach, or override scar?
- Should Session Logs remain a tab permanently, or migrate into Inventory once the activity timeline is strong enough?
- Where should Skins persist, and should skins unlock through EXP or remain manually selected cosmetics?
- Should Magic Trade rules live in Inventory, or should Armed Magic remain a separate small access point?
- Should connected wallet history affect Avatar state before the user imports or confirms the data?

## Suggested First Implementation Step

Start with a narrow Phase 1 boundary:

1. Create an `AvatarSurface` shell component with static placeholder props and no domain logic.
2. Move the existing Portal Command input into the footer header while preserving the existing `commandValue`, submit handler, parser, and command execution behavior.
3. Replace the old Trade command panel body with the shell-only Avatar surface.
4. Convert Armed Magic to a small text-only trigger that still opens the existing drawer/modal flow.
5. Verify that all existing footer modes still own the footer, Trade execution still works, and no trade controls appear in Discipline, Journal, AI Coach, Diagnosis, Session Logs, or Settings modes.

Do not start HP, Stamina, Armory editing, Soul derivation, or Inventory modal work until this shell move is stable.
