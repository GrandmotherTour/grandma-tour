import type { CandidateWithContext } from '../types/recommendation';
import type { PreferenceTag } from '../types/preference';

export const filterStrongRejectedCandidates = (
  candidates: CandidateWithContext[],
  strongRejectTags: PreferenceTag[]
) => {
  return candidates.filter((candidate) => {
    return !candidate.tags.some((tag) => strongRejectTags.includes(tag));
  });
};

export const feasibilityFilter = {
  filter: filterStrongRejectedCandidates
};
