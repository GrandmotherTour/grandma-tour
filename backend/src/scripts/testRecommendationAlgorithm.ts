import { generateRecommendations } from '../recommendation/recommendationEngine';
import { calculatePreferenceWeights } from '../recommendation/preferenceScorer';
import type { SwipeFeedback } from '../types/preference';

const currentTime = new Date('2026-09-02T14:00:00+09:00');
const nextScheduleTime = new Date('2026-09-02T17:00:00+09:00');

const swipeFeedbacks: SwipeFeedback[] = [
  { cardId: 'cafe-1', action: 'like', tags: ['cafe'] },
  { cardId: 'cafe-2', action: 'like', tags: ['cafe'] },
  { cardId: 'nature-1', action: 'like', tags: ['nature'] },
  { cardId: 'culture-1', action: 'dislike', tags: ['culture'] },
  { cardId: 'activity-1', action: 'skip', tags: ['activity'] }
];

const manualCandidates = [
  {
    id: 'cafe-seongsu',
    name: '성수 카페',
    latitude: 37.5446,
    longitude: 127.0557,
    tags: ['cafe'],
    congestionLevel: 'normal',
    weatherLevel: 'clear',
    imageUrl: 'https://example.com/cafe.jpg',
    address: '서울 성동구'
  },
  {
    id: 'seoul-forest',
    name: '서울숲',
    latitude: 37.5444,
    longitude: 127.0374,
    tags: ['nature'],
    congestionLevel: 'crowded',
    weatherLevel: 'clear',
    address: '서울 성동구'
  },
  {
    id: 'museum',
    name: '국립중앙박물관',
    latitude: 37.5238,
    longitude: 126.9804,
    tags: ['culture'],
    congestionLevel: 'normal',
    weatherLevel: 'clear',
    imageUrl: 'https://example.com/museum.jpg',
    address: '서울 용산구'
  },
  {
    id: 'workshop',
    name: '공방 체험',
    latitude: 37.5419,
    longitude: 127.0492,
    tags: ['activity'],
    congestionLevel: 'relaxed',
    weatherLevel: 'clear',
    address: '서울 성동구'
  }
];

const runScenario = async (
  name: string,
  nextScheduleLocation: { latitude: number; longitude: number },
  scenarioNextScheduleTime = nextScheduleTime,
  scenarioSwipeFeedbacks = swipeFeedbacks
) => {
  const preferenceResult = calculatePreferenceWeights(scenarioSwipeFeedbacks);
  const recommendations = await generateRecommendations({
    currentLocation: { latitude: 37.5445, longitude: 127.0550 },
    nextScheduleLocation,
    nextScheduleTime: scenarioNextScheduleTime,
    peopleCount: 2,
    transportMode: 'walk',
    swipeFeedbacks: scenarioSwipeFeedbacks,
    manualCandidates,
    currentTime
  });

  return {
    scenario: name,
    preferenceWeights: preferenceResult.weights,
    strongRejectTags: preferenceResult.strongRejectTags,
    topCourses: recommendations.slice(0, 3).map((course) => ({
      pointCount: course.pointCount,
      points: course.points.map((point) => point.name),
      minimumSlackMinutes: course.minimumSlackMinutes,
      totalCourseMinutes: course.totalCourseMinutes,
      score: course.score,
      scoreBreakdown: course.scoreBreakdown
    }))
  };
};

const main = async () => {
  const strongRejectFeedbacks: SwipeFeedback[] = [
    { cardId: 'culture-1', action: 'dislike', tags: ['culture'] },
    { cardId: 'culture-2', action: 'dislike', tags: ['culture'] },
    { cardId: 'culture-3', action: 'dislike', tags: ['culture'] },
    { cardId: 'cafe-1', action: 'like', tags: ['cafe'] }
  ];
  const scenarios = [
    await runScenario('deadline-safe nearby schedule', { latitude: 37.5444, longitude: 127.0374 }),
    await runScenario('deadline-rejected far schedule', { latitude: 37.5665, longitude: 126.9780 }),
    await runScenario('strong-reject culture category', { latitude: 37.5444, longitude: 127.0374 }, nextScheduleTime, strongRejectFeedbacks)
  ];

  console.log(JSON.stringify(scenarios, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
