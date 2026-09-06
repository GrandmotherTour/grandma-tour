export const routeService = {
  buildRoute: async (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) => {
    return {
      origin,
      destination,
      steps: []
    };
  }
};
