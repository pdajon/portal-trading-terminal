import type {
  SoulEscalationState,
  SoulRecommendation,
  SoulRecommendationAction,
} from "./soul-types";

const REPEATED_DISMISSAL_THRESHOLD = 3;
const REPEATED_IGNORED_WARNING_THRESHOLD = 2;

export function createSoulRecommendation(
  recommendation: Omit<SoulRecommendation, "accepted" | "dismissalCount" | "showLessMode" | "snoozed"> &
    Partial<Pick<SoulRecommendation, "accepted" | "dismissalCount" | "showLessMode" | "snoozed">>,
): SoulRecommendation {
  return {
    accepted: false,
    dismissalCount: 0,
    showLessMode: false,
    snoozed: false,
    ...recommendation,
  };
}

export function updateSoulRecommendation(
  recommendation: SoulRecommendation,
  action: SoulRecommendationAction,
): SoulRecommendation {
  if (action.action === "dismiss") {
    return {
      ...recommendation,
      dismissalCount: recommendation.dismissalCount + 1,
      snoozed: false,
    };
  }

  if (action.action === "show_less") {
    return {
      ...recommendation,
      showLessMode: true,
    };
  }

  if (action.action === "snooze") {
    return {
      ...recommendation,
      snoozed: action.snoozed ?? true,
    };
  }

  return {
    ...recommendation,
    accepted: true,
    snoozed: false,
  };
}

export function deriveSoulEscalation(input: {
  ignoredWarningCount?: number;
  recommendations: SoulRecommendation[];
}): SoulEscalationState {
  const repeatedDismissals = input.recommendations.some(
    (recommendation) => recommendation.dismissalCount >= REPEATED_DISMISSAL_THRESHOLD,
  );
  const repeatedIgnoredWarnings = (input.ignoredWarningCount ?? 0) >= REPEATED_IGNORED_WARNING_THRESHOLD;
  const showWarningsLess = input.recommendations.some((recommendation) => recommendation.showLessMode);
  const evidenceRecap = input.recommendations
    .filter(
      (recommendation) =>
        recommendation.dismissalCount > 0 || recommendation.showLessMode || recommendation.accepted,
    )
    .map((recommendation) => recommendation.evidence.summary)
    .join(" ");

  return {
    evidenceRecap,
    repeatedDismissals,
    repeatedIgnoredWarnings,
    showWarningsLess,
  };
}
