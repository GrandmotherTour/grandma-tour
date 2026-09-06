import type { RecommendationRequest, RecommendationResponse } from '../types/recommendation';
import { apiClient } from './client';

export const recommendationApi = {
  getRecommendation: async (payload: RecommendationRequest) => {
    return apiClient.post<RecommendationResponse>('/api/recommendation', payload);
  }
};
