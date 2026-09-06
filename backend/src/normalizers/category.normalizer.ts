import type { NormalizedCategory, OriginalCategory } from '../types/normalized';
import { hasText } from './utils';

export const normalizeKakaoCategory = (original: OriginalCategory): NormalizedCategory => {
  const rawText = [original.main, original.middle, original.detail, original.raw].filter(Boolean).join(' ');

  if (original.main === 'CE7' || hasText(rawText, ['카페', '커피', '디저트', '베이커리', '전통찻집', '찻집'])) {
    return 'cafe';
  }

  if (original.main === 'FD6' || hasText(rawText, ['음식점', '맛집', '한식', '중식', '일식', '양식', '분식', '먹거리'])) {
    return 'food';
  }

  if (hasText(rawText, ['궁궐', '궁', '사찰', '절', '유적', '한옥', '전통', '문화재', '역사'])) {
    return 'history';
  }

  if (hasText(rawText, ['공원', '한강', '산책', '자연', '수목원', '숲', '둘레길'])) {
    return 'nature';
  }

  if (original.main === 'CT1' || hasText(rawText, ['미술관', '박물관', '전시', '공연', '극장', '문화시설', '갤러리'])) {
    return 'culture';
  }

  if (hasText(rawText, ['체험', '공방', '레포츠', '스포츠', '놀이', '테마파크', '방탈출', '클라이밍'])) {
    return 'activity';
  }

  if (hasText(rawText, ['시장', '쇼핑', '상점', '거리'])) {
    return hasText(rawText, ['전통시장', '전통']) ? 'history' : 'culture';
  }

  if (original.main === 'AT4') {
    return 'nature';
  }

  return 'unmapped';
};

export const normalizeTourApiCategory = (original: OriginalCategory): NormalizedCategory => {
  const rawText = [original.main, original.middle, original.detail, original.raw].filter(Boolean).join(' ');

  if (original.raw === '39' || original.main === 'A05') {
    return 'food';
  }

  if (hasText(rawText, ['궁궐', '궁', '사찰', '절', '유적', '한옥', '전통', '문화재', '역사'])) {
    return 'history';
  }

  if (original.raw === '14' || hasText(rawText, ['미술관', '박물관', '전시', '공연', '문화', '갤러리'])) {
    return 'culture';
  }

  if (original.raw === '28' || original.main === 'A03' || hasText(rawText, ['체험', '공방', '레포츠', '스포츠', '놀이'])) {
    return 'activity';
  }

  if (original.main === 'A01' || hasText(rawText, ['공원', '한강', '산책', '자연', '산', '숲', '수목원', '둘레길'])) {
    return 'nature';
  }

  if (original.raw === '12' || original.main === 'A02') {
    return 'nature';
  }

  if (original.raw === '15') {
    return 'activity';
  }

  if (original.raw === '38' || original.main === 'A04') {
    return hasText(rawText, ['전통시장', '전통']) ? 'history' : 'culture';
  }

  return 'unmapped';
};

export const inferIndoorOutdoor = (category: NormalizedCategory): 'indoor' | 'outdoor' | 'mixed' | 'unknown' => {
  if (category === 'cafe' || category === 'food' || category === 'culture') {
    return 'indoor';
  }

  if (category === 'nature') {
    return 'outdoor';
  }

  if (category === 'history' || category === 'activity') {
    return 'mixed';
  }

  return 'unknown';
};

export const categoryNormalizer = {
  normalizeKakaoCategory,
  normalizeTourApiCategory,
  inferIndoorOutdoor
};
