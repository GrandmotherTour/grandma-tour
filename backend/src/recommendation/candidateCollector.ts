import type { CandidateWithContext } from '../types/recommendation';
import type { JaturipPlace, SeoulContext, WeatherContext } from '../types/normalized';
import { removeDuplicatePlaces } from '../candidates/duplicateDetector';
import { enrichCandidatesWithContext } from '../candidates/contextEnricher';
import { normalizeKakaoPlaces } from '../normalizers/kakao.normalizer';
import { normalizeTourApiPlaces } from '../normalizers/tourApi.normalizer';
import { asRecord, getNumber, getString } from '../normalizers/utils';
import { preferenceTags } from './policy';

type CandidateCollectorInput = {
  kakaoItems?: unknown[];
  tourItems?: unknown[];
  manualCandidates?: unknown[];
  weather?: WeatherContext;
  seoul?: SeoulContext;
  includeRawSource?: boolean;
};

const isPreferenceTag = (value: unknown) => {
  return typeof value === 'string' && preferenceTags.includes(value as never);
};

const normalizeManualCandidate = (rawItem: unknown): CandidateWithContext | null => {
  const item = asRecord(rawItem);
  const name = getString(item, 'name');
  const latitude = getNumber(item, 'latitude') ?? getNumber(item, 'lat');
  const longitude = getNumber(item, 'longitude') ?? getNumber(item, 'lng');
  const rawTags = Array.isArray(item.tags) ? item.tags.filter(isPreferenceTag) : [];
  const rawCategory = getString(item, 'category');
  const tags = rawTags.length > 0
    ? rawTags
    : isPreferenceTag(rawCategory) ? [rawCategory] : [];

  if (!name || latitude === null || longitude === null || tags.length === 0) {
    return null;
  }

  return {
    id: getString(item, 'id') || `manual:${name}`,
    source: 'manual',
    name,
    latitude,
    longitude,
    address: getString(item, 'address') || undefined,
    imageUrl: getString(item, 'imageUrl') || undefined,
    tags,
    congestionLevel: getString(item, 'congestionLevel') as CandidateWithContext['congestionLevel'],
    trafficLevel: getString(item, 'trafficLevel') as CandidateWithContext['trafficLevel'],
    weatherLevel: getString(item, 'weatherLevel') as CandidateWithContext['weatherLevel'],
    hasParkingHint: typeof item.hasParkingHint === 'boolean' ? item.hasParkingHint : undefined
  };
};

const toAlgorithmCandidate = (
  place: JaturipPlace,
  context: { weather?: WeatherContext; seoul?: SeoulContext }
): CandidateWithContext | null => {
  if (place.lat === null || place.lng === null || place.category === 'unmapped') {
    return null;
  }

  const weatherLevel = context.weather?.precipitationType === 'rain' ||
    context.weather?.precipitationType === 'snow' ||
    context.weather?.precipitationType === 'rainSnow'
    ? 'rainOrSnow'
    : context.weather?.precipitationProbability !== null &&
      context.weather?.precipitationProbability !== undefined &&
      context.weather.precipitationProbability >= 40
      ? 'lightRain'
      : 'clear';
  const trafficLevel = context.seoul?.roadTraffic?.trafficLevel === 'congested'
    ? 'jammed'
    : context.seoul?.roadTraffic?.trafficLevel === 'slow'
      ? 'slow'
      : context.seoul?.roadTraffic?.trafficLevel === 'smooth'
        ? 'smooth'
        : undefined;

  return {
    id: place.id,
    source: place.source === 'tourApi' ? 'tour' : 'kakao',
    externalId: place.sourceId,
    name: place.name,
    latitude: place.lat,
    longitude: place.lng,
    address: place.roadAddress || place.address || undefined,
    imageUrl: place.imageUrl || undefined,
    tags: [place.category],
    congestionLevel: context.seoul?.congestionLevel === 'unknown' ? undefined : context.seoul?.congestionLevel,
    trafficLevel,
    weatherLevel
  };
};

export const collectCandidates = async (input: CandidateCollectorInput = {}): Promise<CandidateWithContext[]> => {
  const places = removeDuplicatePlaces([
    ...normalizeKakaoPlaces(input.kakaoItems || [], { includeRawSource: input.includeRawSource }),
    ...normalizeTourApiPlaces(input.tourItems || [], { includeRawSource: input.includeRawSource })
  ]);
  const enriched = enrichCandidatesWithContext(places, {
    weather: input.weather,
    seoul: input.seoul
  });
  const apiCandidates = enriched
    .map((candidate) => toAlgorithmCandidate(candidate.place, candidate.context))
    .filter((item): item is CandidateWithContext => item !== null);
  const manual = (input.manualCandidates || [])
    .map(normalizeManualCandidate)
    .filter((item): item is CandidateWithContext => item !== null);

  return [...apiCandidates, ...manual];
};

export const candidateCollector = {
  collect: collectCandidates
};
