export const placesController = {
  getPlaces: async (_req: any, res: any) => {
    res.json({
      success: true,
      items: []
    });
  }
};
