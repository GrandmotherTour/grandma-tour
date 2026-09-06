import { createMockRecommendation } from '../mocks/recommendationMock.js';
import { toIsoToday } from '../utils/time.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function toBackendPayload(userInput, preferenceWeights, swipeResults) {
  const swipeFeedbacks = Object.entries(swipeResults).flatMap(([tag, result]) => {
    const feedbacks = [];
    for (let index = 0; index < result.likeCount; index += 1) {
      feedbacks.push({ cardId: `${tag}-card-${index}`, action: 'like', tags: [tag] });
    }
    for (let index = 0; index < result.dislikeCount; index += 1) {
      feedbacks.push({ cardId: `${tag}-card-${index}`, action: 'dislike', tags: [tag] });
    }
    for (let index = 0; index < result.skipCount; index += 1) {
      feedbacks.push({ cardId: `${tag}-card-${index}`, action: 'skip', tags: [tag] });
    }
    return feedbacks;
  });

  return {
    currentLocation: userInput.currentLocation,
    nextScheduleLocation: userInput.nextScheduleLocation,
    nextScheduleTime: toIsoToday(userInput.nextScheduleTime),
    nextScheduleTimeLabel: userInput.nextScheduleTime,
    availableMinutes: userInput.availableMinutes,
    peopleCount: userInput.peopleCount,
    transportMode: userInput.transportMode,
    preferences: preferenceWeights,
    currentLatitude: Number(userInput.currentLocation.lat),
    currentLongitude: Number(userInput.currentLocation.lng),
    nextScheduleLatitude: Number(userInput.nextScheduleLocation.lat),
    nextScheduleLongitude: Number(userInput.nextScheduleLocation.lng),
    currentTime: new Date().toISOString(),
    swipeFeedbacks,
  };
}

function normalizeApiResult(json, request) {
  const recommendations = json?.recommendations || json?.data?.recommendations;
  if (Array.isArray(recommendations) && recommendations.length > 0) {
    return {
      source: 'backend',
      request,
      mainCourse: recommendations[0],
      alternatives: recommendations.slice(1, 4),
      raw: json,
    };
  }

  return createMockRecommendation(request, 'backend-stub');
}

export async function requestRecommendation({ userInput, preferenceWeights, swipeResults }) {
  const request = toBackendPayload(userInput, preferenceWeights, swipeResults);
  const response = await fetch(`${API_BASE_URL}/api/recommendation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Recommendation API failed with ${response.status}`);
  }

  const json = await response.json();
  return normalizeApiResult(json, request);
}
