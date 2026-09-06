import type { PreferenceTag, UserPreferenceWeights } from '../types/preference';
import { preferencePolicy, stayTimePolicy } from './policy';

export const getPolicyStayTime = (tags: PreferenceTag[], weights?: UserPreferenceWeights) => {
  const policies = tags.map((tag) => stayTimePolicy[tag]);
  const defaultMinutes = policies.reduce((sum, policy) => sum + policy.defaultMinutes, 0) / policies.length;
  const minMinutes = policies.reduce((sum, policy) => sum + policy.minMinutes, 0) / policies.length;
  const maxMinutes = policies.reduce((sum, policy) => sum + policy.maxMinutes, 0) / policies.length;

  if (!weights) {
    return Math.round(defaultMinutes);
  }

  const preference = tags.reduce((sum, tag) => sum + weights[tag], 0) / tags.length;

  if (preferencePolicy.multiTagAggregation === 'average' && preference >= 0.6) {
    return Math.round((defaultMinutes + maxMinutes) / 2);
  }

  if (preference < 0) {
    return Math.round(minMinutes);
  }

  return Math.round(defaultMinutes);
};

export const stayTimePolicyManager = {
  getPolicyStayTime
};
