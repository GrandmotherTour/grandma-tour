import type { PreferenceTag } from './preference';

export type NormalizedCategory = PreferenceTag | 'unmapped';

export type OriginalCategory = {
  main?: string | null;
  middle?: string | null;
  detail?: string | null;
  raw?: string | null;
};

export type DataQuality = {
  hasCoordinates: boolean;
  hasAddress: boolean;
  hasImage: boolean;
  hasCategory: boolean;
  hasDetailUrl: boolean;
};

export type JaturipPlace = {
  id: string;
  source: 'kakao' | 'tourApi';
  sourceId: string;
  name: string;
  category: NormalizedCategory;
  originalCategory?: OriginalCategory;
  lat: number | null;
  lng: number | null;
  address?: string | null;
  roadAddress?: string | null;
  imageUrl?: string | null;
  detailUrl?: string | null;
  phone?: string | null;
  indoorOutdoor?: 'indoor' | 'outdoor' | 'mixed' | 'unknown';
  policyStayTime?: number;
  dataQuality?: DataQuality;
  rawSource?: unknown;
};

export type WeatherContext = {
  temperature?: number | null;
  precipitationProbability?: number | null;
  precipitationType?: 'none' | 'rain' | 'snow' | 'rainSnow' | 'unknown';
  precipitationAmount?: number | null;
  skyCondition?: 'clear' | 'cloudy' | 'overcast' | 'unknown';
  windSpeed?: number | null;
  observedAt?: string | null;
  rawSource?: unknown;
};

export type SeoulContext = {
  areaName?: string | null;
  congestionLevel?: 'relaxed' | 'normal' | 'crowded' | 'veryCrowded' | 'unknown';
  roadTraffic?: {
    averageSpeed?: number | null;
    trafficLevel?: 'smooth' | 'slow' | 'congested' | 'unknown';
  };
  events?: Array<{
    name: string;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
  }>;
  observedAt?: string | null;
  rawSource?: unknown;
};

export type EnrichedCandidate = {
  place: JaturipPlace;
  context: {
    weather?: WeatherContext;
    seoul?: SeoulContext;
  };
};
