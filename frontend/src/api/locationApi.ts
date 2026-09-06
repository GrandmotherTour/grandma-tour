import { apiClient } from './client';

export const locationApi = {
  getCurrentLocation: async () => {
    return apiClient.get('/api/location/current');
  }
};
