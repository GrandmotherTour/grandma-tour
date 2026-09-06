import type { EnrichedCandidate, JaturipPlace, SeoulContext, WeatherContext } from '../types/normalized';

export const enrichCandidatesWithContext = (
  places: JaturipPlace[],
  context: { weather?: WeatherContext; seoul?: SeoulContext } = {}
): EnrichedCandidate[] => {
  return places.map((place) => ({
    place,
    context
  }));
};
