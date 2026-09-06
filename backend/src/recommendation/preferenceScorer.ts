import type {
  PreferenceScoringResult,
  PreferenceStats,
  PreferenceTag,
  SwipeFeedback,
  UserPreferenceWeights
} from '../types/preference';
import { preferencePolicy, preferenceTags } from './policy';

const createEmptyStats = (): Record<PreferenceTag, PreferenceStats> => {
  return preferenceTags.reduce((acc, tag) => {
    acc[tag] = {
      exposureCount: 0,
      likeCount: 0,
      dislikeCount: 0,
      preferenceWeight: 0,
      strongReject: false
    };
    return acc;
  }, {} as Record<PreferenceTag, PreferenceStats>);
};

export const calculatePreferenceWeights = (feedbacks: SwipeFeedback[]): PreferenceScoringResult => {
  const stats = createEmptyStats();

  for (const feedback of feedbacks) {
    for (const tag of feedback.tags) {
      stats[tag].exposureCount += 1;

      if (feedback.action === 'like') {
        stats[tag].likeCount += 1;
      }

      if (feedback.action === 'dislike') {
        stats[tag].dislikeCount += 1;
      }
    }
  }

  const weights = {} as UserPreferenceWeights;
  const strongRejectTags: PreferenceTag[] = [];

  for (const tag of preferenceTags) {
    const tagStats = stats[tag];
    const exposureBase = tagStats.exposureCount + preferencePolicy.smoothingExposure;
    const dislikeRatio = tagStats.exposureCount === 0
      ? 0
      : tagStats.dislikeCount / tagStats.exposureCount;

    tagStats.preferenceWeight = (tagStats.likeCount - tagStats.dislikeCount) / exposureBase;
    tagStats.strongReject =
      tagStats.exposureCount >= preferencePolicy.strongRejectMinExposure &&
      dislikeRatio >= preferencePolicy.strongRejectRatio;

    weights[tag] = tagStats.preferenceWeight;

    if (tagStats.strongReject) {
      strongRejectTags.push(tag);
    }
  }

  return {
    weights,
    stats,
    strongRejectTags
  };
};

export const preferenceScorer = {
  calculatePreferenceWeights
};
