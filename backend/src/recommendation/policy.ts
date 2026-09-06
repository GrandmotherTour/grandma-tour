import type { PreferenceTag } from '../types/preference';

export const preferenceTags: PreferenceTag[] = [
  'cafe',
  'food',
  'nature',
  'culture',
  'history',
  'activity'
];

export const preferencePolicy = {
  smoothingExposure: 1,
  strongRejectMinExposure: 3,
  strongRejectRatio: 0.8,
  multiTagAggregation: 'average' as const
};

export const courseScoreWeights = {
  deadlineSafety: 0.40,
  preferenceMatch: 0.25,
  routeEfficiency: 0.15,
  context: 0.10,
  groupSuitability: 0.05,
  dataQuality: 0.05
};

export const courseSearchPolicy = {
  beamWidth: 5,
  globalSafetyBufferMinutes: 5,
  pointBufferMinutes: 5,
  maxDepthByUsableMinutes: [
    { maxUsableMinutes: 120, maxDepth: 3 },
    { maxUsableMinutes: 180, maxDepth: 4 },
    { maxUsableMinutes: 300, maxDepth: 5 },
    { maxUsableMinutes: Number.POSITIVE_INFINITY, maxDepth: 6 }
  ]
};

export const deadlinePolicy = {
  arrivalBufferMinutes: {
    walk: 15,
    car: 25
  },
  minimumSafeSlackMinutes: {
    walk: 10,
    car: 20
  },
  targetSlackMinutes: {
    walk: 20,
    car: 35
  }
};

export const stayTimePolicy: Record<PreferenceTag, {
  defaultMinutes: number;
  minMinutes: number;
  maxMinutes: number;
}> = {
  cafe: { defaultMinutes: 40, minMinutes: 30, maxMinutes: 50 },
  food: { defaultMinutes: 60, minMinutes: 50, maxMinutes: 75 },
  nature: { defaultMinutes: 45, minMinutes: 30, maxMinutes: 70 },
  culture: { defaultMinutes: 75, minMinutes: 60, maxMinutes: 100 },
  history: { defaultMinutes: 60, minMinutes: 40, maxMinutes: 90 },
  activity: { defaultMinutes: 90, minMinutes: 70, maxMinutes: 120 }
};

export const travelAdjustmentPolicy = {
  baseSpeedKmh: {
    walk: 4.2,
    carFallbackUrbanMin: 18,
    carFallbackUrbanMax: 25,
    carFallbackUrbanDefault: 22
  },
  congestion: {
    relaxed: 1.0,
    normal: 1.05,
    crowded: 1.15,
    veryCrowded: 1.30
  },
  traffic: {
    smooth: 1.0,
    slow: 1.20,
    jammed: 1.45,
    unknownUrban: 1.20
  },
  weather: {
    walk: {
      clear: 1.0,
      lightRain: 1.10,
      rainOrSnow: 1.25,
      severe: 1.40
    },
    car: {
      clear: 1.0,
      lightRain: 1.08,
      rainOrSnow: 1.18,
      severe: 1.30
    }
  },
  people: {
    one: 1.0,
    two: 1.03,
    threeToFour: 1.08,
    fivePlus: 1.15
  },
  transportRisk: {
    walkDefault: 1.0,
    walkLongDistance: 1.10,
    carDefault: 1.0,
    carNoParkingHint: 1.10,
    carCrowdedDestination: 1.15,
    carJammedNoParkingHint: 1.25
  },
  riskPenalty: {
    trafficDelay: {
      smooth: 0,
      slow: 0.10,
      jammed: 0.25,
      unknownUrban: 0.10
    },
    weatherDelay: {
      clear: 0,
      lightRain: 0.10,
      rainOrSnow: 0.15,
      severe: 0.20
    },
    congestionDelay: {
      relaxed: 0,
      normal: 0.03,
      crowded: 0.08,
      veryCrowded: 0.15
    },
    peopleDelayFivePlus: 0.10,
    tooManyStops: 0.05
  }
};
