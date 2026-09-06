import type { CourseCandidate, CoursePoint, CourseScoreBreakdown } from '../types/recommendation';
import type { UserPreferenceWeights } from '../types/preference';
import { courseScoreWeights, deadlinePolicy, travelAdjustmentPolicy } from './policy';

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

const normalizeSignedScore = (value: number) => clamp((value + 1) / 2);

export const scorePointPreference = (point: Pick<CoursePoint, 'tags'>, weights: UserPreferenceWeights) => {
  const rawScore = point.tags.reduce((sum, tag) => sum + weights[tag], 0) / point.tags.length;
  return rawScore;
};

export const scoreCoursePreference = (course: Pick<CourseCandidate, 'points'>) => {
  if (course.points.length === 0) {
    return 0;
  }

  const rawScore = course.points.reduce((sum, point) => sum + point.preferenceScore, 0) / course.points.length;
  return normalizeSignedScore(rawScore);
};

export const scoreDeadlineSafety = (
  course: Pick<CourseCandidate, 'minimumSlackMinutes'>,
  transportMode: 'walk' | 'car'
) => {
  const targetSlack = deadlinePolicy.targetSlackMinutes[transportMode];
  return clamp(course.minimumSlackMinutes / targetSlack);
};

export const scoreRouteEfficiency = (
  course: Pick<CourseCandidate, 'totalAdjustedTravelMinutes' | 'totalCourseMinutes'>,
  usableMinutes: number
) => {
  if (usableMinutes <= 0 || course.totalCourseMinutes <= 0) {
    return 0;
  }

  const travelRatio = course.totalAdjustedTravelMinutes / course.totalCourseMinutes;
  const timeUseRatio = course.totalCourseMinutes / usableMinutes;
  const timeUseScore = timeUseRatio > 1 ? 0 : 1 - Math.abs(0.85 - timeUseRatio);

  return clamp((1 - travelRatio) * 0.6 + timeUseScore * 0.4);
};

export const scoreContext = (course: Pick<CourseCandidate, 'points'>) => {
  if (course.points.length === 0) {
    return 0;
  }

  const penalties = course.points.map((point) => {
    const congestionPenalty = travelAdjustmentPolicy.riskPenalty.congestionDelay[point.congestionLevel || 'normal'];
    const weatherPenalty = travelAdjustmentPolicy.riskPenalty.weatherDelay[point.weatherLevel || 'clear'];
    return congestionPenalty + weatherPenalty;
  });
  const averagePenalty = penalties.reduce((sum, penalty) => sum + penalty, 0) / penalties.length;

  return clamp(1 - averagePenalty);
};

export const scoreGroupSuitability = (course: Pick<CourseCandidate, 'points'>, peopleCount: number) => {
  if (peopleCount < 5) {
    return 1;
  }

  const crowdedPoints = course.points.filter((point) => point.congestionLevel === 'crowded' || point.congestionLevel === 'veryCrowded');
  return clamp(1 - crowdedPoints.length * travelAdjustmentPolicy.riskPenalty.peopleDelayFivePlus);
};

export const scoreDataQuality = (course: Pick<CourseCandidate, 'points'>) => {
  if (course.points.length === 0) {
    return 0;
  }

  const scores = course.points.map((point) => {
    const checks = [
      point.name,
      point.address,
      point.imageUrl,
      point.latitude,
      point.longitude,
      point.tags.length > 0
    ];
    return checks.filter(Boolean).length / checks.length;
  });

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
};

export const calculateRiskPenalty = (course: Pick<CourseCandidate, 'points'>, transportMode: 'walk' | 'car') => {
  const pointPenalty = course.points.reduce((sum, point) => {
    const trafficDelay = transportMode === 'car'
      ? travelAdjustmentPolicy.riskPenalty.trafficDelay[point.trafficLevel || 'unknownUrban']
      : 0;
    const weatherDelay = travelAdjustmentPolicy.riskPenalty.weatherDelay[point.weatherLevel || 'clear'];
    const congestionDelay = travelAdjustmentPolicy.riskPenalty.congestionDelay[point.congestionLevel || 'normal'];

    return sum + trafficDelay + weatherDelay + congestionDelay;
  }, 0);

  const tooManyStopsPenalty = Math.max(0, course.points.length - 3) * travelAdjustmentPolicy.riskPenalty.tooManyStops;

  return clamp(pointPenalty / Math.max(course.points.length, 1) + tooManyStopsPenalty);
};

export const scoreCourse = (
  course: CourseCandidate,
  usableMinutes: number,
  transportMode: 'walk' | 'car',
  peopleCount: number
): CourseCandidate => {
  const deadlineSafetyScore = scoreDeadlineSafety(course, transportMode);
  const adjustedDeadlineSafetyScore = clamp(deadlineSafetyScore - calculateRiskPenalty(course, transportMode));
  const scoreBreakdown: CourseScoreBreakdown = {
    adjustedDeadlineSafetyScore,
    preferenceMatchScore: scoreCoursePreference(course),
    routeEfficiencyScore: scoreRouteEfficiency(course, usableMinutes),
    contextScore: scoreContext(course),
    groupSuitabilityScore: scoreGroupSuitability(course, peopleCount),
    dataQualityScore: scoreDataQuality(course)
  };

  const score =
    scoreBreakdown.adjustedDeadlineSafetyScore * courseScoreWeights.deadlineSafety +
    scoreBreakdown.preferenceMatchScore * courseScoreWeights.preferenceMatch +
    scoreBreakdown.routeEfficiencyScore * courseScoreWeights.routeEfficiency +
    scoreBreakdown.contextScore * courseScoreWeights.context +
    scoreBreakdown.groupSuitabilityScore * courseScoreWeights.groupSuitability +
    scoreBreakdown.dataQualityScore * courseScoreWeights.dataQuality;

  return {
    ...course,
    score,
    scoreBreakdown
  };
};

export const scorer = {
  score: scoreCourse,
  scorePointPreference,
  scoreCoursePreference,
  scoreDeadlineSafety,
  scoreRouteEfficiency,
  scoreContext,
  scoreGroupSuitability,
  scoreDataQuality
};
