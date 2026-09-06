import type {
  NextSchedule,
  PreferenceTag,
  RecommendationResponse,
  TransportMode,
  TripLocation
} from '../types/recommendation';

const STORAGE_KEY = 'jaturip.tripState.v2';

export type TripState = {
  currentLocation: TripLocation | null;
  nextSchedule: NextSchedule;
  partySize: number;
  transportMode: TransportMode;
  preferences: PreferenceTag[];
  recommendation: RecommendationResponse | null;
};

export const defaultTripState: TripState = {
  currentLocation: null,
  nextSchedule: {
    name: '',
    time: ''
  },
  partySize: 1,
  transportMode: 'walk',
  preferences: [],
  recommendation: null
};

const readStoredState = (): TripState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultTripState, ...JSON.parse(raw) } : defaultTripState;
  } catch {
    return defaultTripState;
  }
};

export const tripStore: TripState = readStoredState();

export const updateTripStore = (nextState: Partial<TripState>) => {
  Object.assign(tripStore, nextState);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tripStore));
};

export const resetRecommendation = () => {
  updateTripStore({ preferences: [], recommendation: null });
};
