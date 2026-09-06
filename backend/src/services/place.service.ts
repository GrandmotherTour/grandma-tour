import { kakaoLocalApi } from '../external/kakao/kakaoLocal.api.js';

type KakaoPlaceDocument = {
  id?: string;
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
};

const toPlaceSearchItem = (item: KakaoPlaceDocument, index: number) => ({
  id: item.id || `${item.place_name || 'place'}-${index}`,
  name: item.place_name || '',
  address: item.address_name || '',
  roadAddress: item.road_address_name || '',
  lat: item.y ? Number(item.y) : null,
  lng: item.x ? Number(item.x) : null
});

export const placeService = {
  searchPlaces: async (query: string, options: { latitude?: number; longitude?: number } = {}) => {
    const result = await kakaoLocalApi.searchByKeyword(query, {
      y: options.latitude,
      x: options.longitude,
      radius: options.latitude !== undefined && options.longitude !== undefined ? 20_000 : undefined
    });

    return {
      query,
      items: (result.documents || []).map(toPlaceSearchItem)
    };
  }
};
