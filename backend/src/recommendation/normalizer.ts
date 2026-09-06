import type { JaturipPlace } from '../types/normalized';
import { normalizeKakaoCategory, normalizeTourApiCategory } from '../normalizers/category.normalizer';
import { normalizeKakaoPlace, normalizeKakaoPlaces } from '../normalizers/kakao.normalizer';
import { normalizeTourApiPlace, normalizeTourApiPlaces } from '../normalizers/tourApi.normalizer';

type Source = 'kakao' | 'tour';

export const normalizeCandidate = (item: unknown, source: Source): JaturipPlace | null => {
  return source === 'kakao'
    ? normalizeKakaoPlace(item)
    : normalizeTourApiPlace(item);
};

export const normalizer = {
  normalize: (items: unknown[], source: Source): JaturipPlace[] => {
    return source === 'kakao'
      ? normalizeKakaoPlaces(items)
      : normalizeTourApiPlaces(items);
  },
  normalizeKakaoCategory,
  normalizeTourApiCategory,
  normalizeCandidate
};
