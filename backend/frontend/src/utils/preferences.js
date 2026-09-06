export const preferenceTags = [
  {
    key: 'cafe',
    label: '카페·디저트',
    shortLabel: '카페',
  },
  {
    key: 'food',
    label: '맛집·먹거리',
    shortLabel: '맛집',
  },
  {
    key: 'nature',
    label: '산책·자연',
    shortLabel: '자연',
  },
  {
    key: 'culture',
    label: '전시·문화',
    shortLabel: '문화',
  },
  {
    key: 'history',
    label: '역사·전통',
    shortLabel: '역사',
  },
  {
    key: 'activity',
    label: '체험·놀거리',
    shortLabel: '체험',
  },
];

export function createEmptySwipeResults() {
  return preferenceTags.reduce((acc, tag) => {
    acc[tag.key] = {
      likeCount: 0,
      dislikeCount: 0,
      skipCount: 0,
      exposureCount: 0,
    };
    return acc;
  }, {});
}

export function calculatePreferenceWeights(swipeResults) {
  return Object.entries(swipeResults).reduce((acc, [tag, result]) => {
    acc[tag] = (result.likeCount - result.dislikeCount) / (result.exposureCount + 1);
    return acc;
  }, {});
}
