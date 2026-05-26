import { getSoulLevelForExp } from "./soul-exp";
import type {
  SoulEvolutionStage,
  SoulEvolutionState,
  SoulMemory,
  SoulObservationType,
} from "./soul-types";

function getStage(level: number): SoulEvolutionStage {
  if (level >= 5) {
    return "hardened";
  }

  if (level >= 3) {
    return "stabilizing";
  }

  if (level >= 2) {
    return "forming";
  }

  return "dormant";
}

function getDominantPattern(memory: SoulMemory): SoulObservationType | null {
  const [dominant] = [...memory.repeatedHarmfulPatterns].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return new Date(right.lastObservedAt).getTime() - new Date(left.lastObservedAt).getTime();
  });

  return dominant?.type ?? null;
}

export function createInitialSoulEvolutionState(createdAt: string): SoulEvolutionState {
  return {
    dominantPattern: null,
    level: 1,
    stage: "dormant",
    unlockedRewards: [],
    updatedAt: createdAt,
  };
}

export function updateSoulEvolutionState(
  state: SoulEvolutionState,
  input: {
    expTotal: number;
    memory: SoulMemory;
    updatedAt: string;
  },
): SoulEvolutionState {
  const level = getSoulLevelForExp(input.expTotal).level;

  return {
    ...state,
    dominantPattern: getDominantPattern(input.memory),
    level,
    stage: getStage(level),
    unlockedRewards: [],
    updatedAt: input.updatedAt,
  };
}
