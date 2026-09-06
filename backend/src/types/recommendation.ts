import type { PreferenceTag } from './preference';
import type { TransportMode } from './userInput';

export type RecommendationType = {
  id: string;
  title: string;
  summary?: string;
  score?: number;
  totalMinutes?: number;
  totalCost?: number;
};

export type RecommendedCourseStop = {
  order: number;
  placeId: string;
  name: string;
  categoryTags: PreferenceTag[];
  stayMinutes: number;
  latitude: number;
  longitude: number;
};

export type RecommendedCourse = RecommendationType & {
  stops: RecommendedCourseStop[];
  reasons: string[];
};

export type NormalizedCandidate = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  tags: PreferenceTag[];
  source: 'kakao' | 'tour' | 'manual';
  externalId?: string;
  imageUrl?: string;
  address?: string;
};

export type CandidateWithContext = NormalizedCandidate & {
  congestionLevel?: 'relaxed' | 'normal' | 'crowded' | 'veryCrowded';
  trafficLevel?: 'smooth' | 'slow' | 'jammed' | 'unknownUrban';
  weatherLevel?: 'clear' | 'lightRain' | 'rainOrSnow' | 'severe';
  hasParkingHint?: boolean;
};

export type CoursePoint = CandidateWithContext & {
  policyStayTime: number;
  preferenceScore: number;
};

export type ScheduledCoursePoint = CoursePoint & {
  order: number;
  adjustedTravelTimeFromPrevious: number;
  latestArrivalTime: Date;
  latestLeaveTime: Date;
  estimatedArrivalTime: Date;
  estimatedLeaveTime: Date;
  slackMinutes: number;
};

export type CourseSearchRequest = {
  currentLocation: { latitude: number; longitude: number };
  nextScheduleTime: Date;
  nextScheduleLocation?: { latitude: number; longitude: number };
  peopleCount: number;
  transportMode: TransportMode;
  candidates: CandidateWithContext[];
};

export type CourseCandidate = {
  points: ScheduledCoursePoint[];
  pointCount: number;
  totalAdjustedTravelMinutes: number;
  finalTravelMinutes: number;
  totalStayMinutes: number;
  totalBufferMinutes: number;
  totalCourseMinutes: number;
  minimumSlackMinutes: number;
  estimatedArrivalAtNextSchedule: Date;
  latestArrivalAtNextSchedule: Date;
  deadlineSafe: boolean;
  score?: number;
  scoreBreakdown?: CourseScoreBreakdown;
};

export type CourseScoreBreakdown = {
  adjustedDeadlineSafetyScore: number;
  preferenceMatchScore: number;
  routeEfficiencyScore: number;
  contextScore: number;
  groupSuitabilityScore: number;
  dataQualityScore: number;
};

export type TravelContext = {
  transportMode: TransportMode;
  peopleCount: number;
  distanceKm: number;
  congestionLevel?: CandidateWithContext['congestionLevel'];
  trafficLevel?: CandidateWithContext['trafficLevel'];
  weatherLevel?: CandidateWithContext['weatherLevel'];
  hasParkingHint?: boolean;
};
