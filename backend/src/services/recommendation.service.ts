import { kakaoLocalApi } from '../external/kakao/kakaoLocal.api.js';
import { generateRecommendations } from '../recommendation/recommendationEngine';
import type { CourseCandidate, ScheduledCoursePoint } from '../types/recommendation';
import type { SwipeFeedback } from '../types/preference';
import type { SeoulContext, WeatherContext } from '../types/normalized';
import type { TransportMode } from '../types/userInput';

type LocationPayload = {
  latitude: number;
  longitude: number;
  address?: string;
  placeName?: string;
  name?: string;
};

type NextSchedulePayload = {
  name: string;
  time: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  placeName?: string;
};

type RecommendationPayload = {
  currentLocation?: LocationPayload;
  nextSchedule?: NextSchedulePayload;
  partySize?: number;
  transportMode?: TransportMode | 'walking';
  preferences?: string[];
  swipeFeedbacks?: SwipeFeedback[];
  kakaoItems?: unknown[];
  tourItems?: unknown[];
  manualCandidates?: unknown[];
  weather?: WeatherContext;
  seoul?: SeoulContext;
  currentTime?: string;
  currentLatitude?: number;
  currentLongitude?: number;
  nextScheduleTime?: string;
  nextScheduleLatitude?: number;
  nextScheduleLongitude?: number;
  peopleCount?: number;
};

const KAKAO_CATEGORY_CODES = ['CE7', 'FD6', 'CT1', 'AT4'];

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const toTransportMode = (value: RecommendationPayload['transportMode']): TransportMode | null => {
  if (value === 'walking' || value === 'walk') return 'walk';
  if (value === 'car') return 'car';
  return null;
};

const parseNextScheduleTime = (time: string, currentTime: Date) => {
  if (time.includes('T')) {
    return new Date(time);
  }

  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(currentTime);
  next.setHours(hours, minutes || 0, 0, 0);

  if (next.getTime() <= currentTime.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
};

const getLocationName = (location?: LocationPayload | NextSchedulePayload) => {
  return location?.placeName || location?.name || location?.address || '';
};

const toSwipeFeedbacks = (payload: RecommendationPayload): SwipeFeedback[] => {
  if (Array.isArray(payload.swipeFeedbacks)) {
    return payload.swipeFeedbacks;
  }

  if (!Array.isArray(payload.preferences)) {
    return [];
  }

  return payload.preferences.map((tag, index) => ({
    cardId: `${tag}-${index}`,
    action: 'like',
    tags: [tag]
  })) as SwipeFeedback[];
};

const resolveNextScheduleLocation = async (
  nextSchedule: NextSchedulePayload | undefined,
  fallbackLatitude: number | undefined,
  fallbackLongitude: number | undefined,
  currentLocation: LocationPayload
) => {
  if (isNumber(nextSchedule?.latitude) && isNumber(nextSchedule?.longitude)) {
    return {
      latitude: nextSchedule.latitude,
      longitude: nextSchedule.longitude,
      address: nextSchedule.address,
      placeName: nextSchedule.placeName || nextSchedule.name
    };
  }

  if (isNumber(fallbackLatitude) && isNumber(fallbackLongitude)) {
    return {
      latitude: fallbackLatitude,
      longitude: fallbackLongitude,
      address: nextSchedule?.address,
      placeName: nextSchedule?.placeName || nextSchedule?.name
    };
  }

  if (nextSchedule?.name?.trim()) {
    const searchResult = await kakaoLocalApi.searchByKeyword(nextSchedule.name, {
      x: currentLocation.longitude,
      y: currentLocation.latitude,
      radius: 20_000,
      sort: 'distance',
      size: 1
    });
    const first = searchResult.documents?.[0];

    if (first?.x && first?.y) {
      return {
        latitude: Number(first.y),
        longitude: Number(first.x),
        address: first.road_address_name || first.address_name || nextSchedule.address,
        placeName: first.place_name || nextSchedule.name
      };
    }
  }

  return null;
};

const collectNearbyKakaoItems = async (currentLocation: LocationPayload) => {
  const results = await Promise.all(
    KAKAO_CATEGORY_CODES.map((code) =>
      kakaoLocalApi.searchByCategory(code, {
        x: currentLocation.longitude,
        y: currentLocation.latitude,
        radius: 5_000
      })
    )
  );

  return results.flatMap((result) => result.documents || []);
};

const toTimeLabel = (date: Date) => {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul'
  }).format(date);
};

const toStopResponse = (point: ScheduledCoursePoint) => ({
  order: point.order,
  placeId: point.id,
  name: point.name,
  categoryTags: point.tags,
  stayMinutes: point.policyStayTime,
  travelMinutesFromPrevious: point.adjustedTravelTimeFromPrevious,
  arrivalTime: point.estimatedArrivalTime.toISOString(),
  arrivalTimeLabel: toTimeLabel(point.estimatedArrivalTime),
  leaveTime: point.estimatedLeaveTime.toISOString(),
  leaveTimeLabel: toTimeLabel(point.estimatedLeaveTime),
  slackMinutes: point.slackMinutes,
  latitude: point.latitude,
  longitude: point.longitude,
  address: point.address,
  imageUrl: point.imageUrl
});

const toCourseResponse = (
  course: CourseCandidate,
  index: number,
  request: {
    currentLocation: LocationPayload;
    nextSchedule: Required<Pick<NextSchedulePayload, 'name' | 'time'>> & LocationPayload;
    transportMode: TransportMode;
    partySize: number;
  }
) => ({
  id: `course-${index + 1}`,
  title: index === 0 ? '다음 일정 전 추천 코스' : `대안 코스 ${index + 1}`,
  summary: course.pointCount > 0
    ? `${course.pointCount}곳을 들르고 다음 일정 ${toTimeLabel(new Date(request.nextSchedule.time))} 전에 도착하는 코스입니다.`
    : '다음 일정까지 안전하게 들를 수 있는 장소가 없습니다.',
  score: course.score || 0,
  stops: course.points.map(toStopResponse),
  route: {
    currentLocation: request.currentLocation,
    nextSchedule: request.nextSchedule,
    transportMode: request.transportMode,
    partySize: request.partySize,
    nextScheduleTime: request.nextSchedule.time,
    nextScheduleTimeLabel: toTimeLabel(new Date(request.nextSchedule.time)),
    latestArrivalAtNextSchedule: course.latestArrivalAtNextSchedule.toISOString(),
    latestArrivalAtNextScheduleLabel: toTimeLabel(course.latestArrivalAtNextSchedule),
    estimatedArrivalAtNextSchedule: course.estimatedArrivalAtNextSchedule.toISOString(),
    estimatedArrivalAtNextScheduleLabel: toTimeLabel(course.estimatedArrivalAtNextSchedule),
    finalTravelMinutes: course.finalTravelMinutes,
    totalTravelMinutes: course.totalAdjustedTravelMinutes,
    totalStayMinutes: course.totalStayMinutes,
    totalBufferMinutes: course.totalBufferMinutes,
    totalCourseMinutes: course.totalCourseMinutes,
    slackMinutes: course.minimumSlackMinutes
  },
  reasons: [
    '다음 일정 도착 시간을 먼저 만족하는 코스만 골랐습니다.',
    `이동수단 ${request.transportMode === 'walk' ? '도보' : '차량'} 기준 이동 시간을 반영했습니다.`,
    `인원 ${request.partySize}명을 추천 요청에 포함했습니다.`
  ],
  scoreBreakdown: course.scoreBreakdown
});

export const recommendationService = {
  buildRecommendation: async (payload: unknown) => {
    const body = payload as RecommendationPayload;
    const currentLocation = body.currentLocation || (
      isNumber(body.currentLatitude) && isNumber(body.currentLongitude)
        ? { latitude: body.currentLatitude, longitude: body.currentLongitude }
        : undefined
    );
    const partySize = body.partySize ?? body.peopleCount;
    const transportMode = toTransportMode(body.transportMode);
    const currentTime = body.currentTime ? new Date(body.currentTime) : new Date();
    const rawNextScheduleTime = body.nextSchedule?.time || body.nextScheduleTime;

    if (!currentLocation || !isNumber(currentLocation.latitude) || !isNumber(currentLocation.longitude) ||
      !rawNextScheduleTime || !isNumber(partySize) || !transportMode) {
      return {
        success: false,
        status: 'invalid_request',
        message: 'currentLocation, nextSchedule.time, partySize, transportMode are required.',
        data: { courses: [] }
      };
    }

    const nextScheduleTime = parseNextScheduleTime(rawNextScheduleTime, currentTime);
    const nextScheduleLocation = await resolveNextScheduleLocation(
      body.nextSchedule,
      body.nextScheduleLatitude,
      body.nextScheduleLongitude,
      currentLocation
    );

    if (!nextScheduleLocation) {
      return {
        success: false,
        status: 'next_schedule_location_not_found',
        message: '다음 일정 장소의 좌표를 찾을 수 없습니다.',
        data: { courses: [] }
      };
    }

    const kakaoItems = body.kakaoItems || await collectNearbyKakaoItems(currentLocation);
    const recommendations = await generateRecommendations({
      currentLocation: {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      },
      nextScheduleTime,
      nextScheduleLocation: {
        latitude: nextScheduleLocation.latitude,
        longitude: nextScheduleLocation.longitude
      },
      peopleCount: partySize,
      transportMode,
      swipeFeedbacks: toSwipeFeedbacks(body),
      kakaoItems,
      tourItems: body.tourItems,
      manualCandidates: body.manualCandidates,
      weather: body.weather,
      seoul: body.seoul,
      currentTime
    });

    const request = {
      currentLocation: {
        ...currentLocation,
        placeName: getLocationName(currentLocation) || '현재 위치'
      },
      nextSchedule: {
        name: body.nextSchedule?.name || getLocationName(nextScheduleLocation) || '다음 일정',
        time: nextScheduleTime.toISOString(),
        latitude: nextScheduleLocation.latitude,
        longitude: nextScheduleLocation.longitude,
        address: nextScheduleLocation.address,
        placeName: nextScheduleLocation.placeName || body.nextSchedule?.name || '다음 일정'
      },
      partySize,
      transportMode,
      preferences: body.preferences || [],
      currentTime: currentTime.toISOString()
    };
    const courses = recommendations.slice(0, 10).map((course, index) => toCourseResponse(course, index, request));

    if (courses.length === 0) {
      return {
        success: true,
        status: 'no_recommendation',
        message: '다음 일정까지 시간이 부족해 안전하게 들를 수 있는 장소가 없어요.',
        data: {
          request,
          courses: [],
          mainCourse: null,
          alternatives: []
        }
      };
    }

    return {
      success: true,
      status: 'ok',
      message: 'recommendation created',
      data: {
        request,
        courses,
        mainCourse: courses[0],
        alternatives: courses.slice(1, 4)
      }
    };
  }
};
