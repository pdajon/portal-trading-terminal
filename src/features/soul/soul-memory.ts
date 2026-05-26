import type {
  SoulAcceptedRule,
  SoulMemory,
  SoulObservation,
  SoulObservationType,
  SoulPatternMemory,
  SoulRecommendationType,
} from "./soul-types";

export function createInitialSoulMemory(createdAt: string): SoulMemory {
  return {
    acceptedRules: [],
    createdAt,
    dismissedRecommendations: [],
    repeatedHarmfulPatterns: [],
    triggeredObservations: [],
    updatedAt: createdAt,
  };
}

function upsertPattern(
  patterns: SoulPatternMemory[],
  type: SoulObservationType,
  observedAt: string,
): SoulPatternMemory[] {
  const existing = patterns.find((pattern) => pattern.type === type);

  if (!existing) {
    return [...patterns, { count: 1, lastObservedAt: observedAt, type }];
  }

  return patterns.map((pattern) =>
    pattern.type === type
      ? {
          ...pattern,
          count: pattern.count + 1,
          lastObservedAt: observedAt,
        }
      : pattern,
  );
}

export function recordTriggeredSoulObservation(
  memory: SoulMemory,
  observation: SoulObservation,
): SoulMemory {
  return {
    ...memory,
    repeatedHarmfulPatterns: upsertPattern(
      memory.repeatedHarmfulPatterns,
      observation.type,
      observation.createdAt,
    ),
    triggeredObservations: [...memory.triggeredObservations, observation],
    updatedAt: observation.createdAt,
  };
}

export function recordDismissedSoulRecommendation(
  memory: SoulMemory,
  recommendationId: string,
  dismissedAt: string,
  recommendationType?: SoulRecommendationType,
): SoulMemory {
  const existing = memory.dismissedRecommendations.find((recommendation) =>
    recommendationType
      ? recommendation.recommendationType === recommendationType
      : recommendation.id === recommendationId,
  );
  const shouldUpdateRecommendation = (recommendation: SoulMemory["dismissedRecommendations"][number]) =>
    recommendationType
      ? recommendation.recommendationType === recommendationType
      : recommendation.id === recommendationId;

  return {
    ...memory,
    dismissedRecommendations: existing
      ? memory.dismissedRecommendations.map((recommendation) =>
          shouldUpdateRecommendation(recommendation)
            ? {
                ...recommendation,
                dismissalCount: recommendation.dismissalCount + 1,
                id: recommendationId,
                lastDismissedAt: dismissedAt,
                recommendationType: recommendationType ?? recommendation.recommendationType,
              }
            : recommendation,
        )
      : [
          ...memory.dismissedRecommendations,
          {
            dismissalCount: 1,
            id: recommendationId,
            lastDismissedAt: dismissedAt,
            recommendationType,
          },
        ],
    updatedAt: dismissedAt,
  };
}

export function getSoulRecommendationDismissalCount(
  memory: SoulMemory,
  recommendationId: string,
  recommendationType?: SoulRecommendationType,
) {
  const dismissed = memory.dismissedRecommendations.find((recommendation) =>
    recommendationType
      ? recommendation.recommendationType === recommendationType
      : recommendation.id === recommendationId,
  );

  return dismissed?.dismissalCount ?? 0;
}

export function recordSoulRecommendationReducedFrequency(
  memory: SoulMemory,
  recommendationType: SoulRecommendationType,
  updatedAt: string,
): SoulMemory {
  const existing = memory.dismissedRecommendations.find(
    (recommendation) => recommendation.recommendationType === recommendationType,
  );

  return {
    ...memory,
    dismissedRecommendations: existing
      ? memory.dismissedRecommendations.map((recommendation) =>
          recommendation.recommendationType === recommendationType
            ? {
                ...recommendation,
                reducedFrequency: true,
              }
            : recommendation,
        )
      : [
          ...memory.dismissedRecommendations,
          {
            dismissalCount: 0,
            id: `recommendation-type:${recommendationType}`,
            lastDismissedAt: updatedAt,
            recommendationType,
            reducedFrequency: true,
          },
        ],
    updatedAt,
  };
}

export function hasSoulRecommendationReducedFrequency(
  memory: SoulMemory,
  recommendationType: SoulRecommendationType,
) {
  return memory.dismissedRecommendations.some(
    (recommendation) =>
      recommendation.recommendationType === recommendationType &&
      recommendation.reducedFrequency === true,
  );
}

export function recordAcceptedSoulRule(memory: SoulMemory, rule: SoulAcceptedRule): SoulMemory {
  return {
    ...memory,
    acceptedRules: [...memory.acceptedRules, rule],
    updatedAt: rule.acceptedAt,
  };
}
