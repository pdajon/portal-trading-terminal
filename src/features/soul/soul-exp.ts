import type {
  SoulExpActionType,
  SoulExpEvent,
  SoulExpState,
  SoulLevelProgress,
} from "./soul-types";

const EXP_WEIGHTS: Record<SoulExpActionType, number> = {
  cooldown_respected: 12,
  harmful_pattern_repeated: -8,
  impulse_avoided: 15,
  journaled_trade_recorded: 8,
  magic_trade_used: 16,
  protected_trade_taken: 10,
  rule_accepted: 25,
  trade_execution_logged: 10,
};

const LEVEL_THRESHOLDS = [0, 50, 100, 250, 500, 1000];

export function getSoulExpForEvent(event: SoulExpEvent): number {
  return EXP_WEIGHTS[event.type] * (event.weight ?? 1);
}

export function getSoulLevelForExp(exp: number): SoulLevelProgress {
  const normalizedExp = Math.max(0, exp);
  let level = 1;

  LEVEL_THRESHOLDS.forEach((threshold, index) => {
    if (normalizedExp >= threshold) {
      level = index + 1;
    }
  });

  return {
    currentLevelExp: LEVEL_THRESHOLDS[level - 1],
    level,
    nextLevelExp: LEVEL_THRESHOLDS[level] ?? null,
  };
}

export function createInitialSoulExpState(createdAt: string): SoulExpState {
  return {
    events: [],
    level: 1,
    totalExp: 0,
    updatedAt: createdAt,
  };
}

export function applySoulExpEvent(state: SoulExpState, event: SoulExpEvent): SoulExpState {
  const eventExp = getSoulExpForEvent(event);
  const totalExp = Math.max(0, state.totalExp + eventExp);

  return {
    events: [...state.events, { ...event, exp: eventExp }],
    level: getSoulLevelForExp(totalExp).level,
    totalExp,
    updatedAt: event.occurredAt,
  };
}
