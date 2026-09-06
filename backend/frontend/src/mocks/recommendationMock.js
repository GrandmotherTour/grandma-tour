import { addMinutesToTime } from '../utils/time.js';

const tagLabels = {
  cafe: '카페',
  food: '맛집',
  nature: '산책',
  culture: '문화',
  history: '역사',
  activity: '체험',
};

function topTags(preferences) {
  return Object.entries(preferences || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([tag]) => tag);
}

function makeCourse(request, variant, source) {
  const preferred = topTags(request.preferences);
  const primaryTag = preferred[0] || 'nature';
  const secondaryTag = preferred[1] || 'cafe';
  const nextScheduleTime = request.nextScheduleTimeLabel || '18:00';
  const startTime = addMinutesToTime(nextScheduleTime, -request.availableMinutes);
  const travelA = request.transportMode === 'car' ? 12 + variant : 18 + variant;
  const travelB = request.transportMode === 'car' ? 9 + variant : 14 + variant;
  const finalTravel = request.transportMode === 'car' ? 15 : 20;
  const stayA = variant === 0 ? 45 : 35 + variant * 5;
  const stayB = variant === 0 ? 40 : 30 + variant * 6;
  const firstArrival = addMinutesToTime(startTime, travelA);
  const firstLeave = addMinutesToTime(firstArrival, stayA);
  const secondArrival = addMinutesToTime(firstLeave, travelB);
  const secondLeave = addMinutesToTime(secondArrival, stayB);
  const finalArrival = addMinutesToTime(secondLeave, finalTravel);
  const totalTravelMinutes = travelA + travelB + finalTravel;
  const totalStayMinutes = stayA + stayB;
  const totalCourseMinutes = totalTravelMinutes + totalStayMinutes;
  const slackMinutes = Math.max(0, request.availableMinutes - totalCourseMinutes);

  const names = [
    ['서울숲 산책로', '성수 로컬 카페'],
    ['뚝섬 전시 공간', '한강 전망 카페'],
    ['성수 골목 맛집', '수제 공방 체험'],
  ][variant] || ['동네 산책 코스', '작은 카페'];

  return {
    id: `mock-course-${variant}`,
    title: variant === 0 ? '추천 코스' : `대안 코스 ${variant}`,
    source,
    totalCourseMinutes,
    totalTravelMinutes,
    totalStayMinutes,
    slackMinutes,
    expectedArrivalTime: finalArrival,
    nextScheduleTime,
    transportMode: request.transportMode,
    preferenceTags: [primaryTag, secondaryTag],
    reason: `${tagLabels[primaryTag]} 선호와 ${request.transportMode === 'walk' ? '도보 이동' : '차량 이동'} 조건을 반영해 다음 일정 전까지 무리 없는 코스로 구성했습니다.`,
    points: [
      {
        type: 'start',
        name: request.currentLocation?.name || '현재 위치',
        time: startTime,
        lat: request.currentLocation?.lat,
        lng: request.currentLocation?.lng,
      },
      {
        type: 'place',
        name: names[0],
        tag: primaryTag,
        arrivalTime: firstArrival,
        leaveTime: firstLeave,
        stayMinutes: stayA,
        travelFromPreviousMinutes: travelA,
        lat: Number(request.currentLocation?.lat || 37.5445) + 0.004 + variant * 0.001,
        lng: Number(request.currentLocation?.lng || 127.055) + 0.004,
      },
      {
        type: 'place',
        name: names[1],
        tag: secondaryTag,
        arrivalTime: secondArrival,
        leaveTime: secondLeave,
        stayMinutes: stayB,
        travelFromPreviousMinutes: travelB,
        lat: Number(request.nextScheduleLocation?.lat || 37.5133) - 0.003,
        lng: Number(request.nextScheduleLocation?.lng || 127.1002) - 0.005 - variant * 0.001,
      },
      {
        type: 'end',
        name: request.nextScheduleLocation?.name || '다음 일정',
        arrivalTime: finalArrival,
        nextScheduleTime,
        travelFromPreviousMinutes: finalTravel,
        slackMinutes,
        lat: request.nextScheduleLocation?.lat,
        lng: request.nextScheduleLocation?.lng,
      },
    ],
  };
}

export function createMockRecommendation(request, source = 'mock') {
  const courses = [0, 1, 2].map((variant) => makeCourse(request, variant, source));
  return {
    source,
    request,
    mainCourse: courses[0],
    alternatives: courses.slice(1),
  };
}
