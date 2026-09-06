export const scoringService = {
  scorePlaces: async (items: unknown[]) => {
    return items.map((item, index) => ({
      item,
      score: 100 - index
    }));
  }
};
