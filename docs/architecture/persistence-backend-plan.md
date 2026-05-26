# Persistence / Backend Architecture Plan Report

## Summary

Portal should move from browser/file-backed persistence to an account-scoped backend built around Postgres as the durable source of truth, with Supabase as the strongest private-beta candidate because it gives Portal a managed Postgres database, row-level security, auth primitives, storage, migrations, and TypeScript-friendly APIs without inventing infrastructure too early.

The core model should be event-ledger first. Journal entries, Session Logs, AI warnings, Discipline state transitions, Magic Trade trigger records, Override Bond simulations, and Diagnosis snapshots should all be traceable to immutable events. Mutable "current state" tables can exist for fast rendering, but important trading and behavior history should be append-only wherever possible.

This plan does not build the database yet. It defines the target backend shape so the next implementation step can be a narrow persistence foundation rather than a broad rewrite.

## Current Local State Inventory

Portal V1 currently stores important state across four places:

1. Browser `localStorage`
   - `portal.chart-levels`, `portal.chart-line-triggers`, `portal.chart-trend-lines`, `portal.chart-zones`: chart annotations, zones, and trigger overlays.
   - `portal.active-position`, `portal.active-trade-plan`, `portal.pending-limit-orders`, `portal.min-rr`, `portal.trade-leverage-by-symbol`: local trading context and planning state.
   - `portal.discipline-rules`, `portal.discipline-tracking`: client-side Discipline rule configuration and counters.
   - `portal.session-log`: capped local Session Log rows.
   - `portal.journal`: native Journal trade entries, review fields, lifecycle metadata, and replay references.
   - `portal.journal.memoryEvents`: Journal memory events derived from trades, Discipline blocks, Magic Trade, AI warnings, no-trade sessions, Override Bond events, plans, and protection actions.
   - `portal.journal-setup-tags`, `portal.journal-settings`: setup tag list and Journal preferences.
   - `portal.baseline-import`: imported Hyperliquid history bundles and baseline profiles.
   - `portal.tag-along-rules`, `portal.tag-along-execution-records`, `portal.magic-trade-market-uses`: Magic Trade rules, trigger/execution history, and market-use telemetry.

2. Browser `sessionStorage`
   - `portal.footer-tab`: last selected footer mode. This should stay local UI preference, not durable beta state.

3. Browser `IndexedDB`
   - `portal-journal-snapshots`, store `frames`: Journal replay/snapshot blobs keyed by replay frame storage keys. Current metadata lives in Journal entries; image-like blobs live in IndexedDB.

4. Local server files under `.portal/`
   - `.portal/discipline-state.json`: server-readable Discipline state used by execution gates.
   - `.portal/override-bond-ledger.json`: simulated Override Bond ledger.

Exchange-facing state is not persisted by Portal:

- Live positions and pending orders are pulled from Hyperliquid through API routes such as `/api/live-positions`, `/api/pending-orders`, `/api/account`, and trading action routes.
- For live trading state, Hyperliquid remains the source of truth. Portal persistence should store Portal decisions, attempts, confirmations, snapshots, and review metadata, not pretend to own exchange settlement.

## Recommended Backend Model

Use Supabase/Postgres for private beta unless a later constraint disqualifies it.

Why this fits Portal:

- Postgres is the right durable core for relational trading/account data, append-only events, account scoping, idempotency keys, and audit trails.
- Supabase gives a fast beta path without running custom DB/auth/storage infrastructure.
- Row-level security maps cleanly to `user_id`, `account_id`, and `environment` ownership rules.
- Supabase Storage can hold chart snapshot assets while Postgres stores metadata and references.
- Next.js API routes can own validation, exchange-facing side effects, idempotency, and server-only secrets while still reading/writing Postgres.

Architecture shape:

- Client UI remains Next.js/React.
- Next.js API routes become the only write path for trading-adjacent durable data.
- Supabase/Postgres stores durable beta state.
- Supabase Storage stores chart snapshot images/replay assets.
- Local browser storage remains a demo/offline cache only until a sync layer replaces it.
- Magic Trade remains browser-runtime in beta V1, but its rules, armed state, and trigger records are persisted in a way that a future backend worker can adopt.

Recommended data pattern:

- Immutable event ledger: `portal_events`.
- Product-specific current-state tables: Journal, Discipline, Magic Trade rules, AI/Diagnosis, baseline imports.
- Idempotent writes: every trading-adjacent write should accept or generate a stable `idempotency_key`.
- Source tagging: every row should record `source`, `source_version`, `environment`, and enough correlation IDs to connect UI, API, exchange response, Session Log, Journal, and Diagnosis.

Do not put private keys in Supabase or browser storage. Any future signing/exchange key material belongs in a separate secret-management design.

Security / privacy model:

- Treat wallet behavior, Journal notes, chart snapshots, baseline imports, Discipline rules, and AI/Diagnosis memory as private user data.
- Enable row-level security on all user/account tables before beta traffic.
- Scope reads and writes by `user_id`, `account_id`, and `environment`.
- Keep service-role credentials server-only in Next.js API routes or backend jobs.
- Use short-lived signed URLs for chart snapshot uploads/downloads.
- Store raw exchange import payloads only when needed for audit or reconstruction; otherwise prefer normalized rows plus data-quality warnings.
- Redact or avoid storing private key material, browser secrets, request cookies, and full API error dumps.
- Add retention controls before beta for imported history, chart snapshot assets, and event payloads that may contain strategy-sensitive metadata.

## Entity / Table Plan

Core ownership and account scope:

| Table | Purpose | Key fields |
| --- | --- | --- |
| `profiles` | Portal user profile mapped to auth identity. | `id uuid pk`, `auth_user_id uuid unique`, `created_at`, `updated_at`, `display_name`, `default_environment` |
| `trading_accounts` | Wallet/account scopes available to a user. | `id uuid pk`, `user_id`, `wallet_address`, `environment testnet/live`, `label`, `is_demo`, `created_at`, `last_seen_at` |
| `account_memberships` | Future sharing/team access without changing ownership model. | `id`, `account_id`, `user_id`, `role owner/viewer`, `created_at` |
| `user_preferences` | Durable user preferences that should roam across devices. | `user_id pk`, `selected_account_id`, `default_symbol`, `default_timeframe`, `updated_at` |

Event ledger:

| Table | Purpose | Key fields |
| --- | --- | --- |
| `portal_events` | Append-only timeline for system, trading, Magic Trade, Discipline, AI, Diagnosis, Journal, and migration events. | `id uuid pk`, `user_id`, `account_id`, `environment`, `event_type`, `category`, `source`, `occurred_at`, `ingested_at`, `symbol`, `direction`, `severity`, `correlation_id`, `idempotency_key unique nullable`, `payload jsonb` |

Journal:

| Table | Purpose | Key fields |
| --- | --- | --- |
| `journal_entries` | Native Portal trade journal entries only. Imported baseline trades do not live here. | `id uuid pk`, `user_id`, `account_id`, `environment`, `symbol`, `direction`, `status open/closed`, `entry_price`, `exit_price`, `size`, `realized_pnl`, `gross_pnl`, `fees jsonb`, `opened_at`, `closed_at`, `timeframe`, `entry_source`, `entry_style`, `exit_reason`, `setup_tag`, `setup_type`, `setup_status`, `is_custom_setup_tag`, `confidence_rating`, `emotion_state`, `mistake_made`, `lesson_learned`, `thesis`, `plan_followed`, `setup_quality_rating`, `created_at`, `updated_at`, `source_type native` |
| `journal_lifecycle_events` | Durable ordered trade lifecycle events. | `id uuid pk`, `journal_entry_id`, `user_id`, `account_id`, `event_type opened/reduced/closed/reversed/order_filled/magic_trade/trigger_fired`, `occurred_at`, `execution_id`, `order_id`, `client_order_id`, `trigger_id`, `magic_trade_rule_id`, `session_log_id`, `order_zone_id`, `size`, `reduced_size`, `remaining_size`, `gross_pnl`, `net_pnl`, `fees jsonb`, `payload jsonb` |
| `journal_memory_events` | Durable memory stream used by Journal, AI Coach, Diagnosis, and future avatar/EXP features. | `id text pk`, `user_id`, `account_id`, `event_type`, `source`, `occurred_at`, `journal_entry_id`, `session_log_id`, `trade_id`, `symbol`, `side`, `severity`, `title`, `message`, `ai_warning_id`, `override_bond_id`, `magic_trade_rule_id`, `trigger_id`, `metadata jsonb` |
| `journal_setup_tags` | User/account-specific setup taxonomy. | `id uuid pk`, `user_id`, `account_id nullable`, `label`, `kind preset/custom`, `created_at`, `archived_at` |
| `journal_review_notes` | Review fields that may evolve independently from execution capture. | `id uuid pk`, `journal_entry_id`, `user_id`, `body`, `emotion_state`, `confidence_rating`, `mistake_made`, `lesson_learned`, `created_at`, `updated_at` |
| `journal_replay_frames` | Replay metadata and asset pointers. | `id uuid pk`, `journal_entry_id`, `user_id`, `account_id`, `event`, `captured_at`, `price`, `size`, `pnl`, `status`, `storage_path`, `preview_storage_path`, `raw_metadata jsonb` |
| `chart_snapshots` | Chart snapshot references for Journal and future review surfaces. | `id uuid pk`, `user_id`, `account_id`, `journal_entry_id nullable`, `symbol`, `timeframe`, `captured_at`, `storage_path`, `preview_storage_path`, `marker jsonb`, `dimensions jsonb`, `source` |

Session Logs:

| Table | Purpose | Key fields |
| --- | --- | --- |
| `session_log_entries` | Durable operator timeline. Can be derived from `portal_events`, but a table makes the UI cheap and stable. | `id text pk`, `user_id`, `account_id`, `environment`, `category`, `event_type`, `source`, `description`, `occurred_at`, `symbol`, `direction`, `price`, `size`, `pnl`, `metadata jsonb`, `event_id nullable` |

Discipline:

| Table | Purpose | Key fields |
| --- | --- | --- |
| `discipline_rule_sets` | Versioned group of active user rules per account/environment. | `id uuid pk`, `user_id`, `account_id`, `environment`, `version`, `status active/archived`, `source client_sync/server_gate/operator_diagnosis/manual`, `created_at`, `updated_at` |
| `discipline_rules` | Individual rules. | `id uuid pk`, `rule_set_id`, `user_id`, `account_id`, `rule_type`, `enabled`, `config jsonb`, `created_by_source`, `locked_at`, `archived_at`, `created_at`, `updated_at` |
| `discipline_rule_states` | Current derived/explicit state per rule. | `id uuid pk`, `rule_id`, `user_id`, `account_id`, `state inactive/active/armed/triggered/locked/overridden`, `reason_code`, `locked_at`, `overridden_at`, `override_expires_at`, `updated_at`, `source` |
| `discipline_tracking` | Account/session counters and cooldown state. | `id uuid pk`, `user_id`, `account_id`, `environment`, `day_key`, `trades_placed_today`, `realized_pnl_today`, `last_losing_trade_at`, `cooldown_remaining_ms`, `session_started_at`, `updated_at` |
| `discipline_no_trade_windows` | Structured no-trade windows, separate from generic JSON for querying. | `id uuid pk`, `rule_id`, `account_id`, `start_time`, `end_time`, `timezone`, `days_of_week int[]`, `created_at`, `updated_at` |
| `discipline_protection_requirements` | Require-protection rule details where structured querying matters. | `id uuid pk`, `rule_id`, `account_id`, `require_stop_loss`, `require_take_profit`, `minimum_rr`, `config jsonb`, `updated_at` |
| `override_bond_events` | Simulated Override Bond ledger now; can later support settlement references. | `id uuid pk`, `bond_id text unique`, `user_id`, `account_id`, `environment`, `rule_id`, `rule_type`, `status posted/voided/settled`, `source simulated/future_settlement`, `base_amount_usdc`, `final_amount_usdc`, `multiplier`, `portal_amount_usdc`, `reserve_amount_usdc`, `vault_amount_usdc`, `override_count_today`, `posted_at`, `metadata jsonb` |

Magic Trade:

| Table | Purpose | Key fields |
| --- | --- | --- |
| `magic_trade_rules` | Saved rules and current armed/draft state. | `id uuid pk`, `user_id`, `account_id`, `environment`, `name`, `status draft/armed/paused/triggered/executing/executed/skipped/failed/expired/disarmed`, `source_symbol`, `target_symbol`, `condition_type`, `condition jsonb`, `target_action_type`, `target_action jsonb`, `target_actions jsonb`, `execution_mode simulation-only/live-risk-reducing/live-open-position`, `fire_behavior`, `max_executions`, `duplicate_window_ms`, `expires_at`, `requires_confirmation_for_risk_increase`, `runtime_owner browser/backend`, `created_at`, `updated_at`, `armed_at`, `disarmed_at` |
| `magic_trade_rule_states` | Runtime watch state without mutating the rule definition repeatedly. | `id uuid pk`, `rule_id`, `watch_state watching/near-trigger/would-trigger/feed-stale`, `execution_count`, `last_triggered_at`, `last_execution_record_id`, `last_source_snapshot jsonb`, `idempotency_key`, `updated_at` |
| `magic_trade_trigger_events` | History of fired/would-fire triggers. | `id uuid pk`, `rule_id`, `user_id`, `account_id`, `triggered_at`, `status simulated/would-trigger/executed/skipped/failed`, `source_snapshot jsonb`, `target_snapshot_before jsonb`, `target_snapshot_after jsonb`, `reason`, `related_session_log_ids text[]`, `event_id` |
| `magic_trade_market_use` | Market usage telemetry currently stored locally. | `id uuid pk`, `user_id`, `account_id`, `symbol`, `use_type`, `count`, `last_used_at` |

The `runtime_owner` field is important. Private beta can persist rules while still letting the browser evaluate them. A later backend worker can claim `runtime_owner = backend` without redesigning the schema.

AI / Diagnosis Memory:

| Table | Purpose | Key fields |
| --- | --- | --- |
| `ai_warnings` | Warnings generated by deterministic AI Coach/Diagnosis aggregation. | `id text pk`, `user_id`, `account_id`, `environment`, `warning_type`, `severity`, `source`, `trigger`, `title`, `message`, `symbol`, `related_rule_type`, `generated_at`, `expires_at`, `metadata jsonb` |
| `ai_warning_events` | Shown/dismissed/respected/ignored events. | `id uuid pk`, `warning_id`, `user_id`, `account_id`, `event_type shown/dismissed/respected/ignored`, `occurred_at`, `context jsonb`, `session_log_id`, `journal_memory_event_id` |
| `behavioral_signals` | Normalized signals for coach/diagnosis without overloading Journal events. | `id uuid pk`, `user_id`, `account_id`, `signal_type`, `severity`, `observed_at`, `symbol`, `source`, `evidence_event_ids text[]`, `journal_entry_ids uuid[]`, `metadata jsonb` |
| `diagnosis_snapshots` | Deterministic Operator Diagnosis output at a point in time. | `id uuid pk`, `user_id`, `account_id`, `environment`, `generated_at`, `confidence low/medium/high`, `sample_size`, `profit_leaks jsonb`, `profitable_behaviors jsonb`, `recommended_plan_id nullable`, `input_event_watermark`, `metadata jsonb` |
| `discipline_plan_recommendations` | Review-first recommended plans from Diagnosis. | `id uuid pk`, `diagnosis_snapshot_id`, `user_id`, `account_id`, `status draft/review_ready/activated/dismissed`, `title`, `summary`, `expected_benefit`, `rules jsonb`, `created_at`, `updated_at` |
| `discipline_plan_activations` | Audit trail for accepted plans. | `id uuid pk`, `plan_id`, `user_id`, `account_id`, `activated_at`, `activated_rule_ids uuid[]`, `source operator_diagnosis`, `result jsonb` |

Baseline Imports:

| Table | Purpose | Key fields |
| --- | --- | --- |
| `baseline_imports` | Saved import bundle/source metadata. | `id uuid pk`, `user_id`, `account_id`, `environment`, `wallet_address`, `source hyperliquid`, `source_label Historical Import`, `requested_start_time`, `requested_end_time`, `imported_at`, `data_quality jsonb`, `raw_storage_path nullable`, `status completed/failed`, `version` |
| `baseline_imported_trades` | Normalized imported historical trades. Not native Journal. | `id text pk`, `baseline_import_id`, `user_id`, `account_id`, `coin`, `direction`, `status`, `entry_time`, `end_time`, `entry_price`, `exit_price`, `max_size`, `execution_closed_pnl`, `funding_pnl`, `gross_fees`, `net_pnl`, `duration_minutes`, `execution_mode`, `entry_style_proxy`, `reconstruction_confidence`, `order_ids bigint[]`, `raw jsonb` |
| `baseline_imported_fills` | Optional detailed imported fills for audit/rebuild. | `id text pk`, `baseline_import_id`, `trade_id`, `account_id`, `coin`, `side`, `size`, `price`, `fee`, `fee_token`, `order_id`, `trade_id_external`, `hash`, `timestamp`, `raw jsonb` |
| `baseline_stats` | Cached baseline profile/metrics for AI Coach context. | `id uuid pk`, `baseline_import_id`, `user_id`, `account_id`, `profile jsonb`, `created_at`, `version` |

Relationship rules:

- Every durable product row must include `user_id`.
- Every trading-account row must include `account_id` and `environment`.
- Native Journal rows and baseline import rows must stay separate.
- Session Logs and Journal memory events should reference the same `portal_events` row when they describe the same occurrence.
- Exchange identifiers (`execution_id`, `order_id`, `client_order_id`) should be preserved wherever available.
- The database should allow multiple accounts and both `testnet` and `live` under one user without mixing state.
- Ownership should flow from authenticated user -> account membership -> account-scoped data. Never infer access from a wallet address string alone.
- Demo/local state should use `is_demo = true` or remain outside persisted beta tables so reset tooling cannot accidentally wipe real user history.

## API Route Plan

Keep Next.js API routes as the backend boundary. The client should not write directly to trading-adjacent tables.

Foundation:

| Route | Responsibility |
| --- | --- |
| `GET /api/me` | Return authenticated profile, selected account, environment, and feature flags. |
| `GET /api/accounts` | List wallet/account scopes available to the user. |
| `POST /api/accounts/select` | Set selected account/environment. |
| `POST /api/events` | Append non-trading UI/system events when safe. Trading-adjacent events should be written by domain routes. |

Journal:

| Route | Responsibility |
| --- | --- |
| `GET /api/journal/entries` | List native Journal entries for selected account/environment. |
| `POST /api/journal/entries` | Create a native Journal entry from a confirmed trade capture. |
| `PATCH /api/journal/entries/:id` | Update review fields, setup tags, notes, and status-safe metadata. |
| `POST /api/journal/entries/:id/lifecycle-events` | Append lifecycle event idempotently. |
| `GET /api/journal/memory-events` | Fetch memory stream for Journal/AI/Diagnosis. |
| `POST /api/journal/memory-events` | Append non-execution memory events idempotently. |
| `POST /api/journal/snapshots/sign-upload` | Return a short-lived upload target for chart snapshot/replay assets. |
| `POST /api/journal/snapshots` | Persist snapshot metadata after upload. |

Session Logs:

| Route | Responsibility |
| --- | --- |
| `GET /api/session-logs` | Fetch paginated Session Logs by account/environment/category. |
| `POST /api/session-logs` | Append best-effort log entries. Must never block exchange execution routes. |

Discipline:

| Route | Responsibility |
| --- | --- |
| `GET /api/discipline/state` | Return server-authoritative Discipline state for selected account/environment. Current route exists and should migrate from `.portal` file reads to Postgres reads. |
| `PUT /api/discipline/state` | Sync rule updates/tracking with version checks, lock protection, and source tagging. Current route exists and should migrate from file writes to transactional DB writes. |
| `POST /api/discipline/rules` | Create/enable a rule. |
| `PATCH /api/discipline/rules/:id` | Edit a rule if not locked or if override is valid. |
| `POST /api/discipline/override-bond` | Post simulated Override Bond event and apply allowed override transition. Current route exists and should migrate ledger writes to `override_bond_events`. |
| `POST /api/discipline/plans/:id/activate` | Activate reviewed Diagnosis plan into Discipline rules with audit trail. |

Magic Trade:

| Route | Responsibility |
| --- | --- |
| `GET /api/magic-trade/rules` | List saved rules for selected account/environment. |
| `POST /api/magic-trade/rules` | Save draft rule. |
| `PATCH /api/magic-trade/rules/:id` | Update rule metadata/config while respecting status constraints. |
| `POST /api/magic-trade/rules/:id/arm` | Mark a rule armed for browser runtime. |
| `POST /api/magic-trade/rules/:id/disarm` | Mark a rule disarmed. |
| `POST /api/magic-trade/triggers` | Record would-trigger/executed/skipped/failed trigger records idempotently. |

Do not build a backend Magic Trade runtime yet. These routes persist browser-runtime state and history so a future worker can take over.

AI / Diagnosis:

| Route | Responsibility |
| --- | --- |
| `GET /api/ai/warnings` | Return active warnings generated from persisted account data. |
| `POST /api/ai/warnings/:id/events` | Record shown/dismissed/respected/ignored. |
| `POST /api/diagnosis/snapshots` | Generate or persist deterministic Diagnosis snapshot from durable Journal/memory/log data. |
| `GET /api/diagnosis/latest` | Fetch latest snapshot and recommended plan. |
| `PATCH /api/diagnosis/plans/:id` | Mark plan reviewed/dismissed/ready. |

Baseline:

| Route | Responsibility |
| --- | --- |
| `POST /api/baseline-imports/preview` | Fetch/normalize Hyperliquid history for preview without committing. |
| `POST /api/baseline-imports` | Persist import request, normalized trades, fills, and baseline stats. |
| `GET /api/baseline-imports` | List context sources. |
| `GET /api/baseline-imports/:id` | Fetch full baseline profile/details. |
| `DELETE /api/baseline-imports/:id` | Delete one imported context source without touching native Journal. |

Existing exchange routes:

- `/api/execute`, `/api/limit-order`, `/api/order-zone`, `/api/protection`, `/api/close-position`, `/api/reduce-position`, `/api/reverse-position`, `/api/cancel-all-orders`, `/api/close-all`, `/api/replace-order`, and related routes should continue to own exchange side effects.
- During persistence migration, these routes should append `portal_events`, `session_log_entries`, `journal_lifecycle_events`, and Discipline tracking updates after exchange confirmation.
- Logging/persistence failures should not cause successful risk-reducing exchange actions to fail. For risk-increasing actions, Discipline gate reads must be durable and fail closed if required state cannot be loaded.

## Migration Plan

Phase 0: Preserve demo behavior

- Keep `localStorage`, `IndexedDB`, and `.portal` support as the demo/offline path.
- Add no database dependency to the current demo until the persistence foundation is explicitly started.

Phase 1: Add backend identity and account scope

- Introduce authenticated user identity.
- Create `profiles`, `trading_accounts`, `account_memberships`, and `user_preferences`.
- Add selected account/environment handling.
- Do not migrate trading behavior yet.

Phase 2: Add append-only event ingestion

- Create `portal_events` and `session_log_entries`.
- Add idempotent server helpers for event writes.
- Mirror new Session Logs to backend while still writing browser local state.
- Keep writes best-effort for logs.

Phase 3: Migrate Journal and snapshots

- Add `journal_entries`, `journal_lifecycle_events`, `journal_memory_events`, `journal_replay_frames`, and `chart_snapshots`.
- Build a one-time browser export/import flow that reads:
  - `portal.journal`
  - `portal.journal.memoryEvents`
  - `portal.journal-setup-tags`
  - IndexedDB `portal-journal-snapshots`
- Upload snapshot assets to storage and store references.
- Preserve local IDs as `legacy_client_id` or in metadata so old Session Log and Journal memory links can be reconciled.

Phase 4: Migrate Discipline server state

- Move `.portal/discipline-state.json` into `discipline_rule_sets`, `discipline_rules`, `discipline_rule_states`, and `discipline_tracking`.
- Move `.portal/override-bond-ledger.json` into `override_bond_events`.
- Keep current `/api/discipline/state` contract initially, but swap its storage adapter from file to database.
- Validate that existing execution routes still gate against server-authoritative state.

Phase 5: Persist Magic Trade rules without backend runtime

- Migrate `portal.tag-along-rules`, `portal.tag-along-execution-records`, and `portal.magic-trade-market-uses`.
- Rules remain browser-runtime with `runtime_owner = browser`.
- Trigger/execution records become durable so future backend runtime can replay state and avoid duplicate executions.

Phase 6: Persist Baseline Imports and Diagnosis memory

- Migrate `portal.baseline-import` into baseline tables and keep imported history separate from native Journal.
- Persist AI warning events, behavioral signals, Diagnosis snapshots, and recommended plans.
- Keep deterministic derivation. Backend persistence should not imply external AI or fake certainty.

Migration mechanics:

- Add a versioned local export payload shape: `portal_local_export_v1`.
- Include `wallet_address`, `environment`, `exported_at`, and all storage keys present.
- Make imports idempotent by mapping local IDs to backend IDs in a `migration_mappings` table or metadata.
- After successful migration, mark the browser state as migrated but do not immediately delete it. Let demo reset tooling still clear local state.
- Provide a private-beta admin/dev route to inspect migration counts by table.

## Beta-Critical Persistence

Must become durable before private beta:

- User/account/environment scope.
- Server-authoritative Discipline state, including rule configs, rule states, locks, overrides, cooldown/session tracking, no-trade windows, protection requirements, and sync source/intent.
- Native Journal entries and lifecycle events for confirmed trades.
- Session Logs for confirmed trade actions, Magic Trade events, Discipline events, AI warning events, and Override Bond simulation events.
- Magic Trade saved rules, armed/disarmed state, trigger records, and fired-rule history, while keeping runtime in-browser.
- Override Bond simulation ledger.
- Baseline imports as separate AI Coach context sources.
- AI warning shown/dismissed/respected/ignored events.
- Diagnosis snapshots and reviewed/activated Discipline plans.
- Chart snapshot metadata and storage references for Journal replay/review.
- Idempotency keys and correlation IDs across trading routes.
- RLS or equivalent account-scoped access controls.

## Can Wait Until Later

Can remain local-only or deferred after beta:

- `portal.footer-tab` and other transient UI preferences.
- Draft command text, temporary composer state, hover state, selected modal tabs, and chart interaction state.
- Full backend Magic Trade runtime/worker.
- Real Override Bond USDC settlement and payout accounting.
- Multi-user collaborative accounts beyond a simple owner membership model.
- Full audit UI for every raw event.
- Advanced analytics warehouse, leaderboards, or public benchmarks.
- External AI memory/vector search.
- Full raw Hyperliquid archival storage if normalized imports and source metadata are enough for beta.
- Offline-first bidirectional sync. Private beta can use server-first reads with a limited migration/import flow.

What can stay local for V1 demo:

- All current browser storage keys.
- IndexedDB snapshot blobs.
- `.portal/discipline-state.json` and `.portal/override-bond-ledger.json`.
- Demo reset tooling and same-origin browser reset page.
- Testnet-only local execution flow.

## Risks / Open Questions

- Auth and wallet ownership: Portal needs a clear private-beta answer for how a user proves or selects a wallet address. Read-only public wallet imports are different from authenticated account ownership.
- Live vs testnet separation: every table and API must scope by `environment`; leaking testnet Discipline state into live would be unacceptable.
- Logging coupling: Session Log writes must remain best-effort and should not break successful execution flows.
- Discipline availability: risk-increasing routes should fail closed if durable Discipline state cannot be loaded, but risk-reducing emergency actions should remain available.
- Magic Trade handoff: browser-runtime persisted rules must include enough idempotency and runtime ownership metadata for a future backend worker to avoid duplicate execution.
- Snapshot storage cost/privacy: chart snapshots may reveal sensitive positions, account behavior, and strategy. Storage access must be private by default.
- Baseline privacy: imported Hyperliquid history can expose wallet behavior. Imported rows must stay account-scoped and separate from native Journal.
- Migration reconciliation: local IDs, session log IDs, replay frame keys, and exchange IDs need deterministic mapping or old review surfaces will lose links.
- Supabase fit: Supabase/Postgres is the best beta default, but final selection should confirm auth model, RLS needs, storage limits, expected event volume, backup/export requirements, and local development workflow.

## Recommended Next Build Step

Create a persistence foundation spec for Supabase/Postgres only: schema migrations for `profiles`, `trading_accounts`, `portal_events`, and `session_log_entries`, plus a small Next.js server-only persistence adapter and tests proving account/environment scoping and idempotent event writes.
