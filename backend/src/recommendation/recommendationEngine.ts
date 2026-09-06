import type { CourseCandidate, CourseSearchRequest } from '../types/recommendation';
import type { SwipeFeedback } from '../types/preference';
import type { SeoulContext, WeatherContext } from '../types/normalized';
import { collectCandidates } from './candidateCollector';
import { filterStrongRejectedCandidates } from './feasibilityFilter';
import { calculatePreferenceWeights } from './preferenceScorer';
import { buildCoursesWithBeamSearch } from './routeBuilder';

type RecommendationEngineInput = Omit<CourseSearchRequest, 'candidates'> & {
  swipeFeedbacks: SwipeFeedback[];
  kakaoItems?: unknown[];
  tourItems?: unknown[];
  manualCandidates?: unknown[];
  weather?: WeatherContext;
  seoul?: SeoulContext;
  currentTime?: Date;
};

export const generateRecommendations = async (input: RecommendationEngineInput): Promise<CourseCandidate[]> => {
  const preferenceResult = calculatePreferenceWeights(input.swipeFeedbacks);
  const candidates = await collectCandidates({
    kakaoItems: input.kakaoItems,
    tourItems: input.tourItems,
    manualCandidates: input.manualCandidates,
    weather: input.weather,
    seoul: input.seoul
  });
  const filteredCandidates = filterStrongRejectedCandidates(candidates, preferenceResult.strongRejectTags);

  return buildCoursesWithBeamSearch(
    {
      currentLocation: input.currentLocation,
      nextScheduleTime: input.nextScheduleTime,
      nextScheduleLocation: input.nextScheduleLocation,
      peopleCount: input.peopleCount,
      transportMode: input.transportMode,
      candidates: filteredCandidates
    },
    {
      preferenceWeights: preferenceResult.weights,
      strongRejectTags: preferenceResult.strongRejectTags,
      currentTime: input.currentTime
    }
  );
};

export const recommendationEngine = {
  generate: generateRecommendations
};
