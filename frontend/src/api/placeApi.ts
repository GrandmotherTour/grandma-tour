import { apiClient } from './client';

export type KakaoPlace = {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  lat: number | null;
  lng: number | null;
};

export const placeApi = {
  getPlaces: async (query: string, options: { latitude?: number; longitude?: number } = {}) => {
    const params = new URLSearchParams({ query });

    if (options.latitude !== undefined && options.longitude !== undefined) {
      params.set('latitude', String(options.latitude));
      params.set('longitude', String(options.longitude));
    }

    return apiClient.get<{ success: boolean; query: string; items: KakaoPlace[] }>(
      `/api/places?${params.toString()}`
    );
  }
};
