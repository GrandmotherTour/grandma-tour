import type { JaturipPlace, OriginalCategory } from '../types/normalized';
import { inferIndoorOutdoor, normalizeTourApiCategory } from './category.normalizer';
import { calculatePlaceDataQuality } from './placeQuality';
import { asRecord, getNumber, getString } from './utils';

export const normalizeTourApiPlace = (rawItem: unknown, options: { includeRawSource?: boolean } = {}): JaturipPlace | null => {
  const item = asRecord(rawItem);
  const sourceId = getString(item, 'contentid');
  const name = getString(item, 'title');
  const lat = getNumber(item, 'mapy');
  const lng = getNumber(item, 'mapx');
  const originalCategory: OriginalCategory = {
    main: getString(item, 'cat1'),
    middle: getString(item, 'cat2'),
    detail: getString(item, 'cat3'),
    raw: getString(item, 'contenttypeid')
  };
  const category = normalizeTourApiCategory(originalCategory);

  if (!sourceId || !name) {
    return null;
  }

  const place: JaturipPlace = {
    id: `tourApi:${sourceId}`,
    source: 'tourApi',
    sourceId,
    name,
    category,
    originalCategory,
    lat,
    lng,
    address: [getString(item, 'addr1'), getString(item, 'addr2')].filter(Boolean).join(' ') || null,
    roadAddress: null,
    imageUrl: getString(item, 'firstimage') || getString(item, 'firstimage2'),
    detailUrl: null,
    phone: getString(item, 'tel'),
    indoorOutdoor: inferIndoorOutdoor(category),
    rawSource: options.includeRawSource ? rawItem : undefined
  };

  return {
    ...place,
    dataQuality: calculatePlaceDataQuality(place)
  };
};

export const normalizeTourApiPlaces = (rawItems: unknown[], options: { includeRawSource?: boolean } = {}) => {
  return rawItems
    .map((item) => normalizeTourApiPlace(item, options))
    .filter((place): place is JaturipPlace => place !== null);
};
