export type TransportMode = 'walk' | 'car';

export type PreferenceTag = 'cafe' | 'food' | 'nature' | 'culture' | 'history' | 'activity';

export type TripLocation = {
  latitude: number;
  longitude: number;
  address: string;
  placeName: string;
};

export type NextSchedule = {
  name: string;
  time: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  placeName?: string;
};

export type RecommendationRequest = {
  currentLatitude: number;
  currentLongitude: number;
  nextScheduleTime: string;
  nextScheduleLatitude: number;
  nextScheduleLongitude: number;
  peopleCount: number;
  transportMode: TransportMode;
  swipeFeedbacks: SwipeFeedback[];
  currentTime?: string;
  nextSchedule?: NextSchedule;
};

export type SwipeAction = 'like' | 'skip' | 'dislike';

export type SwipeFeedback = {
  cardId: string;
  action: SwipeAction;
  tags: PreferenceTag[];
};

export type RecommendationStop = {
  order: number;
  placeId: string;
  name: string;
  categoryTags: PreferenceTag[];
  stayMinutes: number;
  travelMinutesFromPrevious: number;
  arrivalTime: string;
  arrivalTimeLabel: string;
  leaveTime: string;
  leaveTimeLabel: string;
  slackMinutes: number;
  latitude: number;
  longitude: number;
  address?: string;
  imageUrl?: string;
};

export type RecommendedCourse = {
  id: string;
  title: string;
  summary: string;
  score: number;
  stops: RecommendationStop[];
  route: {
    currentLocation: TripLocation;
    nextSchedule: Required<Pick<NextSchedule, 'name' | 'time'>> & TripLocation;
    transportMode: 'walk' | 'car';
    partySize: number;
    nextScheduleTime: string;
    nextScheduleTimeLabel: string;
    latestArrivalAtNextSchedule: string;
    latestArrivalAtNextScheduleLabel: string;
    estimatedArrivalAtNextSchedule: string;
    estimatedArrivalAtNextScheduleLabel: string;
    finalTravelMinutes: number;
    totalTravelMinutes: number;
    totalStayMinutes: number;
    totalBufferMinutes: number;
    totalCourseMinutes: number;
    slackMinutes: number;
  };
  reasons: string[];
};

export type RecommendationResponse = {
  success: boolean;
  status: 'ok' | 'no_recommendation' | 'invalid_request' | 'next_schedule_location_not_found';
  message: string;
  data: {
    request?: RecommendationRequest;
    courses: RecommendedCourse[];
    mainCourse?: RecommendedCourse | null;
    alternatives?: RecommendedCourse[];
  };
};
