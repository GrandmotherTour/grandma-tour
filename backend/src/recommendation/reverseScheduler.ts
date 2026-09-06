import type {
  CourseCandidate,
  CoursePoint,
  ScheduledCoursePoint,
  TravelContext
} from '../types/recommendation';
import type { TransportMode } from '../types/userInput';
import { calculateDistanceKm } from '../utils/distance';
import { courseSearchPolicy, deadlinePolicy } from './policy';
import { estimateAdjustedTravelTime } from './travelTime';

type Location = { latitude: number; longitude: number };

type ReverseScheduleInput = {
  points: CoursePoint[];
  currentLocation: Location;
  nextScheduleTime: Date;
  nextScheduleLocation?: Location;
  transportMode: TransportMode;
  peopleCount: number;
  currentTime?: Date;
};

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);
const subtractMinutes = (date: Date, minutes: number) => addMinutes(date, -minutes);

const getPointLocation = (point: CoursePoint): Location => ({
  latitude: point.latitude,
  longitude: point.longitude
});

const getAdjustedTravelMinutes = (
  from: Location,
  to: CoursePoint | Location,
  contextPoint: CoursePoint,
  transportMode: TransportMode,
  peopleCount: number
) => {
  const toLocation = 'tags' in to ? getPointLocation(to) : to;
  const distanceKm = calculateDistanceKm(from.latitude, from.longitude, toLocation.latitude, toLocation.longitude);
  const context: TravelContext = {
    transportMode,
    peopleCount,
    distanceKm,
    congestionLevel: contextPoint.congestionLevel,
    trafficLevel: contextPoint.trafficLevel,
    weatherLevel: contextPoint.weatherLevel,
    hasParkingHint: contextPoint.hasParkingHint
  };

  return estimateAdjustedTravelTime(context);
};

export const reverseScheduleCourse = (input: ReverseScheduleInput): CourseCandidate => {
  const currentTime = input.currentTime || new Date();
  const arrivalBuffer = deadlinePolicy.arrivalBufferMinutes[input.transportMode];
  const pointBuffer = courseSearchPolicy.pointBufferMinutes;
  const latestArrivalAtNextSchedule = subtractMinutes(input.nextScheduleTime, arrivalBuffer);
  const scheduledReversed: ScheduledCoursePoint[] = [];

  let nextDeadline = latestArrivalAtNextSchedule;
  let totalAdjustedTravelMinutes = 0;
  let totalStayMinutes = 0;
  let totalBufferMinutes = arrivalBuffer;

  for (let index = input.points.length - 1; index >= 0; index -= 1) {
    const point = input.points[index];
    const nextLocation = index === input.points.length - 1
      ? input.nextScheduleLocation
      : getPointLocation(input.points[index + 1]);
    const travelToNext = nextLocation
      ? getAdjustedTravelMinutes(getPointLocation(point), nextLocation, point, input.transportMode, input.peopleCount)
      : 0;

    totalAdjustedTravelMinutes += travelToNext;

    const latestLeaveTime = subtractMinutes(nextDeadline, travelToNext);
    const latestArrivalTime = subtractMinutes(latestLeaveTime, point.policyStayTime + pointBuffer);

    totalStayMinutes += point.policyStayTime;
    totalBufferMinutes += pointBuffer;

    scheduledReversed.push({
      ...point,
      order: index + 1,
      adjustedTravelTimeFromPrevious: 0,
      latestArrivalTime,
      latestLeaveTime,
      estimatedArrivalTime: currentTime,
      estimatedLeaveTime: currentTime,
      slackMinutes: 0
    });

    nextDeadline = latestArrivalTime;
  }

  const scheduled = scheduledReversed.reverse();
  let cursorTime = currentTime;
  let previousLocation = input.currentLocation;

  for (const point of scheduled) {
    const travelFromPrevious = getAdjustedTravelMinutes(
      previousLocation,
      point,
      point,
      input.transportMode,
      input.peopleCount
    );
    totalAdjustedTravelMinutes += travelFromPrevious;

    point.adjustedTravelTimeFromPrevious = travelFromPrevious;
    point.estimatedArrivalTime = addMinutes(cursorTime, travelFromPrevious);
    point.estimatedLeaveTime = addMinutes(point.estimatedArrivalTime, point.policyStayTime + pointBuffer);
    point.slackMinutes = Math.floor((point.latestArrivalTime.getTime() - point.estimatedArrivalTime.getTime()) / 60_000);

    cursorTime = point.estimatedLeaveTime;
    previousLocation = getPointLocation(point);
  }

  const finalTravelMinutes = scheduled.length > 0 && input.nextScheduleLocation
    ? getAdjustedTravelMinutes(
      previousLocation,
      input.nextScheduleLocation,
      scheduled[scheduled.length - 1],
      input.transportMode,
      input.peopleCount
    )
    : 0;
  const estimatedArrivalAtNextSchedule = addMinutes(cursorTime, finalTravelMinutes);
  const minimumSlackMinutes = scheduled.length === 0
    ? Math.floor((latestArrivalAtNextSchedule.getTime() - estimatedArrivalAtNextSchedule.getTime()) / 60_000)
    : Math.min(
      ...scheduled.map((point) => point.slackMinutes),
      Math.floor((latestArrivalAtNextSchedule.getTime() - estimatedArrivalAtNextSchedule.getTime()) / 60_000)
    );
  const totalCourseMinutes = totalAdjustedTravelMinutes + totalStayMinutes + totalBufferMinutes;

  return {
    points: scheduled,
    pointCount: scheduled.length,
    totalAdjustedTravelMinutes,
    finalTravelMinutes,
    totalStayMinutes,
    totalBufferMinutes,
    totalCourseMinutes,
    minimumSlackMinutes,
    estimatedArrivalAtNextSchedule,
    latestArrivalAtNextSchedule,
    deadlineSafe: minimumSlackMinutes >= 0
  };
};

export const reverseScheduler = {
  reverseScheduleCourse
};
