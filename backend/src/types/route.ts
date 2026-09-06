export type RouteStep = {
  order: number;
  type: 'walk' | 'car' | 'public';
  durationMinutes: number;
  description: string;
};

export type Route = {
  from: { latitude: number; longitude: number };
  to: { latitude: number; longitude: number };
  steps: RouteStep[];
};
