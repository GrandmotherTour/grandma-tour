import type { PreferenceTag } from './preference';

export type PlaceType = {
  id: string;
  name: string;
  category?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  categoryTags?: PreferenceTag[];
  source?: 'kakao' | 'tour' | 'manual';
  externalId?: string;
  imageUrl?: string;
};
