export type PreferenceTag =
  | 'cafe'
  | 'food'
  | 'nature'
  | 'culture'
  | 'history'
  | 'activity';

export type UserPreferenceWeights = Record<PreferenceTag, number>;

export type SwipeAction = 'like' | 'skip' | 'dislike';

export type SwipeCard = {
  id: string;
  title: string;
  imageUrl?: string;
  tags: PreferenceTag[];
  source: 'kakao' | 'tour' | 'seoul';
  externalId?: string;
};

export type SwipeFeedback = {
  cardId: string;
  action: SwipeAction;
  tags: PreferenceTag[];
};

export type PreferenceStats = {
  exposureCount: number;
  likeCount: number;
  dislikeCount: number;
  preferenceWeight: number;
  strongReject: boolean;
};

export type PreferenceScoringResult = {
  weights: UserPreferenceWeights;
  stats: Record<PreferenceTag, PreferenceStats>;
  strongRejectTags: PreferenceTag[];
};
