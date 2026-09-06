import { env } from '../../config/env.js';

type KakaoSearchParams = Record<string, string | number | undefined>;

const KAKAO_LOCAL_BASE_URL = 'https://dapi.kakao.com/v2/local';

const emptyKakaoResult = {
  documents: [],
  meta: { total_count: 0, pageable_count: 0, is_end: true }
};

const requestKakaoLocal = async (path: string, params: KakaoSearchParams) => {
  if (!env.KAKAO_REST_API_KEY) {
    return emptyKakaoResult;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const response = await fetch(`${KAKAO_LOCAL_BASE_URL}${path}?${searchParams.toString()}`, {
    headers: {
      Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Kakao Local API failed with ${response.status}`);
  }

  return response.json();
};

export const kakaoLocalApi = {
  searchByKeyword: async (query: string, params: Omit<KakaoSearchParams, 'query'> = {}) => {
    return requestKakaoLocal('/search/keyword.json', {
      query,
      size: 15,
      ...params
    });
  },

  searchByCategory: async (categoryGroupCode: string, params: KakaoSearchParams = {}) => {
    return requestKakaoLocal('/search/category.json', {
      category_group_code: categoryGroupCode,
      size: 15,
      sort: 'distance',
      ...params
    });
  }
};
