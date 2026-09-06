import type { DataQuality, JaturipPlace } from '../types/normalized';

export const calculatePlaceDataQuality = (place: Pick<
  JaturipPlace,
  'lat' | 'lng' | 'address' | 'roadAddress' | 'imageUrl' | 'category' | 'detailUrl'
>): DataQuality => {
  return {
    hasCoordinates: place.lat !== null && place.lng !== null,
    hasAddress: Boolean(place.address || place.roadAddress),
    hasImage: Boolean(place.imageUrl),
    hasCategory: place.category !== 'unmapped',
    hasDetailUrl: Boolean(place.detailUrl)
  };
};
