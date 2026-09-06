export const locationController = {
  getCurrentLocation: async (_req: any, res: any) => {
    res.json({
      success: true,
      data: {
        latitude: 37.5665,
        longitude: 126.978,
        address: '서울시 중구'
      }
    });
  }
};
