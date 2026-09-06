import type {
  CandidateWithContext,
  CourseCandidate,
  CoursePoint,
  CourseSearchRequest
} from '../types/recommendation';
import type { PreferenceTag, UserPreferenceWeights } from '../types/preference';
import { courseSearchPolicy, deadlinePolicy } from './policy';
import { reverseScheduleCourse } from './reverseScheduler';
import { scoreCourse, scorePointPreference } from './scorer';
import { getPolicyStayTime } from './stayTimePolicy';

type BuildCoursesOptions = {
  preferenceWeights: UserPreferenceWeights;
  strongRejectTags?: PreferenceTag[];
  currentTime?: Date;
};

const getUsableMinutes = (request: CourseSearchRequest, currentTime: Date) => {
  const remainingMinutes = Math.floor((request.nextScheduleTime.getTime() - currentTime.getTime()) / 60_000);
  return remainingMinutes -
    deadlinePolicy.arrivalBufferMinutes[request.transportMode] -
    courseSearchPolicy.globalSafetyBufferMinutes;
};

const getMaxDepth = (usableMinutes: number) => {
  return courseSearchPolicy.maxDepthByUsableMinutes.find((policy) => usableMinutes <= policy.maxUsableMinutes)?.maxDepth || 1;
};

const hasStrongReject = (candidate: CandidateWithContext, strongRejectTags: PreferenceTag[]) => {
  return candidate.tags.some((tag) => strongRejectTags.includes(tag));
};

const toCoursePoint = (candidate: CandidateWithContext, preferenceWeights: UserPreferenceWeights): CoursePoint => {
  return {
    ...candidate,
    policyStayTime: getPolicyStayTime(candidate.tags, preferenceWeights),
    preferenceScore: scorePointPreference(candidate, preferenceWeights)
  };
};

const courseKey = (points: CoursePoint[]) => points.map((point) => point.id).join('>');

export const buildCoursesWithBeamSearch = (
  request: CourseSearchRequest,
  options: BuildCoursesOptions
): CourseCandidate[] => {
  const currentTime = options.currentTime || new Date();
  const usableMinutes = getUsableMinutes(request, currentTime);

  if (usableMinutes <= 0) {
    return [];
  }

  const strongRejectTags = options.strongRejectTags || [];
  const maxDepth = getMaxDepth(usableMinutes);
  const pointCandidates = request.candidates
    .filter((candidate) => candidate.tags.length > 0)
    .filter((candidate) => !hasStrongReject(candidate, strongRejectTags))
    .map((candidate) => toCoursePoint(candidate, options.preferenceWeights))
    .sort((a, b) => b.preferenceScore - a.preferenceScore);

  let beam: CourseCandidate[] = [];
  const accepted = new Map<string, CourseCandidate>();

  for (const point of pointCandidates) {
    const course = reverseScheduleCourse({
      points: [point],
      currentLocation: request.currentLocation,
      nextScheduleTime: request.nextScheduleTime,
      nextScheduleLocation: request.nextScheduleLocation,
      transportMode: request.transportMode,
      peopleCount: request.peopleCount,
      currentTime
    });

    if (!course.deadlineSafe || course.totalCourseMinutes > usableMinutes) {
      continue;
    }

    const scored = scoreCourse(course, usableMinutes, request.transportMode, request.peopleCount);
    accepted.set(courseKey(scored.points), scored);
    beam.push(scored);
  }

  beam = beam
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, courseSearchPolicy.beamWidth);

  for (let depth = 2; depth <= maxDepth; depth += 1) {
    const nextBeam: CourseCandidate[] = [];

    for (const partialCourse of beam) {
      const usedIds = new Set(partialCourse.points.map((point) => point.id));

      for (const nextPoint of pointCandidates) {
        if (usedIds.has(nextPoint.id)) {
          continue;
        }

        const points = [...partialCourse.points, nextPoint];
        const course = reverseScheduleCourse({
          points,
          currentLocation: request.currentLocation,
          nextScheduleTime: request.nextScheduleTime,
          nextScheduleLocation: request.nextScheduleLocation,
          transportMode: request.transportMode,
          peopleCount: request.peopleCount,
          currentTime
        });

        if (!course.deadlineSafe || course.minimumSlackMinutes < 0 || course.totalCourseMinutes > usableMinutes) {
          continue;
        }

        const scored = scoreCourse(course, usableMinutes, request.transportMode, request.peopleCount);
        accepted.set(courseKey(scored.points), scored);
        nextBeam.push(scored);
      }
    }

    if (nextBeam.length === 0) {
      break;
    }

    beam = nextBeam
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, courseSearchPolicy.beamWidth);
  }

  return [...accepted.values()]
    .sort((a, b) => (b.score || 0) - (a.score || 0));
};

export const routeBuilder = {
  build: buildCoursesWithBeamSearch,
  buildCoursesWithBeamSearch
};
