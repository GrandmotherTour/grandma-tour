import type { TravelContext } from '../types/recommendation';
import { travelAdjustmentPolicy } from './policy';

export const estimateBaseTravelTime = (distanceKm: number, transportMode: TravelContext['transportMode']) => {
  const speedKmh = transportMode === 'walk'
    ? travelAdjustmentPolicy.baseSpeedKmh.walk
    : travelAdjustmentPolicy.baseSpeedKmh.carFallbackUrbanDefault;

  return (distanceKm / speedKmh) * 60;
};

const getPeopleMultiplier = (peopleCount: number) => {
  if (peopleCount <= 1) return travelAdjustmentPolicy.people.one;
  if (peopleCount === 2) return travelAdjustmentPolicy.people.two;
  if (peopleCount <= 4) return travelAdjustmentPolicy.people.threeToFour;
  return travelAdjustmentPolicy.people.fivePlus;
};

const getTransportRiskMultiplier = (context: TravelContext) => {
  if (context.transportMode === 'walk') {
    return context.distanceKm >= 1.5
      ? travelAdjustmentPolicy.transportRisk.walkLongDistance
      : travelAdjustmentPolicy.transportRisk.walkDefault;
  }

  if (context.trafficLevel === 'jammed' && !context.hasParkingHint) {
    return travelAdjustmentPolicy.transportRisk.carJammedNoParkingHint;
  }

  if (context.congestionLevel === 'veryCrowded') {
    return travelAdjustmentPolicy.transportRisk.carCrowdedDestination;
  }

  if (!context.hasParkingHint) {
    return travelAdjustmentPolicy.transportRisk.carNoParkingHint;
  }

  return travelAdjustmentPolicy.transportRisk.carDefault;
};

export const adjustTravelTime = (baseTravelTime: number, context: TravelContext) => {
  const congestionMultiplier = context.transportMode === 'car'
    ? travelAdjustmentPolicy.traffic[context.trafficLevel || 'unknownUrban']
    : travelAdjustmentPolicy.congestion[context.congestionLevel || 'normal'];
  const weatherMultiplier = travelAdjustmentPolicy.weather[context.transportMode][context.weatherLevel || 'clear'];
  const peopleMultiplier = getPeopleMultiplier(context.peopleCount);
  const transportRiskMultiplier = getTransportRiskMultiplier(context);

  return Math.ceil(
    baseTravelTime *
    congestionMultiplier *
    weatherMultiplier *
    peopleMultiplier *
    transportRiskMultiplier
  );
};

export const estimateAdjustedTravelTime = (context: TravelContext) => {
  return adjustTravelTime(
    estimateBaseTravelTime(context.distanceKm, context.transportMode),
    context
  );
};

export const travelTime = {
  estimateBaseTravelTime,
  adjustTravelTime,
  estimateAdjustedTravelTime
};
