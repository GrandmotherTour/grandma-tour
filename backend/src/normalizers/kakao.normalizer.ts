import type { JaturipPlace, OriginalCategory } from '../types/normalized';
import { inferIndoorOutdoor, normalizeKakaoCategory } from './category.normalizer';
import { calculatePlaceDataQuality } from './placeQuality';
import { asRecord, getNumber, getString } from './utils';

export const normalizeKakaoPlace = (rawItem: unknown, options: { includeRawSource?: boolean } = {}): JaturipPlace | null => {
  const item = asRecord(rawItem);
  const sourceId = getString(item, 'id');
  const name = getString(item, 'place_name');
  const lat = getNumber(item, 'y');
  const lng = getNumber(item, 'x');
  const originalCategory: OriginalCategory = {
    main: getString(item, 'category_group_code'),
    middle: getString(item, 'category_group_name'),
    detail: getString(item, 'category_name'),
    raw: getString(item, 'category_name')
  };
  const category = normalizeKakaoCategory(originalCategory);

  if (!sourceId || !name) {
    return null;
  }

  const place: JaturipPlace = {
    id: `kakao:${sourceId}`,
    source: 'kakao',
    sourceId,
    name,
    category,
    originalCategory,
    lat,
    lng,
    address: getString(item, 'address_name'),
    roadAddress: getString(item, 'road_address_name'),
    imageUrl: null,
    detailUrl: getString(item, 'place_url'),
    phone: getString(item, 'phone'),
    indoorOutdoor: inferIndoorOutdoor(category),
    rawSource: options.includeRawSource ? rawItem : undefined
  };

  return {
    ...place,
    dataQuality: calculatePlaceDataQuality(place)
  };
};

export const normalizeKakaoPlaces = (rawItems: unknown[], options: { includeRawSource?: boolean } = {}) => {
  return rawItems
    .map((item) => normalizeKakaoPlace(item, options))
    .filter((place): place is JaturipPlace => place !== null);
};
