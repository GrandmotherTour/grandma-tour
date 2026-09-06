export type TransportMode = 'car' | 'walk';

export type UserInput = {
  currentLatitude: number;
  currentLongitude: number;
  nextScheduleTime: string;
  peopleCount: number;
  transportMode: TransportMode;
  nextScheduleLatitude?: number;
  nextScheduleLongitude?: number;
  remainingMinutes?: number;
  budget?: number;
};
