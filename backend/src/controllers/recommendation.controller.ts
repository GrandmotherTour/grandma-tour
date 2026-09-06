export const recommendationController = {
  createRecommendation: async (_req: any, res: any) => {
    res.json({
      success: true,
      message: 'Recommendation controller initialized'
    });
  }
};
