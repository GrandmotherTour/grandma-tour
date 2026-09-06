import type { JaturipPlace } from '../types/normalized';
import { calculateDistanceKm } from '../utils/distance';

export const duplicatePolicy = {
  coordinateThresholdMeters: 50
};

const normalizeName = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
};

const areNamesSimilar = (a: string, b: string) => {
  const left = normalizeName(a);
  const right = normalizeName(b);
  return left === right || left.includes(right) || right.includes(left);
};

export const isDuplicatePlace = (a: JaturipPlace, b: JaturipPlace) => {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) {
    return false;
  }

  const distanceMeters = calculateDistanceKm(a.lat, a.lng, b.lat, b.lng) * 1000;
  return areNamesSimilar(a.name, b.name) && distanceMeters <= duplicatePolicy.coordinateThresholdMeters;
};

export const mergeDuplicatePlaces = (primary: JaturipPlace, secondary: JaturipPlace): JaturipPlace => {
  const category = primary.category !== 'unmapped' ? primary.category : secondary.category;

  return {
    ...primary,
    category,
    originalCategory: primary.originalCategory || secondary.originalCategory,
    address: primary.address || secondary.address,
    roadAddress: primary.roadAddress || secondary.roadAddress,
    imageUrl: primary.imageUrl || secondary.imageUrl,
    detailUrl: primary.detailUrl || secondary.detailUrl,
    phone: primary.phone || secondary.phone,
    indoorOutdoor: primary.indoorOutdoor !== 'unknown' ? primary.indoorOutdoor : secondary.indoorOutdoor,
    dataQuality: {
      hasCoordinates: primary.dataQuality?.hasCoordinates || secondary.dataQuality?.hasCoordinates || false,
      hasAddress: primary.dataQuality?.hasAddress || secondary.dataQuality?.hasAddress || false,
      hasImage: primary.dataQuality?.hasImage || secondary.dataQuality?.hasImage || false,
      hasCategory: primary.dataQuality?.hasCategory || secondary.dataQuality?.hasCategory || false,
      hasDetailUrl: primary.dataQuality?.hasDetailUrl || secondary.dataQuality?.hasDetailUrl || false
    },
    rawSource: primary.rawSource
  };
};

export const removeDuplicatePlaces = (places: JaturipPlace[]) => {
  const merged: JaturipPlace[] = [];

  for (const place of places) {
    const duplicateIndex = merged.findIndex((existing) => isDuplicatePlace(existing, place));

    if (duplicateIndex === -1) {
      merged.push(place);
      continue;
    }

    const existing = merged[duplicateIndex];
    const primary = existing.source === 'kakao' ? existing : place.source === 'kakao' ? place : existing;
    const secondary = primary === existing ? place : existing;
    merged[duplicateIndex] = mergeDuplicatePlaces(primary, secondary);
  }

  return merged;
};
